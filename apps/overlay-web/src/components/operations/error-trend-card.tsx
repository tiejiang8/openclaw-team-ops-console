import type { OpsTrendPoint } from "@openclaw-team-ops/shared";

export function ErrorTrendCard({ points }: { points: OpsTrendPoint[] }) {
  const maxValue = Math.max(...points.map((point) => Math.max(point.errors, point.warnings, 1)), 1);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Error trend</h3>
          <p>Last 24h warnings and errors, grouped into short operational buckets.</p>
        </div>
      </div>

      <div className="mini-trend-chart">
        {points.map((point) => (
          <div key={point.label} className="mini-trend-bar-group">
            <div className="mini-trend-stack">
              <div className="mini-trend-bar mini-trend-bar-error" style={{ height: `${(point.errors / maxValue) * 100}%` }} />
              <div className="mini-trend-bar mini-trend-bar-warn" style={{ height: `${(point.warnings / maxValue) * 100}%` }} />
            </div>
            <div className="mini-trend-label">{point.label}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
