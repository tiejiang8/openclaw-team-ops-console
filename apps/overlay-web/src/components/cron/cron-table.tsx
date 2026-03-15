import { Link } from "react-router-dom";

import type { CronJobSummaryDto } from "@openclaw-team-ops/shared";

import { SortableHeader } from "../table-controls.js";
import { StatusBadge } from "../status-badge.js";
import { formatTimestamp } from "../../lib/format.js";
import { useI18n } from "../../lib/i18n.js";

export function CronTable({
  rows,
  density,
  sortBy,
  sortDirection,
  onSort,
}: {
  rows: CronJobSummaryDto[];
  density: "comfortable" | "compact";
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
}) {
  const { language, t } = useI18n();

  return (
    <div className="table-wrap">
      <table className={`data-table ${density === "compact" ? "density-compact" : "density-comfortable"}`}>
        <thead>
          <tr>
            <SortableHeader column="name" label={t("cron.table.name")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="scheduleText" label={t("cron.table.schedule")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="nextRunAt" label={t("cron.table.nextRun")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="lastRunAt" label={t("cron.table.lastRun")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="sessionTarget" label={t("cron.table.sessionTarget")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="deliveryMode" label={t("cron.table.delivery")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="lastRunState" label={t("cron.table.status")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="source" label={t("cron.table.source")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((job) => (
            <tr key={job.id}>
              <td>
                <Link to={`/cron/${job.id}`} className="detail-link">
                  {job.name}
                </Link>
              </td>
              <td className="cell-mono">{job.scheduleText}</td>
              <td>{formatTimestamp(job.nextRunAt, language)}</td>
              <td>{formatTimestamp(job.lastRunAt, language)}</td>
              <td>{job.sessionTarget ?? "-"}</td>
              <td>{job.deliveryMode ?? "-"}</td>
              <td>
                <StatusBadge status={job.overdue ? "degraded" : job.lastRunState ?? "unknown"} />
              </td>
              <td>{job.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
