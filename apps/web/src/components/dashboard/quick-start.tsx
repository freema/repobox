"use client";

import { useDashboard } from "@/contexts/dashboard-context";
import { RepositorySelector } from "./repository-selector";
import { EnvironmentSelector } from "./environment-selector";

interface QuickPromptCard {
  title: string;
  subtitle: string;
  metrics: React.ReactNode;
}

// Animated scanning indicator
function ScanningIndicator() {
  return (
    <div className="text-xs font-mono space-y-1">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: "var(--warning)" }}
        />
        <span style={{ color: "var(--text-muted)" }}>Scanning...</span>
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        Found: <span style={{ color: "var(--text-primary)" }}>3</span> issues
      </div>
      <div style={{ color: "var(--success)" }}>+ Fixing...</div>
    </div>
  );
}

// Test results indicator
function TestResultsIndicator() {
  return (
    <div className="text-xs font-mono space-y-0.5">
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--success)" }}>PASS</span>
        <span style={{ color: "var(--success)" }}>✓</span>
        <span style={{ color: "var(--text-primary)" }}>12</span>
      </div>
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--error)" }}>FAIL</span>
        <span style={{ color: "var(--error)" }}>×</span>
        <span style={{ color: "var(--text-muted)" }}>0</span>
      </div>
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--text-muted)" }}>SKIP</span>
        <span style={{ color: "var(--text-muted)" }}>○</span>
        <span style={{ color: "var(--text-muted)" }}>1</span>
      </div>
    </div>
  );
}

const QUICK_PROMPTS: QuickPromptCard[] = [
  {
    title: "Find and fix a bug",
    subtitle: "Search the codebase for common bug patterns, error-prone code, or FIXME comments and fix one",
    metrics: <ScanningIndicator />,
  },
  {
    title: "Refactor complex code",
    subtitle: "Find a function or component that's overly complex and refactor it for clarity while maintaining the same behavior",
    metrics: null,
  },
  {
    title: "Write a missing test",
    subtitle: "Find an untested function or component and write comprehensive tests for it",
    metrics: <TestResultsIndicator />,
  },
];

export function QuickStart() {
  const { state, dispatch } = useDashboard();

  const handleCardClick = (prompt: string) => {
    dispatch({ type: "SET_NEW_PROMPT", payload: prompt });
    // Focus will be handled by the input component
  };

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Repository and Environment selectors */}
      <div className="flex gap-3 mb-8">
        <div className="flex-1">
          <RepositorySelector
            value={state.selectedRepo?.id ?? null}
            onChange={(id, repo) =>
              dispatch({ type: "SET_SELECTED_REPO", payload: repo })
            }
          />
        </div>
        <div className="w-32">
          <EnvironmentSelector
            value={state.environment}
            onChange={(env) =>
              dispatch({ type: "SET_ENVIRONMENT", payload: env })
            }
          />
        </div>
      </div>

      {/* Quick Prompt Cards */}
      <div className="space-y-3">
        {QUICK_PROMPTS.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => handleCardClick(card.title)}
            className="w-full text-left p-4 rounded-lg transition-all duration-200 flex items-start justify-between gap-4"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div className="flex-1">
              <h3
                className="font-medium mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                {card.title}
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {card.subtitle}
              </p>
            </div>
            {card.metrics && (
              <div className="shrink-0">{card.metrics}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
