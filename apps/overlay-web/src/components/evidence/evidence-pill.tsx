import type { EvidenceReference } from "@openclaw-team-ops/shared";
import { Link } from "react-router-dom";

export function EvidencePill({ evidence }: { evidence: EvidenceReference }) {
  return (
    <Link className={`evidence-pill evidence-pill-${evidence.severity}`} to={evidence.to}>
      <span>{evidence.kind}</span>
      <span className="evidence-pill-label">{evidence.label}</span>
    </Link>
  );
}
