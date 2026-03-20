import type { AdoptionDashboard } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { MetricCard } from "../metric-card.js";

export function AdoptionKpiStrip({ dashboard }: { dashboard: AdoptionDashboard }) {
  const { t } = useI18n();
  const dayDelta = `${dashboard.dayDeltaPercent >= 0 ? "+" : ""}${dashboard.dayDeltaPercent}%`;
  const weekDelta = `${dashboard.weekDeltaPercent >= 0 ? "+" : ""}${dashboard.weekDeltaPercent}%`;

  return (
    <section className="dashboard-health-strip">
      <MetricCard label={t("adoption.kpi.activeUsersProxy")} value={dashboard.activeUsersProxy} />
      <MetricCard
        label={t("adoption.kpi.sessionsToday")}
        value={dashboard.sessionsToday}
        detail={t("adoption.kpi.dayDelta", { value: dayDelta })}
      />
      <MetricCard
        label={t("adoption.kpi.turnsToday")}
        value={dashboard.turnsToday}
        detail={t("adoption.kpi.weekDelta", { value: weekDelta })}
      />
      <MetricCard
        label={t("adoption.kpi.avgDuration")}
        value={`${dashboard.avgSessionDurationMinutes}m`}
        detail={t("adoption.kpi.activeWorkspacesDetail", { count: dashboard.activeWorkspaces })}
      />
    </section>
  );
}
