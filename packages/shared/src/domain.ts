import type { CoverageSummary } from "./observability.js";

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

export const TARGET_TYPES = ["local-runtime", "remote-runtime", "customer-instance"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const TARGET_ENVIRONMENTS = ["development", "staging", "production", "sandbox", "unknown"] as const;
export type TargetEnvironment = (typeof TARGET_ENVIRONMENTS)[number];

export const TARGET_SOURCE_KINDS = ["filesystem", "mock", "cli", "gateway-health", "logs"] as const;
export type TargetSourceKind = (typeof TARGET_SOURCE_KINDS)[number];

export const EVIDENCE_KINDS = [
  "config-parse",
  "config-include",
  "file-missing",
  "workspace-scan",
  "session-store",
  "auth-profile-scan",
  "binding-parse",
  "snapshot-freshness",
  "coverage-gap",
  "runtime-health",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_SOURCES = ["filesystem", "mock", "overlay-api", "derived-rule"] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export const EVIDENCE_SUBJECT_TYPES = [
  "target",
  "agent",
  "workspace",
  "session",
  "binding",
  "auth-profile",
  "collection",
  "topology-edge",
] as const;
export type EvidenceSubjectType = (typeof EVIDENCE_SUBJECT_TYPES)[number];

export const FINDING_TYPES = [
  "orphan-session",
  "dangling-binding",
  "config-include-anomaly",
  "workspace-drift",
  "snapshot-freshness-degradation",
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const FINDING_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_STATUSES = ["open", "no-longer-observed"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const RECOMMENDATION_TYPES = [
  "inspect-file",
  "inspect-directory",
  "run-cli",
  "compare-config",
  "verify-workspace",
  "collect-fresh-snapshot",
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_PRIORITIES = ["high", "medium", "low"] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

export const RECOMMENDATION_SAFETY_LEVELS = ["safe-read-only", "requires-human-review"] as const;
export type RecommendationSafetyLevel = (typeof RECOMMENDATION_SAFETY_LEVELS)[number];

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "unknown"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_FILE_SOURCE_KINDS = ["configured", "default", "glob"] as const;
export type LogFileSourceKind = (typeof LOG_FILE_SOURCE_KINDS)[number];

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

export interface LogFile {
  date: string;
  path: string;
  sizeBytes: number;
  modifiedAt: IsoDateString;
  sourceKind: LogFileSourceKind;
  isLatest: boolean;
}

export interface LogEntryRefs {
  sessionId?: string;
  agentId?: string;
  deviceId?: string;
  jobId?: string;
}

export interface LogEntry {
  id: string;
  lineNumber: number;
  ts?: IsoDateString;
  level: LogLevel;
  subsystem?: string;
  message: string;
  raw: string;
  parsed: boolean;
  tags: string[];
  refs?: LogEntryRefs;
}

export interface LogSummary {
  date: string;
  file?: LogFile;
  totalLines: number;
  parsedLines: number;
  levelCounts: Record<string, number>;
  signalCounts: Record<string, number>;
  latestErrorAt?: IsoDateString;
}

export interface LogEntriesQuery {
  date?: string;
  cursor?: string;
  limit?: number;
  q?: string;
  level?: string;
  subsystem?: string;
  tag?: string;
}

export interface LogEntriesPage {
  date: string;
  file?: LogFile;
  items: LogEntry[];
  total: number;
  limit: number;
  cursor?: string;
  nextCursor?: string;
  previousCursor?: string;
  availableLevels: string[];
  availableSubsystems: string[];
  availableTags: string[];
}

export interface LogRawFile {
  date: string;
  path: string;
  content: string;
  lineCount: number;
  sizeBytes: number;
  truncated: boolean;
}

export interface PresenceEntry {
  deviceId: string;
  roles: string[];
  scopes: string[];
  online: boolean;
  lastSeenAt?: IsoDateString;
}

export interface Node {
  deviceId: string;
  roles: string[];
  scopes: string[];
  online: boolean;
  lastSeenAt?: IsoDateString;
}

export interface Tool {
  agentId: string;
  name: string;
  source: "core" | "plugin";
  pluginId?: string;
  optional?: boolean;
  group?: string;
}

export interface Plugin {
  id: string;
  enabled?: boolean;
  sourceKind: "gateway" | "filesystem" | "cli-probe";
  hasRuntimeErrors?: boolean;
  notes?: string[];
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

export interface TargetConnection {
  runtimeRoot?: string;
  configFile?: string;
  workspaceGlob?: string;
  sourceRoot?: string;
  gatewayUrl?: string;
  dashboardUrl?: string;
}

export interface TargetCollectionPolicy {
  mode: "on-demand-snapshot";
  readOnly: true;
  mockFallbackAllowed: boolean;
}

export interface TargetCoverage {
  completeCollections: number;
  partialCollections: number;
  unavailableCollections: number;
}

export interface Target {
  id: string;
  name: string;
  type: TargetType;
  environment: TargetEnvironment;
  owner?: string;
  sourceKind: TargetSourceKind;
  connection: TargetConnection;
  collectionPolicy: TargetCollectionPolicy;
  status: EntityStatus;
  lastCollectedAt?: IsoDateString;
  freshness: CollectionFreshness;
  warningCount: number;
  riskScore: number;
  coverage: TargetCoverage;
}

export interface TargetSnapshotSummary {
  target: Target;
  summary: InventorySummary;
  collections: Record<CollectionName, CollectionMetadata>;
  runtimeStatuses: RuntimeStatus[];
  warnings: SnapshotWarning[];
  agents: Agent[];
  workspaces: Workspace[];
  sessions: Session[];
  bindings: BindingRoute[];
  authProfiles: AuthProfile[];
  topology: TopologyView;
}

export interface Evidence {
  id: string;
  targetId: string;
  targetName?: string;
  kind: EvidenceKind;
  source: EvidenceSource;
  subjectType: EvidenceSubjectType;
  subjectId: string;
  subjectLabel?: string;
  severity: SnapshotWarningSeverity;
  message: string;
  details: Record<string, string | number | boolean | null>;
  observedAt: IsoDateString;
  freshness: CollectionFreshness;
  pathRefs?: string[];
  fieldRefs?: string[];
}

export interface Finding {
  id: string;
  type: FindingType;
  severity: FindingSeverity;
  status: FindingStatus;
  summary: string;
  targetId: string;
  targetName?: string;
  subjectType: EvidenceSubjectType;
  subjectId: string;
  subjectLabel?: string;
  evidenceRefs: string[];
  recommendationIds: string[];
  observedAt: IsoDateString;
  score: number;
}

export interface Recommendation {
  id: string;
  findingId: string;
  type: RecommendationType;
  title: string;
  body: string;
  priority: RecommendationPriority;
  requiresHuman: boolean;
  commandTemplate?: string;
  pathHint?: string;
  docLink?: string;
  safetyLevel?: RecommendationSafetyLevel;
}

export interface TargetRiskSummary {
  targetId: string;
  targetName: string;
  openFindings: number;
  highestScore: number;
  highestSeverity?: FindingSeverity;
}

export interface RisksSummary {
  generatedAt: IsoDateString;
  openFindings: number;
  bySeverity: Record<FindingSeverity, number>;
  byType: Record<string, number>;
  staleTargets: number;
  coverageGaps: number;
  highestRiskScore: number;
  targetBreakdown: TargetRiskSummary[];
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
  sourceRegistry: CoverageSummary;
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
