import type { ComplianceGapSummary } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";

export function ConfigComplianceCard({ gaps }: { gaps: ComplianceGapSummary[] }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Compliance gaps</h3>
          <p>Configuration, auth, and coverage mismatches that currently weaken governance confidence.</p>
        </div>
      </div>

      <div className="dashboard-list">
        {gaps.map((gap) => (
          <div key={gap.label} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{gap.label}</div>
              <div className="cell-subtitle">{gap.summary}</div>
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
