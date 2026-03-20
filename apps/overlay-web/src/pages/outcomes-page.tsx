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
import { useResource } from "../lib/use-resource.js";

export function OutcomesPage() {
  const { t } = useI18n();
  const { data, loading, error, retry } = useResource(
    "dashboard-outcomes",
    overlayApi.getDashboardOutcomes,
    { refreshIntervalMs: 20000 },
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
              <MetricCard label="Active teams" value={data.data.activeTeams} />
              <MetricCard label="Repeated usage teams" value={data.data.repeatedUsageTeams} />
              <MetricCard label="High-intensity workspaces" value={data.data.highIntensityWorkspaces} />
              <MetricCard label="Biggest blocker" value={data.data.biggestBlocker} />
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
                    <h3>Value signals</h3>
                    <p>Signals that help answer whether expansion is compounding or stalling.</p>
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
                  <h3>Promotion blockers</h3>
                  <p>What to clear first before pushing wider rollout.</p>
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
                  <h3>Next drilldowns</h3>
                  <p>Review adoption, governance, and outcome pages side by side before pushing broader rollout.</p>
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
