import type { AdoptionDashboard } from "@openclaw-team-ops/shared";

import { MetricCard } from "../metric-card.js";

export function AdoptionKpiStrip({ dashboard }: { dashboard: AdoptionDashboard }) {
  return (
    <section className="dashboard-health-strip">
      <MetricCard label="Active users proxy" value={dashboard.activeUsersProxy} />
      <MetricCard label="Sessions today" value={dashboard.sessionsToday} detail={`${dashboard.dayDeltaPercent >= 0 ? "+" : ""}${dashboard.dayDeltaPercent}% vs yesterday`} />
      <MetricCard label="Turns today" value={dashboard.turnsToday} detail={`${dashboard.weekDeltaPercent >= 0 ? "+" : ""}${dashboard.weekDeltaPercent}% vs last week`} />
      <MetricCard label="Avg duration" value={`${dashboard.avgSessionDurationMinutes}m`} detail={`${dashboard.activeWorkspaces} active workspaces`} />
    </section>
  );
}
