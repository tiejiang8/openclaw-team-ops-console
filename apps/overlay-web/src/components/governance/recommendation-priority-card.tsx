import type { RecommendationPriorityItem } from "@openclaw-team-ops/shared";

import { DrilldownLink } from "../evidence/drilldown-link.js";

export function RecommendationPriorityCard({ priorities }: { priorities: RecommendationPriorityItem[] }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Recommendation priority</h3>
          <p>Which read-only checks should be reviewed first.</p>
        </div>
      </div>

      <div className="dashboard-list">
        {priorities.map((priority) => (
          <div key={priority.priority} className="dashboard-list-item dashboard-list-item-wide">
            <div>
              <div className="cell-title">{priority.priority}</div>
              <div className="cell-subtitle">{priority.summary}</div>
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
