import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface BindingRow {
  id: string;
  routeType: string;
  source: string;
  targetAgentId: string;
  targetAgentName: string;
  workspaceId: string;
  workspaceName: string;
  status: string;
  description: string;
  updatedAt: string;
}

export function BindingsPage() {
  const tableState = useTableQueryState({
    defaultSortBy: "updatedAt",
    defaultSortDirection: "desc",
    filterDefaults: {
      status: "all",
      routeType: "all",
      workspace: "all",
    },
    defaultPageSize: 10,
  });

  const loadBindings = useCallback(async () => {
    const [bindingsResponse, agentsResponse, workspacesResponse] = await Promise.all([
      overlayApi.getBindings(),
      overlayApi.getAgents(),
      overlayApi.getWorkspaces(),
    ]);

    return {
      bindings: bindingsResponse.data,
      agents: agentsResponse.data,
      workspaces: workspacesResponse.data,
    };
  }, []);

  const { data, loading, error, retry } = useResource("bindings", loadBindings);

  const agentById = useMemo(() => {
    return new Map(data?.agents.map((agent) => [agent.id, agent.name]) ?? []);
  }, [data]);

  const workspaceById = useMemo(() => {
    return new Map(data?.workspaces.map((workspace) => [workspace.id, workspace.name]) ?? []);
  }, [data]);

  const rows = useMemo<BindingRow[]>(() => {
    return (data?.bindings ?? []).map((binding) => ({
      id: binding.id,
      routeType: binding.routeType,
      source: binding.source,
      targetAgentId: binding.targetAgentId,
      targetAgentName: agentById.get(binding.targetAgentId) ?? binding.targetAgentId,
      workspaceId: binding.workspaceId,
      workspaceName: workspaceById.get(binding.workspaceId) ?? binding.workspaceId,
      status: binding.status,
      description: binding.description,
      updatedAt: binding.updatedAt,
    }));
  }, [agentById, data, workspaceById]);

  const filteredRows = useMemo(() => {
    return rows.filter((binding) => {
      const matchesSearch = includesSearch(
        [binding.id, binding.source, binding.description, binding.targetAgentName, binding.workspaceName, binding.routeType],
        tableState.search,
      );
      const matchesStatus = tableState.filters.status === "all" || binding.status === tableState.filters.status;
      const matchesRouteType = tableState.filters.routeType === "all" || binding.routeType === tableState.filters.routeType;
      const matchesWorkspace = tableState.filters.workspace === "all" || binding.workspaceId === tableState.filters.workspace;

      return matchesSearch && matchesStatus && matchesRouteType && matchesWorkspace;
    });
  }, [rows, tableState.filters.routeType, tableState.filters.status, tableState.filters.workspace, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      id: (binding) => binding.id,
      routeType: (binding) => binding.routeType,
      source: (binding) => binding.source,
      target: (binding) => binding.targetAgentName,
      workspace: (binding) => binding.workspaceName,
      status: (binding) => binding.status,
      updatedAt: (binding) => Date.parse(binding.updatedAt),
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

  const statusOptions = useMemo(() => {
    return Array.from(new Set(rows.map((binding) => binding.status))).sort();
  }, [rows]);

  const routeTypeOptions = useMemo(() => {
    return Array.from(new Set(rows.map((binding) => binding.routeType))).sort();
  }, [rows]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>Bindings</h2>
        <p>Route and binding inventory for channels, APIs, schedules, and webhooks.</p>
      </header>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder="Search by binding, source, description, target, or workspace"
          value={tableState.search}
          onChange={(event) => tableState.setSearch(event.target.value)}
        />

        <select
          className="filter-select"
          value={tableState.filters.status}
          onChange={(event) => tableState.setFilter("status", event.target.value)}
        >
          <option value="all">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={tableState.filters.routeType}
          onChange={(event) => tableState.setFilter("routeType", event.target.value)}
        >
          <option value="all">All route types</option>
          {routeTypeOptions.map((routeType) => (
            <option key={routeType} value={routeType}>
              {routeType}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={tableState.filters.workspace}
          onChange={(event) => tableState.setFilter("workspace", event.target.value)}
        >
          <option value="all">All workspaces</option>
          {data?.workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </TableToolbar>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle="No bindings match current filters"
        emptyMessage="Try broadening search terms or adjusting route/status filters."
      >
        <div className="panel">
          <div className="panel-header">
            <h3>Binding Inventory</h3>
            <p>{filteredRows.length} filtered rows</p>
          </div>

          <div className="table-wrap">
            <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
              <thead>
                <tr>
                  <SortableHeader
                    column="id"
                    label="Binding"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="routeType"
                    label="Route Type"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="source"
                    label="Source"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="target"
                    label="Target Agent"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="workspace"
                    label="Workspace"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="status"
                    label="Status"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="updatedAt"
                    label="Updated"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                </tr>
              </thead>
              <tbody>
                {paginated.pageItems.map((binding) => (
                  <tr key={binding.id}>
                    <td>
                      <div className="cell-title">{binding.id}</div>
                      <div className="cell-subtitle">{binding.description}</div>
                    </td>
                    <td>{binding.routeType}</td>
                    <td>{binding.source}</td>
                    <td>{binding.targetAgentName}</td>
                    <td>{binding.workspaceName}</td>
                    <td>
                      <StatusBadge status={binding.status} />
                    </td>
                    <td>{formatTimestamp(binding.updatedAt)}</td>
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
