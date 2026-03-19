import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { DataState } from "../components/data-state.js";
import { PageObservability } from "../components/page-observability.js";
import { SignalBadge } from "../components/signal-badge.js";
import { PaginationControls, SortableHeader, TableToolbar } from "../components/table-controls.js";
import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { includesSearch, paginateRows, sortRows } from "../lib/table-helpers.js";
import { useTableQueryState } from "../lib/table-state.js";
import { useResource } from "../lib/use-resource.js";
import type { Recommendation, Finding } from "@openclaw-team-ops/shared";

interface RecommendationRow extends Recommendation {
  targetName?: string;
  targetId?: string;
}

export function RecommendationsPage() {
  const { t, translateRecommendationType } = useI18n();
  const tableState = useTableQueryState({
    defaultSortBy: "priority",
    defaultSortDirection: "desc",
    filterDefaults: {
      priority: "all",
      type: "all",
    },
    defaultPageSize: 10,
  });

  const loadData = useCallback(async () => {
    const [recsResponse, findingsResponse] = await Promise.all([
      overlayApi.getRecommendations(),
      overlayApi.getFindings(),
    ]);

    // Map target info from findings to recommendations
    const findingsMap = new Map<string, Finding>(findingsResponse.data.map((f: Finding) => [f.id, f]));
    
    const rows: RecommendationRow[] = recsResponse.data.map((rec: Recommendation) => {
      const finding = findingsMap.get(rec.findingId);
      return {
        ...rec,
        targetName: finding?.targetName ?? "",
        targetId: finding?.targetId ?? "",
      };
    });

    return {
      rows,
      meta: recsResponse.meta,
    };
  }, []);

  const { data, loading, error, retry } = useResource("recommendations", loadData);

  const filteredRows = useMemo(() => {
    return (data?.rows ?? []).filter((row) => {
      const matchesSearch = includesSearch(
        [row.title, row.body, row.targetName ?? "", row.type],
        tableState.search,
      );
      const matchesPriority = tableState.filters.priority === "all" || row.priority === tableState.filters.priority;
      const matchesType = tableState.filters.type === "all" || row.type === tableState.filters.type;

      return matchesSearch && matchesPriority && matchesType;
    });
  }, [data, tableState.search, tableState.filters.priority, tableState.filters.type]);

  const priorityOrder = (p: string) => {
    switch (p) {
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
      default: return 0;
    }
  };

  const sortedRows = useMemo(() => {
    return sortRows(filteredRows, tableState.sortBy, tableState.sortDirection, {
      priority: (row) => priorityOrder(row.priority),
      type: (row) => row.type,
      title: (row) => row.title,
      target: (row) => row.targetName ?? "",
    });
  }, [filteredRows, tableState.sortBy, tableState.sortDirection]);

  const paginated = useMemo(() => paginateRows(sortedRows, tableState.page, tableState.pageSize), [
    sortedRows,
    tableState.page,
    tableState.pageSize,
  ]);

  const priorityOptions = ["high", "medium", "low"];
  const typeOptions = useMemo(() => Array.from(new Set((data?.rows ?? []).map((row) => row.type))).sort(), [data]);

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("recommendations.title")}</h2>
        <p>{t("recommendations.description")}</p>
      </header>

      <PageObservability meta={data?.meta as any} />

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={!loading && !error && filteredRows.length === 0}
        emptyTitle={t("recommendations.emptyTitle")}
        emptyMessage={t("recommendations.emptyMessage")}
      >
        {data ? (
          <>
            <TableToolbar density={tableState.density} setDensity={tableState.setDensity}>
              <input
                className="filter-input"
                placeholder="Search recommendations..."
                value={tableState.search}
                onChange={(e) => tableState.setSearch(e.target.value)}
              />

              <select
                className="filter-select"
                value={tableState.filters.priority}
                onChange={(e) => tableState.setFilter("priority", e.target.value)}
              >
                <option value="all">All Priorities</option>
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>

              <select
                className="filter-select"
                value={tableState.filters.type}
                onChange={(e) => tableState.setFilter("type", e.target.value)}
              >
                <option value="all">All Types</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>{translateRecommendationType(type)}</option>
                ))}
              </select>
            </TableToolbar>

            <div className="panel">
              <div className="table-wrap">
                <table className={`data-table ${tableState.density === "compact" ? "density-compact" : "density-comfortable"}`}>
                  <thead>
                    <tr>
                      <SortableHeader column="title" label={t("recommendations.table.title")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="priority" label={t("recommendations.table.priority")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="type" label={t("recommendations.table.type")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                      <SortableHeader column="target" label={t("recommendations.table.target")} sortBy={tableState.sortBy} sortDirection={tableState.sortDirection} onSort={tableState.setSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.pageItems.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link to={`/recommendations/${row.id}`} className="inline-link">
                            <div className="cell-title">{row.title}</div>
                          </Link>
                          <div className="cell-subtitle line-clamp" style={{ maxHeight: "2.4em", overflow: "hidden" }}>{row.body}</div>
                        </td>
                        <td>
                          <SignalBadge value={row.priority} />
                        </td>
                        <td>{translateRecommendationType(row.type)}</td>
                        <td>
                          {row.targetName && (
                            <>
                              <div className="cell-title">{row.targetName}</div>
                              <div className="cell-subtitle">{row.targetId}</div>
                            </>
                          )}
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
          </>
        ) : null}
      </DataState>
    </section>
  );
}
