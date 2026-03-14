import { useCallback, useMemo } from "react";

import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";

function findRuntimeRootPath(
  runtimeStatuses: Array<{
    componentId: string;
    details: Record<string, string | number | boolean | null>;
  }>,
): string | null {
  const runtimeRoot = runtimeStatuses.find((status) => status.componentId === "openclaw-runtime-root");
  const pathValue = runtimeRoot?.details.path;

  return typeof pathValue === "string" && pathValue.trim().length > 0 ? pathValue : null;
}

export function RuntimeSourceMarker() {
  const { t } = useI18n();
  const loadSource = useCallback(() => overlayApi.getRuntimeStatuses(), []);
  const { data, loading, error } = useResource("runtime-source-marker", loadSource);

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

    if (data.meta.source === "mock") {
      return {
        title: t("source.title"),
        label: t("source.mock"),
        detail: t("source.mockDetail"),
        tone: "neutral",
      } as const;
    }

    const runtimeRootPath = findRuntimeRootPath(data.data);

    return {
      title: t("source.title"),
      label: t("source.local"),
      detail: runtimeRootPath ?? t("source.localFallback"),
      tone: "ok",
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
