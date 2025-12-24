"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WorkSession } from "@repobox/types";
import { DashboardProvider, useDashboard } from "@/contexts/dashboard-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { LeftPanel } from "@/components/dashboard/left-panel";
import { RightPanel } from "@/components/dashboard/right-panel";

// Sync activeSessionId with URL
function UrlSync() {
  const { state, dispatch } = useDashboard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  // On mount - set active session from URL
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const sessionId = searchParams.get("session");
    if (sessionId && !state.activeSessionId) {
      dispatch({ type: "SET_ACTIVE_SESSION", payload: sessionId });
    }
  }, [searchParams, state.activeSessionId, dispatch]);

  // Update URL when active session changes
  useEffect(() => {
    const currentParam = searchParams.get("session");
    if (state.activeSessionId !== currentParam) {
      if (state.activeSessionId) {
        router.replace(`/?session=${state.activeSessionId}`, { scroll: false });
      } else if (currentParam) {
        router.replace("/", { scroll: false });
      }
    }
  }, [state.activeSessionId, searchParams, router]);

  return null;
}

const STORAGE_KEY = "repobox-left-panel-width";
const DEFAULT_WIDTH = 40;
const MIN_WIDTH = 20;
const MAX_WIDTH = 60;

interface DashboardClientProps {
  initialSessions: WorkSession[];
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardClient({ initialSessions, user }: DashboardClientProps) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved width from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setLeftWidth(parsed);
      }
    }
  }, []);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem(STORAGE_KEY, leftWidth.toString());
    }
  }, [leftWidth, isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setLeftWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <ThemeProvider>
      <DashboardProvider initialSessions={initialSessions} user={user}>
        <UrlSync />
        <div
          ref={containerRef}
          className="h-full flex"
          data-testid="dashboard-page"
        >
          {/* Left Panel */}
          <div
            className="h-full flex flex-col"
            style={{
              width: `${leftWidth}%`,
              borderRight: "1px solid var(--border-subtle)",
            }}
          >
            <LeftPanel user={user} />
          </div>

          {/* Resizable divider */}
          <div
            className="cursor-col-resize transition-all duration-150 hover:w-1"
            style={{
              width: isDragging ? "4px" : "1px",
              backgroundColor: isDragging ? "var(--accent-primary)" : "var(--border-subtle)",
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={(e) => {
              if (!isDragging) {
                e.currentTarget.style.backgroundColor = "var(--border-default)";
                e.currentTarget.style.width = "4px";
              }
            }}
            onMouseLeave={(e) => {
              if (!isDragging) {
                e.currentTarget.style.backgroundColor = "var(--border-subtle)";
                e.currentTarget.style.width = "1px";
              }
            }}
          />

          {/* Right Panel */}
          <RightPanel />
        </div>
      </DashboardProvider>
    </ThemeProvider>
  );
}
