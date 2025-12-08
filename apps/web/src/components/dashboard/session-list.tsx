"use client";

import { useEffect, useRef, useCallback } from "react";
import { useDashboard } from "@/contexts/dashboard-context";
import { SessionCard } from "./session-card";

const PAGE_SIZE = 20;

export function SessionList() {
  const { state, dispatch } = useDashboard();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter sessions based on current filter
  const filteredSessions = state.sessions.filter((session) => {
    if (state.sessionFilter === "all") return true;
    // "active" filter shows non-terminal sessions
    return (
      session.status === "initializing" ||
      session.status === "ready" ||
      session.status === "running"
    );
  });

  // Load more sessions
  const loadMoreSessions = useCallback(async () => {
    if (state.isLoadingSessions || !state.hasMoreSessions) return;

    dispatch({ type: "SET_LOADING_SESSIONS", payload: true });

    try {
      const offset = state.sessions.length;
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
        filter: state.sessionFilter,
      });

      const response = await fetch(`/api/work-sessions?${params}`);
      if (!response.ok) throw new Error("Failed to load sessions");

      const data = await response.json();

      dispatch({ type: "APPEND_SESSIONS", payload: data.sessions });
      dispatch({ type: "SET_HAS_MORE_SESSIONS", payload: data.hasMore });
      dispatch({ type: "INCREMENT_SESSIONS_PAGE" });
    } catch (error) {
      console.error("Failed to load more sessions:", error);
    } finally {
      dispatch({ type: "SET_LOADING_SESSIONS", payload: false });
    }
  }, [state.isLoadingSessions, state.hasMoreSessions, state.sessions.length, state.sessionFilter, dispatch]);

  // Load sessions when filter changes (sessions are cleared on filter change)
  useEffect(() => {
    if (state.sessions.length === 0 && state.hasMoreSessions && !state.isLoadingSessions) {
      loadMoreSessions();
    }
  }, [state.sessionFilter, state.sessions.length, state.hasMoreSessions, state.isLoadingSessions, loadMoreSessions]);

  // Intersection observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreSessions();
        }
      },
      { threshold: 0.1 }
    );

    const target = loadMoreRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => observer.disconnect();
  }, [loadMoreSessions]);

  const handleSessionClick = (sessionId: string) => {
    dispatch({ type: "SET_ACTIVE_SESSION", payload: sessionId });
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0" data-testid="session-list">
      {filteredSessions.length === 0 ? (
        <div
          className="px-3 py-8 text-center text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {state.sessions.length === 0 ? "No sessions yet" : "No matching sessions"}
        </div>
      ) : (
        <>
          {filteredSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isActive={session.id === state.activeSessionId}
              onClick={() => handleSessionClick(session.id)}
            />
          ))}

          {/* Lazy load trigger */}
          <div ref={loadMoreRef} className="h-4 flex items-center justify-center">
            {state.isLoadingSessions && (
              <div
                className="w-4 h-4 rounded-full animate-spin"
                style={{
                  border: "2px solid var(--border-default)",
                  borderTopColor: "var(--text-secondary)",
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
