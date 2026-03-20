import type { RetentionProxySummary } from "@openclaw-team-ops/shared";

export function RetentionProxyCard({ retention }: { retention: RetentionProxySummary }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Retention proxy</h3>
          <p>{retention.summary}</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Repeat usage ratio</p>
          <p className="metric-value">{retention.repeatUsageRatio}%</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Multi-day active proxy</p>
          <p className="metric-value">{retention.multiDayActiveUsers}</p>
        </div>
      </div>

      <div className="chip-row">
        {retention.lowActivityTeams.map((team) => (
          <span key={team} className="meta-chip">
            {team}
          </span>
        ))}
      </div>
    </article>
  );
}
