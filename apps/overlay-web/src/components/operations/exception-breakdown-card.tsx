import type { OpsIncidentHotspot } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";

function hotspotTypeLabel(type: OpsIncidentHotspot["type"], t: ReturnType<typeof useI18n>["t"]) {
  switch (type) {
    case "workspace":
      return t("subjectType.workspace");
    case "node":
      return t("operations.hotspotType.node");
    case "agent":
      return t("subjectType.agent");
    case "error-type":
      return t("operations.hotspotType.errorType");
    default:
      return type;
  }
}

export function ExceptionBreakdownCard({ hotspots }: { hotspots: OpsIncidentHotspot[] }) {
  const { t } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("operations.exceptionBreakdownTitle")}</h3>
          <p>{t("operations.exceptionBreakdownDescription")}</p>
        </div>
      </div>

      <div className="dashboard-list">
        {hotspots.map((hotspot) => (
          <div key={hotspot.id} className="dashboard-list-item">
            <div>
              <div className="cell-title">{hotspot.label}</div>
              <div className="cell-subtitle">{hotspotTypeLabel(hotspot.type, t)}</div>
            </div>
            <span className="signal-badge signal-high">{hotspot.count}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
