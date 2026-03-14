import type {
  AdapterSourceDescriptor,
  SnapshotSource,
  SnapshotWarning,
  SystemSnapshot,
  WorkspaceDocument,
} from "@openclaw-team-ops/shared";

export interface AdapterCapabilities {
  supportsCollectionMetadata: boolean;
  supportsPartialData: boolean;
  supportsDegradedSnapshots: boolean;
  supportsScenarioSelection: boolean;
  supportsSourceDescriptors: boolean;
}

export interface AdapterHealth {
  name: string;
  status: "ok" | "degraded" | "down";
  observedAt: string;
  details?: string;
  warnings?: SnapshotWarning[];
}

export interface SidecarInventoryAdapter {
  readonly adapterName: string;
  readonly source: SnapshotSource;
  readonly mode: "mock" | "external-readonly";
  readonly capabilities: AdapterCapabilities;
  describeSources(): Promise<AdapterSourceDescriptor[]>;
  fetchSnapshot(): Promise<SystemSnapshot>;
  getWorkspaceDocument(workspaceId: string, fileName: string): Promise<WorkspaceDocument | undefined>;
  healthCheck(): Promise<AdapterHealth>;
}
