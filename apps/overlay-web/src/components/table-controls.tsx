import type { ReactNode } from "react";

import { useI18n } from "../lib/i18n.js";
import type { SortDirection, TableDensity } from "../lib/table-state.js";

export function SortableHeader({
  column,
  label,
  sortBy,
  sortDirection,
  onSort,
  align = "left",
}: {
  column: string;
  label: string;
  sortBy: string;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  align?: "left" | "right";
}) {
  const isActive = sortBy === column;
  const icon = !isActive ? "↕" : sortDirection === "asc" ? "↑" : "↓";

  return (
    <th className={align === "right" ? "cell-align-right" : undefined}>
      <button type="button" className={`sort-button${isActive ? " sort-button-active" : ""}`} onClick={() => onSort(column)}>
        <span>{label}</span>
        <span className="sort-icon" aria-hidden="true">
          {icon}
        </span>
      </button>
    </th>
  );
}

export function TableToolbar({ children, density, setDensity }: { children: ReactNode; density: TableDensity; setDensity: (density: TableDensity) => void }) {
  const { t } = useI18n();

  return (
    <div className="filter-row filter-row-spread">
      <div className="filter-row">{children}</div>
      <div className="density-toggle" role="group" aria-label={t("table.density")}>
        <button
          type="button"
          className={`density-button${density === "comfortable" ? " density-button-active" : ""}`}
          onClick={() => setDensity("comfortable")}
        >
          {t("table.comfortable")}
        </button>
        <button
          type="button"
          className={`density-button${density === "compact" ? " density-button-active" : ""}`}
          onClick={() => setDensity("compact")}
        >
          {t("table.compact")}
        </button>
      </div>
    </div>
  );
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  startItemIndex,
  endItemIndex,
  pageSize,
  allowedPageSizes,
  setPage,
  setPageSize,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  startItemIndex: number;
  endItemIndex: number;
  pageSize: number;
  allowedPageSizes: number[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="pagination-row">
      <div className="pagination-meta">
        <span>{t("table.showing", { start: startItemIndex, end: endItemIndex, total: totalItems })}</span>
      </div>

      <div className="pagination-controls">
        <label className="page-size-control">
          <span>{t("table.rows")}</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="filter-select filter-select-inline">
            {allowedPageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="pagination-button" onClick={() => setPage(page - 1)} disabled={page <= 1}>
          {t("table.prev")}
        </button>

        <span className="pagination-page">{t("table.page", { page, totalPages })}</span>

        <button type="button" className="pagination-button" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
          {t("table.next")}
        </button>
      </div>
    </div>
  );
}
