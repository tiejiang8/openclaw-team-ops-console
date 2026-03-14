import type { ReactNode } from "react";

export function MetricCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <article className="metric-card fade-in-up">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {detail ? <p className="metric-detail">{detail}</p> : null}
    </article>
  );
}
