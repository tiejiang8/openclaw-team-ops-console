import type { FindingsBriefItem } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";

export function FindingsBriefCard({ findings }: { findings: FindingsBriefItem[] }) {
  return (
    <article className="panel governance-findings-brief">
      <div className="panel-header">
        <div>
          <h3>Findings brief</h3>
          <p>The highest-priority read-only findings that already have evidence attached.</p>
        </div>
      </div>

      <div className="dashboard-list">
        {findings.map((finding) => (
          <div key={finding.id} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{finding.summary}</div>
              <div className="cell-subtitle">
                {finding.severity} • {finding.targetName ?? "fleet"} • {finding.evidenceCount} evidence refs
              </div>
            </div>
            <DrilldownLink link={finding.detailLink} tone="subtle" />
          </div>
        ))}
      </div>
    </article>
  );
}
