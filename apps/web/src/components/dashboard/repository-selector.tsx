"use client";

import { useState, useEffect } from "react";
import { ProviderModal } from "@/components/git-providers";
import type { Repository } from "@/contexts/dashboard-context";

interface RepositorySelectorProps {
  value: string | null;
  onChange: (repoId: string | null, repo: Repository | null) => void;
}

export function RepositorySelector({ value, onChange }: RepositorySelectorProps) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showProviderModal, setShowProviderModal] = useState(false);

  useEffect(() => {
    fetchRepositories();
  }, []);

  async function fetchRepositories() {
    try {
      setLoading(true);
      const res = await fetch("/api/repositories");
      if (!res.ok) throw new Error("Failed to load repositories");
      const data = await res.json();
      setRepositories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const selectedRepo = repositories.find((r) => r.id === value);
  const filteredRepos = repositories.filter(
    (r) =>
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div
        className="h-10 rounded-lg animate-pulse"
        style={{ backgroundColor: "var(--bg-tertiary)" }}
        data-testid="repo-selector-loading"
      />
    );
  }

  if (error) {
    return (
      <div
        className="h-10 rounded-lg flex items-center px-3 text-sm"
        style={{
          backgroundColor: "var(--error-bg)",
          border: "1px solid var(--error)",
          color: "var(--diff-remove)",
        }}
      >
        {error}
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <>
        <div className="relative" data-testid="repository-selector-empty">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full h-10 rounded-lg px-3 text-left flex items-center justify-between text-sm transition-colors"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            <span>Select repository...</span>
            <svg
              className="w-4 h-4"
              style={{ color: "var(--text-muted)" }}
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
                className="absolute z-20 w-full mt-1 rounded-lg shadow-lg overflow-hidden"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div
                  className="px-3 py-3 text-sm text-center"
                  style={{
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  No repositories available
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowProviderModal(true);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                  style={{ color: "var(--accent-primary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Git Provider
                </button>
              </div>
            </>
          )}
        </div>

        <ProviderModal
          isOpen={showProviderModal}
          onClose={() => setShowProviderModal(false)}
          onSuccess={fetchRepositories}
        />
      </>
    );
  }

  return (
    <div className="relative" data-testid="repository-selector">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 rounded-lg px-3 text-left flex items-center justify-between text-sm transition-colors"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-default)",
        }}
      >
        <span
          className="font-mono truncate"
          style={{ color: selectedRepo ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {selectedRepo ? selectedRepo.fullName : "Select repository..."}
        </span>
        <svg
          className="w-4 h-4 shrink-0 ml-2"
          style={{ color: "var(--text-muted)" }}
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
            className="absolute z-20 w-full mt-1 rounded-lg shadow-lg max-h-64 overflow-hidden"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="p-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repositories..."
                className="w-full rounded px-3 py-1.5 text-sm focus:outline-none"
                style={{
                  backgroundColor: "var(--bg-hover)",
                  color: "var(--text-primary)",
                  border: "none",
                }}
                autoFocus
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filteredRepos.length === 0 ? (
                <div
                  className="px-3 py-4 text-sm text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  No repositories found
                </div>
              ) : (
                filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => {
                      onChange(repo.id, repo);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{
                      backgroundColor: repo.id === value ? "var(--bg-hover)" : "transparent",
                      color: repo.id === value ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                    onMouseEnter={(e) => {
                      if (repo.id !== value) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      if (repo.id !== value) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }} className="text-xs">
                      {repo.providerType === "github" ? "GH" : "GL"}
                    </span>
                    <span className="truncate font-mono">{repo.fullName}</span>
                  </button>
                ))
              )}
            </div>
            {/* Add Git Provider button */}
            <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowProviderModal(true);
                }}
                className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                style={{ color: "var(--accent-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Git Provider
              </button>
            </div>
          </div>
        </>
      )}

      <ProviderModal
        isOpen={showProviderModal}
        onClose={() => setShowProviderModal(false)}
        onSuccess={fetchRepositories}
      />
    </div>
  );
}
