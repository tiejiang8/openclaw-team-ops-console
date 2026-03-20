import { DataState } from "../components/data-state.js";
import { SourceTracePanel } from "../components/evidence/source-trace-panel.js";
import { EvidencePill } from "../components/evidence/evidence-pill.js";
import { AdoptionKpiStrip } from "../components/adoption/adoption-kpi-strip.js";
import { RetentionProxyCard } from "../components/adoption/retention-proxy-card.js";
import { TopAgentsCard } from "../components/adoption/top-agents-card.js";
import { TopWorkspacesCard } from "../components/adoption/top-workspaces-card.js";
import { UsageHeatmapCard } from "../components/adoption/usage-heatmap-card.js";
import { UsageTrendCard } from "../components/adoption/usage-trend-card.js";
import { PageObservability } from "../components/page-observability.js";
import { DrilldownLink } from "../components/evidence/drilldown-link.js";
import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { useRefreshPreferences } from "../lib/refresh-preferences.js";
import { useResource } from "../lib/use-resource.js";

export function AdoptionPage() {
  const { t } = useI18n();
  const { intervalMs, autoRefreshEnabled } = useRefreshPreferences();
  const { data, loading, error, retry } = useResource(
    "dashboard-adoption",
    overlayApi.getDashboardAdoption,
    {
      refreshIntervalMs: intervalMs,
      autoRefreshEnabled,
    },
  );

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("adoption.title")}</h2>
        <p>{t("adoption.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <AdoptionKpiStrip dashboard={data.data} />

            <div className="dashboard-grid dashboard-grid-2">
              <UsageTrendCard points={data.data.trendPoints} />
              <UsageHeatmapCard buckets={data.data.hourlyHeatmap} />
            </div>

            <div className="dashboard-grid dashboard-grid-2">
              <TopWorkspacesCard workspaces={data.data.topWorkspaces} />
              <TopAgentsCard agents={data.data.topAgents} />
            </div>

            <RetentionProxyCard retention={data.data.retention} />

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>{t("adoption.nextDrilldownsTitle")}</h3>
                  <p>{t("adoption.nextDrilldownsDescription")}</p>
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
