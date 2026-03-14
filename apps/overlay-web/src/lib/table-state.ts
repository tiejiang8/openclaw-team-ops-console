import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type SortDirection = "asc" | "desc";
export type TableDensity = "comfortable" | "compact";

interface UseTableQueryStateOptions {
  defaultSortBy: string;
  defaultSortDirection?: SortDirection;
  defaultPageSize?: number;
  defaultDensity?: TableDensity;
  defaultSearch?: string;
  filterDefaults?: Record<string, string>;
  allowedPageSizes?: number[];
}

interface SetParamOptions {
  resetPage?: boolean;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function useTableQueryState(options: UseTableQueryStateOptions) {
  const {
    defaultSortBy,
    defaultSortDirection = "asc",
    defaultPageSize = 10,
    defaultDensity = "comfortable",
    defaultSearch = "",
    filterDefaults = {},
    allowedPageSizes = [10, 20, 50],
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(() => {
    const search = searchParams.get("q") ?? defaultSearch;
    const sortBy = searchParams.get("sort") ?? defaultSortBy;
    const sortDirection = searchParams.get("dir") === "desc" ? "desc" : defaultSortDirection;
    const page = parsePositiveInt(searchParams.get("page"), 1);

    const pageSizeValue = parsePositiveInt(searchParams.get("pageSize"), defaultPageSize);
    const pageSize = allowedPageSizes.includes(pageSizeValue) ? pageSizeValue : defaultPageSize;

    const density = searchParams.get("density") === "compact" ? "compact" : defaultDensity;

    const filters: Record<string, string> = {};
    for (const [key, defaultValue] of Object.entries(filterDefaults)) {
      filters[key] = searchParams.get(`f_${key}`) ?? defaultValue;
    }

    return {
      search,
      sortBy,
      sortDirection,
      page,
      pageSize,
      density,
      filters,
    };
  }, [
    allowedPageSizes,
    defaultDensity,
    defaultPageSize,
    defaultSearch,
    defaultSortBy,
    defaultSortDirection,
    filterDefaults,
    searchParams,
  ]);

  const updateParams = useCallback(
    (mutate: (nextParams: URLSearchParams) => void, options?: SetParamOptions) => {
      const resetPage = options?.resetPage ?? false;

      setSearchParams(
        (previousParams) => {
          const nextParams = new URLSearchParams(previousParams);
          mutate(nextParams);

          if (resetPage) {
            nextParams.delete("page");
          }

          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSearch = useCallback(
    (value: string) => {
      updateParams(
        (nextParams) => {
          const normalized = value.trim();
          if (normalized.length === 0) {
            nextParams.delete("q");
          } else {
            nextParams.set("q", normalized);
          }
        },
        { resetPage: true },
      );
    },
    [updateParams],
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      const defaultValue = filterDefaults[key] ?? "all";

      updateParams(
        (nextParams) => {
          if (value === defaultValue) {
            nextParams.delete(`f_${key}`);
          } else {
            nextParams.set(`f_${key}`, value);
          }
        },
        { resetPage: true },
      );
    },
    [filterDefaults, updateParams],
  );

  const setSort = useCallback(
    (column: string) => {
      updateParams(
        (nextParams) => {
          const currentSort = nextParams.get("sort") ?? defaultSortBy;
          const currentDirection = nextParams.get("dir") === "desc" ? "desc" : defaultSortDirection;

          if (currentSort === column) {
            const nextDirection = currentDirection === "asc" ? "desc" : "asc";
            if (nextDirection === defaultSortDirection && column === defaultSortBy) {
              nextParams.delete("sort");
              nextParams.delete("dir");
            } else {
              nextParams.set("sort", column);
              nextParams.set("dir", nextDirection);
            }
            return;
          }

          if (column === defaultSortBy && defaultSortDirection === "asc") {
            nextParams.delete("sort");
            nextParams.delete("dir");
            return;
          }

          nextParams.set("sort", column);
          nextParams.set("dir", "asc");
        },
        { resetPage: true },
      );
    },
    [defaultSortBy, defaultSortDirection, updateParams],
  );

  const setPage = useCallback(
    (page: number) => {
      updateParams((nextParams) => {
        if (page <= 1) {
          nextParams.delete("page");
        } else {
          nextParams.set("page", String(page));
        }
      });
    },
    [updateParams],
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      updateParams(
        (nextParams) => {
          if (pageSize === defaultPageSize) {
            nextParams.delete("pageSize");
          } else {
            nextParams.set("pageSize", String(pageSize));
          }
        },
        { resetPage: true },
      );
    },
    [defaultPageSize, updateParams],
  );

  const setDensity = useCallback(
    (density: TableDensity) => {
      updateParams((nextParams) => {
        if (density === defaultDensity) {
          nextParams.delete("density");
        } else {
          nextParams.set("density", density);
        }
      });
    },
    [defaultDensity, updateParams],
  );

  return {
    ...state,
    allowedPageSizes,
    setSearch,
    setFilter,
    setSort,
    setPage,
    setPageSize,
    setDensity,
  };
}
