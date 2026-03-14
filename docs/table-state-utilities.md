# Table State Utilities (Phase 1.1)

Phase 1.1 introduced reusable client-side table-state utilities in `apps/overlay-web` to keep list pages consistent and read-only.

## Utilities

- `src/lib/table-state.ts`
  - `useTableQueryState(...)`
  - URL-backed state for:
    - search (`q`)
    - sorting (`sort`, `dir`)
    - pagination (`page`, `pageSize`)
    - density (`density`)
    - filters (`f_<key>`)

- `src/lib/table-helpers.ts`
  - `sortRows(...)`
  - `paginateRows(...)`
  - `includesSearch(...)`

- `src/components/table-controls.tsx`
  - `SortableHeader`
  - `TableToolbar`
  - `PaginationControls`

- `src/components/data-state.tsx`
  - shared loading/empty/error presentation
  - read-only retry action for failed read requests

## Behavior Notes

- All table interactions are client-side and read-only.
- URL state is page-local and survives refresh/navigation.
- Query defaults are omitted from URL when possible to keep links concise.

## Why this exists

- avoid page-by-page state duplication
- ensure consistent UX across inventory pages
- keep read-only architecture unchanged while improving operability
