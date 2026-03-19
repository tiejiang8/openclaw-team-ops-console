import type {
  AdapterSourceDescriptor,
  CronJobDetailDto,
  CronJobSummaryDto,
  LogEntriesPage,
  LogEntriesQuery,
  LogFile,
  LogRawFile,
  LogSummary,
  NodeSummaryDto,
  Plugin,
  PresenceEntry,
  RuntimeStatusDto,
  SnapshotSource,
  SourceCollectionStatus,
  SnapshotWarning,
  SystemSnapshot,
  Tool,
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

export interface AdapterLogResultBase {
  collectionStatus: SourceCollectionStatus;
  warnings?: SnapshotWarning[] | undefined;
}

export interface AdapterLogFilesResult extends AdapterLogResultBase {
  items: LogFile[];
}

export interface AdapterLogSummaryResult extends AdapterLogResultBase {
  item: LogSummary;
}

export interface AdapterLogEntriesResult extends AdapterLogResultBase {
  item: LogEntriesPage;
}

export interface AdapterLogRawFileResult extends AdapterLogResultBase {
  item?: LogRawFile;
}

export interface AdapterRuntimePlaneResultBase {
  collectionStatus: SourceCollectionStatus;
  warnings?: SnapshotWarning[] | undefined;
}

export interface AdapterPresenceResult extends AdapterRuntimePlaneResultBase {
  items: PresenceEntry[];
}

export interface AdapterNodesResult extends AdapterRuntimePlaneResultBase {
  items: NodeSummaryDto[];
}

export interface AdapterToolsResult extends AdapterRuntimePlaneResultBase {
  items: Tool[];
}

export interface AdapterPluginsResult extends AdapterRuntimePlaneResultBase {
  items: Plugin[];
}

export interface AdapterRuntimeStatusResult extends AdapterRuntimePlaneResultBase {
  item: RuntimeStatusDto;
}

export interface AdapterCronJobsResult extends AdapterRuntimePlaneResultBase {
  items: CronJobSummaryDto[];
}

export interface AdapterCronJobResult extends AdapterRuntimePlaneResultBase {
  item: CronJobDetailDto | undefined;
}

export interface SidecarInventoryAdapter {
  readonly adapterName: string;
  readonly source: SnapshotSource;
  readonly mode: "mock" | "external-readonly";
  readonly capabilities: AdapterCapabilities;
  describeSources(): Promise<AdapterSourceDescriptor[]>;
  fetchSnapshot(): Promise<SystemSnapshot>;
  getWorkspaceDocument(workspaceId: string, fileName: string): Promise<WorkspaceDocument | undefined>;
  getLogFiles(): Promise<AdapterLogFilesResult>;
  getLogSummary(date?: string): Promise<AdapterLogSummaryResult>;
  getLogEntries(query: LogEntriesQuery): Promise<AdapterLogEntriesResult>;
  getLogRawFile(date?: string): Promise<AdapterLogRawFileResult>;
  getPresence(): Promise<AdapterPresenceResult>;
  getNodes(): Promise<AdapterNodesResult>;
  getTools(): Promise<AdapterToolsResult>;
  getPlugins(): Promise<AdapterPluginsResult>;
  getRuntimeStatus(): Promise<AdapterRuntimeStatusResult>;
  getCronJobs(): Promise<AdapterCronJobsResult>;
  getCronJobById(id: string): Promise<AdapterCronJobResult>;
  healthCheck(): Promise<AdapterHealth>;
  isDataPlaneHealthy(): Promise<boolean>;
  getStateDir(): string | undefined;
  getConfigFile(): string | undefined;
  getWorkspaceGlob(): string | undefined;
  getGatewayUrl(): string | undefined;
}
