import type { JobStatus, WorkSessionStatus } from "@repobox/types";

type StatusType = JobStatus | WorkSessionStatus;

const STATUS_CONFIG: Record<StatusType, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
  // Job statuses
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
  // Work session statuses
  initializing: {
    label: "Initializing",
    icon: "⏳",
    color: "var(--warning)",
    bgColor: "var(--warning-bg)",
    borderColor: "var(--warning)",
  },
  ready: {
    label: "Ready",
    icon: "✓",
    color: "var(--success)",
    bgColor: "var(--success-bg)",
    borderColor: "var(--success)",
  },
  pushed: {
    label: "Pushed",
    icon: "↑",
    color: "var(--info)",
    bgColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "var(--info)",
  },
  archived: {
    label: "Archived",
    icon: "📦",
    color: "var(--text-muted)",
    bgColor: "rgba(115, 115, 115, 0.1)",
    borderColor: "var(--text-muted)",
  },
};

interface StatusBadgeProps {
  status: StatusType;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ status, showLabel = true, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // Small size - just a colored dot
  if (size === "sm") {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: config.color }}
        data-testid="status-badge"
        title={config.label}
      />
    );
  }

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
