import type { ResponseMeta, RetentionProxySummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { MetricConfidenceBadge } from "../metric/metric-confidence-badge.js";
import { MetricHelpPopover } from "../metric/metric-help-popover.js";
import { MetricTrustMeta } from "../metric/metric-trust-meta.js";

export function RetentionProxyCard({
  retention,
  meta,
}: {
  retention: RetentionProxySummary;
  meta: ResponseMeta | null | undefined;
}) {
  const { t } = useI18n();
  const summary =
    retention.multiDayActiveUsers > 0
      ? t("adoption.retentionSummary.some", { count: retention.multiDayActiveUsers })
      : t("adoption.retentionSummary.none");

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>
            {t("adoption.retentionTitle")} <MetricConfidenceBadge tone="proxy" />
          </h3>
          <p>{summary}</p>
        </div>
      </div>

      <MetricTrustMeta
        meta={meta}
        confidenceTone="proxy"
        sampleWindow={t("adoption.sampleWindow.retention")}
        caveat={t("adoption.caveat.retention")}
        definitionHref="#metric-retention-proxy"
      />

      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">
            {t("adoption.retentionRepeatUsageRatio")} <MetricHelpPopover text={t("adoption.help.retention")} />
          </p>
          <p className="metric-value">~{retention.repeatUsageRatio}%</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">
            {t("adoption.retentionMultiDayActiveProxy")} <MetricConfidenceBadge tone="proxy" />
          </p>
          <p className="metric-value">~{retention.multiDayActiveUsers}</p>
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
