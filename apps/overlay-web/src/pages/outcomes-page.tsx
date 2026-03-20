import { DataState } from "../components/data-state.js";
import { EvidencePill } from "../components/evidence/evidence-pill.js";
import { SourceTracePanel } from "../components/evidence/source-trace-panel.js";
import { DrilldownLink } from "../components/evidence/drilldown-link.js";
import { ExecutiveSummaryCard } from "../components/outcomes/executive-summary-card.js";
import { TeamCoverageCard } from "../components/outcomes/team-coverage-card.js";
import { ValueSignalCard } from "../components/outcomes/value-signal-card.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { useRefreshPreferences } from "../lib/refresh-preferences.js";
import { useResource } from "../lib/use-resource.js";

export function OutcomesPage() {
  const { t } = useI18n();
  const { intervalMs, autoRefreshEnabled } = useRefreshPreferences();
  const { data, loading, error, retry } = useResource(
    "dashboard-outcomes",
    overlayApi.getDashboardOutcomes,
    {
      refreshIntervalMs: intervalMs,
      autoRefreshEnabled,
    },
  );

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("outcomes.title")}</h2>
        <p>{t("outcomes.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <section className="dashboard-health-strip">
              <MetricCard label={t("outcomes.metric.activeTeams")} value={data.data.activeTeams} />
              <MetricCard label={t("outcomes.metric.repeatedUsageTeams")} value={data.data.repeatedUsageTeams} />
              <MetricCard label={t("outcomes.metric.highIntensityWorkspaces")} value={data.data.highIntensityWorkspaces} />
              <MetricCard label={t("outcomes.metric.biggestBlocker")} value={data.data.biggestBlocker} />
            </section>

            <ExecutiveSummaryCard
              summary={data.data.executiveSummary}
              biggestBlocker={data.data.biggestBlocker}
              recommendedFocus={data.data.recommendedFocus}
            />

            <div className="dashboard-grid dashboard-grid-2">
              <TeamCoverageCard teams={data.data.teamCoverage} />
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>{t("outcomes.valueSignalsTitle")}</h3>
                    <p>{t("outcomes.valueSignalsDescription")}</p>
                  </div>
                </div>
                <div className="dashboard-grid dashboard-grid-1">
                  {data.data.valueSignals.map((signal) => (
                    <ValueSignalCard key={signal.label} signal={signal} />
                  ))}
                </div>
              </article>
            </div>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>{t("outcomes.promotionBlockersTitle")}</h3>
                  <p>{t("outcomes.promotionBlockersDescription")}</p>
                </div>
              </div>
              <div className="chip-row">
                {data.data.blockers.map((blocker) => (
                  <span key={blocker} className="meta-chip meta-chip-warning">
                    {blocker}
                  </span>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>{t("outcomes.nextDrilldownsTitle")}</h3>
                  <p>{t("outcomes.nextDrilldownsDescription")}</p>
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
