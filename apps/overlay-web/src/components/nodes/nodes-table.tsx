import type { NodeSummaryDto } from "@openclaw-team-ops/shared";

import { SortableHeader } from "../table-controls.js";
import { StatusBadge } from "../status-badge.js";
import { formatTimestamp } from "../../lib/format.js";
import { useI18n } from "../../lib/i18n.js";

export function NodesTable({
  rows,
  density,
  sortBy,
  sortDirection,
  onSort,
}: {
  rows: NodeSummaryDto[];
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
            <SortableHeader column="name" label={t("nodes.table.name")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="platform" label={t("nodes.table.platform")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="paired" label={t("nodes.table.paired")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="connected" label={t("nodes.table.connected")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="lastConnectAt" label={t("nodes.table.lastConnect")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="capabilities" label={t("nodes.table.capabilities")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader column="source" label={t("nodes.table.source")} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((node) => (
            <tr key={node.id}>
              <td>
                <div className="cell-title">{node.name ?? node.id}</div>
                <div className="cell-subtitle cell-mono">{node.id}</div>
              </td>
              <td>{node.platform ?? "-"}</td>
              <td>
                <StatusBadge status={node.paired ? "healthy" : "offline"} />
              </td>
              <td>
                <StatusBadge status={node.connected ? "active" : "offline"} />
              </td>
              <td>{formatTimestamp(node.lastConnectAt, language)}</td>
              <td>{node.capabilities?.join(", ") ?? "-"}</td>
              <td>{node.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
