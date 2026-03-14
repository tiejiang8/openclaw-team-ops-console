import { useCallback, useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface AuthProfileRow {
  id: string;
  name: string;
  provider: string;
  status: string;
  scopes: string[];
  workspaceNames: string[];
  linkedAgents: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export function AuthProfilesPage() {
  const tableState = useTableQueryState({
    defaultSortBy: "name",
    filterDefaults: {
      status: "all",
      provider: "all",
    },
    defaultPageSize: 10,
  });

  const loadAuthProfiles = useCallback(async () => {
    const [authProfilesResponse, workspacesResponse, agentsResponse] = await Promise.all([
      overlayApi.getAuthProfiles(),
      overlayApi.getWorkspaces(),
      overlayApi.getAgents(),
    ]);

    return {
      authProfiles: authProfilesResponse.data,
      workspaces: workspacesResponse.data,
      agents: agentsResponse.data,
    };
  }, []);

  const { data, loading, error, retry } = useResource("auth-profiles", loadAuthProfiles);

  const workspaceById = useMemo(() => {
    return new Map(data?.workspaces.map((workspace) => [workspace.id, workspace.name]) ?? []);
  }, [data]);

  const linkedAgentCountByAuthProfile = useMemo(() => {
    const counts = new Map<string, number>();

    for (const agent of data?.agents ?? []) {
      counts.set(agent.authProfileId, (counts.get(agent.authProfileId) ?? 0) + 1);
    }

    return counts;
  }, [data]);

  const rows = useMemo<AuthProfileRow[]>(() => {
    return (data?.authProfiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.name,
      provider: profile.provider,
      status: profile.status,
      scopes: profile.scopes,
      workspaceNames: profile.workspaceIds.map((workspaceId) => workspaceById.get(workspaceId) ?? workspaceId),
      linkedAgents: linkedAgentCountByAuthProfile.get(profile.id) ?? 0,
      expiresAt: profile.expiresAt ?? null,
      lastUsedAt: profile.lastUsedAt ?? null,
    }));
  }, [data, linkedAgentCountByAuthProfile, workspaceById]);

  const filteredRows = useMemo(() => {
    return rows.filter((profile) => {
      const matchesSearch = includesSearch(
        [profile.id, profile.name, profile.provider, profile.scopes.join(" "), profile.workspaceNames.join(" ")],
        tableState.search,
      );
      const matchesStatus = tableState.filters.status === "all" || profile.status === tableState.filters.status;
      const matchesProvider = tableState.filters.provider === "all" || profile.provider === tableState.filters.provider;

      return matchesSearch && matchesStatus && matchesProvider;
    });
  }, [rows, tableState.filters.provider, tableState.filters.status, tableState.search]);

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      name: (profile) => profile.name,
      provider: (profile) => profile.provider,
      status: (profile) => profile.status,
      scopeCount: (profile) => profile.scopes.length,
      workspaceCount: (profile) => profile.workspaceNames.length,
      linkedAgents: (profile) => profile.linkedAgents,
      expiresAt: (profile) => (profile.expiresAt ? Date.parse(profile.expiresAt) : Number.POSITIVE_INFINITY),
      lastUsedAt: (profile) => (profile.lastUsedAt ? Date.parse(profile.lastUsedAt) : Number.NEGATIVE_INFINITY),
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
    return Array.from(new Set(rows.map((profile) => profile.status))).sort();
  }, [rows]);

  const providerOptions = useMemo(() => {
    return Array.from(new Set(rows.map((profile) => profile.provider))).sort();
  }, [rows]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>Auth Profiles</h2>
        <p>Credential profile inventory, scope coverage, and expiry posture.</p>
      </header>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder="Search by profile, provider, scope, or workspace"
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
          value={tableState.filters.provider}
          onChange={(event) => tableState.setFilter("provider", event.target.value)}
        >
          <option value="all">All providers</option>
          {providerOptions.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </TableToolbar>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle="No auth profiles match current filters"
        emptyMessage="Try expanding search terms or clearing status/provider filters."
      >
        <div className="panel">
          <div className="panel-header">
            <h3>Auth Profile Inventory</h3>
            <p>{filteredRows.length} filtered rows</p>
          </div>

          <div className="table-wrap">
            <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
              <thead>
                <tr>
                  <SortableHeader
                    column="name"
                    label="Profile"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="provider"
                    label="Provider"
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
                    column="scopeCount"
                    label="Scopes"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
                  />
                  <SortableHeader
                    column="workspaceCount"
                    label="Workspaces"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
                  />
                  <SortableHeader
                    column="linkedAgents"
                    label="Linked Agents"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
                  />
                  <SortableHeader
                    column="expiresAt"
                    label="Expires"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="lastUsedAt"
                    label="Last Used"
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                </tr>
              </thead>
              <tbody>
                {paginated.pageItems.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <div className="cell-title">{profile.name}</div>
                      <div className="cell-subtitle">{profile.id}</div>
                    </td>
                    <td>{profile.provider}</td>
                    <td>
                      <StatusBadge status={profile.status} />
                    </td>
                    <td className="cell-align-right">{profile.scopes.length}</td>
                    <td className="cell-align-right">{profile.workspaceNames.length}</td>
                    <td className="cell-align-right">{profile.linkedAgents}</td>
                    <td>{profile.expiresAt ? formatTimestamp(profile.expiresAt) : "-"}</td>
                    <td>{profile.lastUsedAt ? formatTimestamp(profile.lastUsedAt) : "-"}</td>
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
