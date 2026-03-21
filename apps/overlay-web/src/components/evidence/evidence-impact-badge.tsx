import { useI18n } from "../../lib/i18n.js";

export function EvidenceImpactBadge({
  impact,
  role,
}: {
  impact: "high" | "medium" | "low";
  role: "operations" | "governance" | "adoption";
}) {
  const { t } = useI18n();

  return (
    <div className="evidence-impact-stack">
      <span className={`signal-badge signal-${impact === "high" ? "high" : impact === "medium" ? "medium" : "low"}`}>
        {t(`evidenceBridge.impact.${impact}`)}
      </span>
      <span className="evidence-role-tag">{t(`evidenceBridge.role.${role}`)}</span>
    </div>
  );
}
