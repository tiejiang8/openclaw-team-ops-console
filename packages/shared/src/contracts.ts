import type {
  Agent,
  AuthProfile,
  BindingRoute,
  InventorySummary,
  RuntimeStatus,
  Session,
  SystemSnapshot,
  TopologyView,
  Workspace,
} from "./domain.js";

export interface ResponseMeta {
  generatedAt: string;
  source: "mock" | "openclaw" | "mixed";
  readOnly: true;
}

export interface ListResponse<T> {
  data: T[];
  meta: ResponseMeta & { count: number };
}

export interface ItemResponse<T> {
  data: T;
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
  meta: ResponseMeta;
}

export type AgentsResponse = ListResponse<Agent>;
export type AgentResponse = ItemResponse<Agent>;
export type WorkspacesResponse = ListResponse<Workspace>;
export type SessionsResponse = ListResponse<Session>;
export type BindingsResponse = ListResponse<BindingRoute>;
export type AuthProfilesResponse = ListResponse<AuthProfile>;
