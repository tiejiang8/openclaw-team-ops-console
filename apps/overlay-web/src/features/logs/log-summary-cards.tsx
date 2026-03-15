import type { LogSummary } from "@openclaw-team-ops/shared";

import { MetricCard } from "../../components/metric-card.js";
import { formatTimestamp } from "../../lib/format.js";
import { useI18n } from "../../lib/i18n.js";

export function LogSummaryCards({
  summary,
  fileCount,
}: {
  summary: LogSummary;
  fileCount: number;
}) {
  const { language, t } = useI18n();
  const errorCount = (summary.levelCounts.error ?? 0) + (summary.levelCounts.fatal ?? 0);

  return (
    <div className="metrics-grid">
      <MetricCard label={t("logs.metric.files")} value={fileCount} detail={summary.file?.date ?? summary.date} />
      <MetricCard label={t("logs.metric.totalLines")} value={summary.totalLines} />
      <MetricCard label={t("logs.metric.parsedLines")} value={summary.parsedLines} />
      <MetricCard
        label={t("logs.metric.errorCount")}
        value={errorCount}
        {...(summary.latestErrorAt ? { detail: formatTimestamp(summary.latestErrorAt, language) } : {})}
      />
    </div>
  );
}
