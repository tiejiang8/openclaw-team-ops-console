import type { ComplianceGapSummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";

function translateGapLabel(label: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (label) {
    case "Config mismatch":
      return t("governance.configMismatch");
    case "Auth coverage gaps":
      return t("governance.authCoverageGaps");
    case "Coverage gaps":
      return t("governance.coverageGaps");
    default:
      return label;
  }
}

function translateGapSummary(label: string, t: ReturnType<typeof useI18n>["t"], fallback: string) {
  switch (label) {
    case "Config mismatch":
      return t("governance.complianceSummary.configMismatch");
    case "Auth coverage gaps":
      return t("governance.complianceSummary.authCoverage");
    case "Coverage gaps":
      return t("governance.complianceSummary.coverage");
    default:
      return fallback;
  }
}

export function ConfigComplianceCard({ gaps }: { gaps: ComplianceGapSummary[] }) {
  const { t } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("governance.complianceGapsTitle")}</h3>
          <p>{t("governance.complianceGapsDescription")}</p>
        </div>
      </div>

      <div className="dashboard-list">
        {gaps.map((gap) => (
          <div key={gap.label} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{translateGapLabel(gap.label, t)}</div>
              <div className="cell-subtitle">{translateGapSummary(gap.label, t, gap.summary)}</div>
            </div>
            <div className="dashboard-list-actions">
              <span className="signal-badge signal-medium">{gap.count}</span>
              <DrilldownLink link={gap.detailLink} tone="subtle" />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
