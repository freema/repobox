"use client";

import { useState, useEffect } from "react";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  providerId: string;
  providerType: "github" | "gitlab";
}

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
        className="h-10 bg-neutral-800 rounded-lg animate-pulse"
        data-testid="repo-selector-loading"
      />
    );
  }

  if (error) {
    return (
      <div className="h-10 bg-red-900/20 border border-red-800 rounded-lg flex items-center px-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <div className="h-10 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center px-3 text-sm text-neutral-500">
        No repositories available. Add a Git provider first.
      </div>
    );
  }

  return (
    <div className="relative" data-testid="repository-selector">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 bg-neutral-800 border border-neutral-700 rounded-lg px-3 text-left flex items-center justify-between text-sm hover:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500"
      >
        <span className={selectedRepo ? "text-white" : "text-neutral-500"}>
          {selectedRepo ? selectedRepo.fullName : "Select repository..."}
        </span>
        <svg
          className="w-4 h-4 text-neutral-500"
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
          <div className="absolute z-20 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-hidden">
            <div className="p-2 border-b border-neutral-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repositories..."
                className="w-full bg-neutral-700 border-0 rounded px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredRepos.length === 0 ? (
                <div className="px-3 py-4 text-sm text-neutral-500 text-center">
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
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 flex items-center gap-2 ${
                      repo.id === value ? "bg-neutral-700 text-white" : "text-neutral-300"
                    }`}
                  >
                    <span className="text-neutral-500">
                      {repo.providerType === "github" ? "GH" : "GL"}
                    </span>
                    <span className="truncate">{repo.fullName}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
