"use client";

import { useState, useRef, useEffect } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask Repobox to write code...",
  compact = false,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const maxHeight = compact ? 80 : 200;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [value, compact]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  const isValid = value.trim().length > 0;

  if (compact) {
    return (
      <div
        className="relative rounded-lg flex items-center transition-all duration-200"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: `1px solid ${isFocused ? "var(--accent-primary)" : "var(--border-default)"}`,
          boxShadow: isFocused
            ? "0 0 0 3px rgba(167, 139, 250, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.3)"
            : "inset 0 1px 2px rgba(0, 0, 0, 0.3)",
        }}
        data-testid="prompt-input"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent px-3 py-2 text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
          style={{
            color: "var(--text-primary)",
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !isValid}
          className="shrink-0 p-2 mr-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ color: "var(--text-muted)" }}
          data-testid="prompt-submit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-lg transition-all duration-200"
      style={{
        backgroundColor: "var(--bg-tertiary)",
        border: `1px solid ${isFocused ? "var(--accent-primary)" : "var(--border-default)"}`,
        boxShadow: isFocused
          ? "0 0 0 3px rgba(167, 139, 250, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.3)"
          : "inset 0 1px 2px rgba(0, 0, 0, 0.3)",
      }}
      data-testid="prompt-input"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-transparent px-4 py-3 text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ color: "var(--text-primary)" }}
      />
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          <kbd
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: "var(--bg-hover)",
              color: "var(--text-secondary)",
            }}
          >
            Cmd
          </kbd>
          <span className="mx-1">+</span>
          <kbd
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: "var(--bg-hover)",
              color: "var(--text-secondary)",
            }}
          >
            Enter
          </kbd>
          <span className="ml-2">to send</span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !isValid}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isValid && !disabled ? "var(--accent-primary)" : "var(--bg-hover)",
            color: isValid && !disabled ? "#0d0d0d" : "var(--text-muted)",
          }}
          data-testid="prompt-submit"
        >
          Send
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
