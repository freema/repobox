"use client";

import { useState } from "react";
import type { WorkSession } from "@repobox/types";
import { useDashboard } from "@/contexts/dashboard-context";
import { SessionChatInput } from "./session-chat-input";

interface SessionActionBarProps {
  session: WorkSession;
}

export function SessionActionBar({ session }: SessionActionBarProps) {
  const { dispatch } = useDashboard();
  const [isPushing, setIsPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Terminal states - no more actions possible
  const isTerminal = session.status === "pushed" || session.status === "archived" || session.status === "failed";

  // Can show input when not in terminal state
  const showInput = !isTerminal;

  // Can push when session is ready and has at least one completed prompt
  const canPush = session.status === "ready" && session.jobCount > 0;

  // Has MR link to show
  const hasMR = session.status === "pushed" && session.mrUrl;

  const handlePush = async () => {
    if (!canPush) return;

    setIsPushing(true);
    setPushError(null);

    try {
      const response = await fetch(`/api/work-sessions/${session.id}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Changes from session ${session.id.slice(0, 8)}`,
          description: `Automated changes from ${session.jobCount} prompt(s)`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to push changes");
      }

      const data = await response.json();
      dispatch({ type: "UPDATE_SESSION", payload: data.session });
    } catch (error) {
      console.error("Failed to push:", error);
      setPushError(error instanceof Error ? error.message : "Failed to push");
    } finally {
      setIsPushing(false);
    }
  };

  // Don't show action bar for terminal states without MR
  if (isTerminal && !hasMR) {
    return null;
  }

  return (
    <div
      className="shrink-0 border-t p-3"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-secondary)",
      }}
      data-testid="session-action-bar"
    >
      {pushError && (
        <div
          className="mb-3 px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: "var(--error-bg)",
            color: "var(--error)",
            border: "1px solid var(--error)",
          }}
        >
          {pushError}
        </div>
      )}

      {/* MR warning if present */}
      {session.mrWarning && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded text-xs mb-3"
          style={{
            backgroundColor: "var(--warning-bg)",
            color: "var(--warning)",
            border: "1px solid var(--warning)",
          }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {session.mrWarning}
        </div>
      )}

      {/* Branch + Create PR row */}
      {(canPush || hasMR) && (
        <div
          className="flex items-center gap-2 mb-3 rounded-lg overflow-hidden"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {/* Branch name */}
          <div
            className="flex-1 px-3 py-2 text-sm font-mono truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {session.workBranch}
          </div>

          {/* Create PR button */}
          {canPush && (
            <button
              type="button"
              onClick={handlePush}
              disabled={isPushing}
              className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--bg-hover)",
                color: "var(--text-primary)",
                borderLeft: "1px solid var(--border-subtle)",
              }}
              data-testid="push-button"
            >
              {isPushing ? (
                <>
                  <div
                    className="w-3.5 h-3.5 rounded-full animate-spin"
                    style={{
                      border: "2px solid var(--text-muted)",
                      borderTopColor: "transparent",
                    }}
                  />
                  Creating...
                </>
              ) : (
                <>
                  Create PR
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </>
              )}
            </button>
          )}

          {/* View MR button - shown when MR exists */}
          {hasMR && (
            <a
              href={session.mrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--success)",
                color: "var(--bg-primary)",
              }}
              data-testid="view-mr-button"
            >
              View PR
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      )}

      {/* Reply input */}
      {showInput && <SessionChatInput sessionId={session.id} />}
    </div>
  );
}
