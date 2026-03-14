import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
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
        <h2>Topology and Relationships</h2>
        <p>Relationship view for workspace, agent, binding, session, and auth-profile linkages.</p>
      </header>

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label="Nodes" value={data.data.nodes.length} detail={`snapshot ${formatTimestamp(data.meta.generatedAt)}`} />
              <MetricCard label="Edges" value={data.data.edges.length} detail={`${filteredRows.length} after filters`} />
              <MetricCard label="Workspace Nodes" value={nodeCounts.get("workspace") ?? 0} />
              <MetricCard label="Agent Nodes" value={nodeCounts.get("agent") ?? 0} />
              <MetricCard label="Session Nodes" value={nodeCounts.get("session") ?? 0} />
              <MetricCard label="Auth Nodes" value={nodeCounts.get("auth-profile") ?? 0} />
            </div>

            <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
              <input
                className="filter-input"
                placeholder="Search by relation, node type, or entity id"
                value={tableState.search}
                onChange={(event) => tableState.setSearch(event.target.value)}
              />

              <select
                className="filter-select"
                value={tableState.filters.relation}
                onChange={(event) => tableState.setFilter("relation", event.target.value)}
              >
                <option value="all">All relations</option>
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
                <option value="all">All source node types</option>
                {fromTypeOptions.map((fromType) => (
                  <option key={fromType} value={fromType}>
                    {fromType}
                  </option>
                ))}
              </select>
            </TableToolbar>

            <DataState
              loading={false}
              error={null}
              isEmpty={isEmpty}
              emptyTitle="No relationships match current filters"
              emptyMessage="Try broadening relation/node filters or search terms."
            >
              <div className="panel">
                <div className="panel-header">
                  <h3>Relationship Edges</h3>
                  <p>{filteredRows.length} filtered rows</p>
                </div>

                <div className="table-wrap">
                  <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
                    <thead>
                      <tr>
                        <SortableHeader
                          column="fromType"
                          label="From Type"
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                        <SortableHeader
                          column="from"
                          label="From"
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                        <SortableHeader
                          column="relation"
                          label="Relation"
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                        <SortableHeader
                          column="toType"
                          label="To Type"
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                        <SortableHeader
                          column="to"
                          label="To"
                          sortBy={tableState.sortBy}
                          sortDirection={tableState.sortDirection}
                          onSort={tableState.setSort}
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.pageItems.map((edge) => (
                        <tr key={edge.id}>
                          <td>{edge.fromType}</td>
                          <td>
                            <div className="cell-title">{edge.fromLabel}</div>
                            <div className="cell-subtitle">{edge.fromId}</div>
                          </td>
                          <td>{edge.relation}</td>
                          <td>{edge.toType}</td>
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
