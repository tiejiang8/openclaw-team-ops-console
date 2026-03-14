import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { StatusBadge } from "../components/status-badge.js";
import { formatTimestamp } from "../lib/format.js";
import { overlayApi } from "../lib/api.js";
import { useResource } from "../lib/use-resource.js";

export function OverviewPage() {
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
      { to: "/agents", label: "Agents", count: data.summary.data.totals.agents },
      { to: "/workspaces", label: "Workspaces", count: data.summary.data.totals.workspaces },
      { to: "/sessions", label: "Sessions", count: data.summary.data.totals.sessions },
      { to: "/bindings", label: "Bindings", count: data.summary.data.totals.bindings },
      { to: "/auth-profiles", label: "Auth Profiles", count: data.summary.data.totals.authProfiles },
      { to: "/topology", label: "Topology", count: data.summary.runtimeStatuses.length },
    ];
  }, [data]);

  const isEmpty = !loading && !error && data?.summary.runtimeStatuses.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>Overview Dashboard</h2>
        <p>Read-only inventory and runtime health summary for team operations.</p>
      </header>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle="Runtime status is currently unavailable"
        emptyMessage="Retry to refresh the current system snapshot."
      >
        {data ? (
          <>
            <div className={`health-banner health-${data.health.status}`}>
              <p>
                Overlay API health is <StatusBadge status={data.health.status} /> with {data.summary.runtimeStatuses.length} runtime components observed.
              </p>
              <p>Last health check: {formatTimestamp(data.health.time)}</p>
            </div>

            <div className="metrics-grid">
              <MetricCard label="Agents" value={data.summary.data.totals.agents} />
              <MetricCard label="Workspaces" value={data.summary.data.totals.workspaces} />
              <MetricCard label="Sessions" value={data.summary.data.totals.sessions} detail={`${data.summary.data.activeSessions} active`} />
              <MetricCard label="Bindings" value={data.summary.data.totals.bindings} />
              <MetricCard label="Auth Profiles" value={data.summary.data.totals.authProfiles} />
              <MetricCard label="Snapshot Time" value={formatTimestamp(data.summary.meta.generatedAt)} />
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Drill-down Paths</h3>
                <p>Navigate directly to inventory views</p>
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
                <h3>Runtime Status</h3>
                <p>Snapshot generated {formatTimestamp(data.summary.meta.generatedAt)}</p>
              </div>

              <div className="table-wrap">
                <table className="data-table density-comfortable">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Observed</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.runtimeStatuses.map((runtimeStatus) => (
                      <tr key={runtimeStatus.componentId}>
                        <td className="cell-mono">{runtimeStatus.componentId}</td>
                        <td>{runtimeStatus.componentType}</td>
                        <td>
                          <StatusBadge status={runtimeStatus.status} />
                        </td>
                        <td>{formatTimestamp(runtimeStatus.observedAt)}</td>
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
