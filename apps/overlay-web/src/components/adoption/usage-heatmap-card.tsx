import type { HourlyUsageBucket } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { EmptyPanel } from "../state/empty-panel.js";

export function UsageHeatmapCard({ buckets }: { buckets: HourlyUsageBucket[] }) {
  const { t } = useI18n();
  const maxValue = Math.max(...buckets.map((bucket) => Math.max(bucket.sessions, bucket.turns, 1)), 1);
  const hasSignal = buckets.some((bucket) => bucket.sessions > 0 || bucket.turns > 0);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("adoption.usageHeatmapTitle")}</h3>
          <p>{t("adoption.usageHeatmapDescription")}</p>
        </div>
      </div>

      {hasSignal ? (
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
      ) : (
        <EmptyPanel
          title={t("adoption.emptyHeatmapTitle")}
          message={t("adoption.emptyHeatmapDescription")}
        />
      )}
    </article>
  );
}
