import type { SortDirection } from "./table-state.js";

export type SortValue = string | number;
export type SortAccessor<T> = (item: T) => SortValue;

function compareValues(left: SortValue, right: SortValue): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortRows<T>(rows: T[], sortBy: string, sortDirection: SortDirection, accessors: Record<string, SortAccessor<T>>): T[] {
  const accessor = accessors[sortBy];
  if (!accessor) {
    return rows;
  }

  const sorted = [...rows].sort((left, right) => {
    const leftValue = accessor(left);
    const rightValue = accessor(right);

    const compared = compareValues(leftValue, rightValue);
    return sortDirection === "asc" ? compared : -compared;
  });

  return sorted;
}

export interface PaginatedResult<T> {
  pageItems: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  startItemIndex: number;
  endItemIndex: number;
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): PaginatedResult<T> {
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    pageItems: rows.slice(start, end),
    page: safePage,
    totalPages,
    totalItems,
    startItemIndex: totalItems === 0 ? 0 : start + 1,
    endItemIndex: Math.min(end, totalItems),
  };
}

export function includesSearch(haystack: string[], search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase();

  if (normalizedSearch.length === 0) {
    return true;
  }

  return haystack.some((candidate) => candidate.toLowerCase().includes(normalizedSearch));
}
