"use client";

import { useDashboard } from "@/contexts/dashboard-context";
import { PromptInput } from "./prompt-input";

interface SessionChatInputProps {
  sessionId: string;
}

export function SessionChatInput({ sessionId }: SessionChatInputProps) {
  const { state, dispatch } = useDashboard();

  const handleSubmit = async () => {
    if (!state.sessionReplyPrompt.trim()) return;

    dispatch({ type: "START_SUBMITTING_REPLY" });

    try {
      // TODO: Implement session refinement API
      // For now, we'll just log it
      console.log("Refining session:", sessionId, state.sessionReplyPrompt);

      // This would call the refinement endpoint
      // const response = await fetch(`/api/jobs/${sessionId}/refine`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ prompt: state.sessionReplyPrompt.trim() }),
      // });

      dispatch({ type: "FINISH_SUBMITTING_REPLY" });
    } catch (error) {
      console.error("Failed to refine session:", error);
      dispatch({ type: "FINISH_SUBMITTING_REPLY" });
    }
  };

  return (
    <div className="flex-1" data-testid="session-chat-input">
      <PromptInput
        value={state.sessionReplyPrompt}
        onChange={(v) => dispatch({ type: "SET_REPLY_PROMPT", payload: v })}
        onSubmit={handleSubmit}
        disabled={state.isSubmittingReply}
        placeholder="Reply..."
        compact
      />
    </div>
  );
}
