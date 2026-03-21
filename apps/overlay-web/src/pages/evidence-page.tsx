import { useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { EvidenceImpactBadge } from "../components/evidence/evidence-impact-badge.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { SignalBadge } from "../components/signal-badge.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface EvidenceRow {
  id: string;
  message: string;
  kind: string;
  severity: string;
  targetId: string;
  targetName: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  freshness: string;
  observedAt: string;
}

function subjectLinkFor(subjectType: string, subjectId: string): string | null {
  switch (subjectType) {
    case "workspace":
      return "/workspaces";
    case "agent":
      return "/agents";
    case "session":
      return "/sessions";
    case "binding":
      return "/bindings";
    case "auth-profile":
      return "/auth-profiles";
    case "node":
      return "/nodes";
    case "cron-job":
      return `/cron/${encodeURIComponent(subjectId)}`;
    default:
      return null;
  }
}

function bridgeForEvidence(row: EvidenceRow) {
  if (row.kind === "runtime-health" || row.freshness === "stale" || row.subjectType === "node") {
    return {
      impact: "high" as const,
      role: "operations" as const,
      actionKey: "evidenceBridge.action.operations",
    };
  }

  if (row.subjectType === "workspace" || row.subjectType === "agent" || row.kind === "session-store") {
    return {
      impact: "medium" as const,
      role: "adoption" as const,
      actionKey: "evidenceBridge.action.adoption",
    };
  }

  return {
    impact: row.severity === "error" ? ("high" as const) : ("medium" as const),
    role: "governance" as const,
    actionKey: "evidenceBridge.action.governance",
  };
}

function localizeEvidenceMessage(message: string, language: "en" | "zh"): string {
  if (language !== "zh") {
    return message;
  }

  const sessionWorkspace = /^Session (.+) has a missing workspace condition\.$/.exec(message);
  if (sessionWorkspace) {
    return `会话 ${sessionWorkspace[1]} 缺少工作区关联条件。`;
  }

  const sessionAgent = /^Session (.+) has a missing agent condition\.$/.exec(message);
  if (sessionAgent) {
    return `会话 ${sessionAgent[1]} 缺少智能体关联条件。`;
  }

  const bindingAgent = /^Binding (.+) has a missing agent condition\.$/.exec(message);
  if (bindingAgent) {
    return `绑定 ${bindingAgent[1]} 缺少智能体关联条件。`;
  }

  const bindingWorkspace = /^Binding (.+) has a missing workspace condition\.$/.exec(message);
  if (bindingWorkspace) {
    return `绑定 ${bindingWorkspace[1]} 缺少工作区关联条件。`;
  }

  return message;
}

function severityOrder(value: string): number {
  switch (value) {
    case "error":
      return 3;
    case "warn":
      return 2;
    default:
      return 1;
  }
}

export function EvidencePage() {
  const {
    language,
    t,
    translateEvidenceKind,
    translateEvidenceSubjectType,
    translateFreshness,
    translateSignal,
  } = useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "observedAt",
    defaultSortDirection: "desc",
    filterDefaults: {
      targetId: "all",
      severity: "all",
      kind: "all",
      subjectType: "all",
    },
    defaultPageSize: 10,
  });

  const loadEvidence = useCallback(async () => {
    const [evidenceResponse, targetsResponse] = await Promise.all([
      overlayApi.getEvidences(),
      overlayApi.getTargets(),
    ]);

    return {
      evidence: evidenceResponse.data,
      targets: targetsResponse.data,
      meta: evidenceResponse.meta,
    };
  }, []);

  const { data, loading, error, retry } = useResource("evidence", loadEvidence);

  const rows = useMemo<EvidenceRow[]>(() => {
    return (data?.evidence ?? []).map((evidence) => ({
      id: evidence.id,
      message: evidence.message,
      kind: evidence.kind,
      severity: evidence.severity,
      targetId: evidence.targetId,
      targetName: evidence.targetName ?? evidence.targetId,
      subjectType: evidence.subjectType,
      subjectId: evidence.subjectId,
      subjectLabel: evidence.subjectLabel ?? evidence.subjectId,
      freshness: evidence.freshness,
      observedAt: evidence.observedAt,
    }));
  }, [data]);

  const filteredRows = useMemo(() => {
    return rows.filter((evidence) => {
      const matchesSearch = includesSearch(
        [evidence.message, evidence.targetName, evidence.subjectLabel, evidence.subjectId, evidence.kind],
        tableState.search,
      );
      const matchesTarget = tableState.filters.targetId === "all" || evidence.targetId === tableState.filters.targetId;
      const matchesSeverity =
        tableState.filters.severity === "all" || evidence.severity === tableState.filters.severity;
      const matchesKind = tableState.filters.kind === "all" || evidence.kind === tableState.filters.kind;
      const matchesSubjectType =
        tableState.filters.subjectType === "all" || evidence.subjectType === tableState.filters.subjectType;

      return matchesSearch && matchesTarget && matchesSeverity && matchesKind && matchesSubjectType;
    });
  }, [rows, tableState.filters.kind, tableState.filters.severity, tableState.filters.subjectType, tableState.filters.targetId, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      kind: (evidence) => evidence.kind,
      severity: (evidence) => severityOrder(evidence.severity),
      target: (evidence) => evidence.targetName,
      subject: (evidence) => evidence.subjectLabel,
      freshness: (evidence) => evidence.freshness,
      observedAt: (evidence) => Date.parse(evidence.observedAt),
    });
  }, [filteredRows, tableState.sortBy, tableState.sortDirection]);

  const paginated = useMemo(() => {
    return paginateRows(sortedRows, tableState.page, tableState.pageSize);
  }, [sortedRows, tableState.page, tableState.pageSize]);

  useEffect(() => {
    if (paginated.page !== tableState.page) {
      tableState.setPage(paginated.page);
    }
  }, [paginated.page, tableState.page, tableState.setPage]);

  const severityOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.severity))), [rows]);
  const kindOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.kind))).sort(), [rows]);
  const subjectTypeOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.subjectType))).sort(), [rows]);
  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("evidence.title")}</h2>
        <p>{t("evidence.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("evidence.emptyTitle")}
        emptyMessage={t("evidence.emptyMessage")}
      >
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("evidence.panelTitle")} value={rows.length} />
              <MetricCard label={t("signal.error")} value={rows.filter((row) => row.severity === "error").length} />
              <MetricCard label={t("signal.warn")} value={rows.filter((row) => row.severity === "warn").length} />
              <MetricCard label={t("freshness.stale")} value={rows.filter((row) => row.freshness === "stale").length} />
            </div>

            <div className="state-box state-box-warning panel-inline-note">
              <p className="state-title">{t("evidence.bridgeTitle")}</p>
              <p className="state-message">{t("evidence.bridgeDescription")}</p>
            </div>

            <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
              <input
                className="filter-input"
                placeholder={t("evidence.searchPlaceholder")}
                value={tableState.search}
                onChange={(event) => tableState.setSearch(event.target.value)}
              />

              <select
                className="filter-select"
                value={tableState.filters.targetId}
                onChange={(event) => tableState.setFilter("targetId", event.target.value)}
              >
                <option value="all">{t("filter.allTargets")}</option>
                {data.targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={tableState.filters.severity}
                onChange={(event) => tableState.setFilter("severity", event.target.value)}
              >
                <option value="all">{t("filter.allSeverities")}</option>
                {severityOptions.map((severity) => (
                  <option key={severity} value={severity}>
                    {translateSignal(severity)}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={tableState.filters.kind}
                onChange={(event) => tableState.setFilter("kind", event.target.value)}
              >
                <option value="all">{t("filter.allEvidenceKinds")}</option>
                {kindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {translateEvidenceKind(kind)}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={tableState.filters.subjectType}
                onChange={(event) => tableState.setFilter("subjectType", event.target.value)}
              >
                <option value="all">{t("filter.allSubjectTypes")}</option>
                {subjectTypeOptions.map((subjectType) => (
                  <option key={subjectType} value={subjectType}>
                    {translateEvidenceSubjectType(subjectType)}
                  </option>
                ))}
              </select>
            </TableToolbar>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("evidence.panelTitle")}</h3>
                <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
              </div>

              <div className="table-wrap">
                <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
                  <thead>
                    <tr>
                      <th>{t("evidence.table.message")}</th>
                      <SortableHeader column="kind" label={t("evidence.table.kind")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="severity" label={t("evidence.table.severity")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="target" label={t("evidence.table.target")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="subject" label={t("evidence.table.subject")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <th>{t("evidence.table.impact")}</th>
                      <SortableHeader column="freshness" label={t("evidence.table.freshness")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="observedAt" label={t("evidence.table.observed")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.pageItems.map((evidence) => {
                      const bridge = bridgeForEvidence(evidence);
                      const targetLink = `/targets/${encodeURIComponent(evidence.targetId)}`;
                      const subjectLink = subjectLinkFor(evidence.subjectType, evidence.subjectId);

                      return (
                        <tr key={evidence.id}>
                          <td>
                            <Link to={`/evidence/${evidence.id}`} className="inline-link">
                              <div className="cell-title">{localizeEvidenceMessage(evidence.message, language)}</div>
                            </Link>
                            <div className="cell-subtitle">{evidence.id}</div>
                          </td>
                          <td>{translateEvidenceKind(evidence.kind)}</td>
                          <td>
                            <SignalBadge value={evidence.severity} />
                          </td>
                          <td>
                            <Link to={targetLink} className="inline-link">
                              <div className="cell-title">{evidence.targetName}</div>
                            </Link>
                            <div className="cell-subtitle">{evidence.targetId}</div>
                          </td>
                          <td>
                            {subjectLink ? (
                              <Link to={subjectLink} className="inline-link">
                                <div className="cell-title">{evidence.subjectLabel}</div>
                              </Link>
                            ) : (
                              <div className="cell-title">{evidence.subjectLabel}</div>
                            )}
                            <div className="cell-subtitle">
                              {translateEvidenceSubjectType(evidence.subjectType)} · {evidence.subjectId}
                            </div>
                          </td>
                          <td>
                            <EvidenceImpactBadge impact={bridge.impact} role={bridge.role} />
                            <div className="cell-subtitle">{t(bridge.actionKey)}</div>
                          </td>
                          <td>{translateFreshness(evidence.freshness)}</td>
                          <td>{formatTimestamp(evidence.observedAt, language)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                page={paginated.page}
                totalPages={paginated.totalPages}
                totalItems={paginated.totalItems}
                startItemIndex={paginated.startItemIndex}
                endItemIndex={paginated.endItemIndex}
                pageSize={tableState.pageSize}
                allowedPageSizes={tableState.allowedPageSizes}
                setPage={tableState.setPage}
                setPageSize={tableState.setPageSize}
              />
            </div>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
