import type { CollectionStatus, ResponseMeta } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { CoverageBadge } from "../coverage-badge.js";
import { MetricConfidenceBadge, type MetricConfidenceTone } from "./metric-confidence-badge.js";

function resolveCoverage(meta: ResponseMeta | null | undefined): CollectionStatus {
  return meta?.coverage ?? "partial";
}

function buildDegradeReason(
  meta: ResponseMeta | null | undefined,
  caveat: string,
  translateCoverageState: (value: string) => string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const coverage = resolveCoverage(meta);
  const reasons: string[] = [];

  if (coverage !== "complete") {
    reasons.push(t("metricTrust.sourceCoverage", { value: translateCoverageState(coverage) }));
  }

  if (meta?.freshness === "stale") {
    reasons.push(t("metricTrust.stale"));
  }

  if ((meta?.warningCount ?? 0) > 0) {
    reasons.push(t("metricTrust.warnings", { count: meta?.warningCount ?? 0 }));
  }

  return `${reasons.length > 0 ? reasons.join(" ") : t("metricTrust.none")} ${caveat}`;
}

export function MetricTrustMeta({
  meta,
  confidenceTone,
  sampleWindow,
  caveat,
  definitionHref,
}: {
  meta: ResponseMeta | null | undefined;
  confidenceTone: Extract<MetricConfidenceTone, "proxy" | "observational" | "snapshot">;
  sampleWindow: string;
  caveat: string;
  definitionHref: string;
}) {
  const { t, translateCoverageState } = useI18n();
  const coverage = resolveCoverage(meta);
  const degradeReason = buildDegradeReason(meta, caveat, translateCoverageState, t);

  return (
    <>
      <div className="metric-trust-chip-row">
        <span className="metric-trust-chip">
          <span className="metric-trust-chip-label">{t("metricTrust.confidence")}</span>
          <MetricConfidenceBadge tone={confidenceTone} />
        </span>
        <span className="metric-trust-chip">
          <span className="metric-trust-chip-label">{t("metricTrust.coverage")}</span>
          <CoverageBadge coverage={coverage} />
        </span>
        <span className="metric-trust-chip">
          <span className="metric-trust-chip-label">{t("metricTrust.sampleWindow")}</span>
          <span>{sampleWindow}</span>
        </span>
      </div>
      <p className="metric-trust-note">
        <strong>{t("metricTrust.degradeReason")}</strong> {degradeReason}
      </p>
      <a className="detail-link metric-trust-link" href={definitionHref}>
        {t("metricTrust.openDefinition")}
      </a>
    </>
  );
}
