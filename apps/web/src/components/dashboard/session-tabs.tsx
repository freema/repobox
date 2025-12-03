"use client";

import { useState } from "react";
import { useDashboard, type SessionFilter } from "@/contexts/dashboard-context";

const FILTERS: { id: SessionFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "all", label: "All" },
];

export function SessionTabs() {
  const { state, dispatch } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);

  const currentFilter = FILTERS.find((f) => f.id === state.sessionFilter) || FILTERS[0];

  return (
    <div className="relative" data-testid="session-tabs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-sm transition-colors"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
      >
        <span>{currentFilter.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-1 rounded-lg shadow-lg overflow-hidden min-w-24"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  dispatch({ type: "SET_SESSION_FILTER", payload: filter.id });
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm transition-colors"
                style={{
                  backgroundColor: state.sessionFilter === filter.id ? "var(--bg-hover)" : "transparent",
                  color: state.sessionFilter === filter.id ? "var(--text-primary)" : "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  if (state.sessionFilter !== filter.id) {
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (state.sessionFilter !== filter.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                data-testid={`session-filter-${filter.id}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
