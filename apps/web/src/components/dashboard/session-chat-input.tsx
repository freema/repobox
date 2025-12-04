"use client";

import { useDashboard, getActiveSession } from "@/contexts/dashboard-context";
import { PromptInput } from "./prompt-input";

interface SessionChatInputProps {
  sessionId: string;
}

export function SessionChatInput({ sessionId }: SessionChatInputProps) {
  const { state, dispatch } = useDashboard();
  const activeSession = getActiveSession(state);

  // Don't allow prompts if session is not ready
  const canSubmit = activeSession?.status === "ready";

  // Get placeholder text based on session status
  const getPlaceholder = () => {
    if (!activeSession) return "No session selected...";
    switch (activeSession.status) {
      case "initializing":
        return "Setting up repository...";
      case "running":
        return "Running your prompt...";
      case "ready":
        return activeSession.jobCount > 0
          ? "Add another prompt or create PR..."
          : "Enter your first prompt...";
      default:
        return "Session not available...";
    }
  };

  const handleSubmit = async () => {
    if (!state.sessionReplyPrompt.trim() || !canSubmit) return;

    dispatch({ type: "START_SUBMITTING_REPLY" });

    try {
      const response = await fetch(`/api/work-sessions/${sessionId}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: state.sessionReplyPrompt.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit prompt");
      }

      const data = await response.json();

      // Update session status to running
      dispatch({ type: "UPDATE_SESSION", payload: data.session });
      dispatch({ type: "FINISH_SUBMITTING_REPLY" });
    } catch (error) {
      console.error("Failed to submit prompt:", error);
      dispatch({ type: "FINISH_SUBMITTING_REPLY" });
    }
  };

  return (
    <div className="flex-1" data-testid="session-chat-input">
      <PromptInput
        value={state.sessionReplyPrompt}
        onChange={(v) => dispatch({ type: "SET_REPLY_PROMPT", payload: v })}
        onSubmit={handleSubmit}
        disabled={state.isSubmittingReply || !canSubmit}
        placeholder={getPlaceholder()}
        compact
      />
    </div>
  );
}
