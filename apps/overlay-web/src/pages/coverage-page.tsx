import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { CoverageBadge } from "../components/coverage-badge.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface CoverageRow {
  key: string;
  sourceKind: string;
  freshness: string;
  coverage: "complete" | "partial" | "unavailable";
  warningCount: number;
  lastSuccessAt: string | null;
}

export function CoveragePage() {
  const { language, t, translateFreshness, translateTargetSourceKind } = useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "coverage",
    defaultSortDirection: "asc",
    filterDefaults: {
      coverage: "all",
      sourceKind: "all",
    },
    defaultPageSize: 10,
  });

  const loadCoverage = useCallback(() => overlayApi.getCoverage(), []);
  const { data, loading, error, retry } = useResource("coverage", loadCoverage);

  const rows = useMemo<CoverageRow[]>(
    () =>
      (data?.data.collections ?? []).map((collection) => ({
        key: collection.key,
        sourceKind: collection.sourceKind,
        freshness: collection.freshness,
        coverage: collection.coverage,
        warningCount: collection.warningCount,
        lastSuccessAt: collection.lastSuccessAt ?? null,
      })),
    [data],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch = includesSearch([row.key, row.sourceKind, row.freshness, row.coverage], tableState.search);
      const matchesCoverage = tableState.filters.coverage === "all" || row.coverage === tableState.filters.coverage;
      const matchesSourceKind = tableState.filters.sourceKind === "all" || row.sourceKind === tableState.filters.sourceKind;

      return matchesSearch && matchesCoverage && matchesSourceKind;
    });
  }, [rows, tableState.filters.coverage, tableState.filters.sourceKind, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      key: (row) => row.key,
      sourceKind: (row) => row.sourceKind,
      freshness: (row) => row.freshness,
      coverage: (row) => row.coverage,
      warningCount: (row) => row.warningCount,
      lastSuccessAt: (row) => (row.lastSuccessAt ? Date.parse(row.lastSuccessAt) : null),
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

  const sourceKindOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.sourceKind))).sort(), [rows]);
  const coverageCounts = useMemo(
    () => ({
      complete: rows.filter((row) => row.coverage === "complete").length,
      partial: rows.filter((row) => row.coverage === "partial").length,
      unavailable: rows.filter((row) => row.coverage === "unavailable").length,
    }),
    [rows],
  );
  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("coverage.title")}</h2>
        <p>{t("coverage.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("coverage.emptyTitle")}
        emptyMessage={t("coverage.emptyMessage")}
      >
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("coverage.metric.complete")} value={coverageCounts.complete} />
              <MetricCard label={t("coverage.metric.partial")} value={coverageCounts.partial} />
              <MetricCard label={t("coverage.metric.unavailable")} value={coverageCounts.unavailable} />
              <MetricCard label={t("common.warnings")} value={rows.reduce((count, row) => count + row.warningCount, 0)} />
            </div>

            <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
              <input
                className="filter-input"
                placeholder={t("coverage.searchPlaceholder")}
                value={tableState.search}
                onChange={(event) => tableState.setSearch(event.target.value)}
              />

              <select
                className="filter-select"
                value={tableState.filters.coverage}
                onChange={(event) => tableState.setFilter("coverage", event.target.value)}
              >
                <option value="all">{t("coverage.filter.allCoverage")}</option>
                <option value="complete">{t("coverageState.complete")}</option>
                <option value="partial">{t("coverageState.partial")}</option>
                <option value="unavailable">{t("coverageState.unavailable")}</option>
              </select>

              <select
                className="filter-select"
                value={tableState.filters.sourceKind}
                onChange={(event) => tableState.setFilter("sourceKind", event.target.value)}
              >
                <option value="all">{t("filter.allSources")}</option>
                {sourceKindOptions.map((sourceKind) => (
                  <option key={sourceKind} value={sourceKind}>
                    {translateTargetSourceKind(sourceKind)}
                  </option>
                ))}
              </select>
            </TableToolbar>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("coverage.panelTitle")}</h3>
                <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
              </div>

              <div className="table-wrap">
                <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
                  <thead>
                    <tr>
                      <SortableHeader column="key" label={t("coverage.table.collection")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="sourceKind" label={t("coverage.table.sourceKind")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="freshness" label={t("coverage.table.freshness")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="coverage" label={t("coverage.table.coverage")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="warningCount" label={t("coverage.table.warnings")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} align="right" />
                      <SortableHeader column="lastSuccessAt" label={t("coverage.table.lastSuccessAt")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.pageItems.map((row) => (
                      <tr key={row.key}>
                        <td className="cell-mono">{row.key}</td>
                        <td>{translateTargetSourceKind(row.sourceKind)}</td>
                        <td>{translateFreshness(row.freshness)}</td>
                        <td>
                          <CoverageBadge coverage={row.coverage} />
                        </td>
                        <td className="cell-align-right">{row.warningCount}</td>
                        <td>{formatTimestamp(row.lastSuccessAt, language)}</td>
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
