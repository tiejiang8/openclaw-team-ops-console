import type { OperationsDashboard } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { MetricCard } from "../metric-card.js";

export function OpsHealthStrip({ dashboard }: { dashboard: OperationsDashboard }) {
  const { t } = useI18n();

  return (
    <section className="dashboard-health-strip">
      <MetricCard label={t("operations.healthScore")} value={`${dashboard.healthScore}/100`} detail={dashboard.summary} />
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
