import type { ValueSignalSummary } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";
import { TrendChip } from "../dashboard/trend-chip.js";

export function ValueSignalCard({ signal }: { signal: ValueSignalSummary }) {
  return (
    <article className={`role-summary-card dashboard-signal-${signal.signal}`}>
      <div className="dashboard-card-header">
        <div>
          <p className="metric-label">{signal.label}</p>
          <p className="dashboard-hero-value">{signal.value}</p>
        </div>
        <TrendChip label={signal.signal} signal={signal.signal} />
      </div>

      <p className="dashboard-summary">{signal.summary}</p>
      <div className="dashboard-card-actions">
        <DrilldownLink link={signal.detailLink} tone="subtle" />
      </div>
    </article>
  );
}
