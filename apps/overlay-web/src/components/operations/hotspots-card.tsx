import type { OpsIncidentHotspot } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";

export function HotspotsCard({ hotspots }: { hotspots: OpsIncidentHotspot[] }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Operational hotspots</h3>
          <p>Shortlist of the places most likely to need read-only follow-up first.</p>
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
