import type { LogEntry } from "@openclaw-team-ops/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DataState } from "../components/data-state.js";
import { PageObservability } from "../components/page-observability.js";
import { TableToolbar } from "../components/table-controls.js";
import { loadLogsPageData } from "../features/logs/api.js";
import { LogEntryDetailDrawer } from "../features/logs/log-entry-detail-drawer.js";
import { LogEntryTable } from "../features/logs/log-entry-table.js";
import { buildLogFilterOptions } from "../features/logs/log-filters.js";
import { LogFileSelector } from "../features/logs/log-file-selector.js";
import { LogSummaryCards } from "../features/logs/log-summary-cards.js";
import { useI18n } from "../lib/i18n.js";
import { sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";

function buildPaginationWindow(page: number, pageSize: number, totalItems: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, totalItems);

  return {
    page: safePage,
    totalPages,
    startIndex,
    endIndex,
  };
}

export function LogsPage() {
  const { language, t } = useI18n();
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const tableState = useTableQueryState({
    defaultSortBy: "lineNumber",
    defaultSortDirection: "desc",
    filterDefaults: {
      date: "latest",
      level: "all",
      subsystem: "all",
      tag: "all",
    },
    defaultPageSize: 20,
    allowedPageSizes: [20, 50, 100],
  });

  const loadLogs = useCallback(
    () =>
      loadLogsPageData({
        ...(tableState.filters.date !== "latest" ? { date: tableState.filters.date } : {}),
        ...(tableState.page > 1 ? { cursor: String((tableState.page - 1) * tableState.pageSize) } : {}),
        limit: tableState.pageSize,
        ...(tableState.search ? { q: tableState.search } : {}),
        ...(tableState.filters.level !== "all" ? { level: tableState.filters.level } : {}),
        ...(tableState.filters.subsystem !== "all" ? { subsystem: tableState.filters.subsystem } : {}),
        ...(tableState.filters.tag !== "all" ? { tag: tableState.filters.tag } : {}),
      }),
    [
      tableState.filters.date,
      tableState.filters.level,
      tableState.filters.subsystem,
      tableState.filters.tag,
      tableState.page,
      tableState.pageSize,
      tableState.search,
    ],
  );
  const { data, loading, error, retry } = useResource("logs", loadLogs);

  const filterOptions = useMemo(() => buildLogFilterOptions(data?.files, data?.entries), [data]);
  const rows = useMemo(
    () =>
      sortRows(data?.entries.data.items ?? [], tableState.sortBy, tableState.sortDirection, {
        lineNumber: (entry) => entry.lineNumber,
        ts: (entry) => (entry.ts ? Date.parse(entry.ts) : null),
        level: (entry) => entry.level,
        subsystem: (entry) => entry.subsystem ?? "",
        message: (entry) => entry.message,
        tags: (entry) => entry.tags.join(","),
      }),
    [data?.entries.data.items, tableState.sortBy, tableState.sortDirection],
  );
  const pagination = useMemo(
    () => buildPaginationWindow(tableState.page, tableState.pageSize, data?.entries.data.total ?? 0),
    [data?.entries.data.total, tableState.page, tableState.pageSize],
  );
  const selectedFile = useMemo(
    () => data?.files.data.find((file) => file.date === data.resolvedDate) ?? data?.files.data.find((file) => file.isLatest),
    [data],
  );
  const observabilityMeta = data?.entries.meta ?? data?.summary.meta ?? data?.files.meta;
  const isPartialCoverage = Boolean(observabilityMeta && observabilityMeta.coverage !== "complete");
  const isEmpty = !loading && !error && rows.length === 0;

  useEffect(() => {
    if (pagination.page !== tableState.page) {
      tableState.setPage(pagination.page);
    }
  }, [pagination.page, tableState.page, tableState.setPage]);

  useEffect(() => {
    setSelectedEntry((current) => {
      if (!current) {
        return null;
      }

      return rows.some((entry) => entry.id === current.id) ? current : null;
    });
  }, [rows]);

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("logs.title")}</h2>
        <p>{t("logs.description")}</p>
      </header>

      <PageObservability meta={observabilityMeta} />

      {isPartialCoverage ? (
        <div className="state-box state-box-warning">
          <p className="state-title">{t("logs.partialTitle")}</p>
          <p className="state-message">{t("logs.partialMessage")}</p>
        </div>
      ) : null}

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("logs.emptyTitle")}
        emptyMessage={t("logs.emptyMessage")}
      >
        {data ? (
          <>
            <LogSummaryCards summary={data.summary.data} fileCount={data.files.data.length} />

            <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
              <LogFileSelector
                value={tableState.filters.date ?? "latest"}
                files={data.files.data}
                onChange={(value) => tableState.setFilter("date", value)}
              />

              <input
                className="filter-input"
                placeholder={t("logs.searchPlaceholder")}
                value={tableState.search}
                onChange={(event) => tableState.setSearch(event.target.value)}
              />

              <label className="log-filter-field">
                <span className="log-filter-label">{t("logs.filters.level")}</span>
                <select
                  className="filter-select"
                  value={tableState.filters.level}
                  onChange={(event) => tableState.setFilter("level", event.target.value)}
                >
                  <option value="all">{t("logs.filter.allLevels")}</option>
                  {filterOptions.levels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label className="log-filter-field">
                <span className="log-filter-label">{t("logs.filters.subsystem")}</span>
                <select
                  className="filter-select"
                  value={tableState.filters.subsystem}
                  onChange={(event) => tableState.setFilter("subsystem", event.target.value)}
                >
                  <option value="all">{t("logs.filter.allSubsystems")}</option>
                  {filterOptions.subsystems.map((subsystem) => (
                    <option key={subsystem} value={subsystem}>
                      {subsystem}
                    </option>
                  ))}
                </select>
              </label>

              <label className="log-filter-field">
                <span className="log-filter-label">{t("logs.filters.tag")}</span>
                <select
                  className="filter-select"
                  value={tableState.filters.tag}
                  onChange={(event) => tableState.setFilter("tag", event.target.value)}
                >
                  <option value="all">{t("logs.filter.allTags")}</option>
                  {filterOptions.tags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
            </TableToolbar>

            <div className="log-layout">
              <div className="panel">
                <div className="panel-header">
                  <h3>{t("logs.panelTitle")}</h3>
                  <p>{t("table.filteredRows", { count: data.entries.data.total })}</p>
                </div>

                <LogEntryTable
                  rows={rows}
                  density={tableState.density}
                  language={language}
                  sortBy={tableState.sortBy}
                  sortDirection={tableState.sortDirection}
                  onSort={tableState.setSort}
                  {...(selectedEntry?.id ? { selectedEntryId: selectedEntry.id } : {})}
                  onSelect={setSelectedEntry}
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={data.entries.data.total}
                  startItemIndex={pagination.startIndex}
                  endItemIndex={pagination.endIndex}
                  pageSize={tableState.pageSize}
                  allowedPageSizes={tableState.allowedPageSizes}
                  setPage={tableState.setPage}
                  setPageSize={tableState.setPageSize}
                />
              </div>

              <LogEntryDetailDrawer entry={selectedEntry} {...(selectedFile?.path ? { filePath: selectedFile.path } : {})} />
            </div>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
