"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Job } from "@repobox/types";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { LeftPanel } from "@/components/dashboard/left-panel";
import { RightPanel } from "@/components/dashboard/right-panel";

const STORAGE_KEY = "repobox-left-panel-width";
const DEFAULT_WIDTH = 40;
const MIN_WIDTH = 20;
const MAX_WIDTH = 60;

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardClientProps {
  initialJobs: Job[];
  user: User;
}

export function DashboardClient({ initialJobs, user }: DashboardClientProps) {
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
      <DashboardProvider initialJobs={initialJobs}>
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
            className="w-1 cursor-col-resize transition-colors"
            style={{
              backgroundColor: isDragging ? "var(--accent-primary)" : "var(--border-subtle)",
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={(e) => {
              if (!isDragging) e.currentTarget.style.backgroundColor = "var(--border-default)";
            }}
            onMouseLeave={(e) => {
              if (!isDragging) e.currentTarget.style.backgroundColor = "var(--border-subtle)";
            }}
          />

          {/* Right Panel */}
          <RightPanel />
        </div>
      </DashboardProvider>
    </ThemeProvider>
  );
}
