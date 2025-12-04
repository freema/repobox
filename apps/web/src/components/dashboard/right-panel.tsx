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
  const { state } = useDashboard();
  const activeSession = getActiveSession(state);

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
            {isStreaming && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Live
              </span>
            )}
            <StatusBadge status={activeSession.status} />
          </div>
        </div>
      </header>

      {/* Error message if failed */}
      {activeSession.status === "failed" && activeSession.errorMessage && (
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
        <ActiveSessionOutput key={activeSession.id} session={activeSession} />
      </div>

      {/* Bottom action bar */}
      <SessionActionBar session={activeSession} />
    </div>
  );
}

