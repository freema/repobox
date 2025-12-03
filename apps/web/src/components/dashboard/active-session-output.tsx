"use client";

import { useState, useEffect } from "react";
import type { Job, JobOutput } from "@repobox/types";
import { useJobStream } from "@/hooks";
import { OutputViewer } from "./output-viewer";

interface ActiveSessionOutputProps {
  session: Job;
}

export function ActiveSessionOutput({ session }: ActiveSessionOutputProps) {
  const [initialOutput, setInitialOutput] = useState<JobOutput[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Fetch initial output on mount
  useEffect(() => {
    setIsLoadingInitial(true);

    fetch(`/api/jobs/${session.id}/output`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load output");
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

  const { status, lines, isConnected, isDone, error, reconnect } = useJobStream(
    session.id,
    {
      initialJob: session,
      initialOutput,
    }
  );

  const isStreaming = status === "running" || status === "pending";

  if (isLoadingInitial) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
      </div>
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
