import { DataState } from "../components/data-state.js";
import { EvidencePill } from "../components/evidence/evidence-pill.js";
import { SourceTracePanel } from "../components/evidence/source-trace-panel.js";
import { DrilldownLink } from "../components/evidence/drilldown-link.js";
import { ConfigComplianceCard } from "../components/governance/config-compliance-card.js";
import { FindingsBriefCard } from "../components/governance/findings-brief-card.js";
import { RecommendationPriorityCard } from "../components/governance/recommendation-priority-card.js";
import { RiskPostureCard } from "../components/governance/risk-posture-card.js";
import { PageObservability } from "../components/page-observability.js";
import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";

export function GovernancePage() {
  const { t } = useI18n();
  const { data, loading, error, retry } = useResource(
    "dashboard-governance",
    overlayApi.getDashboardGovernance,
    { refreshIntervalMs: 20000 },
  );

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("governance.title")}</h2>
        <p>{t("governance.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <RiskPostureCard posture={data.data.riskPosture} />

            <div className="dashboard-grid dashboard-grid-2">
              <ConfigComplianceCard gaps={data.data.complianceGaps} />
              <RecommendationPriorityCard priorities={data.data.recommendationPriorities} />
            </div>

            <FindingsBriefCard findings={data.data.findingsBrief} />

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Next drilldowns</h3>
                  <p>Every governance conclusion should still resolve back to a finding, recommendation, or evidence record.</p>
                </div>
              </div>
              <div className="dashboard-card-actions">
                {data.data.evidenceLinks.map((link) => (
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
