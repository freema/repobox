"use client";

import { useState } from "react";
import type { Job } from "@repobox/types";
import { SessionCard } from "./session-card";

type FilterOption = "all" | "running" | "success" | "failed";

interface SessionListProps {
  jobs: Job[];
}

export function SessionList({ jobs }: SessionListProps) {
  const [filter, setFilter] = useState<FilterOption>("all");

  const filteredJobs = jobs.filter((job) => {
    if (filter === "all") return true;
    if (filter === "running") return job.status === "running" || job.status === "pending";
    return job.status === filter;
  });

  return (
    <div className="flex flex-col h-full" data-testid="session-list">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-white">Sessions</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterOption)}
          className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-600"
          data-testid="session-filter"
        >
          <option value="all">All</option>
          <option value="running">Active</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredJobs.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-neutral-500">
            {jobs.length === 0 ? "No sessions yet" : "No matching sessions"}
          </div>
        ) : (
          filteredJobs.map((job) => <SessionCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}
