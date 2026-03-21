import type { ReactNode } from "react";

export function SectionCollapse({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="panel section-collapse" open={defaultOpen}>
      <summary className="section-collapse-summary">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </summary>
      <div className="section-collapse-body">{children}</div>
    </details>
  );
}
