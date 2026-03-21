import type { SourceTraceSummary } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";
import { formatTimestamp } from "../../lib/format.js";

export function SourceTracePanel({ trace }: { trace: SourceTraceSummary }) {
  const { language, t, translateTargetSourceKind } = useI18n();

  return (
    <article className="panel source-trace-panel">
      <div className="panel-header">
        <div>
          <h3>{t("dashboard.sourceTraceTitle")}</h3>
          <p>{t("dashboard.sourceTraceDescription")}</p>
        </div>
      </div>

      <div className="source-trace-grid">
        <div className="source-trace-item">
          <span className="metric-label">{t("runtime.sourceMode")}</span>
          <strong>{trace.sourceMode}</strong>
        </div>
        <div className="source-trace-item">
          <span className="metric-label">{t("common.generatedAt")}</span>
          <strong>{formatTimestamp(trace.generatedAt, language)}</strong>
        </div>
        <div className="source-trace-item">
          <span className="metric-label">{t("common.readOnly")}</span>
          <strong>{trace.readOnly ? t("common.yes") : t("common.no")}</strong>
        </div>
        <div className="source-trace-item source-trace-item-wide">
          <span className="metric-label">{t("source.title")}</span>
          <div className="source-trace-pills">
            {trace.sourceKinds.map((kind) => (
              <span key={kind} className="meta-chip">
                {translateTargetSourceKind(kind)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="source-trace-notes">
        {trace.notes.map((note) => (
          <div key={note} className="source-trace-note">
            {note}
          </div>
        ))}
      </div>
    </article>
  );
}
