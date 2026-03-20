import type { TeamCoverageSummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";

export function TeamCoverageCard({ teams }: { teams: TeamCoverageSummary[] }) {
  const { t } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("outcomes.teamCoverageTitle")}</h3>
          <p>{t("outcomes.teamCoverageDescription")}</p>
        </div>
      </div>

      <div className="dashboard-list">
        {teams.map((team) => (
          <div key={team.team} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{team.team}</div>
              <div className="cell-subtitle">
                {t("outcomes.teamCoverageSummary", {
                  active: team.activeWorkspaces,
                  repeat: team.repeatUsageWorkspaces,
                  risks: team.riskCount,
                })}
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
