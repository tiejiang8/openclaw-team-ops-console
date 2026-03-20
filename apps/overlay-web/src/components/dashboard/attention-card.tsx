import type { AttentionItem } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";
import { TrendChip } from "./trend-chip.js";

export function AttentionCard({ item }: { item: AttentionItem }) {
  return (
    <article className={`attention-card attention-card-${item.severity}`}>
      <div className="dashboard-card-header">
        <div>
          <p className="metric-label">{item.title}</p>
        </div>
        <TrendChip label={item.trendLabel} signal={item.severity === "critical" || item.severity === "error" ? "risk" : item.severity === "warn" ? "attention" : "neutral"} />
      </div>

      <p className="dashboard-summary">{item.summary}</p>

      <div className="dashboard-card-actions">
        <DrilldownLink link={item.detailLink} tone="accent" />
        {item.evidenceLink ? <DrilldownLink link={item.evidenceLink} tone="subtle" /> : null}
        {item.relatedFindingsLink ? <DrilldownLink link={item.relatedFindingsLink} tone="subtle" /> : null}
      </div>
    </article>
  );
}
