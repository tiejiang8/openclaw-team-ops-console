import type { OpsIncidentHotspot } from "@openclaw-team-ops/shared";

export function ExceptionBreakdownCard({ hotspots }: { hotspots: OpsIncidentHotspot[] }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Exception breakdown</h3>
          <p>Where the current warnings and errors are concentrating.</p>
        </div>
      </div>

      <div className="dashboard-list">
        {hotspots.map((hotspot) => (
          <div key={hotspot.id} className="dashboard-list-item">
            <div>
              <div className="cell-title">{hotspot.label}</div>
              <div className="cell-subtitle">{hotspot.type}</div>
            </div>
            <span className="signal-badge signal-high">{hotspot.count}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
