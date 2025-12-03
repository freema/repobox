"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Job, JobOutput, JobStatus } from "@repobox/types";

interface JobStreamState {
  /** Current job status */
  status: JobStatus;
  /** Output lines received so far */
  lines: JobOutput[];
  /** Whether the stream is connected */
  isConnected: boolean;
  /** Whether the job has finished */
  isDone: boolean;
  /** Error message if any */
  error: string | null;
  /** Additional job metadata from status events */
  metadata: {
    startedAt?: number;
    finishedAt?: number;
    errorMessage?: string;
    linesAdded?: number;
    linesRemoved?: number;
    mrUrl?: string;
    branch?: string;
  };
}

interface UseJobStreamOptions {
  /** Initial job data (for SSR hydration) */
  initialJob?: Job;
  /** Initial output lines (for SSR hydration) */
  initialOutput?: JobOutput[];
  /** Maximum lines to keep in memory */
  maxLines?: number;
  /** Whether to auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
}

interface UseJobStreamReturn extends JobStreamState {
  /** Manually reconnect to the stream */
  reconnect: () => void;
  /** Disconnect from the stream */
  disconnect: () => void;
}

/**
 * Hook for subscribing to real-time job output via SSE
 */
export function useJobStream(
  jobId: string,
  options: UseJobStreamOptions = {}
): UseJobStreamReturn {
  const {
    initialJob,
    initialOutput = [],
    maxLines = 10000,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [state, setState] = useState<JobStreamState>({
    status: initialJob?.status ?? "pending",
    lines: initialOutput,
    isConnected: false,
    isDone: initialJob?.status === "success" || initialJob?.status === "failed" || initialJob?.status === "cancelled",
    error: null,
    metadata: {
      startedAt: initialJob?.startedAt,
      finishedAt: initialJob?.finishedAt,
      errorMessage: initialJob?.errorMessage,
      linesAdded: initialJob?.linesAdded,
      linesRemoved: initialJob?.linesRemoved,
      mrUrl: initialJob?.mrUrl,
      branch: initialJob?.branch,
    },
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    // Don't connect if job is already done
    if (state.isDone) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        isConnected: true,
        error: null,
      }));
    };

    es.addEventListener("status", (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          status: data.status,
          metadata: {
            startedAt: data.startedAt ?? prev.metadata.startedAt,
            finishedAt: data.finishedAt ?? prev.metadata.finishedAt,
            errorMessage: data.errorMessage ?? prev.metadata.errorMessage,
            linesAdded: data.linesAdded ?? prev.metadata.linesAdded,
            linesRemoved: data.linesRemoved ?? prev.metadata.linesRemoved,
            mrUrl: data.mrUrl ?? prev.metadata.mrUrl,
            branch: data.branch ?? prev.metadata.branch,
          },
        }));
      } catch {
        // Invalid JSON
      }
    });

    es.addEventListener("output", (event) => {
      if (!mountedRef.current) return;
      try {
        const line = JSON.parse(event.data) as JobOutput;
        setState((prev) => {
          const newLines = [...prev.lines, line];
          // Trim to max lines if needed
          if (newLines.length > maxLines) {
            return { ...prev, lines: newLines.slice(-maxLines) };
          }
          return { ...prev, lines: newLines };
        });
      } catch {
        // Invalid JSON
      }
    });

    es.addEventListener("done", (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          status: data.status,
          isDone: true,
          isConnected: false,
        }));
        es.close();
      } catch {
        // Invalid JSON
      }
    });

    es.addEventListener("error", (event) => {
      if (!mountedRef.current) return;
      // Check if this is a custom error event with data
      if (event instanceof MessageEvent && event.data) {
        try {
          const data = JSON.parse(event.data);
          setState((prev) => ({
            ...prev,
            error: data.message || "Stream error",
            isConnected: false,
          }));
        } catch {
          // Standard error event
        }
      }
    });

    es.onerror = () => {
      if (!mountedRef.current) return;

      setState((prev) => ({
        ...prev,
        isConnected: false,
      }));

      es.close();

      // Auto-reconnect if enabled and job not done
      if (autoReconnect && !state.isDone) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !state.isDone) {
            connect();
          }
        }, reconnectDelay);
      }
    };
  }, [jobId, maxLines, autoReconnect, reconnectDelay, state.isDone]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isConnected: false,
    }));
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true;

    // Only connect if job is not already done
    if (!state.isDone) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    reconnect,
    disconnect,
  };
}
