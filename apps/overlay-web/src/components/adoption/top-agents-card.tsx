import type { TopAgentUsage } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";

export function TopAgentsCard({ agents }: { agents: TopAgentUsage[] }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Top agents</h3>
          <p>Which agents are carrying the most usage footprint.</p>
        </div>
      </div>

      <div className="dashboard-list">
        {agents.map((agent) => (
          <div key={agent.agentId} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{agent.agentName}</div>
              <div className="cell-subtitle">
                {agent.sessions} sessions, {agent.turns} turns, {agent.activeWorkspaces} active workspaces
              </div>
            </div>
            <DrilldownLink link={agent.detailLink} tone="subtle" />
          </div>
        ))}
      </div>
    </article>
  );
}
