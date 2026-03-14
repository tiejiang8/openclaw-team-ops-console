export type IsoDateString = string;

export const SNAPSHOT_SOURCES = ["mock", "openclaw", "mixed"] as const;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];

export const ENTITY_STATUSES = ["healthy", "degraded", "offline", "unknown"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const SESSION_STATUSES = ["active", "idle", "ended", "error"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const BINDING_STATUSES = ["active", "paused", "error"] as const;
export type BindingStatus = (typeof BINDING_STATUSES)[number];

export const AUTH_PROFILE_STATUSES = ["valid", "expiring", "expired", "disabled"] as const;
export type AuthProfileStatus = (typeof AUTH_PROFILE_STATUSES)[number];

export const AGENT_ROLES = ["coordinator", "worker", "observer", "router"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const ROUTE_TYPES = ["channel", "api", "webhook", "schedule"] as const;
export type RouteType = (typeof ROUTE_TYPES)[number];

export const COLLECTION_NAMES = [
  "agents",
  "workspaces",
  "sessions",
  "bindings",
  "authProfiles",
  "runtimeStatuses",
  "topology",
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];

export const COLLECTION_STATUSES = ["complete", "partial", "unavailable"] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

export const COLLECTION_FRESHNESS = ["fresh", "stale", "unknown"] as const;
export type CollectionFreshness = (typeof COLLECTION_FRESHNESS)[number];

export const SNAPSHOT_WARNING_SEVERITIES = ["info", "warn", "error"] as const;
export type SnapshotWarningSeverity = (typeof SNAPSHOT_WARNING_SEVERITIES)[number];

export const ADAPTER_SOURCE_KINDS = ["mock", "filesystem", "cli", "http", "websocket", "composite"] as const;
export type AdapterSourceKind = (typeof ADAPTER_SOURCE_KINDS)[number];

export const SOURCE_CONFIDENCE_LEVELS = ["confirmed", "assumption"] as const;
export type SourceConfidenceLevel = (typeof SOURCE_CONFIDENCE_LEVELS)[number];

export interface SnapshotWarning {
  code: string;
  severity: SnapshotWarningSeverity;
  message: string;
  collection?: CollectionName;
  sourceId?: string;
}

export interface CollectionMetadata {
  collection: CollectionName;
  status: CollectionStatus;
  freshness: CollectionFreshness;
  collectedAt?: IsoDateString;
  recordCount?: number;
  sourceIds?: string[];
  warnings: SnapshotWarning[];
}

export interface AdapterSourceDescriptor {
  id: string;
  displayName: string;
  kind: AdapterSourceKind;
  readOnly: true;
  confidence: SourceConfidenceLevel;
  location?: string;
  notes?: string;
}

export interface SnapshotOrigin {
  adapterName: string;
  mode: "mock" | "external-readonly";
  collectedAt: IsoDateString;
  sources: AdapterSourceDescriptor[];
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: EntityStatus;
  workspaceId?: string;
  authProfileId?: string;
  host?: string;
  runtimeVersion?: string;
  lastHeartbeatAt?: IsoDateString;
  uptimeSeconds?: number;
  tags?: string[];
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

export interface Workspace {
  id: string;
  name: string;
  status: EntityStatus;
  environment?: "development" | "staging" | "production";
  ownerTeam?: string;
  region?: string;
  coreMarkdownFiles?: string[];
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

export interface WorkspaceDocument {
  workspaceId: string;
  fileName: string;
  contentType: "text/markdown";
  content: string;
  sourcePath?: string;
  updatedAt?: IsoDateString;
}

export interface Session {
  id: string;
  workspaceId?: string;
  agentId?: string;
  bindingId?: string;
  status: SessionStatus;
  channel: string;
  startedAt?: IsoDateString;
  lastActivityAt?: IsoDateString;
  messageCount?: number;
}

export interface BindingRoute {
  id: string;
  workspaceId?: string;
  routeType: RouteType;
  source: string;
  targetAgentId?: string;
  status: BindingStatus;
  description?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

export interface AuthProfile {
  id: string;
  name: string;
  provider: "api-key" | "oauth" | "token" | "certificate";
  status: AuthProfileStatus;
  scopes?: string[];
  workspaceIds?: string[];
  expiresAt?: IsoDateString;
  lastUsedAt?: IsoDateString;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

export interface RuntimeStatus {
  componentId: string;
  componentType: "service" | "adapter" | "dependency";
  status: EntityStatus;
  observedAt: IsoDateString;
  details: Record<string, string | number | boolean | null>;
}

export interface InventorySummary {
  generatedAt: IsoDateString;
  totals: {
    agents: number;
    workspaces: number;
    sessions: number;
    bindings: number;
    authProfiles: number;
  };
  activeSessions: number;
  statusBreakdown: {
    agents: Record<string, number>;
    sessions: Record<string, number>;
    bindings: Record<string, number>;
    authProfiles: Record<string, number>;
    runtime: Record<string, number>;
  };
}

export type TopologyNodeType = "workspace" | "agent" | "session" | "binding" | "auth-profile";

export interface TopologyNode {
  id: string;
  nodeType: TopologyNodeType;
  label: string;
  status: string;
  workspaceId?: string;
}

export interface TopologyEdge {
  fromType: TopologyNodeType;
  fromId: string;
  toType: TopologyNodeType;
  toId: string;
  relation: string;
}

export interface TopologyView {
  generatedAt: IsoDateString;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface SystemSnapshot {
  source: SnapshotSource;
  generatedAt: IsoDateString;
  origin: SnapshotOrigin;
  collections: Record<CollectionName, CollectionMetadata>;
  warnings: SnapshotWarning[];
  agents: Agent[];
  workspaces: Workspace[];
  sessions: Session[];
  bindings: BindingRoute[];
  authProfiles: AuthProfile[];
  runtimeStatuses: RuntimeStatus[];
  summary: InventorySummary;
  topology: TopologyView;
}
