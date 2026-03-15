import { useCallback, useEffect, useState } from "react";

interface UseResourceOptions {
  refreshIntervalMs?: number;
}

export function useResource<T>(key: string, loader: () => Promise<T>, options: UseResourceOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Unknown error";
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, key, loader]);

  useEffect(() => {
    if (!options.refreshIntervalMs || options.refreshIntervalMs <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setAttempt((value) => value + 1);
    }, options.refreshIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [options.refreshIntervalMs]);

  return {
    data,
    loading,
    error,
    retry,
  };
}
