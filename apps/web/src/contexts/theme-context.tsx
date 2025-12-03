"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ThemeId = "dracula" | "monokai" | "gruvbox";

interface Theme {
  id: ThemeId;
  name: string;
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    borderSubtle: string;
    borderDefault: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accentPrimary: string;
    accentSecondary: string;
    success: string;
    successBg: string;
    diffAdd: string;
    diffRemove: string;
    error: string;
    errorBg: string;
    warning: string;
    warningBg: string;
  };
}

const THEMES: Record<ThemeId, Theme> = {
  dracula: {
    id: "dracula",
    name: "Dracula",
    colors: {
      bgPrimary: "#282a36",
      bgSecondary: "#21222c",
      bgTertiary: "#343746",
      bgHover: "#3d4051",
      borderSubtle: "#3d4051",
      borderDefault: "#4a4d5e",
      textPrimary: "#f8f8f2",
      textSecondary: "#6272a4",
      textMuted: "#6272a4",
      accentPrimary: "#bd93f9",
      accentSecondary: "#ff79c6",
      success: "#50fa7b",
      successBg: "rgba(80, 250, 123, 0.15)",
      diffAdd: "#50fa7b",
      diffRemove: "#ff5555",
      error: "#ff5555",
      errorBg: "rgba(255, 85, 85, 0.15)",
      warning: "#ffb86c",
      warningBg: "rgba(255, 184, 108, 0.15)",
    },
  },
  monokai: {
    id: "monokai",
    name: "Monokai",
    colors: {
      bgPrimary: "#272822",
      bgSecondary: "#1e1f1a",
      bgTertiary: "#3e3d32",
      bgHover: "#49483e",
      borderSubtle: "#3e3d32",
      borderDefault: "#4e4d42",
      textPrimary: "#f8f8f2",
      textSecondary: "#75715e",
      textMuted: "#75715e",
      accentPrimary: "#66d9ef",
      accentSecondary: "#f92672",
      success: "#a6e22e",
      successBg: "rgba(166, 226, 46, 0.15)",
      diffAdd: "#a6e22e",
      diffRemove: "#f92672",
      error: "#f92672",
      errorBg: "rgba(249, 38, 114, 0.15)",
      warning: "#e6db74",
      warningBg: "rgba(230, 219, 116, 0.15)",
    },
  },
  gruvbox: {
    id: "gruvbox",
    name: "Gruvbox",
    colors: {
      bgPrimary: "#282828",
      bgSecondary: "#1d2021",
      bgTertiary: "#3c3836",
      bgHover: "#504945",
      borderSubtle: "#3c3836",
      borderDefault: "#504945",
      textPrimary: "#ebdbb2",
      textSecondary: "#a89984",
      textMuted: "#a89984",
      accentPrimary: "#fe8019",
      accentSecondary: "#8ec07c",
      success: "#b8bb26",
      successBg: "rgba(184, 187, 38, 0.15)",
      diffAdd: "#b8bb26",
      diffRemove: "#fb4934",
      error: "#fb4934",
      errorBg: "rgba(251, 73, 52, 0.15)",
      warning: "#fabd2f",
      warningBg: "rgba(250, 189, 47, 0.15)",
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  themes: typeof THEMES;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "repobox-theme";
const DEFAULT_THEME: ThemeId = "dracula";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);

  // Load theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES[saved]) {
      setThemeId(saved);
    }
  }, []);

  // Apply theme CSS variables when theme changes
  useEffect(() => {
    const theme = THEMES[themeId];
    const root = document.documentElement;

    root.style.setProperty("--bg-primary", theme.colors.bgPrimary);
    root.style.setProperty("--bg-secondary", theme.colors.bgSecondary);
    root.style.setProperty("--bg-tertiary", theme.colors.bgTertiary);
    root.style.setProperty("--bg-hover", theme.colors.bgHover);
    root.style.setProperty("--border-subtle", theme.colors.borderSubtle);
    root.style.setProperty("--border-default", theme.colors.borderDefault);
    root.style.setProperty("--text-primary", theme.colors.textPrimary);
    root.style.setProperty("--text-secondary", theme.colors.textSecondary);
    root.style.setProperty("--text-muted", theme.colors.textMuted);
    root.style.setProperty("--accent-primary", theme.colors.accentPrimary);
    root.style.setProperty("--accent-secondary", theme.colors.accentSecondary);
    root.style.setProperty("--success", theme.colors.success);
    root.style.setProperty("--success-bg", theme.colors.successBg);
    root.style.setProperty("--diff-add", theme.colors.diffAdd);
    root.style.setProperty("--diff-remove", theme.colors.diffRemove);
    root.style.setProperty("--error", theme.colors.error);
    root.style.setProperty("--error-bg", theme.colors.errorBg);
    root.style.setProperty("--warning", theme.colors.warning);
    root.style.setProperty("--warning-bg", theme.colors.warningBg);

    // Update body background
    document.body.style.backgroundColor = theme.colors.bgPrimary;
  }, [themeId]);

  const setTheme = (id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: THEMES[themeId],
        themeId,
        setTheme,
        themes: THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export { THEMES };
