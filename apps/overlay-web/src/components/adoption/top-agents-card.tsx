import type { TopAgentUsage } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { EmptyPanel } from "../state/empty-panel.js";

export function TopAgentsCard({ agents }: { agents: TopAgentUsage[] }) {
  const { t } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("adoption.topAgentsTitle")}</h3>
          <p>{t("adoption.topAgentsDescription")}</p>
        </div>
      </div>

      {agents.length > 0 ? (
        <div className="dashboard-list">
          {agents.map((agent) => (
            <div key={agent.agentId} className="dashboard-list-item dashboard-list-item-wide">
              <div>
                <div className="cell-title">{agent.agentName}</div>
                <div className="cell-subtitle">
                  {t("adoption.topAgentsSummary", {
                    sessions: agent.sessions,
                    turns: agent.turns,
                    count: agent.activeWorkspaces,
                  })}
                </div>
              </div>
              <DrilldownLink link={agent.detailLink} tone="subtle" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel
          title={t("adoption.emptyAgentsTitle")}
          message={t("adoption.emptyAgentsDescription")}
        />
      )}
    </article>
  );
}
