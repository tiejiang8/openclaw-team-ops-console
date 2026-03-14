import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp, formatUptime } from "../lib/format.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

export function AgentsPage() {
  const tableState = useTableQueryState({
    defaultSortBy: "name",
    filterDefaults: {
      status: "all",
      workspace: "all",
    },
    defaultPageSize: 10,
  });

  const loadAgents = useCallback(async () => {
    const [agentsResponse, workspacesResponse] = await Promise.all([overlayApi.getAgents(), overlayApi.getWorkspaces()]);

    return {
      agents: agentsResponse.data,
      workspaces: workspacesResponse.data,
    };
  }, []);

  const { data, loading, error, retry } = useResource("agents", loadAgents);

  const workspaceById = useMemo(() => {
    return new Map(data?.workspaces.map((workspace) => [workspace.id, workspace.name]) ?? []);
  }, [data]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(data?.agents.map((agent) => agent.status) ?? [])).sort();
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.agents.filter((agent) => {
      const workspaceName = workspaceById.get(agent.workspaceId) ?? agent.workspaceId;

      const matchesSearch = includesSearch(
        [agent.id, agent.name, agent.role, agent.authProfileId, agent.workspaceId, workspaceName],
        tableState.search,
      );
      const matchesStatus = tableState.filters.status === "all" || agent.status === tableState.filters.status;
      const matchesWorkspace = tableState.filters.workspace === "all" || agent.workspaceId === tableState.filters.workspace;

      return matchesSearch && matchesStatus && matchesWorkspace;
    });
  }, [data, tableState.filters.status, tableState.filters.workspace, tableState.search, workspaceById]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      name: (agent) => agent.name,
      role: (agent) => agent.role,
      workspace: (agent) => workspaceById.get(agent.workspaceId) ?? agent.workspaceId,
      authProfile: (agent) => agent.authProfileId,
      status: (agent) => agent.status,
      heartbeat: (agent) => Date.parse(agent.lastHeartbeatAt),
      uptime: (agent) => agent.uptimeSeconds,
    });
  }, [filteredRows, tableState.sortBy, tableState.sortDirection, workspaceById]);

  const paginated = useMemo(() => {
    return paginateRows(sortedRows, tableState.page, tableState.pageSize);
  }, [sortedRows, tableState.page, tableState.pageSize]);

  useEffect(() => {
    if (paginated.page !== tableState.page) {
      tableState.setPage(paginated.page);
    }
  }, [paginated.page, tableState.page, tableState.setPage]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>Agents</h2>
        <p>Inventory of running agents, ownership, and operational status.</p>
      </header>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder="Search by agent, role, workspace, or auth profile"
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
        emptyTitle="No agents match current filters"
        emptyMessage="Try resetting status/workspace filters or broadening your search."
      >
        <div className="panel">
          <div className="panel-header">
            <h3>Agent Inventory</h3>
            <p>{filteredRows.length} filtered rows</p>
          </div>

          <div className="table-wrap">
            <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
              <thead>
                <tr>
                  <SortableHeader
                    column="name"
                    label="Agent"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="role"
                    label="Role"
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
                    column="authProfile"
                    label="Auth Profile"
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
                    column="heartbeat"
                    label="Last Heartbeat"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="uptime"
                    label="Uptime"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {paginated.pageItems.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <div className="cell-title">{agent.name}</div>
                      <div className="cell-subtitle">{agent.id}</div>
                    </td>
                    <td>{agent.role}</td>
                    <td>{workspaceById.get(agent.workspaceId) ?? agent.workspaceId}</td>
                    <td className="cell-mono">{agent.authProfileId}</td>
                    <td>
                      <StatusBadge status={agent.status} />
                    </td>
                    <td>{formatTimestamp(agent.lastHeartbeatAt)}</td>
                    <td className="cell-align-right">{formatUptime(agent.uptimeSeconds)}</td>
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
