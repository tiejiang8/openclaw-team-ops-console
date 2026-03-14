import type { EntityStatus } from "@openclaw-team-ops/shared";

const statusClassByValue: Record<string, string> = {
  healthy: "status-badge status-healthy",
  valid: "status-badge status-healthy",
  active: "status-badge status-healthy",
  ok: "status-badge status-healthy",
  degraded: "status-badge status-degraded",
  expiring: "status-badge status-degraded",
  paused: "status-badge status-degraded",
  idle: "status-badge status-degraded",
  unknown: "status-badge status-unknown",
  ended: "status-badge status-unknown",
  offline: "status-badge status-offline",
  expired: "status-badge status-offline",
  disabled: "status-badge status-offline",
  error: "status-badge status-offline",
  down: "status-badge status-offline",
};

export function StatusBadge({ status }: { status: EntityStatus | string }) {
  const className = statusClassByValue[status] ?? "status-badge status-unknown";

  return <span className={className}>{status}</span>;
}
