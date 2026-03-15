import type { LogEntry } from "@openclaw-team-ops/shared";

import { PaginationControls, SortableHeader } from "../../components/table-controls.js";
import { formatTimestamp } from "../../lib/format.js";
import { useI18n, type LanguageCode } from "../../lib/i18n.js";
import type { SortDirection, TableDensity } from "../../lib/table-state.js";

function levelClassName(level: string): string {
  switch (level) {
    case "fatal":
    case "error":
      return "log-level-badge log-level-badge-error";
    case "warn":
      return "log-level-badge log-level-badge-warn";
    case "info":
      return "log-level-badge log-level-badge-info";
    case "debug":
    case "trace":
      return "log-level-badge log-level-badge-debug";
    default:
      return "log-level-badge log-level-badge-unknown";
  }
}

export function LogEntryTable({
  rows,
  density,
  language,
  sortBy,
  sortDirection,
  onSort,
  selectedEntryId,
  onSelect,
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
  rows: LogEntry[];
  density: TableDensity;
  language: LanguageCode;
  sortBy: string;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  selectedEntryId?: string;
  onSelect: (entry: LogEntry) => void;
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
    <>
      <div className="table-wrap">
        <table className={`data-table ${density === "compact" ? "density-compact" : "density-comfortable"}`}>
          <thead>
            <tr>
              <SortableHeader column="lineNumber" label={t("logs.table.line")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} align="right" />
              <SortableHeader column="ts" label={t("logs.table.timestamp")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader column="level" label={t("logs.table.level")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader column="subsystem" label={t("logs.table.subsystem")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader column="message" label={t("logs.table.message")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader column="tags" label={t("logs.table.tags")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} className={selectedEntryId === entry.id ? "log-entry-row-selected" : undefined}>
                <td className="cell-align-right cell-mono">{entry.lineNumber}</td>
                <td>{formatTimestamp(entry.ts, language)}</td>
                <td>
                  <span className={levelClassName(entry.level)}>{entry.level.toUpperCase()}</span>
                </td>
                <td className="cell-mono">{entry.subsystem ?? "-"}</td>
                <td>
                  <button type="button" className="log-entry-button" onClick={() => onSelect(entry)}>
                    <span className="log-entry-message">{entry.message}</span>
                  </button>
                </td>
                <td>
                  <div className="log-tag-list">
                    {entry.tags.length > 0 ? (
                      entry.tags.map((tag) => (
                        <span key={tag} className="log-tag">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="cell-subtitle">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        startItemIndex={startItemIndex}
        endItemIndex={endItemIndex}
        pageSize={pageSize}
        allowedPageSizes={allowedPageSizes}
        setPage={setPage}
        setPageSize={setPageSize}
      />
    </>
  );
}
