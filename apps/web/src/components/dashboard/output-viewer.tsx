"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { JobOutput } from "@repobox/types";

interface OutputViewerProps {
  lines: JobOutput[];
  isStreaming?: boolean;
  isConnected?: boolean;
  error?: string | null;
  onReconnect?: () => void;
}

export function OutputViewer({
  lines,
  isStreaming = false,
  isConnected = false,
  error = null,
  onReconnect,
}: OutputViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastScrollTopRef = useRef(0);

  // Auto-scroll to bottom when new lines arrive (if enabled)
  useEffect(() => {
    if (containerRef.current && autoScroll && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll, isStreaming]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    // If user scrolled up, disable auto-scroll
    if (scrollTop < lastScrollTopRef.current && !isAtBottom) {
      setAutoScroll(false);
    }
    // If user scrolled to bottom, re-enable auto-scroll
    else if (isAtBottom) {
      setAutoScroll(true);
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  // Scroll to bottom button handler
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  if (lines.length === 0 && !isStreaming) {
    return (
      <div
        className="h-full flex items-center justify-center text-neutral-500 text-sm"
        data-testid="output-viewer-empty"
      >
        No output yet
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Output container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-xs bg-neutral-900 rounded-lg p-4"
        data-testid="output-viewer"
      >
        {lines.map((line, index) => (
          <div
            key={index}
            className={`whitespace-pre-wrap break-all leading-relaxed ${
              line.stream === "stderr" ? "text-red-400" : "text-neutral-300"
            }`}
          >
            {line.line}
          </div>
        ))}

        {/* Status indicators */}
        {isStreaming && (
          <div className="inline-flex items-center gap-2 text-neutral-500 mt-3 pt-2 border-t border-neutral-800">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"
              }`}
            />
            <span>{isConnected ? "Running..." : "Reconnecting..."}</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-3 pt-2 border-t border-neutral-800">
            <div className="flex items-center gap-2 text-red-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
              {onReconnect && (
                <button
                  onClick={onReconnect}
                  className="ml-2 text-blue-400 hover:text-blue-300 underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scroll to bottom button (shown when auto-scroll disabled) */}
      {!autoScroll && isStreaming && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 flex items-center gap-1 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded-full text-xs shadow-lg transition-colors"
          data-testid="scroll-to-bottom"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
          Follow output
        </button>
      )}
    </div>
  );
}
