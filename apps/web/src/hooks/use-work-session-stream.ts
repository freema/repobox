"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WorkSession, WorkSessionStatus, JobOutput } from "@repobox/types";

interface WorkSessionStreamState {
  /** Current session status */
  status: WorkSessionStatus;
  /** Output lines received so far */
  lines: JobOutput[];
  /** Whether the stream is connected */
  isConnected: boolean;
  /** Whether the session has finished (terminal state) */
  isDone: boolean;
  /** Error message if any */
  error: string | null;
  /** Session metadata from status events */
  metadata: {
    jobCount?: number;
    totalLinesAdded?: number;
    totalLinesRemoved?: number;
    errorMessage?: string;
    lastJobStatus?: string;
    mrUrl?: string;
    mrWarning?: string;
    lastActivityAt?: number;
  };
}

interface UseWorkSessionStreamOptions {
  /** Initial session data (for SSR hydration) */
  initialSession?: WorkSession;
  /** Initial output lines (for SSR hydration) */
  initialOutput?: JobOutput[];
  /** Maximum lines to keep in memory */
  maxLines?: number;
  /** Whether to auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
}

interface UseWorkSessionStreamReturn extends WorkSessionStreamState {
  /** Manually reconnect to the stream */
  reconnect: () => void;
  /** Disconnect from the stream */
  disconnect: () => void;
}

const TERMINAL_STATUSES: WorkSessionStatus[] = ["pushed", "archived", "failed"];

/**
 * Hook for subscribing to real-time work session output via SSE
 */
export function useWorkSessionStream(
  sessionId: string,
  options: UseWorkSessionStreamOptions = {}
): UseWorkSessionStreamReturn {
  const {
    initialSession,
    initialOutput = [],
    maxLines = 10000,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [state, setState] = useState<WorkSessionStreamState>({
    status: initialSession?.status ?? "initializing",
    lines: initialOutput,
    isConnected: false,
    isDone: initialSession
      ? TERMINAL_STATUSES.includes(initialSession.status)
      : false,
    error: null,
    metadata: {
      jobCount: initialSession?.jobCount,
      totalLinesAdded: initialSession?.totalLinesAdded,
      totalLinesRemoved: initialSession?.totalLinesRemoved,
      errorMessage: initialSession?.errorMessage,
      lastJobStatus: initialSession?.lastJobStatus,
      mrUrl: initialSession?.mrUrl,
      mrWarning: initialSession?.mrWarning,
      lastActivityAt: initialSession?.lastActivityAt,
    },
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    // Don't connect if session is already done
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

    const es = new EventSource(`/api/work-sessions/${sessionId}/stream`);
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
        const newStatus = data.status as WorkSessionStatus;
        const isDone = TERMINAL_STATUSES.includes(newStatus);

        setState((prev) => ({
          ...prev,
          status: newStatus,
          isDone,
          metadata: {
            jobCount: data.jobCount ?? prev.metadata.jobCount,
            totalLinesAdded: data.totalLinesAdded ?? prev.metadata.totalLinesAdded,
            totalLinesRemoved: data.totalLinesRemoved ?? prev.metadata.totalLinesRemoved,
            errorMessage: data.errorMessage ?? prev.metadata.errorMessage,
            lastJobStatus: data.lastJobStatus ?? prev.metadata.lastJobStatus,
            mrUrl: data.mrUrl ?? prev.metadata.mrUrl,
            mrWarning: data.mrWarning ?? prev.metadata.mrWarning,
            lastActivityAt: data.lastActivityAt ?? prev.metadata.lastActivityAt,
          },
        }));

        // Close connection if session is done
        if (isDone) {
          es.close();
        }
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

      // Auto-reconnect if enabled and session not done
      if (autoReconnect && !state.isDone) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !state.isDone) {
            connect();
          }
        }, reconnectDelay);
      }
    };
  }, [sessionId, maxLines, autoReconnect, reconnectDelay, state.isDone]);

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

    // Only connect if session is not already done
    if (!state.isDone) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    reconnect,
    disconnect,
  };
}
