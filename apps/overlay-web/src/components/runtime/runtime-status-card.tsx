import type { RuntimeStatusDto } from "@openclaw-team-ops/shared";

import { formatTimestamp } from "../../lib/format.js";
import { useI18n } from "../../lib/i18n.js";
import { StatusBadge } from "../status-badge.js";

function translateRuntimeMode(mode: RuntimeStatusDto["sourceMode"], t: (key: string, params?: Record<string, string | number>) => string) {
  const key = `runtime.mode.${mode}`;
  const translated = t(key);
  return translated === key ? mode : translated;
}

export function RuntimeStatusCard({ runtime }: { runtime: RuntimeStatusDto }) {
  const { language, t, translateStatus } = useI18n();

  return (
    <article className="panel runtime-status-card">
      <div className="panel-header">
        <div>
          <h3>{t("runtime.cardTitle")}</h3>
          <p>{t("runtime.cardSubtitle")}</p>
        </div>
        <StatusBadge status={runtime.openclaw.overall} />
      </div>

      <div className="runtime-card-grid">
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.sourceMode")}</span>
          <strong>{translateRuntimeMode(runtime.sourceMode, t)}</strong>
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.transportProbe")}</span>
          <StatusBadge status={runtime.gateway.transportProbe === "connected" ? "healthy" : (runtime.gateway.transportProbe === "degraded" ? "degraded" : "offline")} />
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.dataReaderHealth")}</span>
          <StatusBadge status={runtime.gateway.dataReaderHealth} />
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.gatewayConfigured")}</span>
          <strong>{runtime.gateway.configured ? t("common.yes") : t("common.no")}</strong>
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.authResolved")}</span>
          <strong>{runtime.gateway.authResolved ? t("common.yes") : t("common.no")}</strong>
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.nodes")}</span>
          <strong>{t("runtime.nodesSummary", { connected: runtime.nodes.connected, paired: runtime.nodes.paired })}</strong>
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.cron")}</span>
          <strong>{t("runtime.cronSummary", { total: runtime.cron.total, overdue: runtime.cron.overdue })}</strong>
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.lastSuccess")}</span>
          <strong>{runtime.gateway.lastSuccessAt ? formatTimestamp(runtime.gateway.lastSuccessAt, language) : "-"}</strong>
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.lastFailure")}</span>
          <strong>{runtime.gateway.lastFailureAt ? formatTimestamp(runtime.gateway.lastFailureAt, language) : "-"}</strong>
        </div>
        <div className="runtime-card-item">
          <span className="runtime-card-label">{t("runtime.lastSeen")}</span>
          <strong>{formatTimestamp(runtime.gateway.lastSeenAt ?? runtime.snapshotAt, language)}</strong>
        </div>
        {runtime.gateway.url ? (
          <div className="runtime-card-item runtime-card-item-wide">
            <span className="runtime-card-label">{t("runtime.gatewayUrl")}</span>
            <strong className="cell-mono">{runtime.gateway.url}</strong>
          </div>
        ) : null}
      </div>
    </article>
  );
}
