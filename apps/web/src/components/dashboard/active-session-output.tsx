"use client";

import { useState, useEffect } from "react";
import type { WorkSession, JobOutput } from "@repobox/types";
import { useWorkSessionStream } from "@/hooks";
import { useDashboard } from "@/contexts/dashboard-context";
import { OutputViewer } from "./output-viewer";
import { ChatView } from "./chat-view";

interface ActiveSessionOutputProps {
  session: WorkSession;
  viewMode: "chat" | "terminal";
}

export function ActiveSessionOutput({ session, viewMode }: ActiveSessionOutputProps) {
  const { dispatch } = useDashboard();
  const [initialOutput, setInitialOutput] = useState<JobOutput[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Fetch initial output on mount
  useEffect(() => {
    setIsLoadingInitial(true);

    fetch(`/api/work-sessions/${session.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load session");
        return res.json();
      })
      .then((data) => {
        setInitialOutput(data.output || []);
      })
      .catch((err) => {
        console.error("Failed to load initial output:", err);
      })
      .finally(() => {
        setIsLoadingInitial(false);
      });
  }, [session.id]);

  const { status, lines, isConnected, isDone, error, reconnect, metadata } =
    useWorkSessionStream(session.id, {
      initialSession: session,
      initialOutput,
    });

  // Update session in context when status changes
  useEffect(() => {
    if (status !== session.status) {
      dispatch({
        type: "UPDATE_SESSION",
        payload: {
          ...session,
          status,
          jobCount: metadata.jobCount ?? session.jobCount,
          totalLinesAdded: metadata.totalLinesAdded ?? session.totalLinesAdded,
          totalLinesRemoved: metadata.totalLinesRemoved ?? session.totalLinesRemoved,
          errorMessage: metadata.errorMessage ?? session.errorMessage,
          mrUrl: metadata.mrUrl ?? session.mrUrl,
          mrWarning: metadata.mrWarning ?? session.mrWarning,
        },
      });
    }
  }, [status, metadata, session, dispatch]);

  const isStreaming = status === "initializing" || status === "running";

  if (isLoadingInitial) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (viewMode === "chat") {
    return (
      <ChatView
        session={session}
        lines={lines}
        isStreaming={isStreaming}
        isConnected={isConnected}
      />
    );
  }

  return (
    <OutputViewer
      lines={lines}
      isStreaming={isStreaming}
      isConnected={isConnected}
      error={error}
      onReconnect={!isDone ? reconnect : undefined}
    />
  );
}
