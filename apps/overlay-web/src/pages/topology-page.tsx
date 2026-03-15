import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface EdgeRow {
  id: string;
  relation: string;
  fromType: string;
  fromId: string;
  fromLabel: string;
  toType: string;
  toId: string;
  toLabel: string;
}

export function TopologyPage() {
  const { language, t, translateNodeType } = useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "relation",
    filterDefaults: {
      relation: "all",
      fromType: "all",
    },
    defaultPageSize: 10,
  });

  const loadTopology = useCallback(async () => {
    return overlayApi.getTopology();
  }, []);

  const { data, loading, error, retry } = useResource("topology", loadTopology);

  const nodeKeyToLabel = useMemo(() => {
    const map = new Map<string, string>();

    for (const node of data?.data.nodes ?? []) {
      map.set(`${node.nodeType}:${node.id}`, node.label);
    }

    return map;
  }, [data]);

  const nodeCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const node of data?.data.nodes ?? []) {
      counts.set(node.nodeType, (counts.get(node.nodeType) ?? 0) + 1);
    }

    return counts;
  }, [data]);

  const rows = useMemo<EdgeRow[]>(() => {
    return (data?.data.edges ?? []).map((edge) => ({
      id: `${edge.fromType}:${edge.fromId}:${edge.relation}:${edge.toType}:${edge.toId}`,
      relation: edge.relation,
      fromType: edge.fromType,
      fromId: edge.fromId,
      fromLabel: nodeKeyToLabel.get(`${edge.fromType}:${edge.fromId}`) ?? edge.fromId,
      toType: edge.toType,
      toId: edge.toId,
      toLabel: nodeKeyToLabel.get(`${edge.toType}:${edge.toId}`) ?? edge.toId,
    }));
  }, [data, nodeKeyToLabel]);

  const filteredRows = useMemo(() => {
    return rows.filter((edge) => {
      const matchesSearch = includesSearch(
        [edge.relation, edge.fromType, edge.fromId, edge.fromLabel, edge.toType, edge.toId, edge.toLabel],
        tableState.search,
      );
      const matchesRelation = tableState.filters.relation === "all" || edge.relation === tableState.filters.relation;
      const matchesFromType = tableState.filters.fromType === "all" || edge.fromType === tableState.filters.fromType;

      return matchesSearch && matchesRelation && matchesFromType;
    });
  }, [rows, tableState.filters.fromType, tableState.filters.relation, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      relation: (edge) => edge.relation,
      fromType: (edge) => edge.fromType,
      from: (edge) => edge.fromLabel,
      toType: (edge) => edge.toType,
      to: (edge) => edge.toLabel,
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

  const relationOptions = useMemo(() => {
    return Array.from(new Set(rows.map((edge) => edge.relation))).sort();
  }, [rows]);

  const fromTypeOptions = useMemo(() => {
    return Array.from(new Set(rows.map((edge) => edge.fromType))).sort();
  }, [rows]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("topology.title")}</h2>
        <p>{t("topology.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard
                label={t("topology.metric.nodes")}
                value={data.data.nodes.length}
                detail={t("common.snapshotAt", { time: formatTimestamp(data.meta.generatedAt, language) })}
              />
              <MetricCard
                label={t("topology.metric.edges")}
                value={data.data.edges.length}
                detail={t("common.afterFilters", { count: filteredRows.length })}
              />
              <MetricCard label={t("topology.metric.workspaceNodes")} value={nodeCounts.get("workspace") ?? 0} />
              <MetricCard label={t("topology.metric.agentNodes")} value={nodeCounts.get("agent") ?? 0} />
              <MetricCard label={t("topology.metric.sessionNodes")} value={nodeCounts.get("session") ?? 0} />
              <MetricCard label={t("topology.metric.authNodes")} value={nodeCounts.get("auth-profile") ?? 0} />
            </div>

            <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
              <input
                className="filter-input"
                placeholder={t("topology.searchPlaceholder")}
                value={tableState.search}
                onChange={(event) => tableState.setSearch(event.target.value)}
              />

              <select
                className="filter-select"
                value={tableState.filters.relation}
                onChange={(event) => tableState.setFilter("relation", event.target.value)}
              >
                <option value="all">{t("filter.allRelations")}</option>
                {relationOptions.map((relation) => (
                  <option key={relation} value={relation}>
                    {relation}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={tableState.filters.fromType}
                onChange={(event) => tableState.setFilter("fromType", event.target.value)}
              >
                <option value="all">{t("filter.allSourceNodeTypes")}</option>
                {fromTypeOptions.map((fromType) => (
                  <option key={fromType} value={fromType}>
                    {translateNodeType(fromType)}
                  </option>
                ))}
              </select>
            </TableToolbar>

            <DataState
              loading={false}
              error={null}
              isEmpty={isEmpty}
              emptyTitle={t("topology.emptyTitle")}
              emptyMessage={t("topology.emptyMessage")}
            >
              <div className="panel">
                <div className="panel-header">
                  <h3>{t("topology.panelTitle")}</h3>
                  <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
                </div>

                <div className="table-wrap">
                  <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
                    <thead>
                      <tr>
                        <SortableHeader
                          column="fromType"
                          label={t("topology.table.fromType")}
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                        <SortableHeader
                          column="from"
                          label={t("topology.table.from")}
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                        <SortableHeader
                          column="relation"
                          label={t("topology.table.relation")}
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                        <SortableHeader
                          column="toType"
                          label={t("topology.table.toType")}
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                        <SortableHeader
                          column="to"
                          label={t("topology.table.to")}
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.pageItems.map((edge) => (
                        <tr key={edge.id}>
                          <td>{translateNodeType(edge.fromType)}</td>
                          <td>
                            <div className="cell-title">{edge.fromLabel}</div>
                            <div className="cell-subtitle">{edge.fromId}</div>
                          </td>
                          <td>{edge.relation}</td>
                          <td>{translateNodeType(edge.toType)}</td>
                          <td>
                            <div className="cell-title">{edge.toLabel}</div>
                            <div className="cell-subtitle">{edge.toId}</div>
                          </td>
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
          </>
        ) : null}
      </DataState>
    </section>
  );
}
