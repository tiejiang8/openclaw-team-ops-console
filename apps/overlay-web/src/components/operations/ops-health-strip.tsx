import type { OperationsDashboard } from "@openclaw-team-ops/shared";

import { MetricCard } from "../metric-card.js";

export function OpsHealthStrip({ dashboard }: { dashboard: OperationsDashboard }) {
  return (
    <section className="dashboard-health-strip">
      <MetricCard label="Health score" value={`${dashboard.healthScore}/100`} detail={dashboard.summary} />
      <MetricCard label="24h errors" value={dashboard.errors24h} detail={`Gateway ${dashboard.connectionState}`} />
      <MetricCard label="Stale nodes" value={dashboard.staleNodes} />
      <MetricCard label="Overdue cron" value={dashboard.overdueCron} />
    </section>
  );
}
