import type { CollectionStatus } from "@openclaw-team-ops/shared";

import { useI18n } from "../lib/i18n.js";

const coverageClassByValue: Record<CollectionStatus, string> = {
  complete: "coverage-badge coverage-badge-complete",
  partial: "coverage-badge coverage-badge-partial",
  unavailable: "coverage-badge coverage-badge-unavailable",
};

export function CoverageBadge({ coverage }: { coverage: CollectionStatus }) {
  const { translateCoverageState } = useI18n();

  return <span className={coverageClassByValue[coverage]}>{translateCoverageState(coverage)}</span>;
}
