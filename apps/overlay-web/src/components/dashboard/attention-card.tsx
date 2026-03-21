import type { AttentionItem } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { TrendChip } from "./trend-chip.js";

function translateAttentionLabel(id: AttentionItem["id"], t: ReturnType<typeof useI18n>["t"], fallback: string) {
  switch (id) {
    case "stability-anomaly":
    case "adoption-shift":
    case "governance-drift":
      return t(`dashboard.attentionLabel.${id}`);
    default:
      return fallback;
  }
}

function translateAttentionTrend(id: AttentionItem["id"], t: ReturnType<typeof useI18n>["t"], fallback?: string) {
  switch (id) {
    case "stability-anomaly":
    case "adoption-shift":
    case "governance-drift":
      return t(`dashboard.attentionTrend.${id}`);
    default:
      return fallback;
  }
}

function translateAttentionSummary(id: AttentionItem["id"], t: ReturnType<typeof useI18n>["t"], fallback: string) {
  switch (id) {
    case "stability-anomaly":
    case "adoption-shift":
    case "governance-drift":
      return t(`dashboard.attentionSummary.${id}`);
    default:
      return fallback;
  }
}

export function AttentionCard({ item }: { item: AttentionItem }) {
  const { t } = useI18n();

  return (
    <article className={`attention-card attention-card-${item.severity}`}>
      <div className="dashboard-card-header">
        <div>
          <p className="metric-label">{translateAttentionLabel(item.id, t, item.title)}</p>
        </div>
        <TrendChip
          label={translateAttentionTrend(item.id, t, item.trendLabel)}
          signal={item.severity === "critical" || item.severity === "error" ? "risk" : item.severity === "warn" ? "attention" : "neutral"}
        />
      </div>

      <p className="dashboard-summary">{translateAttentionSummary(item.id, t, item.summary)}</p>

      <div className="dashboard-card-actions">
        <DrilldownLink link={item.detailLink} tone="accent" />
        {item.evidenceLink ? <DrilldownLink link={item.evidenceLink} tone="subtle" /> : null}
        {item.relatedFindingsLink ? <DrilldownLink link={item.relatedFindingsLink} tone="subtle" /> : null}
      </div>
    </article>
  );
}
