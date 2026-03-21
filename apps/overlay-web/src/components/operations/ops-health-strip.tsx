import type { OperationsDashboard } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { MetricCard } from "../metric-card.js";

export function OpsHealthStrip({ dashboard }: { dashboard: OperationsDashboard }) {
  const { t } = useI18n();
  const summary =
    dashboard.staleNodes > 0 || dashboard.overdueCron > 0 || dashboard.errors24h > 0
      ? t("operations.summaryHotspot", {
          label:
            dashboard.staleNodes > 0
              ? t("operations.staleNodes")
              : dashboard.overdueCron > 0
                ? t("operations.overdueCron")
                : t("operations.logErrors24h"),
        })
      : t("operations.summaryHealthy");

  return (
    <section className="dashboard-health-strip">
      <MetricCard label={t("operations.healthScore")} value={`${dashboard.healthScore}/100`} detail={summary} />
      <MetricCard
        label={t("operations.logErrors24h")}
        value={dashboard.errors24h}
        detail={`${t("runtime.gateway")} ${t(`status.${dashboard.connectionState}`)}`}
      />
      <MetricCard label={t("operations.staleNodes")} value={dashboard.staleNodes} />
      <MetricCard label={t("operations.overdueCron")} value={dashboard.overdueCron} />
    </section>
  );
}
