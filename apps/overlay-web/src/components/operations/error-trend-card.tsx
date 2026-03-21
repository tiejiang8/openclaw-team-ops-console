import type { OpsTrendPoint } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { EmptyPanel } from "../state/empty-panel.js";

export function ErrorTrendCard({ points }: { points: OpsTrendPoint[] }) {
  const { t } = useI18n();
  const maxValue = Math.max(...points.map((point) => Math.max(point.errors, point.warnings, 1)), 1);
  const hasSignal = points.some((point) => point.errors > 0 || point.warnings > 0);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("operations.errorTrendTitle")}</h3>
          <p>{t("operations.errorTrendDescription")}</p>
        </div>
      </div>

      {hasSignal ? (
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
      ) : (
        <EmptyPanel
          title={t("operations.errorTrendEmptyTitle")}
          message={t("operations.errorTrendEmptyDescription")}
        />
      )}
    </article>
  );
}
