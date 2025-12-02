import Link from "next/link";
import type { Job } from "@repobox/types";
import { StatusBadge } from "./status-badge";

interface SessionCardProps {
  job: Job;
}

export function SessionCard({ job }: SessionCardProps) {
  const timeAgo = formatTimeAgo(job.createdAt);

  return (
    <Link
      href={`/sessions/${job.id}`}
      className="block p-3 rounded-lg hover:bg-neutral-800/50 transition-colors border border-transparent hover:border-neutral-700"
      data-testid="session-card"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-white truncate flex-1">{job.prompt}</p>
        <StatusBadge status={job.status} showLabel={false} />
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="truncate">{job.repoName}</span>
        <span>•</span>
        <span>{timeAgo}</span>
      </div>
      {job.status === "success" && job.mrUrl && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="text-green-400">
            +{job.linesAdded} -{job.linesRemoved}
          </span>
          <span className="text-blue-400">↗ MR</span>
        </div>
      )}
      {job.status === "failed" && job.errorMessage && (
        <p className="mt-1.5 text-xs text-red-400 truncate">{job.errorMessage}</p>
      )}
    </Link>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
