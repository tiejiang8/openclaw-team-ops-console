import { useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { NodesTable } from "../components/nodes/nodes-table.js";
import { PageObservability } from "../components/page-observability.js";
import { PaginationControls, TableToolbar } from "../components/table-controls.js";
import { useStreamRefresh } from "../components/streaming-provider.js";
import { overlayApi } from "../lib/api.js";
import { getNodes } from "../lib/api/nodes.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";
import { useTableQueryState } from "../lib/table-state.js";

export function NodesPage() {
  const { t } = useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "lastConnectAt",
    defaultSortDirection: "desc",
    filterDefaults: {
      status: "all",
    },
    defaultPageSize: 10,
  });
  const { data, loading, error, retry } = useResource("nodes", overlayApi.getNodes, {
    refreshIntervalMs: 10000,
  });

  useStreamRefresh("node_status", retry);
  const rows = useMemo(() => data?.data ?? [], [data]);

  const filteredRows = useMemo(() => {
    return rows.filter((node) => {
      const matchesSearch = includesSearch(
        [node.id, node.name, node.platform, ...(node.capabilities ?? [])],
        tableState.search,
      );

      if (!matchesSearch) {
        return false;
      }

      switch (tableState.filters.status) {
        case "connected":
          return node.connected;
        case "paired":
          return node.paired;
        case "stale":
          return node.paired && !node.connected;
        default:
          return true;
      }
    });
  }, [rows, tableState.filters.status, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      name: (node) => node.name ?? node.id,
      platform: (node) => node.platform,
      paired: (node) => Number(node.paired),
      connected: (node) => Number(node.connected),
      lastConnectAt: (node) => (node.lastConnectAt ? Date.parse(node.lastConnectAt) : null),
      capabilities: (node) => node.capabilities?.join(", "),
      source: (node) => node.source,
    });
  }, [filteredRows, tableState.sortBy, tableState.sortDirection]);

  const paginated = useMemo(() => paginateRows(sortedRows, tableState.page, tableState.pageSize), [sortedRows, tableState.page, tableState.pageSize]);

  useEffect(() => {
    if (paginated.page !== tableState.page) {
      tableState.setPage(paginated.page);
    }
  }, [paginated.page, tableState]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("nodes.title")}</h2>
        <p>{t("nodes.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <div className="metrics-grid">
        <MetricCard label={t("nodes.summary.connected")} value={data?.summary?.connected ?? rows.filter((node) => node.connected).length} />
        <MetricCard label={t("nodes.summary.paired")} value={data?.summary?.paired ?? rows.filter((node) => node.paired).length} />
        <MetricCard label={t("nodes.summary.stale")} value={data?.summary?.stale ?? rows.filter((node) => node.paired && !node.connected).length} />
      </div>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder={t("nodes.searchPlaceholder")}
          value={tableState.search}
          onChange={(event) => tableState.setSearch(event.target.value)}
        />

        <select className="filter-select" value={tableState.filters.status} onChange={(event) => tableState.setFilter("status", event.target.value)}>
          <option value="all">{t("filter.allStatuses")}</option>
          <option value="connected">{t("nodes.filter.connected")}</option>
          <option value="paired">{t("nodes.filter.paired")}</option>
          <option value="stale">{t("nodes.filter.stale")}</option>
        </select>
      </TableToolbar>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("nodes.emptyTitle")}
        emptyMessage={t("nodes.emptyMessage")}
      >
        <div className="panel">
          <div className="panel-header">
            <h3>{t("nodes.panelTitle")}</h3>
            <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
          </div>

          <NodesTable
            rows={paginated.pageItems}
            density={tableState.density}
            sortBy={tableState.sortBy}
            sortDirection={tableState.sortDirection}
            onSort={tableState.setSort}
          />
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
      </DataState>
    </section>
  );
}
