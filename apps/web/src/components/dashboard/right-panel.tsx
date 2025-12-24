"use client";

import React from "react";
import { useDashboard, getActiveSession } from "@/contexts/dashboard-context";
import { StatusBadge } from "./status-badge";
import { ActiveSessionOutput } from "./active-session-output";
import { SessionActionBar } from "./session-action-bar";
import { QuickStart } from "./quick-start";

// Cute box mascot with hover animation - runs away from cursor
function CuteBoxMascot() {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!wrapperRef.current || !svgRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Calculate direction away from mouse
    const deltaX = centerX - mouseX;
    const deltaY = centerY - mouseY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxMove = 20;

    if (distance > 0) {
      const moveX = (deltaX / distance) * maxMove;
      const moveY = (deltaY / distance) * maxMove;
      svgRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`;
    }
  };

  const handleMouseLeave = () => {
    if (svgRef.current) {
      svgRef.current.style.transform = "translate(0, 0)";
    }
    setIsHovered(false);
  };

  return (
    <div
      ref={wrapperRef}
      className="cute-box-wrapper"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        width: "120px",
        height: "100px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes leg-left {
          0%, 50% { transform: translateY(0); }
          25% { transform: translateY(-4px); }
          75% { transform: translateY(-4px); }
        }
        @keyframes leg-right {
          0%, 50% { transform: translateY(-4px); }
          25% { transform: translateY(0); }
          75% { transform: translateY(0); }
        }
        @keyframes body-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
      <svg
        ref={svgRef}
        width="66"
        height="52"
        viewBox="0 0 66 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transition: "transform 0.08s ease-out" }}
      >
        {/* Legs */}
        <rect
          className="leg-1"
          x="10" y="46" width="8" height="6"
          fill="var(--accent-primary)"
          style={{ animation: isHovered ? "leg-left 0.15s infinite" : "none" }}
        />
        <rect
          className="leg-2"
          x="22" y="46" width="8" height="6"
          fill="var(--accent-primary)"
          style={{ animation: isHovered ? "leg-right 0.15s infinite" : "none" }}
        />
        <rect
          className="leg-3"
          x="36" y="46" width="8" height="6"
          fill="var(--accent-primary)"
          style={{ animation: isHovered ? "leg-right 0.15s infinite" : "none" }}
        />
        <rect
          className="leg-4"
          x="48" y="46" width="8" height="6"
          fill="var(--accent-primary)"
          style={{ animation: isHovered ? "leg-left 0.15s infinite" : "none" }}
        />

        <g className="body" style={{ animation: isHovered ? "body-bounce 0.15s infinite" : "none" }}>
          {/* Box body */}
          <rect x="6" y="13" width="54" height="33" fill="var(--accent-primary)"/>

          {/* Box lid flaps */}
          <rect x="0" y="6" width="18" height="7" fill="var(--accent-secondary)"/>
          <rect x="24" y="6" width="18" height="7" fill="var(--accent-secondary)"/>
          <rect x="48" y="6" width="18" height="7" fill="var(--accent-secondary)"/>

          {/* Top flaps */}
          <rect x="6" y="0" width="12" height="6" fill="var(--accent-primary)"/>
          <rect x="27" y="0" width="12" height="6" fill="var(--accent-primary)"/>
          <rect x="48" y="0" width="12" height="6" fill="var(--accent-primary)"/>

          {/* Eyes - normal or scared based on hover */}
          {!isHovered ? (
            <>
              <rect x="18" y="24" width="8" height="8" fill="var(--bg-primary)"/>
              <rect x="40" y="24" width="8" height="8" fill="var(--bg-primary)"/>
            </>
          ) : (
            <>
              <rect x="15" y="20" width="12" height="14" fill="var(--bg-primary)"/>
              <rect x="39" y="20" width="12" height="14" fill="var(--bg-primary)"/>
              {/* Pupils looking away */}
              <rect x="17" y="22" width="4" height="4" fill="var(--accent-primary)"/>
              <rect x="45" y="22" width="4" height="4" fill="var(--accent-primary)"/>
            </>
          )}

          {/* Mouth - normal or scared based on hover */}
          {!isHovered ? (
            <rect x="29" y="38" width="8" height="4" fill="var(--bg-primary)"/>
          ) : (
            <rect x="26" y="36" width="14" height="8" fill="var(--bg-primary)"/>
          )}
        </g>
      </svg>
    </div>
  );
}

export function RightPanel() {
  const { state, dispatch } = useDashboard();
  const activeSession = getActiveSession(state);
  const [viewMode, setViewMode] = React.useState<"chat" | "terminal">("chat");

  // Empty state when no session is selected
  if (!activeSession) {
    return (
      <div
        className="flex-1 flex flex-col h-full items-center justify-center relative dotted-bg"
        style={{ backgroundColor: "var(--bg-primary)" }}
        data-testid="right-panel"
      >
        <div className="flex flex-col items-center z-10">
          {/* Cute Box Mascot */}
          <div className="mb-4">
            <CuteBoxMascot />
          </div>

          {/* Quick Start Section */}
          <QuickStart />
        </div>
      </div>
    );
  }

  const isStreaming =
    activeSession.status === "initializing" || activeSession.status === "running";

  // Compute effective status - show "failed" if session has error even if status is "ready"
  const hasError = !!activeSession.errorMessage || activeSession.lastJobStatus === "failed";
  const effectiveStatus = (activeSession.status === "ready" && hasError) ? "failed" : activeSession.status;

  return (
    <div
      className="flex-1 flex flex-col h-full dotted-bg"
      style={{ backgroundColor: "var(--bg-primary)" }}
      data-testid="right-panel"
    >
      {/* Session header with status */}
      <header
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <h1
            className="text-sm font-semibold truncate flex-1"
            style={{ color: "var(--text-primary)" }}
            data-testid="session-title"
          >
            {activeSession.repoName}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle: Chat / Terminal */}
            <div
              className="flex items-center rounded-md p-0.5"
              style={{ backgroundColor: "var(--bg-tertiary)" }}
            >
              <button
                type="button"
                onClick={() => setViewMode("chat")}
                className="p-1.5 rounded transition-colors"
                style={{
                  backgroundColor: viewMode === "chat" ? "var(--bg-hover)" : "transparent",
                  color: viewMode === "chat" ? "var(--text-primary)" : "var(--text-muted)",
                }}
                title="Chat view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("terminal")}
                className="p-1.5 rounded transition-colors"
                style={{
                  backgroundColor: viewMode === "terminal" ? "var(--bg-hover)" : "transparent",
                  color: viewMode === "terminal" ? "var(--text-primary)" : "var(--text-muted)",
                }}
                title="Terminal view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
            </div>

            {isStreaming && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Live
              </span>
            )}
            <StatusBadge status={effectiveStatus} />

            {/* Close button */}
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_ACTIVE_SESSION", payload: null })}
              className="p-1.5 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
              title="Close session"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Error message if failed */}
      {hasError && activeSession.errorMessage && (
        <div
          className="shrink-0 mx-4 mt-4 p-3 rounded-lg"
          style={{
            backgroundColor: "var(--error-bg)",
            border: "1px solid var(--error)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--diff-remove)" }}>
            {activeSession.errorMessage}
          </p>
        </div>
      )}

      {/* MR warning if creation had issues */}
      {activeSession.status === "pushed" && activeSession.mrWarning && (
        <div
          className="shrink-0 mx-4 mt-4 p-3 rounded-lg"
          style={{
            backgroundColor: "var(--warning-bg)",
            border: "1px solid var(--warning)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--warning)" }}>
            {activeSession.mrWarning}
          </p>
        </div>
      )}

      {/* Output viewer - takes remaining space */}
      <div className="flex-1 min-h-0 p-4">
        <ActiveSessionOutput key={activeSession.id} session={activeSession} viewMode={viewMode} />
      </div>

      {/* Bottom action bar */}
      <SessionActionBar session={activeSession} />
    </div>
  );
}

