import type { DashboardSignal } from "@openclaw-team-ops/shared";

export function TrendChip({ label, signal = "neutral" }: { label: string | undefined; signal?: DashboardSignal }) {
  if (!label) {
    return null;
  }

  return <span className={`trend-chip trend-chip-${signal}`}>{label}</span>;
}
