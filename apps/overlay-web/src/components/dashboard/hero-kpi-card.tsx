import type { ExecutiveKpiGroup } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { EvidencePill } from "../evidence/evidence-pill.js";
import { TrendChip } from "./trend-chip.js";

export function HeroKpiCard({ kpi }: { kpi: ExecutiveKpiGroup }) {
  const { t } = useI18n();

  return (
    <article className={`dashboard-hero-card dashboard-signal-${kpi.signal}`}>
      <div className="dashboard-card-header">
        <div>
          <p className="metric-label">{kpi.label}</p>
          <p className="dashboard-hero-value">{kpi.value}</p>
        </div>
        <TrendChip label={kpi.trendLabel} signal={kpi.signal} />
      </div>

      <p className="dashboard-summary">{kpi.summary}</p>

      <div className="dashboard-card-actions">
        <DrilldownLink link={kpi.detailLink} tone="accent" />
        {kpi.evidenceLink ? <DrilldownLink link={kpi.evidenceLink} tone="subtle" /> : null}
        {kpi.relatedFindingsLink ? <DrilldownLink link={kpi.relatedFindingsLink} tone="subtle" /> : null}
      </div>

      {kpi.evidenceRefs.length > 0 ? (
        <div className="evidence-pill-row" aria-label={t("nav.evidence")}>
          {kpi.evidenceRefs.slice(0, 3).map((evidence) => (
            <EvidencePill key={evidence.id} evidence={evidence} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
