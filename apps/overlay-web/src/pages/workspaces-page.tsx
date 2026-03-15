import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DataState } from "../components/data-state.js";
import { PageObservability } from "../components/page-observability.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { StatusBadge } from "../components/status-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

interface WorkspaceRow {
  id: string;
  name: string;
  environment: string;
  ownerTeam: string;
  region: string;
  status: string;
  updatedAt: string | null;
  agents: number;
  sessions: number;
  activeSessions: number;
  coreMarkdownFiles: string[];
}

interface SelectedWorkspaceDocument {
  workspaceId: string;
  workspaceName: string;
  fileName: string;
}

export function WorkspacesPage() {
  const { language, t, translateEnvironment, translateStatus } = useI18n();
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
      meta: workspacesResponse.meta,
    };
  }, []);

  const { data, loading, error, retry } = useResource("workspaces", loadWorkspaces);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedWorkspaceDocument | null>(null);
  const [documentContent, setDocumentContent] = useState<Awaited<ReturnType<typeof overlayApi.getWorkspaceDocument>>["data"] | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  const rows = useMemo<WorkspaceRow[]>(() => {
    if (!data) {
      return [];
    }

    const metrics = new Map<string, { agents: number; sessions: number; activeSessions: number }>();

    for (const workspace of data.workspaces) {
      metrics.set(workspace.id, { agents: 0, sessions: 0, activeSessions: 0 });
    }

    for (const agent of data.agents) {
      const entry = agent.workspaceId ? metrics.get(agent.workspaceId) : undefined;
      if (entry) {
        entry.agents += 1;
      }
    }

    for (const session of data.sessions) {
      const entry = session.workspaceId ? metrics.get(session.workspaceId) : undefined;
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
        environment: workspace.environment ?? "unknown",
        ownerTeam: workspace.ownerTeam ?? "-",
        region: workspace.region ?? "-",
        status: workspace.status,
        updatedAt: workspace.updatedAt ?? null,
        agents: snapshot.agents,
        sessions: snapshot.sessions,
        activeSessions: snapshot.activeSessions,
        coreMarkdownFiles: workspace.coreMarkdownFiles ?? [],
      };
    });
  }, [data]);

  const filteredRows = useMemo(() => {
    return rows.filter((workspace) => {
      const matchesSearch = includesSearch(
        [workspace.id, workspace.name, workspace.ownerTeam, workspace.region, workspace.environment, ...workspace.coreMarkdownFiles],
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
      updatedAt: (workspace) => (workspace.updatedAt ? Date.parse(workspace.updatedAt) : null),
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

  const loadWorkspaceDocument = useCallback(async (selection: SelectedWorkspaceDocument) => {
    setSelectedDocument(selection);
    setDocumentLoading(true);
    setDocumentError(null);
    setDocumentContent(null);

    try {
      const response = await overlayApi.getWorkspaceDocument(selection.workspaceId, selection.fileName);
      setDocumentContent(response.data);
    } catch (loadError) {
      setDocumentError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setDocumentLoading(false);
    }
  }, []);

  const retryWorkspaceDocument = useCallback(() => {
    if (selectedDocument) {
      void loadWorkspaceDocument(selectedDocument);
    }
  }, [loadWorkspaceDocument, selectedDocument]);

  useEffect(() => {
    if (selectedDocument) {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedDocument]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("workspaces.title")}</h2>
        <p>{t("workspaces.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder={t("workspaces.searchPlaceholder")}
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
        emptyTitle={t("workspaces.emptyTitle")}
        emptyMessage={t("workspaces.emptyMessage")}
      >
        <div className="panel">
          <div className="panel-header">
            <h3>{t("workspaces.panelTitle")}</h3>
            <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
          </div>

          <div className="table-wrap">
            <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
              <thead>
                <tr>
                  <SortableHeader
                    column="name"
                    label={t("workspaces.table.workspace")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="environment"
                    label={t("workspaces.table.environment")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="ownerTeam"
                    label={t("workspaces.table.team")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="region"
                    label={t("workspaces.table.region")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="agents"
                    label={t("workspaces.table.agents")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
                  />
                  <SortableHeader
                    column="sessions"
                    label={t("workspaces.table.sessions")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                    align="right"
                  />
                  <SortableHeader
                    column="status"
                    label={t("workspaces.table.status")}
                    sortBy={tableState.sortBy}
                    sortDirection={tableState.sortDirection}
                    onSort={tableState.setSort}
                  />
                  <SortableHeader
                    column="updatedAt"
                    label={t("workspaces.table.updated")}
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
                      {workspace.coreMarkdownFiles.length > 0 ? (
                        <div className="workspace-core-docs" aria-label="Core markdown files">
                          {workspace.coreMarkdownFiles.map((fileName) => (
                            <button
                              key={fileName}
                              type="button"
                              className={`workspace-core-doc-button${
                                selectedDocument?.workspaceId === workspace.id && selectedDocument?.fileName === fileName
                                  ? " workspace-core-doc-button-active"
                                  : ""
                              }`}
                              onClick={() =>
                                void loadWorkspaceDocument({
                                  workspaceId: workspace.id,
                                  workspaceName: workspace.name,
                                  fileName,
                                })
                              }
                              title={t("workspaces.previewOpenAction", { fileName })}
                            >
                              {fileName}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="workspace-core-docs-empty">{t("workspaces.noCoreDocs")}</div>
                      )}
                    </td>
                    <td>{translateEnvironment(workspace.environment)}</td>
                    <td>{workspace.ownerTeam}</td>
                    <td>{workspace.region}</td>
                    <td className="cell-align-right">{workspace.agents}</td>
                    <td className="cell-align-right">
                      {workspace.sessions}
                      <span className="cell-subtitle-inline"> ({t("common.activeCount", { count: workspace.activeSessions })})</span>
                    </td>
                    <td>
                      <StatusBadge status={workspace.status} />
                    </td>
                    <td>{formatTimestamp(workspace.updatedAt, language)}</td>
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

        <div ref={previewRef} className="panel workspace-document-panel">
          <div className="panel-header workspace-document-header">
            <div>
              <h3>{t("workspaces.previewTitle")}</h3>
              <p>
                {selectedDocument
                  ? t("workspaces.previewDescription", {
                      workspace: selectedDocument.workspaceName,
                      fileName: selectedDocument.fileName,
                    })
                  : t("workspaces.previewEmptyMessage")}
              </p>
            </div>
            {selectedDocument ? (
              <button
                type="button"
                className="workspace-document-close"
                onClick={() => {
                  setSelectedDocument(null);
                  setDocumentContent(null);
                  setDocumentError(null);
                  setDocumentLoading(false);
                }}
              >
                {t("common.close")}
              </button>
            ) : null}
          </div>

          <DataState
            loading={documentLoading}
            loadingMessage={t("workspaces.previewLoading")}
            error={documentError}
            errorTitle={t("workspaces.previewErrorTitle")}
            onRetry={selectedDocument ? retryWorkspaceDocument : undefined}
            isEmpty={!selectedDocument}
            emptyTitle={t("workspaces.previewEmptyTitle")}
            emptyMessage={t("workspaces.previewEmptyMessage")}
          >
            {selectedDocument && documentContent ? (
              <div className="workspace-document-body">
                <div className="workspace-document-meta">
                  <span className="workspace-document-meta-item">
                    <strong>{t("workspaces.previewUpdated")}:</strong> {formatTimestamp(documentContent.updatedAt, language)}
                  </span>
                  <span className="workspace-document-meta-item">
                    <strong>{t("workspaces.previewSourcePath")}:</strong> {documentContent.sourcePath ?? t("common.notAvailable")}
                  </span>
                </div>
                <pre className="workspace-document-content">{documentContent.content}</pre>
              </div>
            ) : null}
          </DataState>
        </div>
      </DataState>
    </section>
  );
}
