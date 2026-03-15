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
export type NodesResponse = ListResponse<Node>;
export type ToolsResponse = ListResponse<Tool>;
export type PluginsResponse = ListResponse<Plugin>;
