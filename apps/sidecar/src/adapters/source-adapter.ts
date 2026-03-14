import type { SystemSnapshot } from "@openclaw-team-ops/shared";

export interface AdapterHealth {
  name: string;
  status: "ok" | "degraded" | "down";
  details?: string;
}

export interface SidecarInventoryAdapter {
  readonly adapterName: string;
  readonly source: "mock" | "openclaw" | "mixed";
  fetchSnapshot(): Promise<SystemSnapshot>;
  healthCheck(): Promise<AdapterHealth>;
}
