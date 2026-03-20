import type { RiskPostureSummary } from "@openclaw-team-ops/shared";

import { MetricCard } from "../metric-card.js";

export function RiskPostureCard({ posture }: { posture: RiskPostureSummary }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Risk posture</h3>
          <p>{posture.summary}</p>
        </div>
      </div>

      <div className="dashboard-health-strip">
        <MetricCard label="Open risks" value={posture.openRisks} />
        <MetricCard label="Critical findings" value={posture.criticalFindings} />
        <MetricCard label="Config mismatch" value={posture.configMismatchCount} />
        <MetricCard label="Auth gaps" value={posture.authCoverageGapCount} />
      </div>

      <div className="dashboard-split-grid">
        <div className="dashboard-list">
          {posture.severityBreakdown.map((item) => (
            <div key={item.severity} className="dashboard-list-item">
              <span>{item.severity}</span>
              <span className="signal-badge signal-high">{item.count}</span>
            </div>
          ))}
        </div>
        <div className="dashboard-list">
          {posture.typeBreakdown.map((item) => (
            <div key={item.type} className="dashboard-list-item">
              <span>{item.type}</span>
              <span className="signal-badge signal-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
