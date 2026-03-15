import type { LogEntry } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";

function formatRefKey(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());
}

export function LogEntryDetailDrawer({
  entry,
  filePath,
}: {
  entry: LogEntry | null;
  filePath?: string;
}) {
  const { t } = useI18n();
  const refs = entry?.refs ? Object.entries(entry.refs).filter(([, value]) => typeof value === "string" && value.length > 0) : [];

  return (
    <aside className="panel log-detail-panel">
      <div className="panel-header">
        <h3>{t("logs.detailTitle")}</h3>
        <p>{entry ? entry.id : t("logs.detailEmpty")}</p>
      </div>

      {entry ? (
        <div className="log-detail-body">
          <dl className="detail-list">
            <div className="detail-list-row">
              <dt>{t("logs.table.level")}</dt>
              <dd>{entry.level}</dd>
            </div>
            <div className="detail-list-row">
              <dt>{t("logs.table.subsystem")}</dt>
              <dd>{entry.subsystem ?? "-"}</dd>
            </div>
            <div className="detail-list-row">
              <dt>{t("common.path")}</dt>
              <dd className="cell-mono">{filePath ?? "-"}</dd>
            </div>
            <div className="detail-list-row">
              <dt>{t("logs.detailRefs")}</dt>
              <dd>
                {refs.length > 0 ? (
                  <div className="detail-chips">
                    {refs.map(([key, value]) => (
                      <span key={key} className="detail-chip">
                        {formatRefKey(key)}: {value}
                      </span>
                    ))}
                  </div>
                ) : (
                  t("common.notAvailable")
                )}
              </dd>
            </div>
          </dl>

          <div className="log-raw-panel">
            <p className="log-raw-label">{t("logs.detailRaw")}</p>
            <pre className="log-raw-content">{entry.raw}</pre>
          </div>
        </div>
      ) : (
        <div className="log-detail-empty">
          <p className="state-title">{t("logs.detailTitle")}</p>
          <p className="state-message">{t("logs.detailEmpty")}</p>
        </div>
      )}
    </aside>
  );
}
