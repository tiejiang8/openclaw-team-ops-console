import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp, formatUptime } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

export function AgentsPage() {
  const { language, t, translateStatus } = useI18n();
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
      const workspaceName = agent.workspaceId ? (workspaceById.get(agent.workspaceId) ?? agent.workspaceId) : "-";

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
      workspace: (agent) => (agent.workspaceId ? (workspaceById.get(agent.workspaceId) ?? agent.workspaceId) : "-"),
      authProfile: (agent) => agent.authProfileId ?? "-",
      status: (agent) => agent.status,
      heartbeat: (agent) => (agent.lastHeartbeatAt ? Date.parse(agent.lastHeartbeatAt) : null),
      uptime: (agent) => agent.uptimeSeconds ?? null,
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
        <h2>{t("agents.title")}</h2>
        <p>{t("agents.description")}</p>
      </header>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder={t("agents.searchPlaceholder")}
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
          value={tableState.filters.workspace}
          onChange={(event) => tableState.setFilter("workspace", event.target.value)}
        >
          <option value="all">{t("filter.allWorkspaces")}</option>
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
        emptyTitle={t("agents.emptyTitle")}
        emptyMessage={t("agents.emptyMessage")}
      >
        <div className="panel">
          <div className="panel-header">
            <h3>{t("agents.panelTitle")}</h3>
            <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
          </div>

          <div className="table-wrap">
            <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
              <thead>
                <tr>
                  <SortableHeader
                    column="name"
                    label={t("agents.table.agent")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="role"
                    label={t("agents.table.role")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="workspace"
                    label={t("agents.table.workspace")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="authProfile"
                    label={t("agents.table.authProfile")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="status"
                    label={t("agents.table.status")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="heartbeat"
                    label={t("agents.table.lastHeartbeat")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="uptime"
                    label={t("agents.table.uptime")}
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
                    <td>{agent.workspaceId ? (workspaceById.get(agent.workspaceId) ?? agent.workspaceId) : "-"}</td>
                    <td className="cell-mono">{agent.authProfileId ?? "-"}</td>
                    <td>
                      <StatusBadge status={agent.status} />
                    </td>
                    <td>{formatTimestamp(agent.lastHeartbeatAt, language)}</td>
                    <td className="cell-align-right">{formatUptime(agent.uptimeSeconds, language)}</td>
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
