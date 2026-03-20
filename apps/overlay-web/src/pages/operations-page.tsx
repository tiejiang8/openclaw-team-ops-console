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
import { overlayApi } from "../lib/api.js";
import { useResource } from "../lib/use-resource.js";
import { useI18n } from "../lib/i18n.js";

export function OperationsPage() {
  const { t } = useI18n();
  const { data, loading, error, retry } = useResource(
    "dashboard-operations",
    overlayApi.getDashboardOperations,
    { refreshIntervalMs: 15000 },
  );

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("operations.title")}</h2>
        <p>{t("operations.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
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
                  <p>{data.data.impactSummary}</p>
                </div>
              </div>
              <div className="timeline-mini">
                {data.data.recentActivity.map((event) => (
                  <div key={event.id} className="timeline-mini-item">
                    <span className={`signal-dot signal-${event.severity}`}></span>
                    <span className="event-message-mini">{event.message}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Next drilldowns</h3>
                  <p>Open the most relevant read-only workbench before you lose context.</p>
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
