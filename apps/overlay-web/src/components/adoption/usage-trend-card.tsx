import type { UsageTrendPoint } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";

export function UsageTrendCard({ points }: { points: UsageTrendPoint[] }) {
  const { t } = useI18n();
  const maxSessions = Math.max(...points.map((point) => Math.max(point.sessions, 1)), 1);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("adoption.usageTrendTitle")}</h3>
          <p>{t("adoption.usageTrendDescription")}</p>
        </div>
      </div>

      <div className="mini-trend-chart">
        {points.map((point) => (
          <div key={point.label} className="mini-trend-bar-group">
            <div className="mini-trend-stack">
              <div className="mini-trend-bar mini-trend-bar-accent" style={{ height: `${(point.sessions / maxSessions) * 100}%` }} />
            </div>
            <div className="mini-trend-label">{point.label}</div>
            <div className="mini-trend-caption">{point.sessions}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
