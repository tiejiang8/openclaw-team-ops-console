import type { ExecutiveKpiGroup } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { EvidencePill } from "../evidence/evidence-pill.js";
import { TrendChip } from "./trend-chip.js";

export function HeroKpiCard({ kpi }: { kpi: ExecutiveKpiGroup }) {
  const { t } = useI18n();
  const visibleEvidence = kpi.evidenceRefs.slice(0, 2);
  const hiddenEvidenceCount = Math.max(0, kpi.evidenceRefs.length - visibleEvidence.length);

  return (
    <article className={`dashboard-hero-card dashboard-signal-${kpi.signal}`}>
      <div className="dashboard-card-header">
        <div>
          <p className="metric-label">{kpi.label}</p>
          <p className="dashboard-hero-value">{kpi.value}</p>
        </div>
        <TrendChip label={kpi.trendLabel} signal={kpi.signal} />
      </div>

      <p className="dashboard-summary dashboard-summary-clamped">{kpi.summary}</p>

      <div className="dashboard-card-actions dashboard-card-actions-hero">
        <DrilldownLink link={kpi.detailLink} tone="accent" />
        {kpi.evidenceLink ? <DrilldownLink link={kpi.evidenceLink} tone="subtle" /> : null}
        {kpi.relatedFindingsLink ? <DrilldownLink link={kpi.relatedFindingsLink} tone="subtle" /> : null}
      </div>

      {kpi.evidenceRefs.length > 0 ? (
        <div className="evidence-pill-row dashboard-hero-evidence" aria-label={t("nav.evidence")}>
          {visibleEvidence.map((evidence) => (
            <EvidencePill key={evidence.id} evidence={evidence} />
          ))}
          {hiddenEvidenceCount > 0 ? (
            <span className="dashboard-more-chip">
              +{hiddenEvidenceCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
