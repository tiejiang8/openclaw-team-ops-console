import type { RecommendationPriorityItem } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { DrilldownLink } from "../evidence/drilldown-link.js";

export function RecommendationPriorityCard({ priorities }: { priorities: RecommendationPriorityItem[] }) {
  const { t, translateSignal } = useI18n();

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>{t("governance.recommendationPriorityTitle")}</h3>
          <p>{t("governance.recommendationPriorityDescription")}</p>
        </div>
      </div>

      <div className="dashboard-list">
        {priorities.map((priority) => (
          <div key={priority.priority} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{translateSignal(priority.priority)}</div>
              <div className="cell-subtitle">
                {priority.count > 0
                  ? t("governance.recommendationPending", {
                      count: priority.count,
                      priority: translateSignal(priority.priority),
                    })
                  : t("governance.recommendationClear", { priority: translateSignal(priority.priority) })}
              </div>
            </div>
            <div className="dashboard-list-actions">
              <span className="signal-badge signal-high">{priority.count}</span>
              <DrilldownLink link={priority.detailLink} tone="subtle" />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
