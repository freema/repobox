"use client";

import Link from "next/link";
import { useDashboard } from "@/contexts/dashboard-context";
import { RepositorySelector } from "./repository-selector";
import { EnvironmentSelector } from "./environment-selector";
import { SessionTabs } from "./session-tabs";
import { SessionList } from "./session-list";
import { UserProfileSection } from "./user-profile-section";
import { UserProfileModal } from "./user-profile-modal";
import { NewSessionInput } from "./new-session-input";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface LeftPanelProps {
  user: User;
}

export function LeftPanel({ user }: LeftPanelProps) {
  const { state, dispatch } = useDashboard();

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--bg-secondary)" }}
      data-testid="left-panel"
    >
      {/* Header with logo */}
      <div
        className="shrink-0 h-12 flex items-center px-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <Link
          href="/"
          className="flex items-center hover:opacity-80 transition-opacity"
          data-testid="logo-link"
        >
          <span className="font-bold text-lg tracking-tight" style={{ color: "var(--text-primary)" }}>
            Repobox
          </span>
        </Link>
        <span
          className="ml-2 text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-muted)",
          }}
        >
          Research preview
        </span>
      </div>

      {/* New session input */}
      <NewSessionInput />

      {/* Repository and Environment selectors */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex gap-3">
          <div className="flex-1">
            <RepositorySelector
              value={state.selectedRepo?.id ?? null}
              onChange={(id, repo) =>
                dispatch({ type: "SET_SELECTED_REPO", payload: repo })
              }
            />
          </div>
          <div className="w-32">
            <EnvironmentSelector
              value={state.environment}
              onChange={(env) =>
                dispatch({ type: "SET_ENVIRONMENT", payload: env })
              }
            />
          </div>
        </div>
      </div>

      {/* Sessions header with dropdown filter */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Sessions
        </h2>
        <SessionTabs />
      </div>

      {/* Sessions list - scrollable */}
      <SessionList />

      {/* Bottom: User profile */}
      <UserProfileSection user={user} />

      {/* User profile modal */}
      <UserProfileModal user={user} />
    </div>
  );
}
