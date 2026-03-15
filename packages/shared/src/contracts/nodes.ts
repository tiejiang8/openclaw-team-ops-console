export type NodeSource = "mock" | "gateway";

export interface NodeSummaryDto {
  id: string;
  name?: string;
  platform?: string;
  paired: boolean;
  connected: boolean;
  lastConnectAt?: string;
  capabilities?: string[];
  source: NodeSource;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  online?: boolean;
  lastSeenAt?: string;
}

export interface NodeSummaryCountsDto {
  paired: number;
  connected: number;
  stale: number;
}
