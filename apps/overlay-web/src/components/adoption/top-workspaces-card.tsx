import type { TopWorkspaceUsage } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { EmptyPanel } from "../state/empty-panel.js";

export function TopWorkspacesCard({ workspaces }: { workspaces: TopWorkspaceUsage[] }) {
  const { t } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("adoption.topWorkspacesTitle")}</h3>
          <p>{t("adoption.topWorkspacesDescription")}</p>
        </div>
      </div>

      {workspaces.length > 0 ? (
        <div className="dashboard-list">
          {workspaces.map((workspace) => (
            <div key={workspace.workspaceId} className="dashboard-list-item dashboard-list-item-wide">
              <div>
                <div className="cell-title">{workspace.workspaceName}</div>
                <div className="cell-subtitle">
                  {t("adoption.topWorkspacesSummary", {
                    sessions: workspace.sessions,
                    turns: workspace.turns,
                    minutes: workspace.avgSessionDurationMinutes,
                  })}
                </div>
              </div>
              <DrilldownLink link={workspace.detailLink} tone="subtle" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel
          title={t("adoption.emptyWorkspacesTitle")}
          message={t("adoption.emptyWorkspacesDescription")}
        />
      )}
    </article>
  );
}
