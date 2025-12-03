"use client";

import { useState } from "react";
import { useTheme, type ThemeId } from "@/contexts/theme-context";

export function ThemeSwitcher() {
  const { themeId, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themeList = Object.values(themes);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg transition-colors"
        title="Change theme"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--text-muted)";
        }}
        data-testid="theme-switcher-button"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className="absolute bottom-full left-0 mb-2 z-20 rounded-lg shadow-lg overflow-hidden min-w-36"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div
              className="px-3 py-2 text-xs font-medium"
              style={{
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              Theme
            </div>
            {themeList.map((theme) => (
              <button
                key={theme.id}
                onClick={() => {
                  setTheme(theme.id as ThemeId);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                style={{
                  backgroundColor: themeId === theme.id ? "var(--bg-hover)" : "transparent",
                  color: themeId === theme.id ? "var(--text-primary)" : "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  if (themeId !== theme.id) {
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (themeId !== theme.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                data-testid={`theme-option-${theme.id}`}
              >
                {/* Color preview dots - accent colors only */}
                <div className="flex gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.colors.accentPrimary }}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.colors.accentSecondary }}
                  />
                </div>
                <span>{theme.name}</span>
                {themeId === theme.id && (
                  <svg
                    className="w-4 h-4 ml-auto"
                    style={{ color: "var(--accent-primary)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
