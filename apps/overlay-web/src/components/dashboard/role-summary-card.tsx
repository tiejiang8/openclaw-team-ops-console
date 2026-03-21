import type { RoleEntrySummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";
import { TrendChip } from "./trend-chip.js";

function translateRoleValue(
  prefix: "dashboard.roleAudience" | "dashboard.roleLabel" | "dashboard.roleTrend" | "dashboard.roleSummary",
  id: RoleEntrySummary["id"],
  t: ReturnType<typeof useI18n>["t"],
  fallback?: string,
) {
  switch (id) {
    case "operations":
    case "adoption":
    case "outcomes":
    case "governance":
      return t(`${prefix}.${id}`);
    default:
      return fallback;
  }
}

export function RoleSummaryCard({ entry }: { entry: RoleEntrySummary }) {
  const { t } = useI18n();

  return (
    <article className={`role-summary-card dashboard-signal-${entry.signal}`}>
      <div className="dashboard-card-header">
        <div>
          <p className="metric-label">{translateRoleValue("dashboard.roleAudience", entry.id, t, entry.audience)}</p>
          <h4 className="dashboard-card-title">{translateRoleValue("dashboard.roleLabel", entry.id, t, entry.label)}</h4>
        </div>
        <TrendChip label={translateRoleValue("dashboard.roleTrend", entry.id, t, entry.trendLabel)} signal={entry.signal} />
      </div>

      <p className="dashboard-role-value">{entry.value}</p>
      <p className="dashboard-summary">{translateRoleValue("dashboard.roleSummary", entry.id, t, entry.summary)}</p>

      <div className="dashboard-card-actions">
        <DrilldownLink link={entry.detailLink} tone="accent" />
        {entry.evidenceLink ? <DrilldownLink link={entry.evidenceLink} tone="subtle" /> : null}
      </div>
    </article>
  );
}
