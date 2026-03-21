import { useCallback } from "react";
import { Link } from "react-router-dom";

import { AttentionCard } from "../components/dashboard/attention-card.js";
import { HeroKpiCard } from "../components/dashboard/hero-kpi-card.js";
import { RoleSummaryCard } from "../components/dashboard/role-summary-card.js";
import { SectionCollapse } from "../components/dashboard/section-collapse.js";
import { DataState } from "../components/data-state.js";
import { PageObservability } from "../components/page-observability.js";
import { useStreamRefresh } from "../components/streaming-provider.js";
import { RuntimeStatusCard } from "../components/runtime/runtime-status-card.js";
import { ConnectionChecklist } from "../components/runtime/connection-checklist.js";
import { EvidencePill } from "../components/evidence/evidence-pill.js";
import { SourceTracePanel } from "../components/evidence/source-trace-panel.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { overlayApi } from "../lib/api.js";
import { useRefreshPreferences } from "../lib/refresh-preferences.js";
import { useResource } from "../lib/use-resource.js";

export function OverviewPage() {
  const { language, t, translateTargetSourceKind, translateFreshness, translateSignal } = useI18n();
  const { intervalMs, autoRefreshEnabled } = useRefreshPreferences();

  const { data, loading, error, retry } = useResource(
    "dashboard-overview",
    overlayApi.getDashboardOverview,
    {
      refreshIntervalMs: intervalMs,
      autoRefreshEnabled,
      preserveDataOnError: true,
      errorBackoffMs: 60_000,
    },
  );
  const { data: bootstrapData, retry: retryBootstrap } = useResource("bootstrap-status", overlayApi.getBootstrapStatus, {
    autoRefreshEnabled: false,
    preserveDataOnError: true,
  });

  useStreamRefresh("activity", retry, { enabled: autoRefreshEnabled, throttleMs: intervalMs || 30_000 });
  useStreamRefresh("bootstrap_status", retryBootstrap, {
    enabled: autoRefreshEnabled,
    throttleMs: intervalMs || 30_000,
  });

  const isEmpty = !loading && !error && (data?.data.heroKpis.length ?? 0) === 0;
  const bootstrapSummary = bootstrapData?.data
    ? bootstrapData.data.operatorReadReady
      ? t("dashboard.directChecksReady")
      : t("dashboard.directChecksNeedsReview")
    : t("dashboard.directChecksDescription");

  const renderRecentActivity = useCallback(() => {
    if (!data?.data.recentActivity.length) {
      return <p className="state-message">{t("activity.empty")}</p>;
    }

    return (
      <div className="timeline-mini">
        {data.data.recentActivity.map((event) => (
          <div key={event.id} className="timeline-mini-item">
            <span className={`signal-dot signal-${event.severity}`}></span>
            <span className="event-time-mini">{formatTimestamp(event.timestamp, language)}</span>
            <span className="event-message-mini">{event.message}</span>
          </div>
        ))}
      </div>
    );
  }, [data?.data.recentActivity, language, t]);

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("overview.title")}</h2>
        <p>{t("overview.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("overview.emptyTitle")}
        emptyMessage={t("overview.emptyMessage")}
        preserveChildrenOnError={Boolean(data)}
        staleWarning={error && data ? t("refresh.lastDataRetained") : null}
      >
        {data ? (
          <>
            <section className="dashboard-section">
              <div className="section-heading">
                <h3>{t("dashboard.heroTitle")}</h3>
                <p>{t("dashboard.heroDescription")}</p>
              </div>
              <div className="overview-hero-grid">
                {data.data.heroKpis.map((kpi) => (
                  <HeroKpiCard key={kpi.id} kpi={kpi} />
                ))}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <h3>{t("dashboard.attentionTitle")}</h3>
                <p>{t("dashboard.attentionDescription")}</p>
              </div>
              <div className="dashboard-grid dashboard-grid-3">
                {data.data.attentionItems.map((item) => (
                  <AttentionCard key={item.id} item={item} />
                ))}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <h3>{t("dashboard.roleSummaryTitle")}</h3>
                <p>{t("dashboard.roleSummaryDescription")}</p>
              </div>
              <div className="dashboard-grid dashboard-grid-4">
                {data.data.roleEntries.map((entry) => (
                  <RoleSummaryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>

            {bootstrapData?.data ? (
              <SectionCollapse
                title={t("dashboard.directChecksTitle")}
                description={bootstrapSummary}
              >
                <ConnectionChecklist status={bootstrapData.data as never} />
              </SectionCollapse>
            ) : null}

            <div className="dashboard-grid dashboard-grid-2">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>{t("overview.recentActivityTitle")}</h3>
                    <p>{t("dashboard.recentActivityDescription")}</p>
                  </div>
                  <Link to="/activity" className="inline-link">
                    {t("common.viewDetails")} →
                  </Link>
                </div>
                <div className="panel-content">{renderRecentActivity()}</div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>{t("dashboard.riskSnapshotTitle")}</h3>
                    <p>{t("dashboard.riskSnapshotDescription")}</p>
                  </div>
                </div>
                <div className="dashboard-list">
                  {data.data.topRisks.map((item) => (
                    <Link key={item.targetId} className="dashboard-list-item dashboard-list-item-wide" to={item.to}>
                      <div>
                        <div className="cell-title">{item.targetName}</div>
                        <div className="cell-subtitle">
                          {t("dashboard.openFindingsCount", { count: item.openFindings })} •{" "}
                          {t("dashboard.riskScore", { score: item.highestScore })}
                        </div>
                      </div>
                      <span className="signal-badge signal-high">
                        {item.highestSeverity ? translateSignal(item.highestSeverity) : t("common.latest")}
                      </span>
                    </Link>
                  ))}
                </div>
              </article>
            </div>

            <div className="dashboard-grid dashboard-grid-2">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>{t("dashboard.targetSnapshotTitle")}</h3>
                    <p>{t("dashboard.targetSnapshotDescription")}</p>
                  </div>
                  <Link to="/targets" className="inline-link">
                    {t("common.viewDetails")} →
                  </Link>
                </div>
                <div className="dashboard-list">
                  {data.data.targetSnapshot.map((target) => (
                    <Link key={target.id} className="dashboard-list-item dashboard-list-item-wide" to={target.to}>
                      <div>
                        <div className="cell-title">{target.label}</div>
                        <div className="cell-subtitle">
                          {translateTargetSourceKind(target.sourceKind)} • {translateFreshness(target.freshness)} •{" "}
                          {t("dashboard.warningCount", { count: target.warningCount })}
                        </div>
                      </div>
                      <span className="signal-badge signal-medium">{target.riskScore}</span>
                    </Link>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>{t("dashboard.coverageSnapshotTitle")}</h3>
                    <p>{t("dashboard.coverageSnapshotDescription")}</p>
                  </div>
                  <Link to={data.data.coverageHighlight.detailLink.to} className="inline-link">
                    {t("common.viewDetails")} →
                  </Link>
                </div>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <p className="metric-label">{t("coverage.metric.complete")}</p>
                    <p className="metric-value">{data.data.coverageHighlight.complete}</p>
                  </div>
                  <div className="metric-card">
                    <p className="metric-label">{t("coverage.metric.partial")}</p>
                    <p className="metric-value">{data.data.coverageHighlight.partial}</p>
                  </div>
                  <div className="metric-card">
                    <p className="metric-label">{t("coverage.metric.unavailable")}</p>
                    <p className="metric-value">{data.data.coverageHighlight.unavailable}</p>
                  </div>
                  <div className="metric-card">
                    <p className="metric-label">{t("common.warnings")}</p>
                    <p className="metric-value">{data.data.coverageHighlight.warnings}</p>
                  </div>
                </div>
              </article>
            </div>

            <RuntimeStatusCard runtime={data.data.runtime} />
            <SourceTracePanel trace={data.data.sourceTrace} />

            {data.data.heroKpis.some((item) => item.evidenceRefs.length > 0) ? (
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>{t("dashboard.evidenceTitle")}</h3>
                    <p>{t("dashboard.evidenceDescription")}</p>
                  </div>
                </div>
                <div className="evidence-pill-row">
                  {data.data.heroKpis.flatMap((item) => item.evidenceRefs).slice(0, 8).map((evidence) => (
                    <EvidencePill key={evidence.id} evidence={evidence} />
                  ))}
                </div>
              </article>
            ) : null}
          </>
        ) : null}
      </DataState>
    </section>
  );
}
