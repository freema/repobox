"use client";

import { useDashboard } from "@/contexts/dashboard-context";
import { PromptInput } from "./prompt-input";

export function NewSessionInput() {
  const { state, dispatch } = useDashboard();

  const handleSubmit = async () => {
    if (!state.selectedRepo || !state.newSessionPrompt.trim()) return;

    dispatch({ type: "START_CREATING_SESSION" });

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: state.selectedRepo.providerId,
          repoUrl: state.selectedRepo.url,
          repoName: state.selectedRepo.fullName,
          branch: state.selectedRepo.defaultBranch,
          environment: state.environment,
          prompt: state.newSessionPrompt.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const job = await response.json();
      dispatch({ type: "CREATE_SESSION_SUCCESS", payload: job });
    } catch (error) {
      console.error("Failed to create session:", error);
      dispatch({ type: "FINISH_CREATING_SESSION" });
    }
  };

  return (
    <div
      className="p-4"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
      data-testid="new-session-input"
    >
      <PromptInput
        value={state.newSessionPrompt}
        onChange={(v) => dispatch({ type: "SET_NEW_PROMPT", payload: v })}
        onSubmit={handleSubmit}
        disabled={state.isCreatingSession || !state.selectedRepo}
        placeholder={
          state.selectedRepo
            ? "Ask Claude to write code..."
            : "Select a repository first..."
        }
        compact={false}
      />
    </div>
  );
}
