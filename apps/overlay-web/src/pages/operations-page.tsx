import { DataState } from "../components/data-state.js";
import { SourceTracePanel } from "../components/evidence/source-trace-panel.js";
import { EvidencePill } from "../components/evidence/evidence-pill.js";
import { ErrorTrendCard } from "../components/operations/error-trend-card.js";
import { ExceptionBreakdownCard } from "../components/operations/exception-breakdown-card.js";
import { ConfigHealthCard } from "../components/operations/config-health-card.js";
import { HotspotsCard } from "../components/operations/hotspots-card.js";
import { OpsHealthStrip } from "../components/operations/ops-health-strip.js";
import { PageObservability } from "../components/page-observability.js";
import { DrilldownLink } from "../components/evidence/drilldown-link.js";
import { EmptyPanel } from "../components/state/empty-panel.js";
import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { useRefreshPreferences } from "../lib/refresh-preferences.js";
import { useResource } from "../lib/use-resource.js";

export function OperationsPage() {
  const { t } = useI18n();
  const { intervalMs, autoRefreshEnabled } = useRefreshPreferences();
  const { data, loading, error, retry } = useResource(
    "dashboard-operations",
    overlayApi.getDashboardOperations,
    {
      refreshIntervalMs: intervalMs,
      autoRefreshEnabled,
      preserveDataOnError: true,
      errorBackoffMs: 60_000,
    },
  );
  const hasRecentCronFailure = Boolean(
    data?.data.recentActivity.some(
      (event) =>
        event.type === "cron" &&
        (event.severity === "warn" || event.severity === "error" || event.severity === "critical") &&
        /fail|overdue/i.test(event.message),
    ),
  );
  const activitySummary = data
    ? data.data.errors24h > 0
      ? t("operations.activitySummary.errors", { count: data.data.errors24h })
      : data.data.staleNodes > 0
        ? t("operations.activitySummary.stale", { count: data.data.staleNodes })
        : data.data.overdueCron > 0
          ? t("operations.activitySummary.cron", { count: data.data.overdueCron })
          : hasRecentCronFailure
            ? t("operations.activitySummary.cronFailure")
            : t("operations.activitySummary.healthy")
    : "";

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("operations.title")}</h2>
        <p>{t("operations.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        preserveChildrenOnError={Boolean(data)}
        staleWarning={error && data ? t("refresh.lastDataRetained") : null}
      >
        {data ? (
          <>
            <OpsHealthStrip dashboard={data.data} />

            <div className="dashboard-grid dashboard-grid-2">
              <ErrorTrendCard points={data.data.trendPoints} />
              <ExceptionBreakdownCard hotspots={data.data.hotspots} />
            </div>

            <div className="dashboard-grid dashboard-grid-2">
              <ConfigHealthCard configHealth={data.data.configHealth} />
              <HotspotsCard hotspots={data.data.hotspots} />
            </div>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>{t("overview.recentActivityTitle")}</h3>
                  <p>{activitySummary}</p>
                </div>
              </div>
              {data.data.recentActivity.length > 0 ? (
                <div className="timeline-mini">
                  {data.data.recentActivity.map((event) => (
                    <div key={event.id} className="timeline-mini-item">
                      <span className={`signal-dot signal-${event.severity}`}></span>
                      <span className="event-message-mini">{event.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title={t("operations.activityEmptyTitle")}
                  message={t("operations.activityEmptyDescription")}
                />
              )}
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>{t("operations.nextDrilldownsTitle")}</h3>
                  <p>{t("operations.nextDrilldownsDescription")}</p>
                </div>
              </div>
              <div className="dashboard-card-actions">
                {data.data.quickLinks.map((link) => (
                  <DrilldownLink key={`${link.label}-${link.to}`} link={link} tone="subtle" />
                ))}
              </div>
            </article>

            <SourceTracePanel trace={data.data.sourceTrace} />

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>{t("dashboard.evidenceTitle")}</h3>
                  <p>{t("dashboard.evidenceDescription")}</p>
                </div>
              </div>
              <div className="evidence-pill-row">
                {data.data.evidenceRefs.map((evidence) => (
                  <EvidencePill key={evidence.id} evidence={evidence} />
                ))}
              </div>
            </article>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
