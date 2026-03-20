import type { OpsIncidentHotspot } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";

export function HotspotsCard({ hotspots }: { hotspots: OpsIncidentHotspot[] }) {
  const { t } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("operations.hotspotsTitle")}</h3>
          <p>{t("operations.hotspotsDescription")}</p>
        </div>
      </div>

      <div className="dashboard-list">
        {hotspots.map((hotspot) => (
          <div key={hotspot.id} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{hotspot.label}</div>
              <div className="cell-subtitle">{hotspot.summary}</div>
            </div>
            <div className="dashboard-list-actions">
              <span className="signal-badge signal-medium">{hotspot.count}</span>
              <DrilldownLink link={hotspot.detailLink} tone="subtle" />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
