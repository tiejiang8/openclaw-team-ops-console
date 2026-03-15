import type { RuntimeStatus } from "../domain.js";

export type RuntimeConnectionState =
  | "not-configured"
  | "auth-missing"
  | "connecting"
  | "connected"
  | "degraded"
  | "disconnected";

export type RuntimeOverallState =
  | "healthy"
  | "partial"
  | "degraded"
  | "unavailable";

export type RuntimeSourceMode =
  | "mock"
  | "filesystem"
  | "gateway-ws"
  | "hybrid";

export interface RuntimeStatusDto {
  sourceMode: RuntimeSourceMode;
  snapshotAt: string;
  gateway: {
    configured: boolean;
    authResolved: boolean;
    url?: string;
    connectionState: RuntimeConnectionState;
    rpcHealthy?: boolean;
    identity?: {
      name?: string;
      version?: string;
    };
    lastSeenAt?: string;
    warnings: string[];
  };
  openclaw: {
    overall: RuntimeOverallState;
    stateDirDetected: boolean;
    configDetected: boolean;
    logsDetected: boolean;
  };
  nodes: {
    paired: number;
    connected: number;
    stale: number;
    source: "mock" | "filesystem" | "gateway" | "hybrid" | "unavailable";
    lastSyncAt?: string;
  };
  cron: {
    total: number;
    enabled: number;
    overdue: number;
    failing: number;
    source: "mock" | "filesystem" | "gateway" | "hybrid" | "unavailable";
    lastSyncAt?: string;
  };
  presence: {
    onlineDevices: number;
    onlineOperators: number;
    lastSyncAt?: string;
  };
  legacyRuntimeStatuses?: RuntimeStatus[];
}
