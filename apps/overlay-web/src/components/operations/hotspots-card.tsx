import type { OpsIncidentHotspot } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { EmptyPanel } from "../state/empty-panel.js";

export function HotspotsCard({ hotspots }: { hotspots: OpsIncidentHotspot[] }) {
  const { t } = useI18n();
  const translateSummary = (hotspot: OpsIncidentHotspot) => {
    switch (hotspot.type) {
      case "workspace":
        return t("operations.hotspotSummary.workspace", { count: hotspot.count });
      case "node":
        return t("operations.hotspotSummary.node");
      case "agent":
        return t("operations.hotspotSummary.agent");
      case "error-type":
        return t("operations.hotspotSummary.errorType");
      default:
        return hotspot.summary;
    }
  };

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("operations.hotspotsTitle")}</h3>
          <p>{t("operations.hotspotsDescription")}</p>
        </div>
      </div>

      {hotspots.length > 0 ? (
        <div className="dashboard-list">
          {hotspots.map((hotspot) => (
            <div key={hotspot.id} className="dashboard-list-item dashboard-list-item-wide">
              <div>
                <div className="cell-title">{hotspot.label}</div>
                <div className="cell-subtitle">{translateSummary(hotspot)}</div>
              </div>
              <div className="dashboard-list-actions">
                <span className="signal-badge signal-medium">{hotspot.count}</span>
                <DrilldownLink link={hotspot.detailLink} tone="subtle" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel
          title={t("operations.hotspotsEmptyTitle")}
          message={t("operations.hotspotsEmptyDescription")}
        />
      )}
    </article>
  );
}
