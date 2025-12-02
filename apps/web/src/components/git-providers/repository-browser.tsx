"use client";

import { useState, useMemo } from "react";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  private: boolean;
  providerId: string;
  providerType: "gitlab" | "github";
}

interface RepositoryBrowserProps {
  repositories: Repository[];
  onSelect?: (repo: Repository) => void;
  selectedId?: string;
}

export function RepositoryBrowser({ repositories, onSelect, selectedId }: RepositoryBrowserProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "gitlab" | "github">("all");

  const filteredRepos = useMemo(() => {
    return repositories.filter((repo) => {
      const matchesSearch =
        search === "" ||
        repo.fullName.toLowerCase().includes(search.toLowerCase()) ||
        repo.description?.toLowerCase().includes(search.toLowerCase());

      const matchesType = filterType === "all" || repo.providerType === filterType;

      return matchesSearch && matchesType;
    });
  }, [repositories, search, filterType]);

  if (repositories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No repositories available. Add a git provider first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filter */}
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="all">All Providers</option>
          <option value="gitlab">GitLab</option>
          <option value="github">GitHub</option>
        </select>
      </div>

      {/* Repository list */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {filteredRepos.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No repositories match your search.</div>
        ) : (
          filteredRepos.map((repo) => (
            <button
              key={`${repo.providerId}-${repo.id}`}
              onClick={() => onSelect?.(repo)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedId === repo.id
                  ? "bg-orange-900/30 border-orange-600"
                  : "bg-gray-800 border-gray-700 hover:border-gray-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    repo.providerType === "gitlab" ? "bg-orange-500" : "bg-gray-400"
                  }`}
                />
                <span className="font-medium text-gray-200">{repo.fullName}</span>
                {repo.private && (
                  <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
                    Private
                  </span>
                )}
              </div>
              {repo.description && (
                <p className="mt-1 text-sm text-gray-500 line-clamp-1">{repo.description}</p>
              )}
            </button>
          ))
        )}
      </div>

      {/* Count */}
      <div className="text-sm text-gray-500">
        {filteredRepos.length} of {repositories.length} repositories
      </div>
    </div>
  );
}
