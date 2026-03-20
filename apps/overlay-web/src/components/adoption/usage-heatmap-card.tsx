import type { HourlyUsageBucket } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";

export function UsageHeatmapCard({ buckets }: { buckets: HourlyUsageBucket[] }) {
  const { t } = useI18n();
  const maxValue = Math.max(...buckets.map((bucket) => Math.max(bucket.sessions, bucket.turns, 1)), 1);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("adoption.usageHeatmapTitle")}</h3>
          <p>{t("adoption.usageHeatmapDescription")}</p>
        </div>
      </div>

      <div className="usage-heatmap">
        {buckets.map((bucket) => (
          <div
            key={bucket.hour}
            className="usage-heatmap-cell"
            style={{ opacity: Math.max(0.2, (bucket.sessions + bucket.turns / 4) / maxValue) }}
            title={t("adoption.usageHeatmapTooltip", {
              hour: bucket.hour,
              sessions: bucket.sessions,
              turns: bucket.turns,
            })}
          >
            <span>{bucket.hour}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
