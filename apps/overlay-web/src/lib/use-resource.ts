import { useCallback, useEffect, useRef, useState } from "react";

interface UseResourceOptions {
  refreshIntervalMs?: number;
  preserveDataOnError?: boolean;
  errorBackoffMs?: number | undefined;
  autoRefreshEnabled?: boolean | undefined;
}

export function useResource<T>(key: string, loader: () => Promise<T>, options: UseResourceOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);
  const dataRef = useRef<T | null>(null);
  const inFlightRef = useRef(false);
  const lastTriggerRef = useRef<"initial" | "manual" | "auto">("initial");
  const nextAllowedAutoAtRef = useRef(0);

  const refreshIntervalMs = options.refreshIntervalMs ?? 0;
  const preserveDataOnError = options.preserveDataOnError ?? false;
  const errorBackoffMs = options.errorBackoffMs ?? 60_000;
  const autoRefreshEnabled = options.autoRefreshEnabled ?? true;

  const retry = useCallback(() => {
    if (inFlightRef.current) {
      return;
    }

    lastTriggerRef.current = "manual";
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const showLoadingState = dataRef.current === null || !preserveDataOnError;

    inFlightRef.current = true;
    setLoading(showLoadingState);
    setError(null);

    loader()
      .then((result) => {
        if (!cancelled) {
          dataRef.current = result;
          setData((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(result)) {
              return prev as T;
            }
            return result;
          });

          if (autoRefreshEnabled && refreshIntervalMs > 0) {
            nextAllowedAutoAtRef.current = Date.now() + refreshIntervalMs;
          }
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Unknown error";
          setError(message);

          if (lastTriggerRef.current === "auto" && autoRefreshEnabled && refreshIntervalMs > 0) {
            nextAllowedAutoAtRef.current = Date.now() + Math.max(refreshIntervalMs, errorBackoffMs);
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          inFlightRef.current = false;
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      inFlightRef.current = false;
    };
  }, [attempt, autoRefreshEnabled, errorBackoffMs, key, loader, preserveDataOnError, refreshIntervalMs]);

  useEffect(() => {
    if (!autoRefreshEnabled || refreshIntervalMs <= 0) {
      return undefined;
    }

    nextAllowedAutoAtRef.current = Date.now() + refreshIntervalMs;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || inFlightRef.current || Date.now() < nextAllowedAutoAtRef.current) {
        return;
      }

      lastTriggerRef.current = "auto";
      setAttempt((value) => value + 1);
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefreshEnabled, refreshIntervalMs]);

  return {
    data,
    loading,
    error,
    retry,
  };
}
