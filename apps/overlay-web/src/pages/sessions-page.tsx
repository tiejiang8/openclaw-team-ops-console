import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface SessionRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  agentId: string;
  agentName: string;
  bindingId: string;
  channel: string;
  status: string;
  lastActivityAt: string;
  messageCount: number;
}

export function SessionsPage() {
  const tableState = useTableQueryState({
    defaultSortBy: "lastActivityAt",
    defaultSortDirection: "desc",
    filterDefaults: {
      status: "all",
      channel: "all",
    },
    defaultPageSize: 10,
  });

  const loadSessions = useCallback(async () => {
    const [sessionsResponse, agentsResponse, workspacesResponse] = await Promise.all([
      overlayApi.getSessions(),
      overlayApi.getAgents(),
      overlayApi.getWorkspaces(),
    ]);

    return {
      sessions: sessionsResponse.data,
      agents: agentsResponse.data,
      workspaces: workspacesResponse.data,
    };
  }, []);

  const { data, loading, error, retry } = useResource("sessions", loadSessions);

  const agentById = useMemo(() => {
    return new Map(data?.agents.map((agent) => [agent.id, agent.name]) ?? []);
  }, [data]);

  const workspaceById = useMemo(() => {
    return new Map(data?.workspaces.map((workspace) => [workspace.id, workspace.name]) ?? []);
  }, [data]);

  const rows = useMemo<SessionRow[]>(() => {
    return (data?.sessions ?? []).map((session) => ({
      id: session.id,
      workspaceId: session.workspaceId,
      workspaceName: workspaceById.get(session.workspaceId) ?? session.workspaceId,
      agentId: session.agentId,
      agentName: agentById.get(session.agentId) ?? session.agentId,
      bindingId: session.bindingId,
      channel: session.channel,
      status: session.status,
      lastActivityAt: session.lastActivityAt,
      messageCount: session.messageCount,
    }));
  }, [agentById, data, workspaceById]);

  const filteredRows = useMemo(() => {
    return rows.filter((session) => {
      const matchesSearch = includesSearch(
        [session.id, session.workspaceName, session.workspaceId, session.agentName, session.agentId, session.bindingId, session.channel],
        tableState.search,
      );
      const matchesStatus = tableState.filters.status === "all" || session.status === tableState.filters.status;
      const matchesChannel = tableState.filters.channel === "all" || session.channel === tableState.filters.channel;

      return matchesSearch && matchesStatus && matchesChannel;
    });
  }, [rows, tableState.filters.channel, tableState.filters.status, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      id: (session) => session.id,
      workspace: (session) => session.workspaceName,
      agent: (session) => session.agentName,
      binding: (session) => session.bindingId,
      channel: (session) => session.channel,
      status: (session) => session.status,
      lastActivityAt: (session) => Date.parse(session.lastActivityAt),
      messageCount: (session) => session.messageCount,
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
    return Array.from(new Set(rows.map((session) => session.status))).sort();
  }, [rows]);

  const channelOptions = useMemo(() => {
    return Array.from(new Set(rows.map((session) => session.channel))).sort();
  }, [rows]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>Sessions</h2>
        <p>Session inventory and activity state across workspaces and channels.</p>
      </header>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder="Search by session, workspace, agent, binding, or channel"
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
          value={tableState.filters.channel}
          onChange={(event) => tableState.setFilter("channel", event.target.value)}
        >
          <option value="all">All channels</option>
          {channelOptions.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
      </TableToolbar>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle="No sessions match current filters"
        emptyMessage="Try clearing status/channel filters or broadening search terms."
      >
        <div className="panel">
          <div className="panel-header">
            <h3>Session Inventory</h3>
            <p>{filteredRows.length} filtered rows</p>
          </div>

          <div className="table-wrap">
            <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
              <thead>
                <tr>
                  <SortableHeader
                    column="id"
                    label="Session"
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
                    column="agent"
                    label="Agent"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="binding"
                    label="Binding"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="channel"
                    label="Channel"
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
                    column="lastActivityAt"
                    label="Last Activity"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="messageCount"
                    label="Messages"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {paginated.pageItems.map((session) => (
                  <tr key={session.id}>
                    <td className="cell-mono">{session.id}</td>
                    <td>{session.workspaceName}</td>
                    <td>{session.agentName}</td>
                    <td className="cell-mono">{session.bindingId}</td>
                    <td>{session.channel}</td>
                    <td>
                      <StatusBadge status={session.status} />
                    </td>
                    <td>{formatTimestamp(session.lastActivityAt)}</td>
                    <td className="cell-align-right">{session.messageCount}</td>
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
