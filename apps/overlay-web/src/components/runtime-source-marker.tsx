import { useCallback, useMemo } from "react";

import { getRuntimeStatus } from "../lib/api/runtime.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";

export function RuntimeSourceMarker() {
  const { t } = useI18n();
  const loadSource = useCallback(() => getRuntimeStatus(), []);
  const { data, loading, error } = useResource("runtime-source-marker", loadSource, { refreshIntervalMs: 5000 });

  const marker = useMemo(() => {
    if (loading) {
      return {
        title: t("source.title"),
        label: t("source.detecting"),
        detail: t("source.checking"),
        tone: "neutral",
      } as const;
    }

    if (error || !data) {
      return {
        title: t("source.title"),
        label: t("source.unavailable"),
        detail: t("source.unavailableDetail"),
        tone: "warning",
      } as const;
    }

    if (data.data.sourceMode === "mock") {
      return {
        title: t("source.title"),
        label: t("source.mock"),
        detail: t("source.mockDetail"),
        tone: "neutral",
      } as const;
    }

    const label = data.data.sourceMode === "gateway-ws"
      ? t("source.gateway")
      : data.data.sourceMode === "hybrid"
        ? t("source.hybrid")
        : t("source.local");

    return {
      title: t("source.title"),
      label,
      detail: data.data.gateway.url ?? t("source.localFallback"),
      tone: data.data.gateway.connectionState === "connected" ? "ok" : "neutral",
    } as const;
  }, [data, error, loading, t]);

  return (
    <section className={`source-marker source-marker-${marker.tone}`} aria-label="Current runtime source">
      <p className="source-marker-title">{marker.title}</p>
      <p className="source-marker-label">{marker.label}</p>
      <p className="source-marker-detail" title={marker.detail}>
        {marker.detail}
      </p>
    </section>
  );
}
