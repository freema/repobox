"use client";

import { useDashboard } from "@/contexts/dashboard-context";
import { RepositorySelector } from "./repository-selector";
import { EnvironmentSelector } from "./environment-selector";

interface QuickPromptCard {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const QUICK_PROMPTS: QuickPromptCard[] = [
  {
    title: "Write a CLAUDE.md",
    subtitle: "Create or update my CLAUDE.md file",
    icon: (
      <div
        className="text-xs font-mono p-2 rounded"
        style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
      >
        <div style={{ color: "var(--accent-primary)" }}># Claude</div>
        <div>Thoughtful AI</div>
        <div>Answers Flow</div>
        <div>Learning</div>
      </div>
    ),
  },
  {
    title: "Fix a small todo",
    subtitle: "Search for a TODO comment and fix it",
    icon: null,
  },
  {
    title: "Improve test coverage",
    subtitle: "Recommend areas to improve our tests",
    icon: (
      <div
        className="text-xs font-mono p-2 rounded"
        style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
      >
        <div>src/</div>
        <div className="pl-2">
          <span style={{ color: "var(--success)" }}>+</span> auth.js
        </div>
        <div className="pl-2">
          <span style={{ color: "var(--warning)" }}>~</span> utils.js
        </div>
        <div className="pl-2">
          <span style={{ color: "var(--error)" }}>x</span> api.js
        </div>
      </div>
    ),
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
            {card.icon && (
              <div className="shrink-0">{card.icon}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
