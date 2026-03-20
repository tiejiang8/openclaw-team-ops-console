import type { ConfigHealthSummary } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";

export function ConfigHealthCard({ configHealth }: { configHealth: ConfigHealthSummary }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Config health</h3>
          <p>{configHealth.summary}</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Mismatch</p>
          <p className="metric-value">{configHealth.mismatchCount}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Auth gaps</p>
          <p className="metric-value">{configHealth.authCoverageGapCount}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Stale targets</p>
          <p className="metric-value">{configHealth.staleTargets}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Coverage gaps</p>
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
