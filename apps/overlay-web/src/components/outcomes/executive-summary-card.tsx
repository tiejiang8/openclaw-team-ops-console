import type { DashboardDrilldownLink } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";

export function ExecutiveSummaryCard({
  summary,
  biggestBlocker,
  recommendedFocus,
}: {
  summary: string;
  biggestBlocker: string;
  recommendedFocus: DashboardDrilldownLink;
}) {
  const { t } = useI18n();

  return (
    <article className="panel executive-summary-card">
      <div className="panel-header">
        <div>
          <h3>{t("outcomes.executiveSummaryTitle")}</h3>
          <p>{summary}</p>
        </div>
      </div>

      <div className="dashboard-callout">
        <span className="metric-label">{t("outcomes.biggestBlockerLabel")}</span>
        <strong>{biggestBlocker}</strong>
      </div>

      <div className="dashboard-card-actions">
        <DrilldownLink link={recommendedFocus} tone="accent" />
      </div>
    </article>
  );
}
