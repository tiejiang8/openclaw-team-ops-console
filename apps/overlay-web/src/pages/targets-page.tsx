import { useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface TargetRow {
  id: string;
  name: string;
  type: string;
  environment: string;
  owner: string;
  sourceKind: string;
  status: string;
  freshness: string;
  warningCount: number;
  riskScore: number;
  lastCollectedAt: string | null;
  coverage: {
    completeCollections: number;
    partialCollections: number;
    unavailableCollections: number;
  };
}

function CoverageLabel({
  completeCollections,
  partialCollections,
  unavailableCollections,
  t,
}: TargetRow["coverage"] & { t: (key: string) => string }) {
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

export function TargetsPage() {
  const { language, t, translateEnvironment, translateFreshness, translateStatus, translateTargetSourceKind, translateTargetType } =
    useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "riskScore",
    defaultSortDirection: "desc",
    filterDefaults: {
      status: "all",
      sourceKind: "all",
      environment: "all",
    },
    defaultPageSize: 10,
  });

  const loadTargets = useCallback(() => overlayApi.getTargets(), []);
  const { data, loading, error, retry } = useResource("targets", loadTargets);

  const rows = useMemo<TargetRow[]>(() => {
    return (data?.data ?? []).map((target) => ({
      id: target.id,
      name: target.name,
      type: target.type,
      environment: target.environment,
      owner: target.owner ?? "-",
      sourceKind: target.sourceKind,
      status: target.status,
      freshness: target.freshness,
      warningCount: target.warningCount,
      riskScore: target.riskScore,
      lastCollectedAt: target.lastCollectedAt ?? null,
      coverage: target.coverage,
    }));
  }, [data]);

  const filteredRows = useMemo(() => {
    return rows.filter((target) => {
      const matchesSearch = includesSearch(
        [target.id, target.name, target.owner, target.environment, target.sourceKind, target.type],
        tableState.search,
      );
      const matchesStatus = tableState.filters.status === "all" || target.status === tableState.filters.status;
      const matchesSourceKind =
        tableState.filters.sourceKind === "all" || target.sourceKind === tableState.filters.sourceKind;
      const matchesEnvironment =
        tableState.filters.environment === "all" || target.environment === tableState.filters.environment;

      return matchesSearch && matchesStatus && matchesSourceKind && matchesEnvironment;
    });
  }, [rows, tableState.filters.environment, tableState.filters.sourceKind, tableState.filters.status, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      name: (target) => target.name,
      type: (target) => target.type,
      environment: (target) => target.environment,
      sourceKind: (target) => target.sourceKind,
      status: (target) => target.status,
      freshness: (target) => target.freshness,
      warningCount: (target) => target.warningCount,
      riskScore: (target) => target.riskScore,
      lastCollectedAt: (target) => (target.lastCollectedAt ? Date.parse(target.lastCollectedAt) : null),
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

  const statusOptions = useMemo(() => Array.from(new Set(rows.map((target) => target.status))).sort(), [rows]);
  const sourceKindOptions = useMemo(() => Array.from(new Set(rows.map((target) => target.sourceKind))).sort(), [rows]);
  const environmentOptions = useMemo(() => Array.from(new Set(rows.map((target) => target.environment))).sort(), [rows]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("targets.title")}</h2>
        <p>{t("targets.description")}</p>
      </header>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder={t("targets.searchPlaceholder")}
          value={tableState.search}
          onChange={(event) => tableState.setSearch(event.target.value)}
        />

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

        <select
          className="filter-select"
          value={tableState.filters.environment}
          onChange={(event) => tableState.setFilter("environment", event.target.value)}
        >
          <option value="all">{t("filter.allEnvironments")}</option>
          {environmentOptions.map((environment) => (
            <option key={environment} value={environment}>
              {translateEnvironment(environment)}
            </option>
          ))}
        </select>
      </TableToolbar>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("targets.emptyTitle")}
        emptyMessage={t("targets.emptyMessage")}
      >
        <div className="panel">
          <div className="panel-header">
            <h3>{t("targets.panelTitle")}</h3>
            <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
          </div>

          <div className="table-wrap">
            <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
              <thead>
                <tr>
                  <SortableHeader column="name" label={t("targets.table.target")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                  <SortableHeader column="type" label={t("targets.table.type")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                  <SortableHeader column="environment" label={t("targets.table.environment")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                  <SortableHeader column="sourceKind" label={t("targets.table.source")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                  <th>{t("targets.table.coverage")}</th>
                  <SortableHeader column="warningCount" label={t("targets.table.warnings")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} align="right" />
                  <SortableHeader column="riskScore" label={t("targets.table.risk")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} align="right" />
                  <SortableHeader column="freshness" label={t("targets.table.freshness")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                  <SortableHeader column="status" label={t("targets.table.status")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                  <SortableHeader column="lastCollectedAt" label={t("targets.table.lastCollected")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                </tr>
              </thead>
              <tbody>
                {paginated.pageItems.map((target) => (
                  <tr key={target.id}>
                    <td>
                      <Link to={`/targets/${target.id}`} className="inline-link">
                        <div className="cell-title">{target.name}</div>
                      </Link>
                      <div className="cell-subtitle">{target.id}</div>
                      {target.owner !== "-" ? <div className="cell-subtitle">{target.owner}</div> : null}
                    </td>
                    <td>{translateTargetType(target.type)}</td>
                    <td>{translateEnvironment(target.environment)}</td>
                    <td>{translateTargetSourceKind(target.sourceKind)}</td>
                    <td>
                      <CoverageLabel {...target.coverage} t={(key) => t(key)} />
                    </td>
                    <td className="cell-align-right">{target.warningCount}</td>
                    <td className="cell-align-right">{target.riskScore}</td>
                    <td>{translateFreshness(target.freshness)}</td>
                    <td>
                      <StatusBadge status={target.status} />
                    </td>
                    <td>{formatTimestamp(target.lastCollectedAt, language)}</td>
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
      </DataState>
    </section>
  );
}
