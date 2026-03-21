import type { FindingsBriefItem } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";

export function FindingsBriefCard({ findings }: { findings: FindingsBriefItem[] }) {
  const { t, translateSignal } = useI18n();

  return (
    <article className="panel governance-findings-brief">
      <div className="panel-header">
        <div>
          <h3>{t("governance.findingsBriefTitle")}</h3>
          <p>{t("governance.findingsBriefDescription")}</p>
        </div>
      </div>

      <div className="dashboard-list">
        {findings.map((finding) => (
          <div key={finding.id} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{finding.summary}</div>
              <div className="cell-subtitle">
                {translateSignal(finding.severity)} • {finding.targetName ?? t("governance.fleetScope")} •{" "}
                {t("governance.evidenceRefs", { count: finding.evidenceCount })}
              </div>
            </div>
            <DrilldownLink link={finding.detailLink} tone="subtle" />
          </div>
        ))}
      </div>
    </article>
  );
}
