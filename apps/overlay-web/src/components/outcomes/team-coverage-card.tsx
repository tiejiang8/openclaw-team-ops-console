import type { TeamCoverageSummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { EmptyPanel } from "../state/empty-panel.js";

export function TeamCoverageCard({ teams, coarseAttribution = false }: { teams: TeamCoverageSummary[]; coarseAttribution?: boolean }) {
  const { t } = useI18n();
  const translateTeam = (team: string) => (team === "Unassigned team" ? t("outcomes.unassignedTeam") : team);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("outcomes.teamCoverageTitle")}</h3>
          <p>{t("outcomes.teamCoverageDescription")}</p>
        </div>
      </div>

      {coarseAttribution ? (
        <div className="state-box state-box-warning panel-inline-note">
          <p className="state-title">{t("outcomes.teamAttributionTitle")}</p>
          <p className="state-message">{t("outcomes.teamAttributionDescription")}</p>
        </div>
      ) : null}

      {teams.length > 0 ? (
        <div className="dashboard-list">
          {teams.map((team) => (
            <div key={team.team} className="dashboard-list-item dashboard-list-item-wide">
              <div>
                <div className="cell-title">{translateTeam(team.team)}</div>
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
      ) : (
        <EmptyPanel
          title={t("outcomes.emptyTeamsTitle")}
          message={t("outcomes.emptyTeamsDescription")}
        />
      )}
    </article>
  );
}
