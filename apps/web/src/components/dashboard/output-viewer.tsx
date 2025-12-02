"use client";

import { useRef, useEffect } from "react";
import type { JobOutput } from "@repobox/types";

interface OutputViewerProps {
  lines: JobOutput[];
  isStreaming?: boolean;
}

export function OutputViewer({ lines, isStreaming = false }: OutputViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, isStreaming]);

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
    <div
      ref={containerRef}
      className="h-full overflow-y-auto font-mono text-xs bg-neutral-900 rounded-lg p-4"
      data-testid="output-viewer"
    >
      {lines.map((line, index) => (
        <div
          key={index}
          className={`whitespace-pre-wrap break-all ${
            line.stream === "stderr" ? "text-red-400" : "text-neutral-300"
          }`}
        >
          {line.line}
        </div>
      ))}
      {isStreaming && (
        <div className="inline-flex items-center gap-1 text-neutral-500 mt-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Running...</span>
        </div>
      )}
    </div>
  );
}
