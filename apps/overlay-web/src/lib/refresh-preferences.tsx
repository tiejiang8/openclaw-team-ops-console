import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type RefreshMode = "off" | "30s" | "3m";

const STORAGE_KEY = "openclaw.console.refreshMode";

interface RefreshPreferencesValue {
  mode: RefreshMode;
  setMode: (mode: RefreshMode) => void;
  intervalMs: number;
  autoRefreshEnabled: boolean;
}

const intervalByMode: Record<RefreshMode, number> = {
  off: 0,
  "30s": 30_000,
  "3m": 180_000,
};

const RefreshPreferencesContext = createContext<RefreshPreferencesValue | null>(null);

function readStoredMode(): RefreshMode {
  if (typeof window === "undefined") {
    return "30s";
  }

  const storedMode = window.localStorage.getItem(STORAGE_KEY);
  return storedMode === "off" || storedMode === "30s" || storedMode === "3m" ? storedMode : "30s";
}

export function RefreshPreferencesProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<RefreshMode>(() => readStoredMode());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo<RefreshPreferencesValue>(() => {
    const intervalMs = intervalByMode[mode];

    return {
      mode,
      setMode,
      intervalMs,
      autoRefreshEnabled: intervalMs > 0,
    };
  }, [mode]);

  return <RefreshPreferencesContext.Provider value={value}>{children}</RefreshPreferencesContext.Provider>;
}

export function useRefreshPreferences() {
  const context = useContext(RefreshPreferencesContext);

  if (!context) {
    throw new Error("useRefreshPreferences must be used within a RefreshPreferencesProvider");
  }

  return context;
}
