import type { ValueSignalSummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { TrendChip } from "../dashboard/trend-chip.js";
import { MetricConfidenceBadge } from "../metric/metric-confidence-badge.js";

function translateSignalLabel(label: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (label) {
    case "Repeat usage ratio":
      return t("outcomes.valueSignal.repeatUsageRatio");
    case "High-intensity workspaces":
      return t("outcomes.valueSignal.highIntensityWorkspaces");
    case "Risk pressure on rollout":
      return t("outcomes.valueSignal.riskPressure");
    default:
      return label;
  }
}

function translateSignalSummary(
  label: string,
  t: ReturnType<typeof useI18n>["t"],
  fallback: string,
  confidenceTone?: "limited" | "early" | null,
) {
  switch (label) {
    case "Repeat usage ratio":
      return t(
        confidenceTone === "limited"
          ? "outcomes.valueSignalSummary.repeatUsage.limited"
          : "outcomes.valueSignalSummary.repeatUsage.active",
      );
    case "High-intensity workspaces":
      return fallback.includes("No stable")
        ? t("outcomes.valueSignalSummary.highIntensity.none")
        : t("outcomes.valueSignalSummary.highIntensity.limited");
    case "Risk pressure on rollout":
      return t("outcomes.valueSignalSummary.riskPressure");
    default:
      return fallback;
  }
}

export function ValueSignalCard({
  signal,
  confidenceTone,
}: {
  signal: ValueSignalSummary;
  confidenceTone?: "limited" | "early" | null;
}) {
  const { t } = useI18n();

  return (
    <article className={`role-summary-card dashboard-signal-${signal.signal}`}>
      <div className="dashboard-card-header">
        <div>
          <p className="metric-label">
            {translateSignalLabel(signal.label, t)} {confidenceTone ? <MetricConfidenceBadge tone={confidenceTone} /> : null}
          </p>
          <p className="dashboard-hero-value">{signal.value}</p>
        </div>
        <TrendChip label={signal.signal} signal={signal.signal} />
      </div>

      <p className="dashboard-summary">
        {translateSignalSummary(signal.label, t, signal.summary, confidenceTone)}
      </p>
      <div className="dashboard-card-actions">
        <DrilldownLink link={signal.detailLink} tone="subtle" />
      </div>
    </article>
  );
}
