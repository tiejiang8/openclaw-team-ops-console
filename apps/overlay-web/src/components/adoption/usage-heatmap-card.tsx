import type { HourlyUsageBucket } from "@openclaw-team-ops/shared";

export function UsageHeatmapCard({ buckets }: { buckets: HourlyUsageBucket[] }) {
  const maxValue = Math.max(...buckets.map((bucket) => Math.max(bucket.sessions, bucket.turns, 1)), 1);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Usage heatmap</h3>
          <p>Last 24h activity distribution by hour.</p>
        </div>
      </div>

      <div className="usage-heatmap">
        {buckets.map((bucket) => (
          <div
            key={bucket.hour}
            className="usage-heatmap-cell"
            style={{ opacity: Math.max(0.2, (bucket.sessions + bucket.turns / 4) / maxValue) }}
            title={`${bucket.hour}:00 - ${bucket.sessions} sessions / ${bucket.turns} turns`}
          >
            <span>{bucket.hour}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
