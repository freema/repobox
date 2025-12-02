"use client";

import { useState } from "react";

type ProviderType = "gitlab" | "github";

interface ProviderFormProps {
  onSuccess?: () => void;
}

export function ProviderForm({ onSuccess }: ProviderFormProps) {
  const [type, setType] = useState<ProviderType>("gitlab");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultUrls: Record<ProviderType, string> = {
    gitlab: "https://gitlab.com",
    github: "https://github.com",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/git-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          url: url || defaultUrls[type],
          token,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || "Failed to add provider");
      }

      // Reset form
      setToken("");
      setUrl("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Provider Type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="type"
              value="gitlab"
              checked={type === "gitlab"}
              onChange={() => setType("gitlab")}
              className="text-orange-500 focus:ring-orange-500"
            />
            <span className="text-gray-200">GitLab</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="type"
              value="github"
              checked={type === "github"}
              onChange={() => setType("github")}
              className="text-orange-500 focus:ring-orange-500"
            />
            <span className="text-gray-200">GitHub</span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-1">
          Instance URL <span className="text-gray-500">(optional, for self-hosted)</span>
        </label>
        <input
          type="url"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={defaultUrls[type]}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="token" className="block text-sm font-medium text-gray-300 mb-1">
          Personal Access Token
        </label>
        <input
          type="password"
          id="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          placeholder={type === "gitlab" ? "glpat-xxxxxxxxxxxx" : "ghp_xxxxxxxxxxxx"}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          {type === "gitlab" ? (
            <>
              Required scope: <code className="text-orange-400">api</code>
            </>
          ) : (
            <>
              Required permissions: <code className="text-orange-400">repo</code>,{" "}
              <code className="text-orange-400">read:user</code>
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-red-300 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !token}
        className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
      >
        {isSubmitting ? "Verifying..." : "Add Provider"}
      </button>
    </form>
  );
}
