"use client";

import type { Job, JobOutput } from "@repobox/types";
import { useJobStream } from "@/hooks";
import { StatusBadge } from "./status-badge";
import { OutputViewer } from "./output-viewer";

interface SessionDetailClientProps {
  job: Job;
  initialOutput: JobOutput[];
}

export function SessionDetailClient({ job, initialOutput }: SessionDetailClientProps) {
  const {
    status,
    lines,
    isConnected,
    isDone,
    error,
    metadata,
    reconnect,
  } = useJobStream(job.id, {
    initialJob: job,
    initialOutput,
  });

  const isStreaming = status === "running" || status === "pending";

  // Use metadata from stream if available, fallback to initial job data
  const currentJob = {
    ...job,
    status,
    startedAt: metadata.startedAt ?? job.startedAt,
    finishedAt: metadata.finishedAt ?? job.finishedAt,
    errorMessage: metadata.errorMessage ?? job.errorMessage,
    linesAdded: metadata.linesAdded ?? job.linesAdded,
    linesRemoved: metadata.linesRemoved ?? job.linesRemoved,
    mrUrl: metadata.mrUrl ?? job.mrUrl,
    branch: metadata.branch ?? job.branch,
  };

  return (
    <>
      {/* Header with status badge - updates in real-time */}
      <header className="shrink-0 border-b border-neutral-800 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <a
                href="/"
                className="text-neutral-500 hover:text-white transition-colors"
                data-testid="back-link"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </a>
              <StatusBadge status={currentJob.status} />
              {isStreaming && isConnected && (
                <span className="text-xs text-neutral-500">Live</span>
              )}
            </div>
            <h1 className="text-lg font-semibold text-white truncate" data-testid="session-prompt">
              {currentJob.prompt}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500">
              <span data-testid="session-repo">{currentJob.repoName}</span>
              <span>•</span>
              <span>{currentJob.branch}</span>
              <span>•</span>
              <span data-testid="session-environment">{currentJob.environment}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentJob.status === "success" && currentJob.mrUrl && (
              <a
                href={currentJob.mrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="view-mr-button"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                View MR/PR
              </a>
            )}
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium border border-neutral-700 hover:border-neutral-600 transition-colors"
              data-testid="rerun-button"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Re-run
            </button>
          </div>
        </div>
      </header>

      {/* Job metadata - updates in real-time */}
      <div className="shrink-0 border-b border-neutral-800 px-6 py-3 flex items-center gap-6 text-sm">
        <JobMetric label="Created" value={formatDateTime(currentJob.createdAt)} testId="session-created" />
        {currentJob.startedAt && (
          <JobMetric
            label="Started"
            value={formatDateTime(currentJob.startedAt)}
            testId="session-started"
          />
        )}
        {currentJob.finishedAt && (
          <JobMetric
            label="Finished"
            value={formatDateTime(currentJob.finishedAt)}
            testId="session-finished"
          />
        )}
        {currentJob.finishedAt && currentJob.startedAt && (
          <JobMetric
            label="Duration"
            value={formatDuration(currentJob.finishedAt - currentJob.startedAt)}
            testId="session-duration"
          />
        )}
        {currentJob.status === "success" && (
          <JobMetric
            label="Changes"
            value={`+${currentJob.linesAdded} -${currentJob.linesRemoved}`}
            valueClassName="text-green-400"
            testId="session-changes"
          />
        )}
        {isStreaming && (
          <div className="ml-auto text-xs text-neutral-500">
            {lines.length} lines
          </div>
        )}
      </div>

      {/* Error message */}
      {currentJob.status === "failed" && currentJob.errorMessage && (
        <div
          className="shrink-0 mx-6 mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg"
          data-testid="session-error"
        >
          <h3 className="text-sm font-medium text-red-400 mb-1">Error</h3>
          <p className="text-sm text-red-300">{currentJob.errorMessage}</p>
        </div>
      )}

      {/* Output viewer with streaming */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-400">Output</h2>
            <span className="text-xs text-neutral-500">{lines.length} lines</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <OutputViewer
              lines={lines}
              isStreaming={isStreaming}
              isConnected={isConnected}
              error={error}
              onReconnect={!isDone ? reconnect : undefined}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function JobMetric({
  label,
  value,
  valueClassName,
  testId,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <span className="text-neutral-500">{label}: </span>
      <span className={valueClassName || "text-neutral-300"}>{value}</span>
    </div>
  );
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
