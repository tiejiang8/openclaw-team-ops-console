import type { RoleEntrySummary } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";
import { TrendChip } from "./trend-chip.js";

export function RoleSummaryCard({ entry }: { entry: RoleEntrySummary }) {
  return (
    <article className={`role-summary-card dashboard-signal-${entry.signal}`}>
      <div className="dashboard-card-header">
        <div>
          <p className="metric-label">{entry.audience}</p>
          <h4 className="dashboard-card-title">{entry.label}</h4>
        </div>
        <TrendChip label={entry.trendLabel} signal={entry.signal} />
      </div>

      <p className="dashboard-role-value">{entry.value}</p>
      <p className="dashboard-summary">{entry.summary}</p>

      <div className="dashboard-card-actions">
        <DrilldownLink link={entry.detailLink} tone="accent" />
        {entry.evidenceLink ? <DrilldownLink link={entry.evidenceLink} tone="subtle" /> : null}
      </div>
    </article>
  );
}
