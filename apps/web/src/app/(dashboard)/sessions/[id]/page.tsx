import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getJob, getJobOutput } from "@/lib/repositories";
import { StatusBadge, OutputViewer } from "@/components/dashboard";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    notFound();
  }

  // Ensure user owns this job
  if (job.userId !== session.user.id) {
    notFound();
  }

  // Fetch job output
  const outputLines = await getJobOutput(id);

  return (
    <div className="h-full flex flex-col" data-testid="session-detail">
      {/* Header */}
      <header className="shrink-0 border-b border-neutral-800 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Link
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
              </Link>
              <StatusBadge status={job.status} />
            </div>
            <h1 className="text-lg font-semibold text-white truncate" data-testid="session-prompt">
              {job.prompt}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500">
              <span data-testid="session-repo">{job.repoName}</span>
              <span>•</span>
              <span>{job.branch}</span>
              <span>•</span>
              <span data-testid="session-environment">{job.environment}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {job.status === "success" && job.mrUrl && (
              <a
                href={job.mrUrl}
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

      {/* Job metadata */}
      <div className="shrink-0 border-b border-neutral-800 px-6 py-3 flex items-center gap-6 text-sm">
        <JobMetric label="Created" value={formatDateTime(job.createdAt)} testId="session-created" />
        {job.startedAt && (
          <JobMetric
            label="Started"
            value={formatDateTime(job.startedAt)}
            testId="session-started"
          />
        )}
        {job.finishedAt && (
          <JobMetric
            label="Finished"
            value={formatDateTime(job.finishedAt)}
            testId="session-finished"
          />
        )}
        {job.finishedAt && job.startedAt && (
          <JobMetric
            label="Duration"
            value={formatDuration(job.finishedAt - job.startedAt)}
            testId="session-duration"
          />
        )}
        {job.status === "success" && (
          <JobMetric
            label="Changes"
            value={`+${job.linesAdded} -${job.linesRemoved}`}
            valueClassName="text-green-400"
            testId="session-changes"
          />
        )}
      </div>

      {/* Error message */}
      {job.status === "failed" && job.errorMessage && (
        <div
          className="shrink-0 mx-6 mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg"
          data-testid="session-error"
        >
          <h3 className="text-sm font-medium text-red-400 mb-1">Error</h3>
          <p className="text-sm text-red-300">{job.errorMessage}</p>
        </div>
      )}

      {/* Output viewer */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-400">Output</h2>
            <span className="text-xs text-neutral-500">{outputLines.length} lines</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <OutputViewer lines={outputLines} isStreaming={job.status === "running"} />
          </div>
        </div>
      </div>
    </div>
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
