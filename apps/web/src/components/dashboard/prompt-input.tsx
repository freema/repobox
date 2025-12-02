"use client";

import { useState, useRef, useEffect } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask Repobox to write code...",
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

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

  return (
    <div
      className={`relative bg-neutral-800 rounded-xl border transition-colors ${
        isFocused ? "border-neutral-600 ring-1 ring-neutral-600" : "border-neutral-700"
      }`}
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
        className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder-neutral-500 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-700">
        <div className="text-xs text-neutral-500">
          <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded text-neutral-400">⌘</kbd>
          <span className="mx-1">+</span>
          <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded text-neutral-400">↵</kbd>
          <span className="ml-2">to send</span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !isValid}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-neutral-900 rounded-lg text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
