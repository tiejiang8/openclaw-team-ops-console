import type { ConfigHealthSummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";

export function ConfigHealthCard({ configHealth }: { configHealth: ConfigHealthSummary }) {
  const { t } = useI18n();
  const issues = [
    configHealth.mismatchCount > 0 ? t("operations.configMismatch") : null,
    configHealth.authCoverageGapCount > 0 ? t("operations.authGaps") : null,
    configHealth.staleTargets > 0 ? t("operations.staleTargets") : null,
    configHealth.coverageGapCount > 0 ? t("operations.coverageGaps") : null,
  ].filter((item): item is string => Boolean(item));
  const summary =
    issues.length > 0
      ? t("operations.configHealthIssues", { issues: issues.join(" / ") })
      : t("operations.configHealthHealthy");

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("operations.configHealthTitle")}</h3>
          <p>{summary}</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">{t("operations.configMismatch")}</p>
          <p className="metric-value">{configHealth.mismatchCount}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("operations.authGaps")}</p>
          <p className="metric-value">{configHealth.authCoverageGapCount}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("operations.staleTargets")}</p>
          <p className="metric-value">{configHealth.staleTargets}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("operations.coverageGaps")}</p>
          <p className="metric-value">{configHealth.coverageGapCount}</p>
        </div>
      </div>

      <div className="dashboard-card-actions">
        {configHealth.detailLinks.map((link) => (
          <DrilldownLink key={`${link.label}-${link.to}`} link={link} tone="subtle" />
        ))}
      </div>
    </article>
  );
}
