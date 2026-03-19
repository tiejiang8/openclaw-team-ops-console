import type {
  Agent,
  CollectionMetadata,
  CollectionName,
  AuthProfile,
  BindingRoute,
  Evidence,
  Finding,
  InventorySummary,
  LogEntriesPage,
  LogFile,
  LogRawFile,
  LogSummary,
  Node,
  Recommendation,
  Plugin,
  PresenceEntry,
  RisksSummary,
  RuntimeStatus,
  Session,
  SnapshotSource,
  SnapshotWarning,
  SystemSnapshot,
  Target,
  TargetSnapshotSummary,
  TopologyView,
  Tool,
  Workspace,
  WorkspaceDocument,
} from "./domain.js";
import type { ApiMeta, CoverageSummary } from "./observability.js";
import type { CronJobDetailDto, CronJobSummaryDto } from "./contracts/cron.js";
import type { NodeSummaryCountsDto, NodeSummaryDto } from "./contracts/nodes.js";
import type { RuntimeStatusDto } from "./contracts/runtime-plane.js";
import type { BootstrapStatusDto, BootstrapStatusResponse } from "./contracts/bootstrap.js";
import type { FleetMapDto, FleetMapResponse } from "./contracts/fleet-map.js";
import type { ActivityEventDto, ActivityResponse } from "./contracts/activity.js";
import type { StreamingEventDto } from "./contracts/streaming.js";

export * from "./contracts/bootstrap.js";
export * from "./contracts/fleet-map.js";
export * from "./contracts/activity.js";
export * from "./contracts/streaming.js";

export interface ResponseMeta extends ApiMeta {}

export interface ListResponse<T> {
  data: T[];
  items: T[];
  total: number;
  meta: ResponseMeta & { count: number };
}

export interface ItemResponse<T> {
  data: T;
  item: T;
  meta: ResponseMeta;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
  meta: ResponseMeta;
}

export interface HealthCheck {
  name: string;
  status: "ok" | "degraded" | "down";
  details?: string;
}

export interface HealthResponse {
  service: "overlay-api" | "sidecar";
  status: "ok" | "degraded";
  time: string;
  checks: HealthCheck[];
}

export interface SummaryResponse {
  data: InventorySummary;
  runtimeStatuses: RuntimeStatus[];
  meta: ResponseMeta;
}

export interface RuntimeStatusesResponse {
  data: RuntimeStatus[];
  meta: ResponseMeta;
}

export interface RuntimeStatusResponse extends ItemResponse<RuntimeStatusDto> {}

export interface TopologyResponse {
  data: TopologyView;
  meta: ResponseMeta;
}

export interface SnapshotResponse {
  data: SystemSnapshot;
  item: SystemSnapshot;
  meta: ResponseMeta;
}

export type AgentsResponse = ListResponse<Agent>;
export type AgentResponse = ItemResponse<Agent>;
export type TargetsResponse = ListResponse<Target>;
export type TargetResponse = ItemResponse<Target>;
export type TargetSummaryResponse = ItemResponse<TargetSnapshotSummary>;
export type EvidencesResponse = ListResponse<Evidence>;
export type EvidenceResponse = ItemResponse<Evidence>;
export type FindingsResponse = ListResponse<Finding>;
export type FindingResponse = ItemResponse<Finding>;
export type RecommendationsResponse = ListResponse<Recommendation>;
export type RecommendationResponse = ItemResponse<Recommendation>;
export type RisksSummaryResponse = ItemResponse<RisksSummary>;
export type WorkspacesResponse = ListResponse<Workspace>;
export type WorkspaceDocumentResponse = ItemResponse<WorkspaceDocument>;
export type SessionsResponse = ListResponse<Session>;
export type BindingsResponse = ListResponse<BindingRoute>;
export type AuthProfilesResponse = ListResponse<AuthProfile>;
export type CoverageResponse = ItemResponse<CoverageSummary>;
export type LogFilesResponse = ListResponse<LogFile>;
export type LogSummaryResponse = ItemResponse<LogSummary>;
export type LogEntriesResponse = ItemResponse<LogEntriesPage>;
export type LogRawFileResponse = ItemResponse<LogRawFile>;
export type PresenceResponse = ListResponse<PresenceEntry>;
export interface NodesResponse extends ListResponse<NodeSummaryDto> {
  summary?: NodeSummaryCountsDto;
}
export type ToolsResponse = ListResponse<Tool>;
export type PluginsResponse = ListResponse<Plugin>;
export type CronJobsResponse = ListResponse<CronJobSummaryDto>;
export interface CronJobResponse extends ItemResponse<CronJobDetailDto> {}
export type FleetMapResponseContract = FleetMapResponse;
export type ActivityResponseContract = ActivityResponse;
export type RecommendationsResponseContract = RecommendationsResponse;
export type RecommendationResponseContract = RecommendationResponse;
