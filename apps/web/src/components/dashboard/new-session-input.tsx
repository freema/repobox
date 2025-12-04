"use client";

import { useDashboard } from "@/contexts/dashboard-context";
import { PromptInput } from "./prompt-input";

export function NewSessionInput() {
  const { state, dispatch } = useDashboard();

  const handleSubmit = async () => {
    if (!state.selectedRepo) return;

    dispatch({ type: "START_CREATING_SESSION" });

    try {
      // Step 1: Create a new work session (clones the repo)
      const sessionResponse = await fetch("/api/work-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: state.selectedRepo.providerId,
          repoUrl: state.selectedRepo.url,
          repoName: state.selectedRepo.fullName,
          baseBranch: state.selectedRepo.defaultBranch,
        }),
      });

      if (!sessionResponse.ok) {
        const data = await sessionResponse.json();
        throw new Error(data.error || "Failed to create session");
      }

      const { session } = await sessionResponse.json();
      dispatch({ type: "CREATE_SESSION_SUCCESS", payload: session });

      // Step 2: If there's a prompt, submit it to the new session
      if (state.newSessionPrompt.trim()) {
        const promptResponse = await fetch(`/api/work-sessions/${session.id}/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: state.newSessionPrompt.trim(),
            environment: state.environment,
          }),
        });

        if (!promptResponse.ok) {
          console.error("Failed to submit initial prompt, but session was created");
        } else {
          const { session: updatedSession } = await promptResponse.json();
          dispatch({ type: "UPDATE_SESSION", payload: updatedSession });
        }
      }
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
            ? "Start a new session (optional: add a prompt)..."
            : "Select a repository first..."
        }
        compact={false}
      />
    </div>
  );
}
