import type { DashboardDrilldownLink as DashboardDrilldownLinkData } from "@openclaw-team-ops/shared";
import { Link } from "react-router-dom";

export function DrilldownLink({
  link,
  tone = "neutral",
}: {
  link: DashboardDrilldownLinkData;
  tone?: "neutral" | "accent" | "subtle";
}) {
  return (
    <Link className={`dashboard-drilldown dashboard-drilldown-${tone}`} to={link.to}>
      <span>{link.label}</span>
      {link.badge ? <span className="dashboard-drilldown-badge">{link.badge}</span> : null}
    </Link>
  );
}
