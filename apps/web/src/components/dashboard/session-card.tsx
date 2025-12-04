"use client";

import { useState } from "react";
import type { WorkSession } from "@repobox/types";
import { StatusBadge } from "./status-badge";
import { useDashboard } from "@/contexts/dashboard-context";

interface SessionCardProps {
  session: WorkSession;
  isActive?: boolean;
  onClick?: () => void;
}

export function SessionCard({ session, isActive = false, onClick }: SessionCardProps) {
  const { dispatch } = useDashboard();
  const [isHovered, setIsHovered] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const timeAgo = formatTimeAgo(session.createdAt);

  // Can archive non-terminal sessions (not already archived/pushed)
  const canArchive = session.status !== "archived" && session.status !== "pushed";

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isArchiving || !canArchive) return;

    setIsArchiving(true);
    try {
      const response = await fetch(`/api/work-sessions/${session.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        dispatch({ type: "ARCHIVE_SESSION", payload: session.id });
      }
    } catch (error) {
      console.error("Failed to archive session:", error);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div
      className="w-full text-left p-3 rounded-lg transition-all duration-150 relative group cursor-pointer"
      style={{
        backgroundColor: isActive ? "var(--bg-hover)" : "transparent",
        border: isActive ? "1px solid var(--border-default)" : "1px solid transparent",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        setIsHovered(true);
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
          e.currentTarget.style.borderColor = "var(--border-subtle)";
        }
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
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
          {session.repoName}
        </p>
        <div className="flex items-center gap-1.5">
          {/* Archive button - shows on hover */}
          {isHovered && canArchive && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={isArchiving}
              className="p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-muted)" }}
              title="Archive session"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </button>
          )}
          <StatusBadge status={session.status} size="sm" />
        </div>
      </div>
      <div
        className="flex items-center gap-2 text-xs font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        <span className="truncate">{session.workBranch}</span>
        <span>•</span>
        <span>{timeAgo}</span>
      </div>
      {session.status === "pushed" && session.mrUrl && (
        <div className="mt-1.5 flex items-center gap-2 text-xs font-mono">
          <span style={{ color: "var(--diff-add)" }}>
            +{session.totalLinesAdded}
          </span>
          <span style={{ color: "var(--diff-remove)" }}>
            -{session.totalLinesRemoved}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: "var(--success-bg)",
              color: "var(--success)",
              border: "1px solid var(--success)",
            }}
          >
            ✓ Merged
          </span>
        </div>
      )}
      {session.status === "failed" && session.errorMessage && (
        <p
          className="mt-1.5 text-xs truncate"
          style={{ color: "var(--diff-remove)" }}
        >
          {session.errorMessage}
        </p>
      )}
    </div>
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
