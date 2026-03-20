import type { TeamCoverageSummary } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";

export function TeamCoverageCard({ teams }: { teams: TeamCoverageSummary[] }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Team coverage</h3>
          <p>Which teams have formed active and repeated usage patterns.</p>
        </div>
      </div>

      <div className="dashboard-list">
        {teams.map((team) => (
          <div key={team.team} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{team.team}</div>
              <div className="cell-subtitle">
                {team.activeWorkspaces} active workspaces, {team.repeatUsageWorkspaces} repeat usage, {team.riskCount} risks
              </div>
            </div>
            <div className="dashboard-list-actions">
              <span className="signal-badge signal-medium">{team.adoptionScore}</span>
              <DrilldownLink link={team.detailLink} tone="subtle" />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
