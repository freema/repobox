"use client";

import type { Job } from "@repobox/types";
import { StatusBadge } from "./status-badge";

interface SessionCardProps {
  job: Job;
  isActive?: boolean;
  onClick?: () => void;
}

export function SessionCard({ job, isActive = false, onClick }: SessionCardProps) {
  const timeAgo = formatTimeAgo(job.createdAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg transition-all duration-150"
      style={{
        backgroundColor: isActive ? "var(--bg-hover)" : "transparent",
        border: isActive ? "1px solid var(--border-default)" : "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
          e.currentTarget.style.borderColor = "var(--border-subtle)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }
      }}
      data-testid="session-card"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p
          className="text-sm font-medium truncate flex-1"
          style={{ color: "var(--text-primary)" }}
        >
          {job.prompt}
        </p>
        <StatusBadge status={job.status} showLabel={false} />
      </div>
      <div
        className="flex items-center gap-2 text-xs font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        <span className="truncate">{job.repoName}</span>
        <span>•</span>
        <span>{timeAgo}</span>
      </div>
      {job.status === "success" && job.mrUrl && (
        <div className="mt-1.5 flex items-center gap-2 text-xs font-mono">
          <span style={{ color: "var(--diff-add)" }}>
            +{job.linesAdded}
          </span>
          <span style={{ color: "var(--diff-remove)" }}>
            -{job.linesRemoved}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: "var(--success-bg)",
              color: "var(--success)",
              border: "1px solid var(--success)",
            }}
          >
            Merged
          </span>
        </div>
      )}
      {job.status === "failed" && job.errorMessage && (
        <p
          className="mt-1.5 text-xs truncate"
          style={{ color: "var(--diff-remove)" }}
        >
          {job.errorMessage}
        </p>
      )}
    </button>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
