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

function translateBlocker(blocker: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (blocker) {
    case "Configuration mismatch is slowing broader rollout":
      return t("outcomes.blocker.configMismatch");
    case "Auth coverage gaps are slowing broader rollout":
      return t("outcomes.blocker.authGaps");
    case "Critical findings are still blocking confident expansion":
      return t("outcomes.blocker.criticalFindings");
    case "Usage breadth still needs stronger multi-team repetition":
      return t("outcomes.blocker.usageBreadth");
    default:
      return blocker;
  }
}

function translateBlockerLabel(blocker: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (blocker) {
    case "Configuration mismatch is slowing broader rollout":
      return t("outcomes.blockerLabel.configMismatch");
    case "Auth coverage gaps are slowing broader rollout":
      return t("outcomes.blockerLabel.authGaps");
    case "Critical findings are still blocking confident expansion":
      return t("outcomes.blockerLabel.criticalFindings");
    case "Usage breadth still needs stronger multi-team repetition":
      return t("outcomes.blockerLabel.usageBreadth");
    default:
      return translateBlocker(blocker, t);
  }
}

function translateOutcomeNote(note: string, t: ReturnType<typeof useI18n>["t"]) {
  const authMatch = /^(\d+) auth coverage gaps remain visible in the latest snapshot\.$/.exec(note);
  if (authMatch) {
    return t("outcomes.blocker.authSnapshot", { count: Number(authMatch[1]) });
  }

  const coverageMatch = /^(\d+) coverage gaps are reducing confidence in cross-team rollout visibility\.$/.exec(note);
  if (coverageMatch) {
    return t("outcomes.blocker.coverageSnapshot", { count: Number(coverageMatch[1]) });
  }

  return translateBlocker(note, t);
}

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
  const sampleLimited = (data?.data.activeTeams ?? 0) < 2 || (data?.data.repeatedUsageTeams ?? 0) === 0;
  const coarseAttribution = Boolean(
    data?.data.teamCoverage.length &&
      data.data.teamCoverage.every((team) => team.team === "Unassigned team"),
  );
  const translatedBlocker = data ? translateBlocker(data.data.biggestBlocker, t) : "";
  const blockerMetricValue = data ? translateBlockerLabel(data.data.biggestBlocker, t) : "";
  const executiveSummary = data
    ? data.data.activeTeams === 0
      ? t("outcomes.executiveSummary.early", { blocker: translatedBlocker })
      : sampleLimited
        ? t("outcomes.executiveSummary.limited", {
            count: data.data.activeTeams,
            blocker: translatedBlocker,
          })
        : t("outcomes.executiveSummary.active", {
            count: data.data.activeTeams,
            blocker: translatedBlocker,
          })
    : "";
  const blockerChips = data ? data.data.blockers.map((blocker) => translateOutcomeNote(blocker, t)) : [];

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
              <MetricCard
                label={t("outcomes.metric.biggestBlocker")}
                value={blockerMetricValue}
                detail={translatedBlocker}
              />
            </section>

            <div className="state-box state-box-warning panel-inline-note">
              <p className="state-title">{sampleLimited ? t("outcomes.observationTitle") : t("outcomes.rolloutStatusTitle")}</p>
              <p className="state-message">
                {sampleLimited ? t("outcomes.observationDescription") : t("outcomes.rolloutStatusDescription")}
              </p>
            </div>

            <ExecutiveSummaryCard
              summary={executiveSummary}
              biggestBlocker={translatedBlocker}
              recommendedFocus={data.data.recommendedFocus}
              confidenceTone={sampleLimited ? "limited" : "early"}
            />

            <div className="dashboard-grid dashboard-grid-2">
              <TeamCoverageCard teams={data.data.teamCoverage} coarseAttribution={coarseAttribution} />
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>{t("outcomes.valueSignalsTitle")}</h3>
                    <p>{t("outcomes.valueSignalsDescription")}</p>
                  </div>
                </div>
                {sampleLimited ? (
                  <div className="state-box state-box-warning panel-inline-note">
                    <p className="state-title">{t("outcomes.sampleLimitedTitle")}</p>
                    <p className="state-message">{t("outcomes.sampleLimitedDescription")}</p>
                  </div>
                ) : null}
                <div className="dashboard-grid dashboard-grid-1">
                  {data.data.valueSignals.map((signal) => (
                    <ValueSignalCard key={signal.label} signal={signal} confidenceTone={sampleLimited ? "limited" : "early"} />
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
                {blockerChips.map((blocker) => (
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
