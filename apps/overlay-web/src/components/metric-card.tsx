import type { ReactNode } from "react";

export function MetricCard({ label, value, detail }: { label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return (
    <article className="metric-card fade-in-up">
      <div className="metric-label-row">
        <p className="metric-label">{label}</p>
      </div>
      <p className="metric-value">{value}</p>
      {detail ? <p className="metric-detail">{detail}</p> : null}
    </article>
  );
}
