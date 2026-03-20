import type { TopWorkspaceUsage } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";

export function TopWorkspacesCard({ workspaces }: { workspaces: TopWorkspaceUsage[] }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Top workspaces</h3>
          <p>Where usage depth is currently highest.</p>
        </div>
      </div>

      <div className="dashboard-list">
        {workspaces.map((workspace) => (
          <div key={workspace.workspaceId} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{workspace.workspaceName}</div>
              <div className="cell-subtitle">
                {workspace.sessions} sessions, {workspace.turns} turns, avg {workspace.avgSessionDurationMinutes}m
              </div>
            </div>
            <DrilldownLink link={workspace.detailLink} tone="subtle" />
          </div>
        ))}
      </div>
    </article>
  );
}
