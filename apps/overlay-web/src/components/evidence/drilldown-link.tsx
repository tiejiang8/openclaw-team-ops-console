import type { DashboardDrilldownLink as DashboardDrilldownLinkData } from "@openclaw-team-ops/shared";
import { Link } from "react-router-dom";

import { useI18n } from "../../lib/i18n.js";

function translateLinkLabel(label: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (label) {
    case "View details":
      return t("common.viewDetails");
    case "View evidence":
      return t("common.viewEvidence");
    case "View related findings":
      return t("common.viewRelatedFindings");
    case "View related finding":
      return t("common.viewRelatedFinding");
    case "View recommendations":
      return t("common.viewRecommendations");
    default:
      return label;
  }
}

export function DrilldownLink({
  link,
  tone = "neutral",
}: {
  link: DashboardDrilldownLinkData;
  tone?: "neutral" | "accent" | "subtle";
}) {
  const { t } = useI18n();

  return (
    <Link className={`dashboard-drilldown dashboard-drilldown-${tone}`} to={link.to}>
      <span>{translateLinkLabel(link.label, t)}</span>
      {link.badge ? <span className="dashboard-drilldown-badge">{link.badge}</span> : null}
    </Link>
  );
}
