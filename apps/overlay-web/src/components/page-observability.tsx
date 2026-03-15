import type { ResponseMeta } from "@openclaw-team-ops/shared";

import { useI18n } from "../lib/i18n.js";
import { CoverageBadge } from "./coverage-badge.js";

export function PageObservability({ meta }: { meta: ResponseMeta | null | undefined }) {
  const { t, translateFreshness } = useI18n();

  if (!meta) {
    return null;
  }

  return (
    <div className="page-observability" aria-label={t("meta.title")}>
      <span className="meta-chip meta-chip-readonly">{t("common.readOnly")}</span>
      <span className="meta-chip">
        {t("common.freshness")}: {translateFreshness(meta.freshness)}
      </span>
      <span className="meta-chip">
        {t("common.coverage")}: <CoverageBadge coverage={meta.coverage} />
      </span>
      <span className={`meta-chip${meta.warningCount > 0 ? " meta-chip-warning" : ""}`}>
        {t("common.warnings")}: {meta.warningCount}
      </span>
    </div>
  );
}
