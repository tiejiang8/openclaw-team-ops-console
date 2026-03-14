import type { ReactNode } from "react";

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
  return (
    <div className="filter-row filter-row-spread">
      <div className="filter-row">{children}</div>
      <div className="density-toggle" role="group" aria-label="Table density">
        <button
          type="button"
          className={`density-button${density === "comfortable" ? " density-button-active" : ""}`}
          onClick={() => setDensity("comfortable")}
        >
          Comfortable
        </button>
        <button
          type="button"
          className={`density-button${density === "compact" ? " density-button-active" : ""}`}
          onClick={() => setDensity("compact")}
        >
          Compact
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
  return (
    <div className="pagination-row">
      <div className="pagination-meta">
        <span>
          Showing {startItemIndex}-{endItemIndex} of {totalItems}
        </span>
      </div>

      <div className="pagination-controls">
        <label className="page-size-control">
          <span>Rows</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="filter-select filter-select-inline">
            {allowedPageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="pagination-button" onClick={() => setPage(page - 1)} disabled={page <= 1}>
          Prev
        </button>

        <span className="pagination-page">
          Page {page} / {totalPages}
        </span>

        <button type="button" className="pagination-button" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}
