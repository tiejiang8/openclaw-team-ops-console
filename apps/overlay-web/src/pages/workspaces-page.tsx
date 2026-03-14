import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface WorkspaceRow {
  id: string;
  name: string;
  environment: "development" | "staging" | "production";
  ownerTeam: string;
  region: string;
  status: string;
  updatedAt: string;
  agents: number;
  sessions: number;
  activeSessions: number;
}

export function WorkspacesPage() {
  const tableState = useTableQueryState({
    defaultSortBy: "name",
    filterDefaults: {
      status: "all",
      environment: "all",
    },
    defaultPageSize: 10,
  });

  const loadWorkspaces = useCallback(async () => {
    const [workspacesResponse, agentsResponse, sessionsResponse] = await Promise.all([
      overlayApi.getWorkspaces(),
      overlayApi.getAgents(),
      overlayApi.getSessions(),
    ]);

    return {
      workspaces: workspacesResponse.data,
      agents: agentsResponse.data,
      sessions: sessionsResponse.data,
    };
  }, []);

  const { data, loading, error, retry } = useResource("workspaces", loadWorkspaces);

  const rows = useMemo<WorkspaceRow[]>(() => {
    if (!data) {
      return [];
    }

    const metrics = new Map<string, { agents: number; sessions: number; activeSessions: number }>();

    for (const workspace of data.workspaces) {
      metrics.set(workspace.id, { agents: 0, sessions: 0, activeSessions: 0 });
    }

    for (const agent of data.agents) {
      const entry = metrics.get(agent.workspaceId);
      if (entry) {
        entry.agents += 1;
      }
    }

    for (const session of data.sessions) {
      const entry = metrics.get(session.workspaceId);
      if (entry) {
        entry.sessions += 1;
        if (session.status === "active") {
          entry.activeSessions += 1;
        }
      }
    }

    return data.workspaces.map((workspace) => {
      const snapshot = metrics.get(workspace.id) ?? { agents: 0, sessions: 0, activeSessions: 0 };
      return {
        id: workspace.id,
        name: workspace.name,
        environment: workspace.environment,
        ownerTeam: workspace.ownerTeam,
        region: workspace.region,
        status: workspace.status,
        updatedAt: workspace.updatedAt,
        agents: snapshot.agents,
        sessions: snapshot.sessions,
        activeSessions: snapshot.activeSessions,
      };
    });
  }, [data]);

  const filteredRows = useMemo(() => {
    return rows.filter((workspace) => {
      const matchesSearch = includesSearch(
        [workspace.id, workspace.name, workspace.ownerTeam, workspace.region, workspace.environment],
        tableState.search,
      );
      const matchesStatus = tableState.filters.status === "all" || workspace.status === tableState.filters.status;
      const matchesEnvironment =
        tableState.filters.environment === "all" || workspace.environment === tableState.filters.environment;

      return matchesSearch && matchesStatus && matchesEnvironment;
    });
  }, [rows, tableState.filters.environment, tableState.filters.status, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      name: (workspace) => workspace.name,
      environment: (workspace) => workspace.environment,
      ownerTeam: (workspace) => workspace.ownerTeam,
      region: (workspace) => workspace.region,
      agents: (workspace) => workspace.agents,
      sessions: (workspace) => workspace.sessions,
      status: (workspace) => workspace.status,
      updatedAt: (workspace) => Date.parse(workspace.updatedAt),
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
    return Array.from(new Set(rows.map((workspace) => workspace.status))).sort();
  }, [rows]);

  const environmentOptions = useMemo(() => {
    return Array.from(new Set(rows.map((workspace) => workspace.environment))).sort();
  }, [rows]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>Workspaces</h2>
        <p>Workspace-level inventory, ownership, and activity coverage.</p>
      </header>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder="Search by workspace, team, region, or environment"
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
          value={tableState.filters.environment}
          onChange={(event) => tableState.setFilter("environment", event.target.value)}
        >
          <option value="all">All environments</option>
          {environmentOptions.map((environment) => (
            <option key={environment} value={environment}>
              {environment}
            </option>
          ))}
        </select>
      </TableToolbar>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle="No workspaces match current filters"
        emptyMessage="Try broadening search terms or clearing filters."
      >
        <div className="panel">
          <div className="panel-header">
            <h3>Workspace Inventory</h3>
            <p>{filteredRows.length} filtered rows</p>
          </div>

          <div className="table-wrap">
            <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
              <thead>
                <tr>
                  <SortableHeader
                    column="name"
                    label="Workspace"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="environment"
                    label="Environment"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="ownerTeam"
                    label="Team"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="region"
                    label="Region"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="agents"
                    label="Agents"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
                  />
                  <SortableHeader
                    column="sessions"
                    label="Sessions"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
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
                {paginated.pageItems.map((workspace) => (
                  <tr key={workspace.id}>
                    <td>
                      <div className="cell-title">{workspace.name}</div>
                      <div className="cell-subtitle">{workspace.id}</div>
                    </td>
                    <td>{workspace.environment}</td>
                    <td>{workspace.ownerTeam}</td>
                    <td>{workspace.region}</td>
                    <td className="cell-align-right">{workspace.agents}</td>
                    <td className="cell-align-right">
                      {workspace.sessions}
                      <span className="cell-subtitle-inline"> ({workspace.activeSessions} active)</span>
                    </td>
                    <td>
                      <StatusBadge status={workspace.status} />
                    </td>
                    <td>{formatTimestamp(workspace.updatedAt)}</td>
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
