import type { RiskPostureSummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { MetricCard } from "../metric-card.js";

export function RiskPostureCard({ posture }: { posture: RiskPostureSummary }) {
  const { t, translateSignal, translateFindingType } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("governance.riskPostureTitle")}</h3>
          <p>
            {t("governance.riskPostureSummary", {
              open: posture.openRisks,
              mismatch: posture.configMismatchCount,
              auth: posture.authCoverageGapCount,
            })}
          </p>
        </div>
      </div>

      <div className="dashboard-health-strip">
        <MetricCard label={t("governance.openRisks")} value={posture.openRisks} />
        <MetricCard label={t("governance.criticalFindings")} value={posture.criticalFindings} />
        <MetricCard label={t("governance.configMismatch")} value={posture.configMismatchCount} />
        <MetricCard label={t("governance.authGaps")} value={posture.authCoverageGapCount} />
      </div>

      <div className="dashboard-split-grid">
        <div className="dashboard-list">
          {posture.severityBreakdown.map((item) => (
            <div key={item.severity} className="dashboard-list-item">
              <span>{translateSignal(item.severity)}</span>
              <span className="signal-badge signal-high">{item.count}</span>
            </div>
          ))}
        </div>
        <div className="dashboard-list">
          {posture.typeBreakdown.map((item) => (
            <div key={item.type} className="dashboard-list-item">
              <span>{translateFindingType(item.type)}</span>
              <span className="signal-badge signal-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
