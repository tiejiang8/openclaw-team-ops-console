import { useI18n } from "../../lib/i18n.js";

type MetricConfidenceTone = "proxy" | "limited" | "early";

export function MetricConfidenceBadge({
  tone,
  label,
}: {
  tone: MetricConfidenceTone;
  label?: string;
}) {
  const { t } = useI18n();

  return <span className={`metric-confidence-badge metric-confidence-badge-${tone}`}>{label ?? t(`metricConfidence.${tone}`)}</span>;
}
