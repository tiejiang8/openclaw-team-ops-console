import { useEffect, useMemo } from "react";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { useStreamRefresh } from "../components/streaming-provider.js";
import { CronTable } from "../components/cron/cron-table.js";
import { PaginationControls, TableToolbar } from "../components/table-controls.js";
import { getCronJobs } from "../lib/api/cron.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";
import { useTableQueryState } from "../lib/table-state.js";

export function CronPage() {
  const { t } = useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "nextRunAt",
    defaultSortDirection: "asc",
    filterDefaults: {
      status: "all",
    },
    defaultPageSize: 10,
  });

  const loadCronJobs = useMemo(() => {
    return () => getCronJobs({
      q: tableState.search,
      status: tableState.filters.status,
      page: String(tableState.page),
      pageSize: String(tableState.pageSize),
      sortBy: tableState.sortBy,
      sortDirection: tableState.sortDirection,
    });
  }, [tableState.search, tableState.filters.status, tableState.page, tableState.pageSize, tableState.sortBy, tableState.sortDirection]);

  const { data, loading, error, retry } = useResource(
    `cron-${tableState.search}-${tableState.filters.status}-${String(tableState.page)}-${String(tableState.pageSize)}-${tableState.sortBy}-${tableState.sortDirection}`,
    loadCronJobs,
    { refreshIntervalMs: 10000 }
  );

  useStreamRefresh("cron_job", retry);

  const rows = useMemo(() => data?.data ?? [], [data]);
  const filteredRows = useMemo(() => {
    return rows.filter((job) => {
      const matchesSearch = includesSearch(
        [job.id, job.name, job.scheduleText, job.sessionTarget, job.deliveryMode],
        tableState.search,
      );

      if (!matchesSearch) {
        return false;
      }

      switch (tableState.filters.status) {
        case "enabled":
          return job.enabled;
        case "disabled":
          return !job.enabled;
        case "overdue":
          return job.overdue;
        case "failing":
          return job.lastRunState === "error";
        default:
          return true;
      }
    });
  }, [rows, tableState.filters.status, tableState.search]);
  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      name: (job) => job.name,
      scheduleText: (job) => job.scheduleText,
      nextRunAt: (job) => (job.nextRunAt ? Date.parse(job.nextRunAt) : null),
      lastRunAt: (job) => (job.lastRunAt ? Date.parse(job.lastRunAt) : null),
      sessionTarget: (job) => job.sessionTarget,
      deliveryMode: (job) => job.deliveryMode,
      lastRunState: (job) => job.lastRunState,
      source: (job) => job.source,
    });
  }, [filteredRows, tableState.sortBy, tableState.sortDirection]);
  const paginated = useMemo(() => paginateRows(sortedRows, tableState.page, tableState.pageSize), [sortedRows, tableState.page, tableState.pageSize]);

  useEffect(() => {
    if (paginated.page !== tableState.page) {
      tableState.setPage(paginated.page);
    }
  }, [paginated.page, tableState]);

  const isEmpty = !loading && !error && filteredRows.length === 0;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("cron.title")}</h2>
        <p>{t("cron.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <div className="metrics-grid">
        <MetricCard label={t("cron.summary.total")} value={rows.length} />
        <MetricCard label={t("cron.summary.enabled")} value={rows.filter((job) => job.enabled).length} />
        <MetricCard label={t("cron.summary.overdue")} value={rows.filter((job) => job.overdue).length} />
        <MetricCard label={t("cron.summary.failing")} value={rows.filter((job) => job.lastRunState === "error").length} />
      </div>

      <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
        <input
          className="filter-input"
          placeholder={t("cron.searchPlaceholder")}
          value={tableState.search}
          onChange={(event) => tableState.setSearch(event.target.value)}
        />

        <select className="filter-select" value={tableState.filters.status} onChange={(event) => tableState.setFilter("status", event.target.value)}>
          <option value="all">{t("filter.allStatuses")}</option>
          <option value="enabled">{t("cron.filter.enabled")}</option>
          <option value="disabled">{t("cron.filter.disabled")}</option>
          <option value="overdue">{t("cron.filter.overdue")}</option>
          <option value="failing">{t("cron.filter.failing")}</option>
        </select>
      </TableToolbar>

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={isEmpty}
        emptyTitle={t("cron.emptyTitle")}
        emptyMessage={t("cron.emptyMessage")}
      >
        <div className="panel">
          <div className="panel-header">
            <h3>{t("cron.panelTitle")}</h3>
            <p>{t("table.filteredRows", { count: filteredRows.length })}</p>
          </div>

          <CronTable
            rows={paginated.pageItems}
            density={tableState.density}
            sortBy={tableState.sortBy}
            sortDirection={tableState.sortDirection}
            onSort={tableState.setSort}
          />
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
      </DataState>
    </section>
  );
}
