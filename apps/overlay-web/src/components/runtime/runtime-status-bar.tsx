import type { RuntimeStatusDto } from "@openclaw-team-ops/shared";

import { getRuntimeStatus } from "../../lib/api/runtime.js";
import { formatTimestamp } from "../../lib/format.js";
import { useI18n } from "../../lib/i18n.js";
import { useResource } from "../../lib/use-resource.js";

function translateRuntimeMode(mode: RuntimeStatusDto["sourceMode"], t: (key: string, params?: Record<string, string | number>) => string) {
  const key = `runtime.mode.${mode}`;
  const translated = t(key);
  return translated === key ? mode : translated;
}

function resolveTargetLabel(runtime: RuntimeStatusDto, t: (key: string, params?: Record<string, string | number>) => string) {
  return runtime.gateway.identity?.name ?? runtime.gateway.url ?? (runtime.openclaw.stateDirDetected ? t("runtime.targetLocal") : t("runtime.targetSnapshot"));
}

function buildChips(
  runtime: RuntimeStatusDto,
  language: "en" | "zh",
  t: (key: string, params?: Record<string, string | number>) => string,
  translateStatus: (value: string) => string,
) {
  return [
    `${t("runtime.target")}: ${resolveTargetLabel(runtime, t)}`,
    `${t("runtime.sourceMode")}: ${translateRuntimeMode(runtime.sourceMode, t)}`,
    `${t("runtime.gateway")}: ${translateStatus(runtime.gateway.connectionState)}`,
    `${t("runtime.openclaw")}: ${translateStatus(runtime.openclaw.overall)}`,
    `${t("runtime.nodes")}: ${t("runtime.nodesSummary", { connected: runtime.nodes.connected, paired: runtime.nodes.paired })}`,
    `${t("runtime.cron")}: ${t("runtime.cronSummary", { total: runtime.cron.total, overdue: runtime.cron.overdue })}`,
    `${t("runtime.freshness")}: ${formatTimestamp(runtime.snapshotAt, language)}`,
  ];
}

export function RuntimeStatusBar() {
  const { language, t, translateStatus } = useI18n();
  const { data, error } = useResource("runtime-status-bar", getRuntimeStatus, { refreshIntervalMs: 5000 });
  const runtime = data?.data;

  return (
    <section className={`runtime-status-bar${error ? " runtime-status-bar-warning" : ""}`}>
      <div className="runtime-status-bar-header">
        <span className="runtime-status-bar-title">{t("runtime.barTitle")}</span>
        <span className={`runtime-pill runtime-pill-${runtime?.gateway.connectionState ?? "unknown"}`}>
          {runtime ? `${t("runtime.gateway")}: ${translateStatus(runtime.gateway.connectionState)}` : t("runtime.loading")}
        </span>
      </div>

      <div className="runtime-status-bar-grid">
        {(runtime ? buildChips(runtime, language, t, translateStatus) : [t("runtime.loading"), t("runtime.waiting"), t("runtime.readonly")]).map((chip) => (
          <span key={chip} className="runtime-chip">
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
}
