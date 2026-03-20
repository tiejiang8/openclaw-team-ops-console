import type { RetentionProxySummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";

export function RetentionProxyCard({ retention }: { retention: RetentionProxySummary }) {
  const { t } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("adoption.retentionTitle")}</h3>
          <p>{retention.summary}</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">{t("adoption.retentionRepeatUsageRatio")}</p>
          <p className="metric-value">{retention.repeatUsageRatio}%</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("adoption.retentionMultiDayActiveProxy")}</p>
          <p className="metric-value">{retention.multiDayActiveUsers}</p>
        </div>
      </div>

      <div className="chip-row">
        {retention.lowActivityTeams.map((team) => (
          <span key={team} className="meta-chip">
            {team}
          </span>
        ))}
      </div>
    </article>
  );
}
