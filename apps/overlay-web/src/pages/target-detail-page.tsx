import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";

function CoverageSummary({
  completeCollections,
  partialCollections,
  unavailableCollections,
  t,
}: {
  completeCollections: number;
  partialCollections: number;
  unavailableCollections: number;
  t: (key: string) => string;
}) {
  return (
    <div className="coverage-list">
      <span className="coverage-pill coverage-pill-complete">
        {completeCollections} {t("targets.coverageComplete")}
      </span>
      <span className="coverage-pill coverage-pill-partial">
        {partialCollections} {t("targets.coveragePartial")}
      </span>
      <span className="coverage-pill coverage-pill-unavailable">
        {unavailableCollections} {t("targets.coverageUnavailable")}
      </span>
    </div>
  );
}

export function TargetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    language,
    t,
    translateComponentType,
    translateEnvironment,
    translateFreshness,
    translateTargetSourceKind,
    translateTargetType,
  } = useI18n();

  const loadTarget = useCallback(async () => {
    if (!id) {
      throw new Error("Target id is required.");
    }

    const [targetResponse, targetSummaryResponse] = await Promise.all([
      overlayApi.getTarget(id),
      overlayApi.getTargetSummary(id),
    ]);

    return {
      target: targetResponse.data,
      summary: targetSummaryResponse.data,
    };
  }, [id]);

  const { data, loading, error, retry } = useResource(`target:${id ?? "missing"}`, loadTarget);

  const connectionRows = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      { label: t("targetDetail.connection.runtimeRoot"), value: data.target.connection.runtimeRoot },
      { label: t("targetDetail.connection.configFile"), value: data.target.connection.configFile },
      { label: t("targetDetail.connection.workspaceGlob"), value: data.target.connection.workspaceGlob },
      { label: t("targetDetail.connection.sourceRoot"), value: data.target.connection.sourceRoot },
      { label: t("targetDetail.connection.gatewayUrl"), value: data.target.connection.gatewayUrl },
      { label: t("targetDetail.connection.dashboardUrl"), value: data.target.connection.dashboardUrl },
    ].filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value.length > 0);
  }, [data, t]);

  const collectionRows = useMemo(() => {
    if (!data) {
      return [];
    }

    return Object.values(data.summary.collections);
  }, [data]);

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <Link to="/targets" className="back-link">
          {t("targetDetail.back")}
        </Link>
        <h2>{data?.target.name ?? t("targetDetail.title")}</h2>
        <p>{t("targetDetail.description")}</p>
      </header>

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("targets.table.type")} value={translateTargetType(data.target.type)} />
              <MetricCard label={t("targets.table.source")} value={translateTargetSourceKind(data.target.sourceKind)} />
              <MetricCard label={t("targets.table.environment")} value={translateEnvironment(data.target.environment)} />
              <MetricCard label={t("targetDetail.metric.riskScore")} value={data.target.riskScore} />
              <MetricCard label={t("targetDetail.metric.warningCount")} value={data.target.warningCount} />
              <MetricCard label={t("targetDetail.metric.freshness")} value={translateFreshness(data.target.freshness)} />
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("targetDetail.summaryTitle")}</h3>
                <p>{formatTimestamp(data.target.lastCollectedAt, language)}</p>
              </div>

              <div className="metrics-grid">
                <MetricCard label={t("overview.metric.agents")} value={data.summary.summary.totals.agents} />
                <MetricCard label={t("overview.metric.workspaces")} value={data.summary.summary.totals.workspaces} />
                <MetricCard
                  label={t("overview.metric.sessions")}
                  value={data.summary.summary.totals.sessions}
                  detail={t("common.activeCount", { count: data.summary.summary.activeSessions })}
                />
                <MetricCard label={t("overview.metric.bindings")} value={data.summary.summary.totals.bindings} />
                <MetricCard label={t("overview.metric.authProfiles")} value={data.summary.summary.totals.authProfiles} />
                <MetricCard
                  label={t("targetDetail.metric.coverage")}
                  value={
                    <CoverageSummary
                      completeCollections={data.target.coverage.completeCollections}
                      partialCollections={data.target.coverage.partialCollections}
                      unavailableCollections={data.target.coverage.unavailableCollections}
                      t={t}
                    />
                  }
                />
              </div>

              <div className="detail-actions">
                <Link className="inline-link" to={`/findings?targetId=${encodeURIComponent(data.target.id)}`}>
                  {t("targetDetail.openFindings")}
                </Link>
                <Link className="inline-link" to={`/evidence?targetId=${encodeURIComponent(data.target.id)}`}>
                  {t("targetDetail.openEvidence")}
                </Link>
              </div>
            </div>

            <div className="detail-grid">
              <div className="panel">
                <div className="panel-header">
                  <h3>{t("targetDetail.connectionTitle")}</h3>
                  <p>{t("targetDetail.connectionDescription")}</p>
                </div>

                <dl className="detail-list">
                  {connectionRows.length > 0 ? (
                    connectionRows.map((row) => (
                      <div key={row.label} className="detail-list-row">
                        <dt>{row.label}</dt>
                        <dd className="cell-mono">{row.value}</dd>
                      </div>
                    ))
                  ) : (
                    <div className="detail-list-row">
                      <dt>{t("common.path")}</dt>
                      <dd>{t("common.notAvailable")}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>{t("targetDetail.policyTitle")}</h3>
                  <p>{t("common.generatedAt", { time: formatTimestamp(data.summary.summary.generatedAt, language) })}</p>
                </div>

                <dl className="detail-list">
                  <div className="detail-list-row">
                    <dt>{t("targetDetail.policy.mode")}</dt>
                    <dd>{t("targetDetail.policy.onDemandSnapshot")}</dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>{t("targetDetail.policy.readOnly")}</dt>
                    <dd>true</dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>{t("targetDetail.policy.mockFallback")}</dt>
                    <dd>{String(data.target.collectionPolicy.mockFallbackAllowed)}</dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>{t("targets.table.status")}</dt>
                    <dd>
                      <StatusBadge status={data.target.status} />
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("targetDetail.collectionsTitle")}</h3>
                <p>{collectionRows.length}</p>
              </div>

              <div className="table-wrap">
                <table className="data-table density-comfortable">
                  <thead>
                    <tr>
                      <th>{t("targetDetail.table.collection")}</th>
                      <th>{t("targetDetail.table.status")}</th>
                      <th>{t("targetDetail.table.freshness")}</th>
                      <th>{t("targetDetail.table.records")}</th>
                      <th>{t("targetDetail.table.collectedAt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionRows.map((collection) => (
                      <tr key={collection.collection}>
                        <td>{collection.collection}</td>
                        <td>
                          <StatusBadge status={collection.status === "complete" ? "healthy" : collection.status === "partial" ? "degraded" : "offline"} />
                        </td>
                        <td>{translateFreshness(collection.freshness)}</td>
                        <td>{collection.recordCount ?? "-"}</td>
                        <td>{formatTimestamp(collection.collectedAt, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("targetDetail.runtimeTitle")}</h3>
                <p>{t("targetDetail.runtimeDescription")}</p>
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
