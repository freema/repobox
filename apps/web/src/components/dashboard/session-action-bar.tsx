"use client";

import { useState } from "react";
import type { Job } from "@repobox/types";
import { SessionChatInput } from "./session-chat-input";

interface SessionActionBarProps {
  session: Job;
}

export function SessionActionBar({ session }: SessionActionBarProps) {
  const [isCreatingPR, setIsCreatingPR] = useState(false);

  const canCreatePR = session.status === "success" && !session.mrUrl;
  const hasPR = session.status === "success" && session.mrUrl;

  const handleCreatePR = async () => {
    if (!canCreatePR) return;

    setIsCreatingPR(true);
    try {
      // TODO: Implement PR creation endpoint
      console.log("Creating PR for session:", session.id);
    } catch (error) {
      console.error("Failed to create PR:", error);
    } finally {
      setIsCreatingPR(false);
    }
  };

  return (
    <div
      className="shrink-0 border-t border-neutral-800 bg-neutral-900/50 p-3"
      data-testid="session-action-bar"
    >
      <div className="flex items-end gap-3">
        {/* Session chat input */}
        <SessionChatInput sessionId={session.id} />

        {/* Create PR button - shown when job succeeded without MR */}
        {canCreatePR && (
          <button
            type="button"
            onClick={handleCreatePR}
            disabled={isCreatingPR}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="create-pr-button"
          >
            {isCreatingPR ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
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
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Create PR
              </>
            )}
          </button>
        )}

        {/* View PR button - shown when MR exists */}
        {hasPR && (
          <a
            href={session.mrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
            data-testid="view-pr-button"
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View PR
          </a>
        )}
      </div>
    </div>
  );
}
