import { useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

import { DataState } from "../components/data-state.js";
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

interface FindingRow {
  id: string;
  summary: string;
  severity: string;
  type: string;
  status: string;
  targetId: string;
  targetName: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  evidenceCount: number;
  score: number;
  observedAt: string;
}

function severityOrder(value: string): number {
  switch (value) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

export function FindingsPage() {
  const { language, t, translateFindingType, translateEvidenceSubjectType, translateSignal, translateStatus } = useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "observedAt",
    defaultSortDirection: "desc",
    filterDefaults: {
      severity: "all",
      targetId: "all",
      type: "all",
      status: "all",
    },
    defaultPageSize: 10,
  });

  const loadFindings = useCallback(async () => {
    const [findingsResponse, targetsResponse] = await Promise.all([
      overlayApi.getFindings(),
      overlayApi.getTargets(),
    ]);

    return {
      findings: findingsResponse.data,
      targets: targetsResponse.data,
      meta: findingsResponse.meta,
    };
  }, []);

  const { data, loading, error, retry } = useResource("findings", loadFindings);

  const rows = useMemo<FindingRow[]>(() => {
    return (data?.findings ?? []).map((finding) => ({
      id: finding.id,
      summary: finding.summary,
      severity: finding.severity,
      type: finding.type,
      status: finding.status,
      targetId: finding.targetId,
      targetName: finding.targetName ?? finding.targetId,
      subjectType: finding.subjectType,
      subjectId: finding.subjectId,
      subjectLabel: finding.subjectLabel ?? finding.subjectId,
      evidenceCount: finding.evidenceRefs.length,
      score: finding.score,
      observedAt: finding.observedAt,
    }));
  }, [data]);

  const filteredRows = useMemo(() => {
    return rows.filter((finding) => {
      const matchesSearch = includesSearch(
        [finding.summary, finding.targetName, finding.subjectLabel, finding.subjectId, finding.type],
        tableState.search,
      );
      const matchesSeverity =
        tableState.filters.severity === "all" || finding.severity === tableState.filters.severity;
      const matchesTarget = tableState.filters.targetId === "all" || finding.targetId === tableState.filters.targetId;
      const matchesType = tableState.filters.type === "all" || finding.type === tableState.filters.type;
      const matchesStatus = tableState.filters.status === "all" || finding.status === tableState.filters.status;

      return matchesSearch && matchesSeverity && matchesTarget && matchesType && matchesStatus;
    });
  }, [
    rows,
    tableState.filters.severity,
    tableState.filters.targetId,
    tableState.filters.type,
    tableState.filters.status,
    tableState.search,
  ]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      severity: (finding) => severityOrder(finding.severity),
      type: (finding) => finding.type,
      status: (finding) => finding.status,
      target: (finding) => finding.targetName,
      subject: (finding) => finding.subjectLabel,
      evidenceCount: (finding) => finding.evidenceCount,
      score: (finding) => finding.score,
      observedAt: (finding) => Date.parse(finding.observedAt),
    });
  }, [filteredRows, tableState.sortBy, tableState.sortDirection]);

  const paginated = useMemo(() => paginateRows(sortedRows, tableState.page, tableState.pageSize), [
    sortedRows,
    tableState.page,
    tableState.pageSize,
  ]);

  useEffect(() => {
    if (paginated.page !== tableState.page) {
      tableState.setPage(paginated.page);
    }
  }, [paginated.page, tableState.page, tableState.setPage]);

  const severityOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.severity))), [rows]);
  const typeOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.type))).sort(), [rows]);
  const statusOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.status))).sort(), [rows]);
  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("findings.title")}</h2>
        <p>{t("findings.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("findings.emptyTitle")}
        emptyMessage={t("findings.emptyMessage")}
      >
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("findings.panelTitle")} value={rows.length} />
              <MetricCard
                label={t("overview.metric.criticalFindings")}
                value={rows.filter((row) => row.severity === "critical").length}
              />
              <MetricCard
                label={t("overview.metric.openFindings")}
                value={rows.filter((row) => row.status === "open").length}
              />
              <MetricCard label={t("overview.metric.targetRisk")} value={Math.max(...rows.map((row) => row.score), 0)} />
            </div>

            <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
              <input
                className="filter-input"
                placeholder={t("findings.searchPlaceholder")}
                value={tableState.search}
                onChange={(event) => tableState.setSearch(event.target.value)}
              />

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
                value={tableState.filters.type}
                onChange={(event) => tableState.setFilter("type", event.target.value)}
              >
                <option value="all">{t("filter.allFindingTypes")}</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {translateFindingType(type)}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={tableState.filters.status}
                onChange={(event) => tableState.setFilter("status", event.target.value)}
              >
                <option value="all">{t("filter.allStatuses")}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {translateStatus(status)}
                  </option>
                ))}
              </select>
            </TableToolbar>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("findings.panelTitle")}</h3>
                <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
              </div>

              <div className="table-wrap">
                <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
                  <thead>
                    <tr>
                      <th>{t("findings.table.summary")}</th>
                      <SortableHeader column="severity" label={t("findings.table.severity")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="type" label={t("findings.table.type")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="status" label={t("findings.table.status")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="target" label={t("findings.table.target")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="subject" label={t("findings.table.subject")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="evidenceCount" label={t("findings.table.evidenceCount")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} align="right" />
                      <SortableHeader column="score" label={t("findings.table.score")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} align="right" />
                      <SortableHeader column="observedAt" label={t("findings.table.observed")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.pageItems.map((finding) => (
                      <tr key={finding.id}>
                        <td>
                          <Link to={`/findings/${finding.id}`} className="inline-link">
                            <div className="cell-title">{finding.summary}</div>
                          </Link>
                          <div className="cell-subtitle">{finding.id}</div>
                        </td>
                        <td>
                          <SignalBadge value={finding.severity} />
                        </td>
                        <td>{translateFindingType(finding.type)}</td>
                        <td>{translateStatus(finding.status)}</td>
                        <td>
                          <div className="cell-title">{finding.targetName}</div>
                          <div className="cell-subtitle">{finding.targetId}</div>
                        </td>
                        <td>
                          <div className="cell-title">{finding.subjectLabel}</div>
                          <div className="cell-subtitle">
                            {translateEvidenceSubjectType(finding.subjectType)} · {finding.subjectId}
                          </div>
                        </td>
                        <td className="cell-align-right">{finding.evidenceCount}</td>
                        <td className="cell-align-right">{finding.score}</td>
                        <td>{formatTimestamp(finding.observedAt, language)}</td>
                      </tr>
                    ))}
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
