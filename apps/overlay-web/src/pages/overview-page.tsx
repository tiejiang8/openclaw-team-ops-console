import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { CoverageBadge } from "../components/coverage-badge.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { RuntimeStatusCard } from "../components/runtime/runtime-status-card.js";
import { StatusBadge } from "../components/status-badge.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { overlayApi } from "../lib/api.js";
import { getRuntimeStatus } from "../lib/api/runtime.js";
import { useResource } from "../lib/use-resource.js";

export function OverviewPage() {
  const { language, t, translateComponentType, translateFreshness, translateSignal, translateTargetSourceKind } = useI18n();
  const loadOverview = useCallback(async () => {
    const [health, summary, targets, risksSummary, coverage, runtimeStatus] = await Promise.all([
      overlayApi.getHealth(),
      overlayApi.getSummary(),
      overlayApi.getTargets(),
      overlayApi.getRisksSummary(),
      overlayApi.getCoverage(),
      getRuntimeStatus(),
    ]);

    return {
      health,
      summary,
      targets,
      risksSummary,
      coverage,
      runtimeStatus,
    };
  }, []);

  const { data, loading, error, retry } = useResource("overview", loadOverview, { refreshIntervalMs: 5000 });

  const drillDownItems = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      { to: "/targets", label: t("nav.targets"), count: data.targets.data.length },
      { to: "/coverage", label: t("nav.coverage"), count: data.coverage.data.collections.length },
      { to: "/agents", label: t("nav.agents"), count: data.summary.data.totals.agents },
      { to: "/workspaces", label: t("nav.workspaces"), count: data.summary.data.totals.workspaces },
      { to: "/sessions", label: t("nav.sessions"), count: data.summary.data.totals.sessions },
      { to: "/bindings", label: t("nav.bindings"), count: data.summary.data.totals.bindings },
      { to: "/auth-profiles", label: t("nav.authProfiles"), count: data.summary.data.totals.authProfiles },
      { to: "/cron", label: t("nav.cron"), count: data.runtimeStatus.data.cron.total },
      { to: "/nodes", label: t("nav.nodes"), count: data.runtimeStatus.data.nodes.paired },
      { to: "/topology", label: t("nav.topology"), count: data.summary.runtimeStatuses.length },
    ];
  }, [data, t]);

  const fleetMetrics = useMemo(() => {
    if (!data) {
      return {
        targetCount: 0,
        warningCount: 0,
        highestRiskScore: 0,
      };
    }

    return {
      targetCount: data.targets.data.length,
      warningCount: data.targets.data.reduce((count, target) => count + target.warningCount, 0),
      highestRiskScore: Math.max(...data.targets.data.map((target) => target.riskScore), 0),
    };
  }, [data]);

  const isEmpty = !loading && !error && data?.summary.runtimeStatuses.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("overview.title")}</h2>
        <p>{t("overview.description")}</p>
      </header>

      <PageObservability meta={data?.summary.meta} />

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("overview.emptyTitle")}
        emptyMessage={t("overview.emptyMessage")}
      >
        {data ? (
          <>
            <div className={`health-banner health-${data.health.status}`}>
              <p>
                {t("overview.healthPrefix")} <StatusBadge status={data.health.status} />{" "}
                {t("overview.healthSuffix", { count: data.summary.runtimeStatuses.length })}
              </p>
              <p>{t("overview.lastHealthCheck", { time: formatTimestamp(data.health.time, language) })}</p>
            </div>

            <div className="metrics-grid">
              <MetricCard label={t("runtime.gateway")} value={data.runtimeStatus.data.gateway.connectionState} />
              <MetricCard
                label={t("runtime.nodes")}
                value={data.runtimeStatus.data.nodes.connected}
                detail={`${data.runtimeStatus.data.nodes.paired} paired`}
              />
              <MetricCard
                label={t("runtime.cron")}
                value={data.runtimeStatus.data.cron.total}
                detail={`${data.runtimeStatus.data.cron.overdue} overdue`}
              />
              <MetricCard label={t("overview.metric.targets")} value={fleetMetrics.targetCount} />
              <MetricCard label={t("overview.metric.targetWarnings")} value={fleetMetrics.warningCount} />
              <MetricCard label={t("overview.metric.targetRisk")} value={fleetMetrics.highestRiskScore} />
              <MetricCard label={t("overview.metric.openFindings")} value={data.risksSummary.data.openFindings} />
              <MetricCard label={t("overview.metric.criticalFindings")} value={data.risksSummary.data.bySeverity.critical} />
              <MetricCard label={t("overview.metric.staleTargets")} value={data.risksSummary.data.staleTargets} />
              <MetricCard label={t("overview.metric.agents")} value={data.summary.data.totals.agents} />
              <MetricCard label={t("overview.metric.workspaces")} value={data.summary.data.totals.workspaces} />
              <MetricCard
                label={t("overview.metric.sessions")}
                value={data.summary.data.totals.sessions}
                detail={t("common.activeCount", { count: data.summary.data.activeSessions })}
              />
              <MetricCard label={t("overview.metric.bindings")} value={data.summary.data.totals.bindings} />
              <MetricCard label={t("overview.metric.authProfiles")} value={data.summary.data.totals.authProfiles} />
              <MetricCard label={t("overview.metric.coverageCollections")} value={data.coverage.data.collections.length} />
              <MetricCard label={t("overview.metric.snapshotTime")} value={formatTimestamp(data.summary.meta.generatedAt, language)} />
            </div>

            <RuntimeStatusCard runtime={data.runtimeStatus.data} />

            <div className="panel">
              <div className="panel-header">
                <h3>{t("overview.targetsTitle")}</h3>
                <p>{t("overview.targetsDescription")}</p>
              </div>

              <div className="target-grid">
                {data.targets.data.map((target) => (
                  <Link key={target.id} className="target-card" to={`/targets/${target.id}`}>
                    <div className="target-card-header">
                      <div>
                        <div className="cell-title">{target.name}</div>
                        <div className="cell-subtitle">{target.id}</div>
                      </div>
                      <StatusBadge status={target.status} />
                    </div>
                    <div className="target-card-meta">
                      <span>{translateTargetSourceKind(target.sourceKind)}</span>
                      <span>{translateFreshness(target.freshness)}</span>
                    </div>
                    <div className="target-card-stats">
                      <span>{t("targets.table.warnings")}: {target.warningCount}</span>
                      <span>{t("targets.table.risk")}: {target.riskScore}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("overview.risksTitle")}</h3>
                <p>{t("overview.risksDescription")}</p>
              </div>

              <div className="target-grid">
                {data.risksSummary.data.targetBreakdown.slice(0, 4).map((targetRisk) => (
                  <Link key={targetRisk.targetId} className="target-card" to="/risks">
                    <div className="target-card-header">
                      <div>
                        <div className="cell-title">{targetRisk.targetName}</div>
                        <div className="cell-subtitle">{targetRisk.targetId}</div>
                      </div>
                      <span className="signal-badge signal-high">{targetRisk.highestScore}</span>
                    </div>
                    <div className="target-card-meta">
                      <span>{t("overview.metric.openFindings")}: {targetRisk.openFindings}</span>
                      <span>{t("risks.table.severity")}: {targetRisk.highestSeverity ? translateSignal(targetRisk.highestSeverity) : "-"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("overview.coverageTitle")}</h3>
                <p>{t("overview.coverageDescription")}</p>
              </div>

              <div className="target-grid">
                <Link className="target-card" to="/coverage">
                  <div className="target-card-header">
                    <div>
                      <div className="cell-title">{t("coverage.panelTitle")}</div>
                      <div className="cell-subtitle">{data.coverage.data.collections.length}</div>
                    </div>
                    <CoverageBadge coverage={data.coverage.meta.coverage} />
                  </div>
                  <div className="target-card-meta">
                    <span>{t("coverage.metric.complete")}: {data.coverage.data.collections.filter((collection) => collection.coverage === "complete").length}</span>
                    <span>{t("coverage.metric.partial")}: {data.coverage.data.collections.filter((collection) => collection.coverage === "partial").length}</span>
                  </div>
                  <div className="target-card-stats">
                    <span>{t("coverage.metric.unavailable")}: {data.coverage.data.collections.filter((collection) => collection.coverage === "unavailable").length}</span>
                    <span>{t("common.warnings")}: {data.coverage.data.collections.reduce((count, collection) => count + collection.warningCount, 0)}</span>
                  </div>
                </Link>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("overview.drilldownTitle")}</h3>
                <p>{t("overview.drilldownDescription")}</p>
              </div>

              <div className="drilldown-grid">
                {drillDownItems.map((item) => (
                  <Link key={item.to} className="drilldown-card" to={item.to}>
                    <span className="drilldown-label">{item.label}</span>
                    <span className="drilldown-count">{item.count}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("overview.runtimeStatusTitle")}</h3>
                <p>{t("common.generatedAt", { time: formatTimestamp(data.summary.meta.generatedAt, language) })}</p>
              </div>

              <div className="table-wrap">
                <table className="data-table density-comfortable">
                  <thead>
                    <tr>
                      <th>{t("overview.table.component")}</th>
                      <th>{t("overview.table.type")}</th>
                      <th>{t("overview.table.status")}</th>
                      <th>{t("overview.table.observed")}</th>
                      <th>{t("overview.table.details")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.runtimeStatuses.map((runtimeStatus) => (
                      <tr key={runtimeStatus.componentId}>
                        <td className="cell-mono">{runtimeStatus.componentId}</td>
                        <td>{translateComponentType(runtimeStatus.componentType)}</td>
                        <td>
                          <StatusBadge status={runtimeStatus.status} />
                        </td>
                        <td>{formatTimestamp(runtimeStatus.observedAt, language)}</td>
                        <td>
                          {Object.entries(runtimeStatus.details)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(" | ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
