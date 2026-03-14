import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { StatusBadge } from "../components/status-badge.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { overlayApi } from "../lib/api.js";
import { useResource } from "../lib/use-resource.js";

export function OverviewPage() {
  const { language, t, translateComponentType } = useI18n();
  const loadOverview = useCallback(async () => {
    const [health, summary] = await Promise.all([overlayApi.getHealth(), overlayApi.getSummary()]);

    return {
      health,
      summary,
    };
  }, []);

  const { data, loading, error, retry } = useResource("overview", loadOverview);

  const drillDownItems = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      { to: "/agents", label: t("nav.agents"), count: data.summary.data.totals.agents },
      { to: "/workspaces", label: t("nav.workspaces"), count: data.summary.data.totals.workspaces },
      { to: "/sessions", label: t("nav.sessions"), count: data.summary.data.totals.sessions },
      { to: "/bindings", label: t("nav.bindings"), count: data.summary.data.totals.bindings },
      { to: "/auth-profiles", label: t("nav.authProfiles"), count: data.summary.data.totals.authProfiles },
      { to: "/topology", label: t("nav.topology"), count: data.summary.runtimeStatuses.length },
    ];
  }, [data, t]);

  const isEmpty = !loading && !error && data?.summary.runtimeStatuses.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("overview.title")}</h2>
        <p>{t("overview.description")}</p>
      </header>

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
              <MetricCard label={t("overview.metric.agents")} value={data.summary.data.totals.agents} />
              <MetricCard label={t("overview.metric.workspaces")} value={data.summary.data.totals.workspaces} />
              <MetricCard
                label={t("overview.metric.sessions")}
                value={data.summary.data.totals.sessions}
                detail={t("common.activeCount", { count: data.summary.data.activeSessions })}
              />
              <MetricCard label={t("overview.metric.bindings")} value={data.summary.data.totals.bindings} />
              <MetricCard label={t("overview.metric.authProfiles")} value={data.summary.data.totals.authProfiles} />
              <MetricCard label={t("overview.metric.snapshotTime")} value={formatTimestamp(data.summary.meta.generatedAt, language)} />
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
