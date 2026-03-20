import type { DashboardDrilldownLink } from "@openclaw-team-ops/shared";

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
  return (
    <article className="panel executive-summary-card">
      <div className="panel-header">
        <div>
          <h3>Executive summary</h3>
          <p>{summary}</p>
        </div>
      </div>

      <div className="dashboard-callout">
        <span className="metric-label">Biggest blocker</span>
        <strong>{biggestBlocker}</strong>
      </div>

      <div className="dashboard-card-actions">
        <DrilldownLink link={recommendedFocus} tone="accent" />
      </div>
    </article>
  );
}
