import type { AdoptionDashboard, ResponseMeta } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { MetricConfidenceBadge } from "../metric/metric-confidence-badge.js";
import { MetricHelpPopover } from "../metric/metric-help-popover.js";
import { MetricTrustMeta } from "../metric/metric-trust-meta.js";

export function AdoptionKpiStrip({
  dashboard,
  meta,
}: {
  dashboard: AdoptionDashboard;
  meta: ResponseMeta | null | undefined;
}) {
  const { t } = useI18n();
  const dayDelta = `${dashboard.dayDeltaPercent >= 0 ? "+" : ""}${dashboard.dayDeltaPercent}%`;
  const weekDelta = `${dashboard.weekDeltaPercent >= 0 ? "+" : ""}${dashboard.weekDeltaPercent}%`;

  return (
    <section className="dashboard-health-strip">
      <article className="metric-card metric-card-trust fade-in-up">
        <div className="metric-label-row">
          <p className="metric-label">
            {t("adoption.kpi.activeUsersProxy")} <MetricConfidenceBadge tone="proxy" />
            <MetricHelpPopover text={t("adoption.help.activeUsersProxy")} />
          </p>
        </div>
        <p className="metric-value">~{dashboard.activeUsersProxy}</p>
        <p className="metric-detail">{t("adoption.kpi.activeWorkspacesDetail", { count: dashboard.activeWorkspaces })}</p>
        <MetricTrustMeta
          meta={meta}
          confidenceTone="proxy"
          sampleWindow={t("adoption.sampleWindow.activeUsersProxy")}
          caveat={t("adoption.caveat.activeUsersProxy")}
          definitionHref="#metric-active-users-proxy"
        />
      </article>

      <article className="metric-card metric-card-trust fade-in-up">
        <div className="metric-label-row">
          <p className="metric-label">
            {t("adoption.kpi.sessionsToday")}
            <MetricHelpPopover text={t("adoption.help.sessionsToday")} />
          </p>
        </div>
        <p className="metric-value">{dashboard.sessionsToday}</p>
        <p className="metric-detail">{t("adoption.kpi.dayDelta", { value: dayDelta })}</p>
        <MetricTrustMeta
          meta={meta}
          confidenceTone="snapshot"
          sampleWindow={t("adoption.sampleWindow.sessionsToday")}
          caveat={t("adoption.caveat.sessionsToday")}
          definitionHref="#metric-sessions-today"
        />
      </article>

      <article className="metric-card metric-card-trust fade-in-up">
        <div className="metric-label-row">
          <p className="metric-label">
            {t("adoption.kpi.turnsToday")}
            <MetricHelpPopover text={t("adoption.help.turnsToday")} />
          </p>
        </div>
        <p className="metric-value">{dashboard.turnsToday}</p>
        <p className="metric-detail">{t("adoption.kpi.weekDelta", { value: weekDelta })}</p>
        <MetricTrustMeta
          meta={meta}
          confidenceTone="observational"
          sampleWindow={t("adoption.sampleWindow.turnsToday")}
          caveat={t("adoption.caveat.turnsToday")}
          definitionHref="#metric-turns-today"
        />
      </article>

      <article className="metric-card metric-card-trust fade-in-up">
        <div className="metric-label-row">
          <p className="metric-label">
            {t("adoption.kpi.avgDuration")}
            <MetricHelpPopover text={t("adoption.help.avgDuration")} />
          </p>
        </div>
        <p className="metric-value">{dashboard.avgSessionDurationMinutes}m</p>
        <p className="metric-detail">{t("adoption.kpi.activeWorkspacesDetail", { count: dashboard.activeWorkspaces })}</p>
        <MetricTrustMeta
          meta={meta}
          confidenceTone="observational"
          sampleWindow={t("adoption.sampleWindow.avgDuration")}
          caveat={t("adoption.caveat.avgDuration")}
          definitionHref="#metric-avg-duration"
        />
      </article>
    </section>
  );
}
