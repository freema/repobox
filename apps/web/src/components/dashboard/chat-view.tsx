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

// Shorten long paths from /tmp/repobox/sessions/.../repo/file to just file
function shortenPath(fullPath: string): string {
  const repoMatch = fullPath.match(/\/repo\/(.+)$/);
  if (repoMatch) return repoMatch[1];
  return fullPath.split("/").pop() || fullPath;
}

interface ToolCall {
  name: string;
  target: string;
  result?: string;
  isActive?: boolean;
  oldString?: string; // pro Edit diff
  newString?: string; // pro Edit diff
}

interface ConversationBlock {
  userPrompt: string;
  toolCalls: ToolCall[];
  responseText: string;
}

interface ParsedOutput {
  blocks: ConversationBlock[];
  errorLines: string[];
  internalLines: string[];
  currentAction: string | null;
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

// Check if a line is a runner internal line
function isRunnerInternalLine(line: JobOutput): boolean {
  const text = line.line.trim();
  return (
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
        text.startsWith("Push completed")))
  );
}

// Parse output lines into structured data with multiple conversation blocks
function parseOutput(lines: JobOutput[]): ParsedOutput {
  const blocks: ConversationBlock[] = [];
  const errorLines: string[] = [];
  const internalLines: string[] = [];
  let currentAction: string | null = null;

  // Current block state
  let currentBlock: ConversationBlock | null = null;
  let currentTool: ToolCall | null = null;
  let currentResponseLines: string[] = [];

  const finishCurrentBlock = () => {
    if (currentBlock) {
      // Save any pending tool
      if (currentTool) {
        currentBlock.toolCalls.push(currentTool);
        currentTool = null;
      }
      // Save response text
      currentBlock.responseText = currentResponseLines.join("\n");
      blocks.push(currentBlock);
      currentResponseLines = [];
    }
  };

  for (const line of lines) {
    const text = line.line.trim();
    if (!text) continue;

    // Check for runner internal lines
    if (isRunnerInternalLine(line)) {
      // Check if this starts a new prompt
      const promptMatch = text.match(/^Running prompt:\s*(.+)$/);
      if (promptMatch) {
        // Finish previous block if exists
        finishCurrentBlock();
        // Start new block
        currentBlock = {
          userPrompt: promptMatch[1],
          toolCalls: [],
          responseText: "",
        };
      }
      internalLines.push(text);
      continue;
    }

    // Stderr from Claude CLI goes to error lines
    if (line.stream === "stderr") {
      errorLines.push(text);
      continue;
    }

    // If no current block, skip Claude output (shouldn't happen)
    if (!currentBlock) continue;

    // Check for tool call patterns
    let isToolCall = false;
    for (const pattern of TOOL_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        // Save previous tool if exists
        if (currentTool) {
          currentBlock.toolCalls.push(currentTool);
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
      // Pro Edit tool zachytit ├─ (oldString) a └─ (newString)
      if (currentTool && currentTool.name === "Edit" && text.startsWith("├─")) {
        currentTool.oldString = text.replace(/^├─\s*/, "").trim();
        continue;
      }
      if (currentTool && currentTool.name === "Edit" && text.startsWith("└─") && !currentTool.newString) {
        currentTool.newString = text.replace(/^└─\s*/, "").trim();
        currentBlock.toolCalls.push(currentTool);
        currentTool = null;
        currentAction = null;
        continue;
      }
      // Check if this is a tool result (starts with └─) - pro ostatní tools
      if (currentTool && text.startsWith("└─")) {
        currentTool.result = text.replace(/^└─\s*/, "").trim();
        currentBlock.toolCalls.push(currentTool);
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
          currentBlock.toolCalls.push(currentTool);
          currentTool = null;
        }
        // Add to response lines
        currentResponseLines.push(text);
        currentAction = null;
      }
    }
  }

  // Finish the last block
  if (currentBlock) {
    if (currentTool) {
      currentTool.isActive = true; // Mark as active if it's the last one
      currentBlock.toolCalls.push(currentTool);
    }
    currentBlock.responseText = currentResponseLines.join("\n");
    blocks.push(currentBlock);
  }

  return {
    blocks,
    errorLines,
    internalLines,
    currentAction,
  };
}

// Color mapping for tool types
const TOOL_COLORS: Record<string, string> = {
  Read: "#3b82f6", // blue
  Edit: "#f97316", // orange
  Write: "#f97316", // orange
  Bash: "#22c55e", // green
  Glob: "#8b5cf6", // purple
  Grep: "#8b5cf6", // purple
  Search: "#8b5cf6", // purple
  Task: "#ec4899", // pink
  WebFetch: "#06b6d4", // cyan
  WebSearch: "#06b6d4", // cyan
  NotebookEdit: "#f97316", // orange
};

// DiffView Component - expandovatelný IDE-style diff
function DiffView({
  oldString,
  newString,
}: {
  oldString?: string;
  newString?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const oldLines = (oldString || "").split("\n");
  const newLines = (newString || "").split("\n");

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1 px-2 py-1 text-[11px] hover:bg-[var(--bg-hover)] transition-colors w-full text-left"
        style={{ color: "var(--text-muted)" }}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Show diff ({oldLines.length} removed, {newLines.length} added)
      </button>
    );
  }

  return (
    <div className="text-[11px] font-mono">
      <button
        onClick={() => setExpanded(false)}
        className="flex items-center gap-1 px-2 py-1 hover:bg-[var(--bg-hover)] transition-colors w-full text-left"
        style={{ color: "var(--text-muted)" }}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Hide diff
      </button>
      <div className="max-h-64 overflow-auto">
        {/* Removed lines */}
        {oldLines.map((line, i) => (
          <div
            key={`r${i}`}
            className="flex"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
          >
            <span
              className="w-8 text-right pr-2 select-none flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {i + 1}
            </span>
            <span className="w-4 flex-shrink-0" style={{ color: "#f87171" }}>
              -
            </span>
            <pre className="flex-1 whitespace-pre-wrap break-all" style={{ color: "#fca5a5" }}>
              {line || " "}
            </pre>
          </div>
        ))}
        {/* Added lines */}
        {newLines.map((line, i) => (
          <div
            key={`a${i}`}
            className="flex"
            style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
          >
            <span
              className="w-8 text-right pr-2 select-none flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {i + 1}
            </span>
            <span className="w-4 flex-shrink-0" style={{ color: "#4ade80" }}>
              +
            </span>
            <pre className="flex-1 whitespace-pre-wrap break-all" style={{ color: "#86efac" }}>
              {line || " "}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tool Call Block Component - minimalist design with status indicator
function ToolCallBlock({
  tool,
  isLast,
  isStreaming,
}: {
  tool: ToolCall;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const isRunning = isLast && isStreaming && !tool.result && !tool.newString;
  const hasResult = !!tool.result || !!tool.newString;
  const shortPath = shortenPath(tool.target);
  const color = TOOL_COLORS[tool.name] || "#6b7280";

  // Status: running = green pulsing, done = green, pending = gray
  const statusColor = isRunning || hasResult ? "#22c55e" : "#6b7280";

  return (
    <div
      className="text-xs rounded font-mono"
      style={{ backgroundColor: "var(--bg-tertiary)" }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 py-1.5 px-2">
        {/* Status indicator */}
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRunning ? "animate-pulse" : ""}`}
          style={{ backgroundColor: statusColor }}
        />
        <span className="font-medium" style={{ color }}>
          {tool.name}
        </span>
        <span
          className="truncate flex-1"
          style={{ color: "var(--text-muted)" }}
        >
          {shortPath}
        </span>
      </div>

      {/* Edit diff - expandovatelný IDE-style diff */}
      {tool.name === "Edit" && (tool.oldString || tool.newString) && (
        <DiffView oldString={tool.oldString} newString={tool.newString} />
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

// Single conversation block component (user prompt + Claude response)
function ConversationBlockView({
  block,
  user,
  isLast,
  isStreaming,
}: {
  block: ConversationBlock;
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  isLast: boolean;
  isStreaming: boolean;
}) {
  return (
    <>
      {/* User Prompt - Right aligned */}
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
                {(user?.name || user?.email || "U")?.[0]?.toUpperCase() || "U"}
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
            {block.userPrompt}
          </div>
        </div>
      </div>

      {/* Claude Response - Left aligned */}
      {(block.toolCalls.length > 0 || block.responseText) && (
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
              {/* Tool Calls */}
              {block.toolCalls.map((tool, i) => (
                <ToolCallBlock
                  key={i}
                  tool={tool}
                  isLast={isLast && i === block.toolCalls.length - 1}
                  isStreaming={isStreaming}
                />
              ))}

              {/* Response Text with Markdown */}
              {block.responseText && (
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
                    {block.responseText}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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

  if (parsed.blocks.length === 0 && lines.length === 0) {
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
        {/* Render all conversation blocks */}
        {parsed.blocks.map((block, index) => (
          <ConversationBlockView
            key={index}
            block={block}
            user={user}
            isLast={index === parsed.blocks.length - 1}
            isStreaming={isStreaming}
          />
        ))}

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
