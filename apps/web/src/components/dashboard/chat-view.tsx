"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { JobOutput, WorkSession } from "@repobox/types";
import { useDashboard } from "@/contexts/dashboard-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface ChatViewProps {
  session: WorkSession;
  lines: JobOutput[];
  isStreaming?: boolean;
  isConnected?: boolean;
}

// Tool call patterns from Claude Code stream-json output
const TOOL_PATTERNS = [
  /^(Read|Write|Edit|Bash|Glob|Grep|Task|WebFetch|WebSearch|Search|NotebookEdit)\s+(.+)/i,
];

interface ToolCall {
  name: string;
  target: string;
  result?: string;
  isActive?: boolean;
}

interface ParsedOutput {
  userPrompt: string | null;
  toolCalls: ToolCall[];
  responseText: string;
  errorLines: string[];
  internalLines: string[];
  currentAction: string | null;
}

// Get icon for tool type
function getToolIcon(name: string): string {
  const icons: Record<string, string> = {
    Read: "📖",
    Edit: "✏️",
    Write: "✏️",
    Grep: "🔍",
    Glob: "🔍",
    Search: "🔍",
    Bash: "⚡",
    WebFetch: "🌐",
    WebSearch: "🌐",
    Task: "📋",
    NotebookEdit: "📓",
  };
  return icons[name] || "🔧";
}

// Get action verb for streaming indicator
function getActionVerb(toolName: string): string {
  switch (toolName.toLowerCase()) {
    case "read":
      return "reading";
    case "edit":
    case "write":
      return "editing";
    case "grep":
    case "glob":
    case "search":
      return "searching";
    case "bash":
      return "running";
    case "webfetch":
    case "websearch":
      return "fetching";
    case "task":
      return "processing";
    default:
      return "processing";
  }
}

// Parse output lines into structured data
function parseOutput(lines: JobOutput[]): ParsedOutput {
  const toolCalls: ToolCall[] = [];
  const responseLines: string[] = [];
  const errorLines: string[] = [];
  const internalLines: string[] = [];
  let userPrompt: string | null = null;
  let currentAction: string | null = null;

  let currentTool: ToolCall | null = null;

  for (const line of lines) {
    const text = line.line.trim();
    if (!text) continue;

    // Lines marked as runner internal
    const isRunnerLine =
      line.source === "runner" ||
      (!line.source &&
        (text.startsWith("Cloning") ||
          text.startsWith("Clone completed") ||
          text.startsWith("Creating branch") ||
          text.startsWith("Work session ready") ||
          text.startsWith("Running prompt:") ||
          text.startsWith("Starting AI agent") ||
          text.startsWith("Agent exited") ||
          text.startsWith("Claude session:") ||
          text.startsWith("Claude completed") ||
          text.startsWith("Claude error") ||
          text.startsWith("Error:") ||
          text.startsWith("Committing") ||
          text.startsWith("No changes") ||
          text.startsWith("Changes committed") ||
          text.startsWith("Prompt completed") ||
          text.startsWith("Pushing") ||
          text.startsWith("Push completed")));

    if (isRunnerLine) {
      // Extract user prompt from "Running prompt: X"
      const promptMatch = text.match(/^Running prompt:\s*(.+)$/);
      if (promptMatch) {
        userPrompt = promptMatch[1];
      }
      internalLines.push(text);
      continue;
    }

    // Stderr from Claude CLI goes to error lines
    if (line.stream === "stderr") {
      errorLines.push(text);
      continue;
    }

    // Check for tool call patterns
    let isToolCall = false;
    for (const pattern of TOOL_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        // Save previous tool if exists
        if (currentTool) {
          toolCalls.push(currentTool);
        }

        currentTool = {
          name: match[1],
          target: match[2] || "",
        };
        currentAction = `${getActionVerb(match[1])} ${match[2]}`;
        isToolCall = true;
        break;
      }
    }

    if (!isToolCall) {
      // Check if this is a tool result (starts with └─)
      if (currentTool && text.startsWith("└─")) {
        currentTool.result = text.replace(/^└─\s*/, "").trim();
        toolCalls.push(currentTool);
        currentTool = null;
        currentAction = null;
      } else if (
        currentTool &&
        (text.startsWith("├") || text.startsWith("  "))
      ) {
        // Continuation of tool output - skip
      } else {
        // Save any pending tool
        if (currentTool) {
          toolCalls.push(currentTool);
          currentTool = null;
        }
        // Add to response lines
        responseLines.push(text);
        currentAction = null;
      }
    }
  }

  // Don't forget the last tool
  if (currentTool) {
    currentTool.isActive = true; // Mark as active if it's the last one
    toolCalls.push(currentTool);
  }

  // Join response lines into markdown text
  const responseText = responseLines.join("\n");

  return {
    userPrompt,
    toolCalls,
    responseText,
    errorLines,
    internalLines,
    currentAction,
  };
}

// Tool Call Block Component
function ToolCallBlock({
  tool,
  isLast,
  isStreaming,
}: {
  tool: ToolCall;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const isActive = isLast && isStreaming && !tool.result;
  const icon = getToolIcon(tool.name);

  return (
    <div
      className="rounded-lg p-2 my-1 transition-all"
      style={{
        backgroundColor: "var(--bg-tertiary)",
        border: isActive
          ? "1px solid var(--accent)"
          : "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 text-sm font-mono">
        <span>{icon}</span>
        <span className="font-medium" style={{ color: "var(--accent)" }}>
          {tool.name}
        </span>
        <span
          className="truncate flex-1"
          style={{ color: "var(--text-muted)" }}
        >
          {tool.target}
        </span>
        {isActive && (
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        )}
      </div>
      {tool.result && (
        <div
          className="mt-1 text-xs pl-6 truncate"
          style={{ color: "var(--text-muted)" }}
        >
          └─ {tool.result}
        </div>
      )}
    </div>
  );
}

// Markdown components for syntax highlighting
const markdownComponents = {
  code({
    inline,
    className,
    children,
    ...props
  }: {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    if (!inline && match) {
      return (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          customStyle={{
            borderRadius: "8px",
            margin: "8px 0",
            fontSize: "13px",
          }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      );
    }

    return (
      <code
        className="px-1.5 py-0.5 rounded text-sm"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--accent)",
        }}
        {...props}
      >
        {children}
      </code>
    );
  },
  p({ children }: { children?: React.ReactNode }) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
  ul({ children }: { children?: React.ReactNode }) {
    return <ul className="list-disc pl-4 mb-2">{children}</ul>;
  },
  ol({ children }: { children?: React.ReactNode }) {
    return <ol className="list-decimal pl-4 mb-2">{children}</ol>;
  },
  li({ children }: { children?: React.ReactNode }) {
    return <li className="mb-1">{children}</li>;
  },
  h1({ children }: { children?: React.ReactNode }) {
    return <h1 className="text-lg font-bold mb-2">{children}</h1>;
  },
  h2({ children }: { children?: React.ReactNode }) {
    return <h2 className="text-base font-bold mb-2">{children}</h2>;
  },
  h3({ children }: { children?: React.ReactNode }) {
    return <h3 className="text-sm font-bold mb-1">{children}</h3>;
  },
  blockquote({ children }: { children?: React.ReactNode }) {
    return (
      <blockquote
        className="border-l-2 pl-3 my-2 italic"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-secondary)",
        }}
      >
        {children}
      </blockquote>
    );
  },
};

export function ChatView({
  session,
  lines,
  isStreaming = false,
  isConnected = false,
}: ChatViewProps) {
  const { state } = useDashboard();
  const user = state.user;

  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastScrollTopRef = useRef(0);
  const [showInternal, setShowInternal] = useState(false);

  // Parse output into structured data
  const parsed = useMemo(() => parseOutput(lines), [lines]);

  // Get prompt - prefer extracted from internal logs, fallback to session
  const prompt = parsed.userPrompt || session.prompts?.[0] || "";

  // Check if there's an error - only from actual error signals, not text content
  const hasError =
    parsed.errorLines.length > 0 ||
    session.lastJobStatus === "failed" ||
    !!session.errorMessage;

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current && autoScroll && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll, isStreaming]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (scrollTop < lastScrollTopRef.current && !isAtBottom) {
      setAutoScroll(false);
    } else if (isAtBottom) {
      setAutoScroll(true);
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  if (!prompt && lines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
        No output yet
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* User Prompt - Right aligned with prominent styling */}
        {prompt && (
          <div className="flex justify-end">
            <div className="max-w-[85%] space-y-2">
              <div
                className="flex items-center justify-end gap-2 text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {user?.name || "User"}
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-[var(--accent)]"
                  />
                ) : (
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{ backgroundColor: "var(--accent)", color: "white" }}
                  >
                    {(user?.name || user?.email || "U")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div
                className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-md"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)",
                  color: "white",
                }}
              >
                {prompt}
              </div>
            </div>
          </div>
        )}

        {/* Claude Response - Left aligned */}
        {(parsed.toolCalls.length > 0 || parsed.responseText) && (
          <div className="flex justify-start">
            <div className="max-w-[85%] space-y-2">
              <div
                className="flex items-center gap-2 text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{
                    background:
                      "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  }}
                >
                  <svg
                    className="w-3.5 h-3.5 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                  </svg>
                </span>
                Claude
              </div>

              <div className="space-y-2">
                {/* Inline Tool Calls */}
                {parsed.toolCalls.map((tool, i) => (
                  <ToolCallBlock
                    key={i}
                    tool={tool}
                    isLast={i === parsed.toolCalls.length - 1}
                    isStreaming={isStreaming}
                  />
                ))}

                {/* Response Text with Markdown */}
                {parsed.responseText && (
                  <div
                    className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm prose prose-sm max-w-none"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {parsed.responseText}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Streaming indicator with action description */}
        {isStreaming && (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}
            />
            <span>
              {isConnected
                ? parsed.currentAction
                  ? `Claude is ${parsed.currentAction}...`
                  : "Processing..."
                : "Reconnecting..."}
            </span>
          </div>
        )}

        {/* Internal logs - Full width, Collapsible */}
        {parsed.internalLines.length > 0 && (
          <div
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              onClick={() => setShowInternal(!showInternal)}
              className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              <svg
                className={`w-3 h-3 transition-transform ${showInternal ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Internal Logs ({parsed.internalLines.length})
            </button>

            {showInternal && (
              <div
                className="px-3 pb-3 text-xs font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {parsed.internalLines.map((line, i) => (
                  <div key={i} className="py-0.5">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error output from Claude CLI */}
        {parsed.errorLines.length > 0 && (
          <div
            className="rounded-lg p-4 text-sm space-y-1"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--error)",
            }}
          >
            <div className="flex items-center gap-2 font-medium mb-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Error
            </div>
            {parsed.errorLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {/* Error indicator (when no specific error lines) */}
        {hasError && !isStreaming && parsed.errorLines.length === 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "var(--error)",
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Task completed with errors
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && isStreaming && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs shadow-lg transition-colors"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
          Follow
        </button>
      )}
    </div>
  );
}
