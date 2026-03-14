import { useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
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
  targetId: string;
  targetName: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
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

export function RisksPage() {
  const { language, t, translateFindingType, translateEvidenceSubjectType, translateSignal } = useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "severity",
    defaultSortDirection: "desc",
    filterDefaults: {
      severity: "all",
      targetId: "all",
      type: "all",
    },
    defaultPageSize: 10,
  });

  const loadRisks = useCallback(async () => {
    const [summaryResponse, findingsResponse, targetsResponse] = await Promise.all([
      overlayApi.getRisksSummary(),
      overlayApi.getFindings(),
      overlayApi.getTargets(),
    ]);

    return {
      summary: summaryResponse.data,
      findings: findingsResponse.data,
      targets: targetsResponse.data,
    };
  }, []);

  const { data, loading, error, retry } = useResource("risks", loadRisks);

  const rows = useMemo<FindingRow[]>(() => {
    return (data?.findings ?? []).map((finding) => ({
      id: finding.id,
      summary: finding.summary,
      severity: finding.severity,
      type: finding.type,
      targetId: finding.targetId,
      targetName: finding.targetName ?? finding.targetId,
      subjectType: finding.subjectType,
      subjectId: finding.subjectId,
      subjectLabel: finding.subjectLabel ?? finding.subjectId,
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

      return matchesSearch && matchesSeverity && matchesTarget && matchesType;
    });
  }, [rows, tableState.filters.severity, tableState.filters.targetId, tableState.filters.type, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      severity: (finding) => severityOrder(finding.severity),
      type: (finding) => finding.type,
      target: (finding) => finding.targetName,
      subject: (finding) => finding.subjectLabel,
      score: (finding) => finding.score,
      observedAt: (finding) => Date.parse(finding.observedAt),
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
  const typeOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.type))).sort(), [rows]);
  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("risks.title")}</h2>
        <p>{t("risks.description")}</p>
      </header>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("risks.emptyTitle")}
        emptyMessage={t("risks.emptyMessage")}
      >
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("overview.metric.openFindings")} value={data.summary.openFindings} />
              <MetricCard label={t("overview.metric.criticalFindings")} value={data.summary.bySeverity.critical} />
              <MetricCard label={t("overview.metric.staleTargets")} value={data.summary.staleTargets} />
              <MetricCard label={t("overview.metric.targetRisk")} value={data.summary.highestRiskScore} />
            </div>

            <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
              <input
                className="filter-input"
                placeholder={t("risks.searchPlaceholder")}
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
            </TableToolbar>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("risks.panelTitle")}</h3>
                <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
              </div>

              <div className="table-wrap">
                <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
                  <thead>
                    <tr>
                      <th>{t("risks.table.summary")}</th>
                      <SortableHeader column="severity" label={t("risks.table.severity")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="type" label={t("risks.table.type")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="target" label={t("risks.table.target")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="subject" label={t("risks.table.subject")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="score" label={t("risks.table.score")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} align="right" />
                      <SortableHeader column="observedAt" label={t("risks.table.observed")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
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
