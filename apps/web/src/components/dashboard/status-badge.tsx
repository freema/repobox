import type { JobStatus } from "@repobox/types";

const STATUS_CONFIG: Record<JobStatus, { label: string; icon: string; className: string }> = {
  pending: {
    label: "Pending",
    icon: "⏸",
    className: "bg-neutral-700 text-neutral-300",
  },
  running: {
    label: "Running",
    icon: "⏳",
    className: "bg-yellow-900/50 text-yellow-400",
  },
  success: {
    label: "Success",
    icon: "✓",
    className: "bg-green-900/50 text-green-400",
  },
  failed: {
    label: "Failed",
    icon: "✗",
    className: "bg-red-900/50 text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: "⊘",
    className: "bg-neutral-700 text-neutral-400",
  },
};

interface StatusBadgeProps {
  status: JobStatus;
  showLabel?: boolean;
}

export function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}
      data-testid="status-badge"
    >
      <span>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
