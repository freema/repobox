import type { JobStatus } from "@repobox/types";

const STATUS_CONFIG: Record<JobStatus, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
  pending: {
    label: "Pending",
    icon: "⏸",
    color: "var(--text-secondary)",
    bgColor: "rgba(163, 163, 163, 0.1)",
    borderColor: "var(--text-muted)",
  },
  running: {
    label: "Running",
    icon: "⏳",
    color: "var(--warning)",
    bgColor: "var(--warning-bg)",
    borderColor: "var(--warning)",
  },
  success: {
    label: "Success",
    icon: "✓",
    color: "var(--success)",
    bgColor: "var(--success-bg)",
    borderColor: "var(--success)",
  },
  failed: {
    label: "Failed",
    icon: "✗",
    color: "var(--error)",
    bgColor: "var(--error-bg)",
    borderColor: "var(--error)",
  },
  cancelled: {
    label: "Cancelled",
    icon: "⊘",
    color: "var(--text-muted)",
    bgColor: "rgba(115, 115, 115, 0.1)",
    borderColor: "var(--text-muted)",
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
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
      }}
      data-testid="status-badge"
    >
      <span>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
