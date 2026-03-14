import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  AdapterSourceDescriptor,
  CollectionFreshness,
  SnapshotWarning,
  SystemSnapshot,
  Target,
  TargetConnection,
  TargetEnvironment,
  TargetSnapshotSummary,
  TargetSourceKind,
  TargetType,
} from "@openclaw-team-ops/shared";

import { FilesystemOpenClawAdapter } from "../adapters/filesystem/filesystem-adapter.js";
import { MockOpenClawAdapter, type MockAdapterScenario } from "../adapters/mock/mock-adapter.js";
import type { SidecarInventoryAdapter } from "../adapters/source-adapter.js";

export interface SidecarTargetEnvironment {
  SIDECAR_TARGET_ID?: string;
  SIDECAR_TARGET_NAME?: string;
  SIDECAR_TARGET_ENVIRONMENT?: string;
  SIDECAR_TARGET_OWNER?: string;
  OPENCLAW_RUNTIME_ROOT?: string;
  OPENCLAW_STATE_DIR?: string;
  OPENCLAW_CONFIG_FILE?: string;
  OPENCLAW_CONFIG_PATH?: string;
  OPENCLAW_WORKSPACE_GLOB?: string;
  OPENCLAW_SOURCE_ROOT?: string;
  OPENCLAW_PROFILE?: string;
  OPENCLAW_GATEWAY_URL?: string;
  OPENCLAW_DASHBOARD_URL?: string;
  SIDECAR_MOCK_SCENARIO?: string;
  SIDECAR_TARGETS_FILE?: string;
}

interface SidecarTargetDefinition {
  id?: string;
  name?: string;
  environment?: string;
  owner?: string;
  mockScenario?: string;
  runtimeRoot?: string;
  stateDir?: string;
  configFile?: string;
  configPath?: string;
  workspaceGlob?: string;
  sourceRoot?: string;
  profile?: string;
  gatewayUrl?: string;
  dashboardUrl?: string;
}

interface TargetEntry {
  adapter: SidecarInventoryAdapter;
  environment: SidecarTargetEnvironment;
}

function normalizeInput(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toTargetSourceKind(sources: AdapterSourceDescriptor[], snapshot: SystemSnapshot): TargetSourceKind {
  const primaryKind = sources[0]?.kind;

  if (primaryKind === "filesystem") {
    return "filesystem";
  }

  if (primaryKind === "cli") {
    return "cli";
  }

  if (primaryKind === "http" || primaryKind === "websocket") {
    return "gateway-health";
  }

  if (primaryKind === "mock" || snapshot.source === "mock") {
    return "mock";
  }

  return "logs";
}

function toTargetType(connection: TargetConnection, sourceKind: TargetSourceKind): TargetType {
  if (sourceKind === "filesystem") {
    return "local-runtime";
  }

  if (connection.gatewayUrl || connection.dashboardUrl) {
    return "remote-runtime";
  }

  return "local-runtime";
}

function toTargetFreshness(snapshot: SystemSnapshot): CollectionFreshness {
  const freshnessValues = Object.values(snapshot.collections).map((collection) => collection.freshness);

  if (freshnessValues.includes("stale")) {
    return "stale";
  }

  if (freshnessValues.includes("fresh")) {
    return "fresh";
  }

  return "unknown";
}

function inferTargetEnvironment(
  input: string | undefined,
  snapshot: SystemSnapshot,
  connection: TargetConnection,
): TargetEnvironment {
  const normalized = normalizeInput(input)?.toLowerCase();

  if (
    normalized === "development" ||
    normalized === "staging" ||
    normalized === "production" ||
    normalized === "sandbox" ||
    normalized === "unknown"
  ) {
    return normalized;
  }

  if (snapshot.source === "mock") {
    return "sandbox";
  }

  const candidates = [
    connection.runtimeRoot,
    connection.configFile,
    connection.workspaceGlob,
    connection.sourceRoot,
    connection.gatewayUrl,
    connection.dashboardUrl,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (candidates.includes("production") || candidates.includes("prod")) {
    return "production";
  }

  if (candidates.includes("staging") || candidates.includes("stage") || candidates.includes("stg")) {
    return "staging";
  }

  if (candidates.includes("development") || candidates.includes("dev")) {
    return "development";
  }

  return "unknown";
}

function readRuntimeDetail(snapshot: SystemSnapshot, componentId: string, key: string): string | undefined {
  const runtimeStatus = snapshot.runtimeStatuses.find((status) => status.componentId === componentId);
  const value = runtimeStatus?.details[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildConnection(environment: SidecarTargetEnvironment, snapshot: SystemSnapshot): TargetConnection {
  const runtimeRoot =
    normalizeInput(environment.OPENCLAW_RUNTIME_ROOT) ??
    normalizeInput(environment.OPENCLAW_STATE_DIR) ??
    readRuntimeDetail(snapshot, "openclaw-runtime-root", "path");
  const configFile =
    normalizeInput(environment.OPENCLAW_CONFIG_FILE) ??
    normalizeInput(environment.OPENCLAW_CONFIG_PATH) ??
    readRuntimeDetail(snapshot, "openclaw-config-file", "path");
  const workspaceGlob =
    normalizeInput(environment.OPENCLAW_WORKSPACE_GLOB) ?? readRuntimeDetail(snapshot, "openclaw-workspace-scan", "pattern");
  const sourceRoot = normalizeInput(environment.OPENCLAW_SOURCE_ROOT) ?? readRuntimeDetail(snapshot, "openclaw-source-root", "path");
  const gatewayUrl = normalizeInput(environment.OPENCLAW_GATEWAY_URL);
  const dashboardUrl = normalizeInput(environment.OPENCLAW_DASHBOARD_URL);

  return {
    ...(runtimeRoot ? { runtimeRoot } : {}),
    ...(configFile ? { configFile } : {}),
    ...(workspaceGlob ? { workspaceGlob } : {}),
    ...(sourceRoot ? { sourceRoot } : {}),
    ...(gatewayUrl ? { gatewayUrl } : {}),
    ...(dashboardUrl ? { dashboardUrl } : {}),
  };
}

function buildCoverage(snapshot: SystemSnapshot): Target["coverage"] {
  const collections = Object.values(snapshot.collections);

  return {
    completeCollections: collections.filter((collection) => collection.status === "complete").length,
    partialCollections: collections.filter((collection) => collection.status === "partial").length,
    unavailableCollections: collections.filter((collection) => collection.status === "unavailable").length,
  };
}

function buildRiskScore(snapshot: SystemSnapshot, freshness: CollectionFreshness): number {
  const warningScore = snapshot.warnings.reduce((score, warning) => {
    switch (warning.severity) {
      case "error":
        return score + 18;
      case "warn":
        return score + 8;
      default:
        return score + 2;
    }
  }, 0);
  const coverageScore = Object.values(snapshot.collections).reduce((score, collection) => {
    if (collection.status === "unavailable") {
      return score + 20;
    }

    if (collection.status === "partial") {
      return score + 8;
    }

    return score;
  }, 0);
  const runtimeScore = snapshot.runtimeStatuses.reduce((score, status) => {
    if (status.status === "offline") {
      return score + 12;
    }

    if (status.status === "degraded") {
      return score + 6;
    }

    if (status.status === "unknown") {
      return score + 3;
    }

    return score;
  }, 0);
  const freshnessScore = freshness === "stale" ? 12 : freshness === "unknown" ? 4 : 0;

  return Math.min(100, warningScore + coverageScore + runtimeScore + freshnessScore);
}

function buildStatus(snapshot: SystemSnapshot, freshness: CollectionFreshness, warnings: SnapshotWarning[]): Target["status"] {
  const collections = Object.values(snapshot.collections);
  const allUnavailable = collections.every((collection) => collection.status === "unavailable");
  const hasOfflineDependency = snapshot.runtimeStatuses.some((status) => status.status === "offline");
  const hasDegradedData = collections.some((collection) => collection.status !== "complete");

  if (allUnavailable && hasOfflineDependency) {
    return "offline";
  }

  if (hasDegradedData || freshness !== "fresh" || warnings.length > 0) {
    return "degraded";
  }

  return "healthy";
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "target";
}

function deriveTargetId(snapshot: SystemSnapshot, environment: SidecarTargetEnvironment, connection: TargetConnection): string {
  const configuredId = normalizeInput(environment.SIDECAR_TARGET_ID);

  if (configuredId) {
    return slugify(configuredId);
  }

  const stableSeed =
    connection.runtimeRoot ??
    connection.configFile ??
    connection.gatewayUrl ??
    connection.dashboardUrl ??
    `${snapshot.source}:${environment.SIDECAR_MOCK_SCENARIO ?? "default"}`;
  const hash = createHash("sha1").update(stableSeed).digest("hex").slice(0, 8);
  const labelSeed =
    path.basename(connection.runtimeRoot ?? connection.configFile ?? connection.gatewayUrl ?? connection.dashboardUrl ?? snapshot.source) ||
    "active";

  return `target-${slugify(labelSeed)}-${hash}`;
}

function deriveTargetName(
  snapshot: SystemSnapshot,
  environment: SidecarTargetEnvironment,
  connection: TargetConnection,
  sources: AdapterSourceDescriptor[],
): string {
  const configuredName = normalizeInput(environment.SIDECAR_TARGET_NAME);

  if (configuredName) {
    return configuredName;
  }

  if (snapshot.source === "mock") {
    return sources[0]?.displayName ?? "Mock Target";
  }

  if (connection.runtimeRoot) {
    return `Local Runtime · ${path.basename(connection.runtimeRoot) || connection.runtimeRoot}`;
  }

  return sources[0]?.displayName ?? "OpenClaw Runtime Target";
}

export class SidecarTargetCatalog {
  constructor(
    private readonly adapter: SidecarInventoryAdapter,
    private readonly environment: SidecarTargetEnvironment = process.env,
  ) {}

  async getTargets(): Promise<Target[]> {
    const entries = await this.getTargetEntries();
    const targets = await Promise.all(
      entries.map(async (entry) => {
        const snapshot = await entry.adapter.fetchSnapshot();
        return this.buildTarget(entry.adapter, entry.environment, snapshot);
      }),
    );

    return targets;
  }

  async getTargetById(targetId: string): Promise<Target | undefined> {
    const targets = await this.getTargets();
    return targets.find((target) => target.id === targetId);
  }

  async getTargetSummary(targetId: string): Promise<TargetSnapshotSummary | undefined> {
    const entries = await this.getTargetEntries();

    for (const entry of entries) {
      const snapshot = await entry.adapter.fetchSnapshot();
      const target = await this.buildTarget(entry.adapter, entry.environment, snapshot);

      if (target.id !== targetId) {
        continue;
      }

      return {
        target,
        summary: snapshot.summary,
        collections: snapshot.collections,
        runtimeStatuses: snapshot.runtimeStatuses,
        warnings: snapshot.warnings,
        agents: snapshot.agents,
        workspaces: snapshot.workspaces,
        sessions: snapshot.sessions,
        bindings: snapshot.bindings,
        authProfiles: snapshot.authProfiles,
        topology: snapshot.topology,
      };
    }

    return undefined;
  }

  private async getTargetEntries(): Promise<TargetEntry[]> {
    const configuredTargets = await this.loadConfiguredTargets();

    if (configuredTargets.length === 0) {
      return [
        {
          adapter: this.adapter,
          environment: this.environment,
        },
      ];
    }

    return configuredTargets;
  }

  private async loadConfiguredTargets(): Promise<TargetEntry[]> {
    const targetsFile = normalizeInput(this.environment.SIDECAR_TARGETS_FILE);

    if (!targetsFile) {
      return [];
    }

    const absolutePath = path.isAbsolute(targetsFile) ? targetsFile : path.resolve(process.cwd(), targetsFile);
    const content = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(content) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error(`Target registry file must contain an array: ${absolutePath}`);
    }

    return parsed
      .filter((entry): entry is SidecarTargetDefinition => typeof entry === "object" && entry !== null)
      .map((entry) => {
        const environment: SidecarTargetEnvironment = {
          ...(entry.id ? { SIDECAR_TARGET_ID: entry.id } : {}),
          ...(entry.name ? { SIDECAR_TARGET_NAME: entry.name } : {}),
          ...(entry.environment ? { SIDECAR_TARGET_ENVIRONMENT: entry.environment } : {}),
          ...(entry.owner ? { SIDECAR_TARGET_OWNER: entry.owner } : {}),
          ...(entry.mockScenario ? { SIDECAR_MOCK_SCENARIO: entry.mockScenario } : {}),
          ...(entry.runtimeRoot ? { OPENCLAW_RUNTIME_ROOT: entry.runtimeRoot } : {}),
          ...(entry.stateDir ? { OPENCLAW_STATE_DIR: entry.stateDir } : {}),
          ...(entry.configFile ? { OPENCLAW_CONFIG_FILE: entry.configFile } : {}),
          ...(entry.configPath ? { OPENCLAW_CONFIG_PATH: entry.configPath } : {}),
          ...(entry.workspaceGlob ? { OPENCLAW_WORKSPACE_GLOB: entry.workspaceGlob } : {}),
          ...(entry.sourceRoot ? { OPENCLAW_SOURCE_ROOT: entry.sourceRoot } : {}),
          ...(entry.profile ? { OPENCLAW_PROFILE: entry.profile } : {}),
          ...(entry.gatewayUrl ? { OPENCLAW_GATEWAY_URL: entry.gatewayUrl } : {}),
          ...(entry.dashboardUrl ? { OPENCLAW_DASHBOARD_URL: entry.dashboardUrl } : {}),
          SIDECAR_TARGETS_FILE: absolutePath,
        };

        return {
          adapter:
            entry.runtimeRoot || entry.stateDir || entry.configFile || entry.configPath || entry.workspaceGlob || entry.profile
              ? new FilesystemOpenClawAdapter({
                  runtimeRoot: entry.runtimeRoot,
                  stateDir: entry.stateDir,
                  configFile: entry.configFile,
                  configPath: entry.configPath,
                  workspaceGlob: entry.workspaceGlob,
                  sourceRoot: entry.sourceRoot,
                  profile: entry.profile,
                })
              : new MockOpenClawAdapter(
                  entry.mockScenario ? { scenario: entry.mockScenario as MockAdapterScenario } : undefined,
                ),
          environment,
        };
      });
  }

  private async buildTarget(
    adapter: SidecarInventoryAdapter,
    environment: SidecarTargetEnvironment,
    snapshot: SystemSnapshot,
  ): Promise<Target> {
    const sources = await adapter.describeSources();
    const connection = buildConnection(environment, snapshot);
    const freshness = toTargetFreshness(snapshot);
    const coverage = buildCoverage(snapshot);
    const sourceKind = toTargetSourceKind(sources, snapshot);
    const owner = normalizeInput(environment.SIDECAR_TARGET_OWNER);
    const target = {
      id: deriveTargetId(snapshot, environment, connection),
      name: deriveTargetName(snapshot, environment, connection, sources),
      type: toTargetType(connection, sourceKind),
      environment: inferTargetEnvironment(environment.SIDECAR_TARGET_ENVIRONMENT, snapshot, connection),
      ...(owner ? { owner } : {}),
      sourceKind,
      connection,
      collectionPolicy: {
        mode: "on-demand-snapshot" as const,
        readOnly: true as const,
        mockFallbackAllowed: snapshot.source === "mock",
      },
      status: buildStatus(snapshot, freshness, snapshot.warnings),
      ...(snapshot.generatedAt ? { lastCollectedAt: snapshot.generatedAt } : {}),
      freshness,
      warningCount: snapshot.warnings.length,
      riskScore: buildRiskScore(snapshot, freshness),
      coverage,
    } satisfies Target;

    return target;
  }
}
