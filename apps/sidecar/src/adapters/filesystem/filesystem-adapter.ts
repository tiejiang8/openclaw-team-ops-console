import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { glob, readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import JSON5 from "json5";

import {
  buildInventorySummary,
  buildTopologyView,
  createCollectionMetadata,
  type Agent,
  type AdapterSourceDescriptor,
  type AuthProfile,
  type AuthProfileStatus,
  type BindingRoute,
  type CollectionMetadata,
  type CollectionName,
  type CronJobDetailDto,
  type CronJobSummaryDto,
  type EntityStatus,
  type LogEntriesQuery,
  type NodeSummaryDto,
  type Plugin,
  type PresenceEntry,
  type RuntimeStatus,
  type RuntimeStatusDto,
  type Session,
  type SnapshotWarning,
  type SourceCollectionStatus,
  type SystemSnapshot,
  type Tool,
  type Workspace,
  type WorkspaceDocument,
} from "@openclaw-team-ops/shared";

import type {
  AdapterHealth,
  AdapterCronJobResult,
  AdapterCronJobsResult,
  AdapterLogEntriesResult,
  AdapterLogFilesResult,
  AdapterLogRawFileResult,
  AdapterLogSummaryResult,
  AdapterNodesResult,
  AdapterPluginsResult,
  AdapterPresenceResult,
  AdapterRuntimeStatusResult,
  AdapterToolsResult,
  SidecarInventoryAdapter,
} from "../source-adapter.js";
import { buildSourceRegistry } from "../../domain/source-registry.js";
import { GatewayWsRuntimeClient, type GatewayRuntimeClient } from "../gateway-ws/gateway-client.js";
import type { GatewayClock, GatewayRuntimeSnapshot } from "../gateway-ws/protocol.js";
import { buildLogSummary } from "./logs/build-log-summary.js";
import { discoverLogFiles } from "./logs/discover-log-files.js";
import { parseLogLine } from "./logs/parse-log-line.js";
import { readLogFile } from "./logs/read-log-file.js";
import { tailLogFile } from "./logs/tail-log-file.js";
import { buildCronSnapshot } from "./cron/build-cron-snapshot.js";
import { GatewayRuntimePlaneCache, type GatewayRuntimePlaneState } from "../gateway/runtime-plane-cache.js";

const CONFIG_SOURCE_ID = "filesystem:config-file";
const RUNTIME_SOURCE_ID = "filesystem:runtime-root";
const WORKSPACE_SOURCE_ID = "filesystem:workspace-scan";
const SOURCE_ROOT_SOURCE_ID = "filesystem:source-root";
const LOG_SOURCE_ID = "filesystem:logs";
const GATEWAY_WS_SOURCE_ID = "gateway-ws:operator-read";
const GATEWAY_WS_CACHE_TTL_MS = 5_000;
const SESSION_ACTIVITY_WINDOW_MS = 6 * 60 * 60 * 1000;
const DEFAULT_OPENCLAW_STATE_DIRNAME = ".openclaw";
const LEGACY_CONFIG_FILENAMES = ["clawdbot.json", "moldbot.json", "moltbot.json"] as const;

const WORKSPACE_BOOTSTRAP_FILES = [
  "AGENTS.md",
  "BOOT.md",
  "SOUL.md",
  "TOOLS.md",
  "BOOTSTRAP.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "MEMORY.md",
  "memory.md",
] as const;

const WORKSPACE_OPTIONAL_DIRECTORIES = ["memory", "skills"] as const;

interface FilesystemOpenClawAdapterClock {
  now(): Date;
}

export interface FilesystemOpenClawAdapterOptions {
  runtimeRoot?: string | undefined;
  stateDir?: string | undefined;
  configFile?: string | undefined;
  configPath?: string | undefined;
  workspaceGlob?: string | undefined;
  logGlob?: string | undefined;
  gatewayUrl?: string | undefined;
  gatewayToken?: string | undefined;
  sourceRoot?: string | undefined;
  profile?: string | undefined;
  clock?: FilesystemOpenClawAdapterClock | undefined;
  homedir?: (() => string) | undefined;
  gatewayTimeoutMs?: number | undefined;
  gatewayClientFactory?: ((
    options: { url: string; timeoutMs: number; clock: GatewayClock; authToken?: string },
  ) => GatewayRuntimeClient) | undefined;
}

interface ResolvedFilesystemPaths {
  runtimeRoot: string | undefined;
  configFile: string | undefined;
  workspaceGlob: string | undefined;
  logGlob: string | undefined;
  gatewayUrl: string | undefined;
  gatewayToken: string | undefined;
  sourceRoot: string | undefined;
  profile: string | undefined;
  configBaseDir: string;
}

interface GatewayRuntimeCacheEntry {
  loadedAtMs: number;
  result: GatewayRuntimeLoadResult;
}

interface GatewayRuntimePlaneCacheEntry {
  cacheKey: string;
  cache: GatewayRuntimePlaneCache;
}

interface GatewayRuntimeLoadResult {
  configured: boolean;
  connected: boolean;
  fetchedAt: string;
  warnings: SnapshotWarning[];
  collections: {
    presence: GatewayRuntimeSnapshot["presence"];
    nodes: GatewayRuntimeSnapshot["nodes"];
    sessions: GatewayRuntimeSnapshot["sessions"];
    tools: GatewayRuntimeSnapshot["tools"];
    plugins: GatewayRuntimeSnapshot["plugins"];
  };
}

interface GatewayAuthResolution {
  token: string | undefined;
  warnings: SnapshotWarning[];
}

interface RawOpenClawConfig {
  logging?: {
    file?: string;
  };
  gateway?: {
    auth?: {
      mode?: string;
      token?: unknown;
      password?: unknown;
    };
    remote?: {
      url?: string;
      token?: unknown;
      password?: unknown;
    };
  };
  agents?: {
    defaults?: {
      workspace?: string;
    };
    list?: RawAgentConfig[];
  };
  secrets?: {
    defaults?: {
      env?: string;
      file?: string;
      exec?: string;
    };
    providers?: Record<string, RawSecretProviderConfig>;
  };
  session?: {
    store?: string;
  };
  bindings?: RawBindingConfig[];
}

interface RawSecretProviderConfig {
  source?: string;
  path?: string;
  mode?: string;
}

type RawSecretsDefaults = NonNullable<NonNullable<RawOpenClawConfig["secrets"]>["defaults"]>;
type RawSecretsProviders = NonNullable<NonNullable<RawOpenClawConfig["secrets"]>["providers"]>;

interface RawAgentConfig {
  id?: string;
  default?: boolean;
  name?: string;
  workspace?: string;
  agentDir?: string;
}

interface RawBindingConfig {
  type?: string;
  action?: string;
  agentId?: string;
  match?: Record<string, unknown>;
}

interface ParsedConfigResult {
  path: string;
  data: RawOpenClawConfig;
  files: string[];
}

interface AgentDefinition {
  id: string;
  rawConfig: RawAgentConfig | undefined;
  workspacePath: string | undefined;
  agentDirPath: string | undefined;
  sessionStorePath: string | undefined;
  sessionStoreCandidatePaths: string[];
  resolvedSessionStorePath: string | undefined;
  authProfilesPath: string | undefined;
  sessionCount: number;
  lastSessionActivityAt: string | undefined;
  primaryAuthProfileId: string | undefined;
  authProfileIds: string[];
  authProfileUpdatedAt: string | undefined;
  agentDirExists: boolean;
  sessionStoreExists: boolean;
}

interface WorkspaceScanResult {
  workspace: Workspace;
  path: string;
  keyFileCount: number;
  optionalDirectoryCount: number;
}

interface ParseResult<T> {
  data: T;
  stat: Awaited<ReturnType<typeof statIfExists>>;
}

interface SecretRefLike {
  source: "env" | "file" | "exec";
  provider: string;
  id: string;
}

const DEFAULT_SECRET_PROVIDER_ALIAS = "default";
const ENV_SECRET_TEMPLATE_RE = /^\$\{([A-Z][A-Z0-9_]{0,127})\}$/;

function isWorkspaceBootstrapFileName(fileName: string): fileName is (typeof WORKSPACE_BOOTSTRAP_FILES)[number] {
  return WORKSPACE_BOOTSTRAP_FILES.includes(fileName as (typeof WORKSPACE_BOOTSTRAP_FILES)[number]);
}

function normalizeInput(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeProfile(value?: string): string | undefined {
  const normalized = normalizeInput(value);

  return normalized ? normalized : undefined;
}

function expandHomeDirectory(input: string, homedir: () => string = os.homedir): string {
  if (input === "~") {
    return homedir();
  }

  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(homedir(), input.slice(2));
  }

  return input;
}

function resolvePathInput(input: string, baseDir: string, homedir: () => string = os.homedir): string {
  const expanded = expandHomeDirectory(input, homedir);
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(baseDir, expanded);
}

function resolveProfileAwareStateDir(profile: string | undefined, homedir: () => string): string {
  if (profile && profile.toLowerCase() !== "default") {
    return path.join(homedir(), `.openclaw-${profile}`);
  }

  return path.join(homedir(), DEFAULT_OPENCLAW_STATE_DIRNAME);
}

function resolveCanonicalConfigCandidates(runtimeRoot: string): string[] {
  return [
    path.join(runtimeRoot, "openclaw.json"),
    ...LEGACY_CONFIG_FILENAMES.map((fileName) => path.join(runtimeRoot, fileName)),
  ];
}

function selectConfigCandidate(candidates: string[]): string | undefined {
  const existing = candidates.find((candidate) => {
    try {
      return existsSync(candidate);
    } catch {
      return false;
    }
  });

  return existing ?? candidates[0];
}

function resolveDefaultWorkspacePath(profile: string | undefined, homedir: () => string): string {
  if (profile && profile.toLowerCase() !== "default") {
    return path.join(homedir(), DEFAULT_OPENCLAW_STATE_DIRNAME, `workspace-${profile}`);
  }

  return path.join(homedir(), DEFAULT_OPENCLAW_STATE_DIRNAME, "workspace");
}

function resolveRuntimeAgentWorkspacePath(agentId: string, homedir: () => string): string {
  return path.join(homedir(), DEFAULT_OPENCLAW_STATE_DIRNAME, `workspace-${agentId}`);
}

function resolveDefaultWorkspaceGlob(homedir: () => string): string {
  return path.join(homedir(), DEFAULT_OPENCLAW_STATE_DIRNAME, "workspace*");
}

function resolveDefaultConfiguredAgentId(rawAgentList: RawAgentConfig[]): string | undefined {
  const configuredDefault = rawAgentList.find(
    (agent) => typeof agent.id === "string" && agent.id.trim().length > 0 && agent.default === true,
  );

  if (configuredDefault?.id) {
    return configuredDefault.id;
  }

  return rawAgentList.find((agent) => typeof agent.id === "string" && agent.id.trim().length > 0)?.id;
}

function isPrimaryAgent(agentId: string, defaultAgentId: string | undefined): boolean {
  const normalizedAgentId = agentId.trim().toLowerCase();
  const normalizedDefaultId = defaultAgentId?.trim().toLowerCase();

  return normalizedAgentId === "main" || (normalizedDefaultId !== undefined && normalizedAgentId === normalizedDefaultId);
}

function resolveAgentWorkspacePath(input: {
  agentId: string;
  configuredWorkspace: string | undefined;
  defaultWorkspacePath: string | undefined;
  defaultAgentId: string | undefined;
  configBaseDir: string;
  homedir: () => string;
}): string | undefined {
  if (typeof input.configuredWorkspace === "string" && input.configuredWorkspace.trim().length > 0) {
    return resolvePathInput(input.configuredWorkspace, input.configBaseDir, input.homedir);
  }

  if (isPrimaryAgent(input.agentId, input.defaultAgentId)) {
    return input.defaultWorkspacePath;
  }

  return resolveRuntimeAgentWorkspacePath(input.agentId, input.homedir);
}

function interpolateAgentTemplate(template: string, agentId: string): string {
  return template.replaceAll("{agentId}", agentId).replaceAll("{{agentId}}", agentId);
}

function resolveAgentSessionStorePath(input: {
  configuredTemplate: string | undefined;
  agentId: string;
  configBaseDir: string;
  runtimeRoot: string | undefined;
  homedir: () => string;
}): string | undefined {
  if (typeof input.configuredTemplate === "string" && input.configuredTemplate.trim().length > 0) {
    return resolvePathInput(
      interpolateAgentTemplate(input.configuredTemplate, input.agentId),
      input.configBaseDir,
      input.homedir,
    );
  }

  if (input.runtimeRoot) {
    return path.join(input.runtimeRoot, "agents", input.agentId, "sessions", "sessions.json");
  }

  return undefined;
}

function resolveLegacyDefaultSessionStorePath(runtimeRoot: string | undefined): string | undefined {
  return runtimeRoot ? path.join(runtimeRoot, "sessions", "sessions.json") : undefined;
}

function toIsoDate(value: string | number | Date | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (isRecord(base) && isRecord(override)) {
    const merged: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(override)) {
      merged[key] = key in merged ? deepMerge(merged[key], value) : value;
    }

    return merged;
  }

  return override;
}

async function resolveConfigValue(
  value: unknown,
  currentFile: string,
  depth: number,
  seen: Set<string>,
  homedir: () => string,
): Promise<{ value: unknown; files: string[] }> {
  if (depth > 10) {
    throw new Error(`Config include depth exceeded while reading ${currentFile}`);
  }

  if (Array.isArray(value)) {
    const items: unknown[] = [];
    const files: string[] = [];

    for (const item of value) {
      const resolved = await resolveConfigValue(item, currentFile, depth + 1, seen, homedir);
      items.push(resolved.value);
      files.push(...resolved.files);
    }

    return {
      value: items,
      files,
    };
  }

  if (!isRecord(value)) {
    return {
      value,
      files: [],
    };
  }

  let baseValue: unknown = {};
  const files: string[] = [];

  if ("$include" in value) {
    const includeValue = value.$include;
    const includePaths = Array.isArray(includeValue) ? includeValue : [includeValue];
    let mergedInclude: unknown = {};
    let initialized = false;

    for (const includePath of includePaths) {
      if (typeof includePath !== "string") {
        throw new Error(`Config include in ${currentFile} must be a string or string array.`);
      }

      const absoluteIncludePath = resolvePathInput(includePath, path.dirname(currentFile), homedir);
      const loaded = await loadConfigFile(absoluteIncludePath, depth + 1, seen, homedir);
      files.push(...loaded.files);
      mergedInclude = initialized ? deepMerge(mergedInclude, loaded.data) : loaded.data;
      initialized = true;
    }

    baseValue = initialized ? mergedInclude : {};
  }

  const siblings: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    if (key === "$include") {
      continue;
    }

    const resolved = await resolveConfigValue(child, currentFile, depth + 1, seen, homedir);
    siblings[key] = resolved.value;
    files.push(...resolved.files);
  }

  return {
    value: "$include" in value ? deepMerge(baseValue, siblings) : siblings,
    files,
  };
}

async function loadConfigFile(
  filePath: string,
  depth = 0,
  seen = new Set<string>(),
  homedir: () => string = os.homedir,
): Promise<ParsedConfigResult> {
  const resolvedPath = path.resolve(filePath);

  if (seen.has(resolvedPath)) {
    throw new Error(`Circular config include detected at ${resolvedPath}`);
  }

  const nextSeen = new Set(seen);
  nextSeen.add(resolvedPath);

  const raw = await readFile(resolvedPath, "utf8");
  const parsed = JSON5.parse(raw) as unknown;
  const resolved = await resolveConfigValue(parsed, resolvedPath, depth, nextSeen, homedir);

  if (!isRecord(resolved.value)) {
    throw new Error(`Expected an object config at ${resolvedPath}`);
  }

  return {
    path: resolvedPath,
    data: resolved.value as RawOpenClawConfig,
    files: Array.from(new Set([resolvedPath, ...resolved.files])),
  };
}

function normalizeSecretInput(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseSecretRefLike(value: unknown, defaults?: RawSecretsDefaults): SecretRefLike | null {
  if (isRecord(value)) {
    const source = value.source;
    const provider = typeof value.provider === "string" && value.provider.trim().length > 0 ? value.provider.trim() : undefined;
    const id = typeof value.id === "string" && value.id.trim().length > 0 ? value.id.trim() : undefined;

    if ((source === "env" || source === "file" || source === "exec") && id) {
      return {
        source,
        provider:
          provider ??
          (source === "env"
            ? defaults?.env?.trim() || DEFAULT_SECRET_PROVIDER_ALIAS
            : source === "file"
              ? defaults?.file?.trim() || DEFAULT_SECRET_PROVIDER_ALIAS
              : defaults?.exec?.trim() || DEFAULT_SECRET_PROVIDER_ALIAS),
        id,
      };
    }
  }

  const template = typeof value === "string" ? ENV_SECRET_TEMPLATE_RE.exec(value.trim()) : null;

  if (!template) {
    return null;
  }

  return {
    source: "env",
    provider: defaults?.env?.trim() || DEFAULT_SECRET_PROVIDER_ALIAS,
    id: template[1] ?? "",
  };
}

async function loadDotEnvMap(dotEnvPath: string | undefined): Promise<Record<string, string>> {
  if (!dotEnvPath) {
    return {};
  }

  const dotEnvStat = await statIfExists(dotEnvPath);

  if (!dotEnvStat.exists || !dotEnvStat.isFile) {
    return {};
  }

  const raw = await readFile(dotEnvPath, "utf8");
  return parseDotEnvContents(raw);
}

function parseDotEnvContents(raw: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const separatorIndex = withoutExport.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, separatorIndex).trim();

    if (key.length === 0) {
      continue;
    }

    let value = withoutExport.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(" #");

      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trimEnd();
      }
    }

    values[key] = value;
  }

  return values;
}

async function buildGatewayResolutionEnv(runtimeRoot: string | undefined): Promise<Record<string, string>> {
  const runtimeEnv = await loadDotEnvMap(runtimeRoot ? path.join(runtimeRoot, ".env") : undefined);
  const cwdEnv = await loadDotEnvMap(path.join(process.cwd(), ".env"));
  const merged: Record<string, string> = {
    ...runtimeEnv,
    ...cwdEnv,
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      merged[key] = value;
    }
  }

  return merged;
}

function readJsonPointerValue(input: unknown, pointer: string): unknown {
  if (pointer === "") {
    return input;
  }

  if (!pointer.startsWith("/")) {
    return undefined;
  }

  let current: unknown = input;

  for (const rawSegment of pointer.slice(1).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);

      if (Number.isNaN(index)) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function formatSecretRefLabel(ref: SecretRefLike): string {
  return `${ref.source}:${ref.provider}:${ref.id}`;
}

function normalizeGatewayAuthMode(value: unknown): string | undefined {
  const normalized = normalizeSecretInput(value)?.toLowerCase();

  return normalized ? normalized : undefined;
}

async function resolveConfiguredGatewayToken(params: {
  config: RawOpenClawConfig;
  configBaseDir: string;
  runtimeRoot: string | undefined;
  homedir: () => string;
}): Promise<GatewayAuthResolution> {
  const warnings: SnapshotWarning[] = [];
  const env = await buildGatewayResolutionEnv(params.runtimeRoot);
  const authMode = normalizeGatewayAuthMode(params.config.gateway?.auth?.mode);

  if (authMode === "password") {
    warnings.push(
      warning(
        "OPENCLAW_GATEWAY_AUTH_PASSWORD_UNSUPPORTED",
        "warn",
        "Gateway auth mode is set to password. Team Ops Console can only auto-connect with token auth in read-only mode today.",
        "runtimeStatuses",
        GATEWAY_WS_SOURCE_ID,
      ),
    );

    return {
      token: undefined,
      warnings,
    };
  }

  const candidateValues = [
    {
      path: "gateway.auth.token",
      value: params.config.gateway?.auth?.token,
      fallbackLabel: undefined,
    },
    {
      path: "gateway.remote.token",
      value: params.config.gateway?.remote?.token,
      fallbackLabel: "remote gateway token fallback",
    },
  ];

  for (const candidate of candidateValues) {
    const resolved = await resolveSecretBackedGatewayValue({
      value: candidate.value,
      pathLabel: candidate.path,
      ...(candidate.fallbackLabel ? { fallbackLabel: candidate.fallbackLabel } : {}),
      ...(params.config.secrets?.defaults ? { defaults: params.config.secrets.defaults } : {}),
      ...(params.config.secrets?.providers ? { providers: params.config.secrets.providers } : {}),
      env,
      configBaseDir: params.configBaseDir,
      homedir: params.homedir,
    });

    warnings.push(...resolved.warnings);

    if (resolved.value) {
      return {
        token: resolved.value,
        warnings,
      };
    }
  }

  if (authMode === "token") {
    warnings.push(
      warning(
        "OPENCLAW_GATEWAY_AUTH_TOKEN_UNRESOLVED",
        "warn",
        "Gateway auth mode is token, but Team Ops Console could not resolve gateway.auth.token from openclaw.json or supported secret refs.",
        "runtimeStatuses",
        GATEWAY_WS_SOURCE_ID,
      ),
    );
  }

  return {
    token: undefined,
    warnings,
  };
}

async function resolveSecretBackedGatewayValue(params: {
  value: unknown;
  pathLabel: string;
  fallbackLabel?: string | undefined;
  defaults?: RawSecretsDefaults;
  providers?: RawSecretsProviders;
  env: Record<string, string>;
  configBaseDir: string;
  homedir: () => string;
}): Promise<{ value?: string; warnings: SnapshotWarning[] }> {
  const directValue = normalizeSecretInput(params.value);

  if (directValue) {
    const inlineRef = parseSecretRefLike(directValue, params.defaults);

    if (!inlineRef) {
      return {
        value: directValue,
        warnings: [],
      };
    }

    return resolveGatewaySecretRef({
      ref: inlineRef,
      pathLabel: params.pathLabel,
      ...(params.fallbackLabel ? { fallbackLabel: params.fallbackLabel } : {}),
      ...(params.providers ? { providers: params.providers } : {}),
      ...(params.defaults ? { defaults: params.defaults } : {}),
      env: params.env,
      configBaseDir: params.configBaseDir,
      homedir: params.homedir,
    });
  }

  const ref = parseSecretRefLike(params.value, params.defaults);

  if (!ref) {
    return {
      warnings: [],
    };
  }

  return resolveGatewaySecretRef({
    ref,
    pathLabel: params.pathLabel,
    ...(params.fallbackLabel ? { fallbackLabel: params.fallbackLabel } : {}),
    ...(params.providers ? { providers: params.providers } : {}),
    ...(params.defaults ? { defaults: params.defaults } : {}),
    env: params.env,
    configBaseDir: params.configBaseDir,
    homedir: params.homedir,
  });
}

async function resolveGatewaySecretRef(params: {
  ref: SecretRefLike;
  pathLabel: string;
  fallbackLabel?: string | undefined;
  providers?: RawSecretsProviders;
  defaults?: RawSecretsDefaults;
  env: Record<string, string>;
  configBaseDir: string;
  homedir: () => string;
}): Promise<{ value?: string; warnings: SnapshotWarning[] }> {
  if (params.ref.source === "env") {
    const envValue = params.env[params.ref.id]?.trim();

    if (envValue) {
      return {
        value: envValue,
        warnings: [],
      };
    }

    return {
      warnings: [
        warning(
          "OPENCLAW_GATEWAY_SECRET_REF_UNRESOLVED",
          "warn",
          `${params.pathLabel} points to ${formatSecretRefLabel(params.ref)}, but the environment variable is not available to the sidecar.`,
          "runtimeStatuses",
          GATEWAY_WS_SOURCE_ID,
        ),
      ],
    };
  }

  if (params.ref.source === "exec") {
    return {
      warnings: [
        warning(
          "OPENCLAW_GATEWAY_SECRET_REF_EXEC_UNSUPPORTED",
          "warn",
          `${params.pathLabel} uses ${formatSecretRefLabel(params.ref)}. Team Ops Console will not execute secret providers while auto-discovering gateway auth in read-only mode.`,
          "runtimeStatuses",
          GATEWAY_WS_SOURCE_ID,
        ),
      ],
    };
  }

  const providerName = params.ref.provider.trim() || params.defaults?.file?.trim() || DEFAULT_SECRET_PROVIDER_ALIAS;
  const provider = params.providers?.[providerName];

  if (!provider || provider.source !== "file" || typeof provider.path !== "string" || provider.path.trim().length === 0) {
    return {
      warnings: [
        warning(
          "OPENCLAW_GATEWAY_SECRET_PROVIDER_INVALID",
          "warn",
          `${params.pathLabel} references ${formatSecretRefLabel(params.ref)}, but the file secret provider "${providerName}" is missing or not configured as a readable file source.`,
          "runtimeStatuses",
          GATEWAY_WS_SOURCE_ID,
        ),
      ],
    };
  }

  const providerPathValue = normalizeSecretInput(provider.path);
  const providerPathRef = parseSecretRefLike(provider.path, params.defaults);
  let providerPath = providerPathValue;

  if (providerPathRef?.source === "env") {
    providerPath = params.env[providerPathRef.id]?.trim();
  }

  if (!providerPath) {
    return {
      warnings: [
        warning(
          "OPENCLAW_GATEWAY_SECRET_PROVIDER_PATH_UNRESOLVED",
          "warn",
          `${params.pathLabel} references ${formatSecretRefLabel(params.ref)}, but the provider path for "${providerName}" could not be resolved.`,
          "runtimeStatuses",
          GATEWAY_WS_SOURCE_ID,
        ),
      ],
    };
  }

  const secretFilePath = resolvePathInput(providerPath, params.configBaseDir, params.homedir);

  try {
    const raw = await readFile(secretFilePath, "utf8");
    const mode = normalizeSecretInput(provider.mode)?.toLowerCase();

    if (params.ref.id === "value" && mode !== "json") {
      const singleValue = raw.trim();
      return singleValue.length > 0
        ? {
            value: singleValue,
            warnings: [],
          }
        : {
            warnings: [
              warning(
                "OPENCLAW_GATEWAY_SECRET_FILE_EMPTY",
                "warn",
                `${params.pathLabel} resolved through ${formatSecretRefLabel(params.ref)}, but ${secretFilePath} was empty.`,
                "runtimeStatuses",
                GATEWAY_WS_SOURCE_ID,
              ),
            ],
          };
    }

    const parsed = JSON5.parse(raw) as unknown;
    const resolvedValue = readJsonPointerValue(parsed, params.ref.id);
    const normalized = normalizeSecretInput(resolvedValue);

    if (normalized) {
      return {
        value: normalized,
        warnings: [],
      };
    }

    return {
      warnings: [
        warning(
          "OPENCLAW_GATEWAY_SECRET_FILE_POINTER_UNRESOLVED",
          "warn",
          `${params.pathLabel} resolved through ${formatSecretRefLabel(params.ref)}, but ${params.ref.id} did not point to a non-empty string in ${secretFilePath}.`,
          "runtimeStatuses",
          GATEWAY_WS_SOURCE_ID,
        ),
      ],
    };
  } catch (error) {
    return {
      warnings: [
        warning(
          "OPENCLAW_GATEWAY_SECRET_FILE_READ_FAILED",
          "warn",
          `${params.pathLabel} references ${formatSecretRefLabel(params.ref)}, but the sidecar could not read ${secretFilePath}: ${error instanceof Error ? error.message : "unknown error"}`,
          "runtimeStatuses",
          GATEWAY_WS_SOURCE_ID,
        ),
      ],
    };
  }
}

async function statIfExists(targetPath: string | undefined) {
  if (!targetPath) {
    return {
      exists: false,
      isDirectory: false,
      isFile: false,
      stats: undefined,
    };
  }

  try {
    const result = await stat(targetPath);
    return {
      exists: true,
      isDirectory: result.isDirectory(),
      isFile: result.isFile(),
      stats: result,
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        exists: false,
        isDirectory: false,
        isFile: false,
        stats: undefined,
      };
    }

    throw error;
  }
}

async function listDirectoryNames(targetPath: string | undefined): Promise<string[]> {
  const target = await statIfExists(targetPath);

  if (!target.exists || !target.isDirectory) {
    return [];
  }

  const entries = await readdir(targetPath as string, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function parseJsonFile<T>(filePath: string): Promise<ParseResult<T>> {
  const fileStat = await statIfExists(filePath);

  if (!fileStat.exists || !fileStat.isFile) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const raw = await readFile(filePath, "utf8");
  return {
    data: JSON5.parse(raw) as T,
    stat: fileStat,
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";
}

function workspaceIdForPath(workspacePath: string): string {
  const basename = path.basename(workspacePath) || "workspace";
  const hash = createHash("sha1").update(workspacePath).digest("hex").slice(0, 8);
  return `ws-${slugify(basename)}-${hash}`;
}

function latestIsoDate(...values: Array<string | undefined>): string | undefined {
  const [latest] = values
    .map((value) => (value ? new Date(value) : undefined))
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());
  return latest ? latest.toISOString() : undefined;
}

function warning(
  code: string,
  severity: SnapshotWarning["severity"],
  message: string,
  collection?: CollectionName,
  sourceId?: string,
): SnapshotWarning {
  return {
    code,
    severity,
    message,
    ...(collection ? { collection } : {}),
    ...(sourceId ? { sourceId } : {}),
  };
}

function mapAuthProfileProvider(profile: Record<string, unknown>, profileId: string): AuthProfile["provider"] {
  const mode = typeof profile.mode === "string" ? profile.mode.toLowerCase() : "";
  const profileLabel = profileId.toLowerCase();

  if (mode.includes("oauth")) {
    return "oauth";
  }

  if (mode.includes("api") || profileLabel.includes("api")) {
    return "api-key";
  }

  if (mode.includes("cert")) {
    return "certificate";
  }

  return "token";
}

function mapAuthProfileStatus(
  profile: Record<string, unknown>,
  usageStats: Record<string, unknown> | undefined,
  nowMs: number,
): AuthProfileStatus {
  const expiresAt = toIsoDate(
    typeof profile.expiresAt === "string" || typeof profile.expiresAt === "number"
      ? profile.expiresAt
      : undefined,
  );
  const cooldownUntil = toIsoDate(
    typeof usageStats?.cooldownUntil === "string" || typeof usageStats?.cooldownUntil === "number"
      ? usageStats.cooldownUntil
      : undefined,
  );
  const disabledUntil = toIsoDate(
    typeof usageStats?.disabledUntil === "string" || typeof usageStats?.disabledUntil === "number"
      ? usageStats.disabledUntil
      : undefined,
  );

  if (disabledUntil && new Date(disabledUntil).getTime() > nowMs) {
    return "disabled";
  }

  if (expiresAt) {
    const expiresAtMs = new Date(expiresAt).getTime();

    if (expiresAtMs <= nowMs) {
      return "expired";
    }

    if (expiresAtMs - nowMs <= 7 * 24 * 60 * 60 * 1000) {
      return "expiring";
    }
  }

  if (cooldownUntil && new Date(cooldownUntil).getTime() > nowMs) {
    return "expiring";
  }

  return "valid";
}

function detectSessionChannel(sessionKey: string, entry: Record<string, unknown>): string {
  if (typeof entry.provider === "string" && entry.provider.trim().length > 0) {
    return entry.provider;
  }

  const parts = sessionKey.split(":");
  if (parts[0] === "agent" && parts.length >= 3) {
    return parts[2] ?? "unknown";
  }

  if (parts[0] === "cron") {
    return "cron";
  }

  if (parts[0] === "hook") {
    return "webhook";
  }

  return "unknown";
}

function detectSessionStatus(entry: Record<string, unknown>, nowMs: number): Session["status"] {
  const endedAt = toIsoDate(
    typeof entry.endedAt === "string" || typeof entry.endedAt === "number"
      ? entry.endedAt
      : typeof entry.closedAt === "string" || typeof entry.closedAt === "number"
        ? entry.closedAt
        : undefined,
  );

  if (endedAt) {
    return "ended";
  }

  const lastActivityAt = toIsoDate(
    typeof entry.updatedAt === "string" || typeof entry.updatedAt === "number"
      ? entry.updatedAt
      : typeof entry.lastActivityAt === "string" || typeof entry.lastActivityAt === "number"
        ? entry.lastActivityAt
        : undefined,
  );

  if (!lastActivityAt) {
    return "idle";
  }

  const lastActivityMs = new Date(lastActivityAt).getTime();
  return nowMs - lastActivityMs <= SESSION_ACTIVITY_WINDOW_MS ? "active" : "idle";
}

function bindingRouteType(binding: RawBindingConfig): BindingRoute["routeType"] {
  const match = isRecord(binding.match) ? binding.match : undefined;

  if (typeof match?.channel === "string") {
    return "channel";
  }

  if (typeof match?.path === "string") {
    return "webhook";
  }

  if (binding.type === "acp") {
    return "api";
  }

  return "channel";
}

function summarizeBindingSource(binding: RawBindingConfig): string {
  const match = isRecord(binding.match) ? binding.match : undefined;
  const parts: string[] = [];

  if (typeof match?.channel === "string") {
    parts.push(`channel:${match.channel}`);
  }

  if (typeof match?.accountId === "string") {
    parts.push(`account:${match.accountId === "*" ? "any" : match.accountId}`);
  }

  if (isRecord(match?.peer) && typeof match.peer.kind === "string") {
    parts.push(`peer:${match.peer.kind}`);
  }

  if (typeof match?.guildId === "string") {
    parts.push("guild");
  }

  if (typeof match?.teamId === "string") {
    parts.push("team");
  }

  if (typeof match?.path === "string") {
    parts.push("path");
  }

  if (parts.length === 0 && binding.type === "acp") {
    return "acp:persistent";
  }

  return parts.join(" ") || "config-binding";
}

function agentStatus(input: {
  workspaceStatus: EntityStatus | undefined;
  agentDirExists: boolean;
  authProfileCount: number;
  sessionCount: number;
}): EntityStatus {
  if (input.workspaceStatus === "offline" && !input.agentDirExists) {
    return "offline";
  }

  if (input.workspaceStatus === "healthy" && input.agentDirExists) {
    return "healthy";
  }

  if (input.authProfileCount > 0 || input.sessionCount > 0 || input.agentDirExists || input.workspaceStatus === "degraded") {
    return "degraded";
  }

  return "unknown";
}

function primaryAuthProfileId(profileIds: string[]): string | undefined {
  if (profileIds.length === 1) {
    return profileIds[0];
  }

  return profileIds.find((profileId) => profileId.endsWith(":default")) ?? profileIds[0];
}

function buildCollectionStatus(input: {
  hasSource: boolean;
  itemCount: number;
  allowEmptyComplete?: boolean;
  warnings: SnapshotWarning[];
}): CollectionMetadata["status"] {
  const hasMeaningfulWarning = input.warnings.some((entry) => entry.severity !== "info");

  if (input.itemCount === 0) {
    if (input.allowEmptyComplete && input.hasSource && !hasMeaningfulWarning) {
      return "complete";
    }

    return "unavailable";
  }

  return hasMeaningfulWarning ? "partial" : "complete";
}

function collectionFreshness(hasSource: boolean): CollectionMetadata["freshness"] {
  return hasSource ? "fresh" : "unknown";
}

function createGatewayCollectionStatus(
  key: SourceCollectionStatus["key"],
  collection: GatewayRuntimeLoadResult["collections"][keyof GatewayRuntimeLoadResult["collections"]],
  fetchedAt: string,
): SourceCollectionStatus {
  return {
    key,
    sourceKind: "gateway-ws",
    freshness: collection.freshness,
    coverage: collection.coverage,
    warningCount: collection.warningMessages.length,
    ...(collection.coverage !== "unavailable" ? { lastSuccessAt: fetchedAt } : {}),
  };
}

function createRuntimePlaneCollectionStatus(
  key: "presence" | "nodes",
  state: GatewayRuntimePlaneState,
  itemCount: number,
): SourceCollectionStatus {
  const connected = state.connectionState === "connected";
  const degraded = state.connectionState === "degraded";

  return {
    key,
    sourceKind: "gateway-ws",
    freshness: connected || degraded ? "fresh" : "unknown",
    coverage: connected ? "complete" : degraded ? "partial" : "unavailable",
    warningCount: state.warnings.length,
    ...(itemCount > 0 && state.lastSeenAt ? { lastSuccessAt: state.lastSeenAt } : {}),
  };
}

function deriveRuntimeSourceMode(input: {
  gatewayState: GatewayRuntimePlaneState;
  cronItems: CronJobSummaryDto[];
  filesystemDetected: boolean;
}): RuntimeStatusDto["sourceMode"] {
  if (input.gatewayState.connectionState === "connected" || input.gatewayState.connectionState === "degraded") {
    return input.filesystemDetected || input.cronItems.length > 0 ? "hybrid" : "gateway-ws";
  }

  return "filesystem";
}

function deriveOpenClawOverallState(input: {
  stateDirDetected: boolean;
  configDetected: boolean;
  logsDetected: boolean;
  gatewayState: GatewayRuntimePlaneState["connectionState"];
}): RuntimeStatusDto["openclaw"]["overall"] {
  const detectedCount = [input.stateDirDetected, input.configDetected, input.logsDetected].filter(Boolean).length;

  if (detectedCount === 0) {
    return input.gatewayState === "connected" || input.gatewayState === "degraded" ? "partial" : "unavailable";
  }

  if (detectedCount === 3) {
    return input.gatewayState === "disconnected" ? "degraded" : "healthy";
  }

  return detectedCount >= 2 ? "partial" : "degraded";
}

function mergeCronSummaries(
  filesystemItems: CronJobSummaryDto[],
  gatewayItems: CronJobSummaryDto[],
): CronJobSummaryDto[] {
  const merged = new Map<string, CronJobSummaryDto>();

  for (const item of filesystemItems) {
    merged.set(item.id, item);
  }

  for (const item of gatewayItems) {
    const existing = merged.get(item.id);

    if (!existing) {
      merged.set(item.id, item);
      continue;
    }

    merged.set(item.id, {
      ...existing,
      ...item,
      scheduleText: existing.scheduleText,
      ...(existing.sessionTarget ? { sessionTarget: existing.sessionTarget } : item.sessionTarget ? { sessionTarget: item.sessionTarget } : {}),
      ...(existing.deliveryMode ? { deliveryMode: existing.deliveryMode } : item.deliveryMode ? { deliveryMode: item.deliveryMode } : {}),
      evidenceRefs: dedupeCronEvidenceRefs([...existing.evidenceRefs, ...item.evidenceRefs]),
      source: "hybrid",
    });
  }

  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function mergeCronDetails(
  filesystemItem: CronJobDetailDto | undefined,
  gatewayItem: CronJobDetailDto | undefined,
): CronJobDetailDto | undefined {
  if (!filesystemItem) {
    return gatewayItem;
  }

  if (!gatewayItem) {
    return filesystemItem;
  }

  return {
    ...filesystemItem,
    ...gatewayItem,
    scheduleText: filesystemItem.scheduleText,
    warnings: dedupeStrings([...filesystemItem.warnings, ...gatewayItem.warnings]),
    evidenceRefs: dedupeCronEvidenceRefs([...filesystemItem.evidenceRefs, ...gatewayItem.evidenceRefs]),
    recentRuns: gatewayItem.recentRuns.length > 0 ? gatewayItem.recentRuns : filesystemItem.recentRuns,
    source: "hybrid",
  };
}

function dedupeCronEvidenceRefs(values: Array<CronJobSummaryDto["evidenceRefs"][number]>): CronJobSummaryDto["evidenceRefs"] {
  const seen = new Set<string>();
  const result: CronJobSummaryDto["evidenceRefs"] = [];

  for (const value of values) {
    const key = `${value.kind}:${value.value}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function deriveCronSource(items: CronJobSummaryDto[]): RuntimeStatusDto["cron"]["source"] {
  const sources = new Set(items.map((item) => item.source));

  if (sources.has("hybrid")) {
    return "hybrid";
  }

  if (sources.has("filesystem") && sources.has("gateway")) {
    return "hybrid";
  }

  if (sources.has("gateway")) {
    return "gateway";
  }

  if (sources.has("filesystem")) {
    return "filesystem";
  }

  if (sources.has("mock")) {
    return "mock";
  }

  return "unavailable";
}

async function scanWorkspaceDirectories(pattern: string): Promise<string[]> {
  const matches: string[] = [];

  for await (const match of glob(pattern)) {
    matches.push(path.resolve(match));
  }

  const directories: string[] = [];

  for (const match of matches) {
    const matchStat = await statIfExists(match);

    if (matchStat.exists && matchStat.isDirectory) {
      directories.push(path.resolve(match));
    }
  }

  return Array.from(new Set(directories));
}

async function inspectWorkspace(
  workspacePath: string,
  linkedAgentNames: string[],
): Promise<WorkspaceScanResult> {
  const workspaceStat = await statIfExists(workspacePath);
  const basename = path.basename(workspacePath) || workspacePath;
  const workspaceId = workspaceIdForPath(workspacePath);

  if (!workspaceStat.exists || !workspaceStat.isDirectory) {
    return {
      path: workspacePath,
      keyFileCount: 0,
      optionalDirectoryCount: 0,
      workspace: {
        id: workspaceId,
        name:
          basename === "workspace" && linkedAgentNames.length === 1
            ? `${linkedAgentNames[0]} Workspace`
            : basename,
        status: "offline",
      },
    };
  }

  let keyFileCount = 0;
  let optionalDirectoryCount = 0;
  let latestMtime = toIsoDate(workspaceStat.stats?.mtime);
  const coreMarkdownFiles: string[] = [];

  for (const bootstrapFile of WORKSPACE_BOOTSTRAP_FILES) {
    const fileStat = await statIfExists(path.join(workspacePath, bootstrapFile));

    if (fileStat.exists && fileStat.isFile) {
      keyFileCount += 1;
      coreMarkdownFiles.push(bootstrapFile);
      latestMtime = latestIsoDate(latestMtime, toIsoDate(fileStat.stats?.mtime));
    }
  }

  for (const optionalDirectory of WORKSPACE_OPTIONAL_DIRECTORIES) {
    const directoryStat = await statIfExists(path.join(workspacePath, optionalDirectory));

    if (directoryStat.exists && directoryStat.isDirectory) {
      optionalDirectoryCount += 1;
      latestMtime = latestIsoDate(latestMtime, toIsoDate(directoryStat.stats?.mtime));
    }
  }

  const createdAt = toIsoDate(workspaceStat.stats?.birthtime);
  const name =
    basename === "workspace"
      ? linkedAgentNames.length > 1
        ? "Shared Workspace"
        : linkedAgentNames.length === 1
          ? `${linkedAgentNames[0]} Workspace`
          : "workspace"
      : basename;

  return {
    path: workspacePath,
    keyFileCount,
    optionalDirectoryCount,
    workspace: {
      id: workspaceId,
      name,
      status: keyFileCount > 0 || optionalDirectoryCount > 0 ? "healthy" : "degraded",
      ...(coreMarkdownFiles.length > 0 ? { coreMarkdownFiles } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(latestMtime ? { updatedAt: latestMtime } : {}),
    },
  };
}

export class FilesystemOpenClawAdapter implements SidecarInventoryAdapter {
  public readonly adapterName = "FilesystemOpenClawAdapter";
  public readonly source = "openclaw" as const;
  public readonly mode = "external-readonly" as const;
  public readonly capabilities = {
    supportsCollectionMetadata: true,
    supportsPartialData: true,
    supportsDegradedSnapshots: true,
    supportsScenarioSelection: false,
    supportsSourceDescriptors: true,
  };

  private readonly runtimeRootInput: string | undefined;
  private readonly stateDirInput: string | undefined;
  private readonly configFileInput: string | undefined;
  private readonly configPathInput: string | undefined;
  private readonly workspaceGlobInput: string | undefined;
  private readonly logGlobInput: string | undefined;
  private readonly gatewayUrlInput: string | undefined;
  private readonly gatewayTokenInput: string | undefined;
  private readonly sourceRootInput: string | undefined;
  private readonly profileInput: string | undefined;
  private readonly clock: FilesystemOpenClawAdapterClock;
  private readonly homedir: () => string;
  private readonly gatewayTimeoutMs: number;
  private readonly gatewayClientFactory: (options: {
    url: string;
    timeoutMs: number;
    clock: GatewayClock;
    authToken?: string;
  }) => GatewayRuntimeClient;
  private gatewayRuntimeCache: GatewayRuntimeCacheEntry | undefined;
  private gatewayRuntimeLoadPromise: Promise<GatewayRuntimeLoadResult> | undefined;
  private gatewayRuntimePlaneCache: GatewayRuntimePlaneCacheEntry | undefined;

  constructor(options: FilesystemOpenClawAdapterOptions = {}) {
    this.runtimeRootInput = normalizeInput(options.runtimeRoot);
    this.stateDirInput = normalizeInput(options.stateDir);
    this.configFileInput = normalizeInput(options.configFile);
    this.configPathInput = normalizeInput(options.configPath);
    this.workspaceGlobInput = normalizeInput(options.workspaceGlob);
    this.logGlobInput = normalizeInput(options.logGlob);
    this.gatewayUrlInput = normalizeInput(options.gatewayUrl);
    this.gatewayTokenInput = normalizeInput(options.gatewayToken);
    this.sourceRootInput = normalizeInput(options.sourceRoot);
    this.profileInput = normalizeProfile(options.profile);
    this.clock = options.clock ?? { now: () => new Date() };
    this.homedir = options.homedir ?? os.homedir;
    this.gatewayTimeoutMs = options.gatewayTimeoutMs ?? 5000;
    this.gatewayClientFactory =
      options.gatewayClientFactory ??
      ((gatewayOptions) =>
        new GatewayWsRuntimeClient({
          url: gatewayOptions.url,
          timeoutMs: gatewayOptions.timeoutMs,
          clock: gatewayOptions.clock,
          ...(gatewayOptions.authToken ? { authToken: gatewayOptions.authToken } : {}),
        }));
  }

  async describeSources(): Promise<AdapterSourceDescriptor[]> {
    const resolved = this.resolvePaths();
    const sources: AdapterSourceDescriptor[] = [];

    if (resolved.runtimeRoot) {
      sources.push({
        id: RUNTIME_SOURCE_ID,
        displayName: "OpenClaw runtime root",
        kind: "filesystem",
        readOnly: true,
        confidence: "confirmed",
        location: resolved.runtimeRoot,
        notes: "Read-only state root used for runtime inventory, sessions, and per-agent auth profile files.",
      });
    }

    if (resolved.configFile) {
      sources.push({
        id: CONFIG_SOURCE_ID,
        displayName: "OpenClaw config file",
        kind: "filesystem",
        readOnly: true,
        confidence: "confirmed",
        location: resolved.configFile,
        notes: "JSON5 runtime configuration loaded directly from disk without importing OpenClaw modules.",
      });
    }

    if (resolved.workspaceGlob) {
      sources.push({
        id: WORKSPACE_SOURCE_ID,
        displayName: "Workspace directory scan",
        kind: "filesystem",
        readOnly: true,
        confidence: "confirmed",
        location: resolved.workspaceGlob,
        notes: "Workspace directories discovered with a read-only glob scan.",
      });
    }

    if (resolved.logGlob) {
      sources.push({
        id: LOG_SOURCE_ID,
        displayName: "OpenClaw log glob",
        kind: "filesystem",
        readOnly: true,
        confidence: "confirmed",
        location: resolved.logGlob,
        notes: "Read-only log discovery using an explicit glob override.",
      });
    }

    if (resolved.gatewayUrl) {
      sources.push({
        id: GATEWAY_WS_SOURCE_ID,
        displayName: "OpenClaw Gateway WebSocket",
        kind: "websocket",
        readOnly: true,
        confidence: "confirmed",
        location: resolved.gatewayUrl,
        notes:
          "Read-only Gateway WebSocket runtime collection using role=operator and scopes=[operator.read] only. Gateway auth token is auto-discovered from openclaw.json when available.",
      });
    }

    if (resolved.sourceRoot) {
      sources.push({
        id: SOURCE_ROOT_SOURCE_ID,
        displayName: "OpenClaw source root (informational only)",
        kind: "filesystem",
        readOnly: true,
        confidence: "confirmed",
        location: resolved.sourceRoot,
        notes: "Informational only. The sidecar does not import or execute OpenClaw source from this path.",
      });
    }

    return sources;
  }

  async fetchSnapshot(): Promise<SystemSnapshot> {
    const generatedAt = this.clock.now().toISOString();
    const nowMs = new Date(generatedAt).getTime();
    const resolved = this.resolvePaths();
    const sourceDescriptors = await this.describeSources();
    const warnings: SnapshotWarning[] = [];
    const collectionWarnings: Record<CollectionName, SnapshotWarning[]> = {
      agents: [],
      workspaces: [],
      sessions: [],
      bindings: [],
      authProfiles: [],
      runtimeStatuses: [],
      topology: [],
    };
    const addWarning = (entry: SnapshotWarning) => {
      warnings.push(entry);
      if (entry.collection) {
        collectionWarnings[entry.collection].push(entry);
      }
    };

    addWarning(
      warning(
        "FILESYSTEM_ADAPTER_ACTIVE",
        "info",
        "Sidecar is reading OpenClaw runtime data from local filesystem paths in read-only mode.",
        "runtimeStatuses",
        CONFIG_SOURCE_ID,
      ),
    );

    const runtimeRootStat = await statIfExists(resolved.runtimeRoot);
    const sourceRootStat = await statIfExists(resolved.sourceRoot);
    let parsedConfig: ParsedConfigResult | undefined;

    if (resolved.runtimeRoot && !runtimeRootStat.exists) {
      addWarning(
        warning(
          "OPENCLAW_RUNTIME_ROOT_MISSING",
          "warn",
          `Configured runtime root does not exist: ${resolved.runtimeRoot}`,
          "runtimeStatuses",
          RUNTIME_SOURCE_ID,
        ),
      );
    }

    if (resolved.configFile) {
      try {
        parsedConfig = await loadConfigFile(resolved.configFile, 0, new Set<string>(), this.homedir);
      } catch (error) {
        const code =
          isNodeError(error) && error.code === "ENOENT"
            ? "OPENCLAW_CONFIG_FILE_MISSING"
            : "OPENCLAW_CONFIG_PARSE_FAILED";
        const message =
          isNodeError(error) && error.code === "ENOENT"
            ? `Configured config file does not exist: ${resolved.configFile}`
            : `Failed to parse OpenClaw config file ${resolved.configFile}: ${error instanceof Error ? error.message : "unknown error"}`;
        addWarning(warning(code, "warn", message, "agents", CONFIG_SOURCE_ID));
        addWarning(warning(code, "warn", message, "workspaces", CONFIG_SOURCE_ID));
        addWarning(warning(code, "warn", message, "bindings", CONFIG_SOURCE_ID));
        addWarning(warning(code, "warn", message, "runtimeStatuses", CONFIG_SOURCE_ID));
      }
    }

    const configBaseDir = parsedConfig ? path.dirname(parsedConfig.path) : resolved.configBaseDir;
    const rawAgentList = Array.isArray(parsedConfig?.data.agents?.list)
      ? parsedConfig?.data.agents?.list.filter(isRecord).map((entry) => entry as RawAgentConfig)
      : [];
    const defaultAgentId = resolveDefaultConfiguredAgentId(rawAgentList);
    const defaultWorkspacePath =
      typeof parsedConfig?.data.agents?.defaults?.workspace === "string"
        ? resolvePathInput(parsedConfig.data.agents.defaults.workspace, configBaseDir, this.homedir)
        : resolveDefaultWorkspacePath(resolved.profile, this.homedir);
    const configuredSessionStoreTemplate =
      typeof parsedConfig?.data.session?.store === "string" ? parsedConfig.data.session.store : undefined;
    const rawBindings = Array.isArray(parsedConfig?.data.bindings)
      ? parsedConfig.data.bindings.filter(isRecord).map((entry) => entry as RawBindingConfig)
      : [];
    const logDiscovery = await discoverLogFiles({
      configFile: resolved.configFile,
      configBaseDir,
      logGlob: resolved.logGlob,
      now: this.clock.now(),
    });

    for (const logWarning of logDiscovery.warnings) {
      warnings.push(logWarning);
    }

    const runtimeAgentIds = runtimeRootStat.exists
      ? await listDirectoryNames(resolved.runtimeRoot ? path.join(resolved.runtimeRoot, "agents") : undefined)
      : [];

    const agentDefinitions = new Map<string, AgentDefinition>();
    const workspacePathToAgents = new Map<string, string[]>();

    for (const rawAgent of rawAgentList) {
      if (typeof rawAgent.id !== "string" || rawAgent.id.trim().length === 0) {
        addWarning(
          warning(
            "OPENCLAW_AGENT_ID_MISSING",
            "warn",
            "Skipped an agent entry in config because it does not define a valid id.",
            "agents",
            CONFIG_SOURCE_ID,
          ),
        );
        continue;
      }

      const workspacePath =
        resolveAgentWorkspacePath({
          agentId: rawAgent.id,
          configuredWorkspace: rawAgent.workspace,
          defaultWorkspacePath,
          defaultAgentId,
          configBaseDir,
          homedir: this.homedir,
        });
      const agentDirPath =
        typeof rawAgent.agentDir === "string"
          ? resolvePathInput(rawAgent.agentDir, configBaseDir, this.homedir)
          : resolved.runtimeRoot
            ? path.join(resolved.runtimeRoot, "agents", rawAgent.id, "agent")
            : undefined;
      const sessionStorePath = resolveAgentSessionStorePath({
        configuredTemplate: configuredSessionStoreTemplate,
        agentId: rawAgent.id,
        configBaseDir,
        runtimeRoot: resolved.runtimeRoot,
        homedir: this.homedir,
      });
      const sessionStoreCandidatePaths = sessionStorePath ? [sessionStorePath] : [];
      const legacySessionStorePath =
        isPrimaryAgent(rawAgent.id, defaultAgentId) && resolved.runtimeRoot
          ? resolveLegacyDefaultSessionStorePath(resolved.runtimeRoot)
          : undefined;

      if (legacySessionStorePath && legacySessionStorePath !== sessionStorePath) {
        sessionStoreCandidatePaths.push(legacySessionStorePath);
      }

      agentDefinitions.set(rawAgent.id, {
        id: rawAgent.id,
        rawConfig: rawAgent,
        workspacePath,
        agentDirPath,
        sessionStorePath,
        sessionStoreCandidatePaths,
        resolvedSessionStorePath: undefined,
        authProfilesPath: agentDirPath ? path.join(agentDirPath, "auth-profiles.json") : undefined,
        sessionCount: 0,
        lastSessionActivityAt: undefined,
        primaryAuthProfileId: undefined,
        authProfileIds: [],
        authProfileUpdatedAt: undefined,
        agentDirExists: false,
        sessionStoreExists: false,
      });

      if (workspacePath) {
        workspacePathToAgents.set(workspacePath, [...(workspacePathToAgents.get(workspacePath) ?? []), rawAgent.id]);
      }
    }

    for (const runtimeAgentId of runtimeAgentIds) {
      if (agentDefinitions.has(runtimeAgentId)) {
        continue;
      }

      const agentDirPath = resolved.runtimeRoot
        ? path.join(resolved.runtimeRoot, "agents", runtimeAgentId, "agent")
        : undefined;
      const workspacePath = resolveAgentWorkspacePath({
        agentId: runtimeAgentId,
        configuredWorkspace: undefined,
        defaultWorkspacePath,
        defaultAgentId,
        configBaseDir,
        homedir: this.homedir,
      });
      const sessionStorePath = resolveAgentSessionStorePath({
        configuredTemplate: configuredSessionStoreTemplate,
        agentId: runtimeAgentId,
        configBaseDir,
        runtimeRoot: resolved.runtimeRoot,
        homedir: this.homedir,
      });
      const sessionStoreCandidatePaths = sessionStorePath ? [sessionStorePath] : [];
      const legacySessionStorePath =
        isPrimaryAgent(runtimeAgentId, defaultAgentId) && resolved.runtimeRoot
          ? resolveLegacyDefaultSessionStorePath(resolved.runtimeRoot)
          : undefined;

      if (legacySessionStorePath && legacySessionStorePath !== sessionStorePath) {
        sessionStoreCandidatePaths.push(legacySessionStorePath);
      }

      agentDefinitions.set(runtimeAgentId, {
        id: runtimeAgentId,
        rawConfig: undefined,
        workspacePath,
        agentDirPath,
        sessionStorePath,
        sessionStoreCandidatePaths,
        resolvedSessionStorePath: undefined,
        authProfilesPath: agentDirPath ? path.join(agentDirPath, "auth-profiles.json") : undefined,
        sessionCount: 0,
        lastSessionActivityAt: undefined,
        primaryAuthProfileId: undefined,
        authProfileIds: [],
        authProfileUpdatedAt: undefined,
        agentDirExists: false,
        sessionStoreExists: false,
      });

      if (workspacePath) {
        workspacePathToAgents.set(workspacePath, [...(workspacePathToAgents.get(workspacePath) ?? []), runtimeAgentId]);
      }
    }

    const workspacePaths = new Set<string>();

    if (defaultWorkspacePath) {
      workspacePaths.add(defaultWorkspacePath);
    }

    for (const agentDefinition of agentDefinitions.values()) {
      if (agentDefinition.workspacePath) {
        workspacePaths.add(agentDefinition.workspacePath);
      }
    }

    let globMatches: string[] = [];

    if (resolved.workspaceGlob) {
      globMatches = await scanWorkspaceDirectories(resolved.workspaceGlob);

      if (globMatches.length === 0) {
        addWarning(
          warning(
            "OPENCLAW_WORKSPACE_GLOB_NO_MATCHES",
            "warn",
            `Workspace glob did not match any directories: ${resolved.workspaceGlob}`,
            "workspaces",
            WORKSPACE_SOURCE_ID,
          ),
        );
      }
    }

    for (const match of globMatches) {
      workspacePaths.add(match);
    }

    if (workspacePaths.size === 0) {
      const defaultRuntimeWorkspace = resolveDefaultWorkspacePath(resolved.profile, this.homedir);
      const defaultRuntimeWorkspaceStat = await statIfExists(defaultRuntimeWorkspace);

      if (defaultRuntimeWorkspaceStat.exists && defaultRuntimeWorkspaceStat.isDirectory) {
        workspacePaths.add(defaultRuntimeWorkspace);
      }
    }

    const workspaceByPath = new Map<string, Workspace>();
    const workspaces: Workspace[] = [];
    let totalWorkspaceKeyFiles = 0;
    let totalWorkspaceOptionalDirectories = 0;

    for (const workspacePath of Array.from(workspacePaths).sort()) {
      const linkedAgentNames = (workspacePathToAgents.get(workspacePath) ?? [])
        .map((agentId) => agentDefinitions.get(agentId)?.rawConfig?.name ?? agentId);
      const scan = await inspectWorkspace(workspacePath, linkedAgentNames);
      workspaceByPath.set(workspacePath, scan.workspace);
      workspaces.push(scan.workspace);
      totalWorkspaceKeyFiles += scan.keyFileCount;
      totalWorkspaceOptionalDirectories += scan.optionalDirectoryCount;

      if (scan.workspace.status === "offline") {
        addWarning(
          warning(
            "OPENCLAW_WORKSPACE_DIRECTORY_MISSING",
            "warn",
            `Workspace directory does not exist: ${workspacePath}`,
            "workspaces",
            WORKSPACE_SOURCE_ID,
          ),
        );
      } else if (scan.workspace.status === "degraded") {
        addWarning(
          warning(
            "OPENCLAW_WORKSPACE_BOOTSTRAP_INCOMPLETE",
            "info",
            `Workspace directory is present but missing common bootstrap or inventory files: ${workspacePath}`,
            "workspaces",
            WORKSPACE_SOURCE_ID,
          ),
        );
      }
    }

    const authProfiles: AuthProfile[] = [];
    const filesystemSessions: Session[] = [];

    for (const agentDefinition of agentDefinitions.values()) {
      const agentDirStat = await statIfExists(agentDefinition.agentDirPath);
      agentDefinition.agentDirExists = agentDirStat.exists && agentDirStat.isDirectory;

      if (agentDefinition.agentDirPath && !agentDefinition.agentDirExists) {
        addWarning(
          warning(
            "OPENCLAW_AGENT_DIR_MISSING",
            "warn",
            `Agent directory does not exist for ${agentDefinition.id}: ${agentDefinition.agentDirPath}`,
            "agents",
            RUNTIME_SOURCE_ID,
          ),
        );
      }

      if (agentDefinition.authProfilesPath) {
        const authProfilesStat = await statIfExists(agentDefinition.authProfilesPath);

        if (authProfilesStat.exists && authProfilesStat.isFile) {
          try {
            const parsed = await parseJsonFile<Record<string, unknown>>(agentDefinition.authProfilesPath);
            const profiles = isRecord(parsed.data.profiles) ? parsed.data.profiles : {};
            const usageStats = isRecord(parsed.data.usageStats) ? parsed.data.usageStats : {};

            for (const [profileId, profileValue] of Object.entries(profiles)) {
              if (!isRecord(profileValue)) {
                continue;
              }

              const usage = isRecord(usageStats[profileId]) ? usageStats[profileId] : undefined;
              const workspaceId = agentDefinition.workspacePath
                ? workspaceByPath.get(agentDefinition.workspacePath)?.id
                : undefined;
              const scopedAuthProfileId = `auth:${agentDefinition.id}:${profileId}`;
              const expiresAt = toIsoDate(
                typeof profileValue.expiresAt === "string" || typeof profileValue.expiresAt === "number"
                  ? profileValue.expiresAt
                  : undefined,
              );
              const lastUsedAt = toIsoDate(
                typeof usage?.lastUsed === "number" || typeof usage?.lastUsed === "string"
                  ? usage.lastUsed
                  : undefined,
              );
              const createdAt = toIsoDate(parsed.stat.stats?.birthtime);
              const updatedAt = toIsoDate(parsed.stat.stats?.mtime);

              authProfiles.push({
                id: scopedAuthProfileId,
                name: profileId,
                provider: mapAuthProfileProvider(profileValue, profileId),
                status: mapAuthProfileStatus(profileValue, usage, nowMs),
                ...(workspaceId ? { workspaceIds: [workspaceId] } : {}),
                ...(expiresAt ? { expiresAt } : {}),
                ...(lastUsedAt ? { lastUsedAt } : {}),
                ...(createdAt ? { createdAt } : {}),
                ...(updatedAt ? { updatedAt } : {}),
              });

              agentDefinition.authProfileIds.push(scopedAuthProfileId);
              agentDefinition.authProfileUpdatedAt = latestIsoDate(
                agentDefinition.authProfileUpdatedAt,
                toIsoDate(parsed.stat.stats?.mtime),
              );
            }
          } catch (error) {
            addWarning(
              warning(
                "OPENCLAW_AUTH_PROFILES_PARSE_FAILED",
                "warn",
                `Failed to parse auth profile file for ${agentDefinition.id}: ${error instanceof Error ? error.message : "unknown error"}`,
                "authProfiles",
                RUNTIME_SOURCE_ID,
              ),
            );
          }
        } else if (agentDefinition.agentDirExists) {
          addWarning(
            warning(
              "OPENCLAW_AUTH_PROFILES_FILE_MISSING",
              "warn",
              `Auth profile file is missing for ${agentDefinition.id}: ${agentDefinition.authProfilesPath}`,
              "authProfiles",
              RUNTIME_SOURCE_ID,
            ),
          );
        }
      }

      agentDefinition.primaryAuthProfileId = primaryAuthProfileId(agentDefinition.authProfileIds);

      if (agentDefinition.sessionStoreCandidatePaths.length > 0) {
        let resolvedSessionStorePath = agentDefinition.sessionStorePath;
        let sessionStoreStat = await statIfExists(resolvedSessionStorePath);

        if (!sessionStoreStat.exists || !sessionStoreStat.isFile) {
          for (const candidatePath of agentDefinition.sessionStoreCandidatePaths) {
            const candidateStat = await statIfExists(candidatePath);

            if (candidateStat.exists && candidateStat.isFile) {
              resolvedSessionStorePath = candidatePath;
              sessionStoreStat = candidateStat;
              break;
            }
          }
        }

        agentDefinition.resolvedSessionStorePath = resolvedSessionStorePath;
        agentDefinition.sessionStoreExists = sessionStoreStat.exists && sessionStoreStat.isFile;

        if (
          agentDefinition.sessionStoreExists &&
          resolvedSessionStorePath &&
          agentDefinition.sessionStorePath &&
          resolvedSessionStorePath !== agentDefinition.sessionStorePath
        ) {
          addWarning(
            warning(
              "OPENCLAW_SESSION_STORE_LEGACY_PATH_USED",
              "info",
              `Using legacy session store path for ${agentDefinition.id}: ${resolvedSessionStorePath}`,
              "sessions",
              RUNTIME_SOURCE_ID,
            ),
          );
        }

        if (agentDefinition.sessionStoreExists) {
          try {
            const parsed = await parseJsonFile<Record<string, unknown>>(resolvedSessionStorePath as string);

            if (isRecord(parsed.data)) {
              for (const [sessionKey, sessionValue] of Object.entries(parsed.data)) {
                if (!isRecord(sessionValue)) {
                  continue;
                }

                const sessionId =
                  typeof sessionValue.sessionId === "string" && sessionValue.sessionId.trim().length > 0
                    ? sessionValue.sessionId
                    : sessionKey;
                const workspaceId = agentDefinition.workspacePath
                  ? workspaceByPath.get(agentDefinition.workspacePath)?.id
                  : undefined;
                const lastActivityAt = toIsoDate(
                  typeof sessionValue.updatedAt === "string" || typeof sessionValue.updatedAt === "number"
                    ? sessionValue.updatedAt
                    : typeof sessionValue.lastActivityAt === "string" ||
                        typeof sessionValue.lastActivityAt === "number"
                      ? sessionValue.lastActivityAt
                      : undefined,
                );
                const startedAt = toIsoDate(
                  typeof sessionValue.startedAt === "string" || typeof sessionValue.startedAt === "number"
                    ? sessionValue.startedAt
                    : typeof sessionValue.createdAt === "string" || typeof sessionValue.createdAt === "number"
                      ? sessionValue.createdAt
                      : undefined,
                );

                filesystemSessions.push({
                  id: `session:${agentDefinition.id}:${sessionId}`,
                  ...(workspaceId ? { workspaceId } : {}),
                  agentId: agentDefinition.id,
                  status: detectSessionStatus(sessionValue, nowMs),
                  channel: detectSessionChannel(sessionKey, sessionValue),
                  ...(startedAt ? { startedAt } : {}),
                  ...(lastActivityAt ? { lastActivityAt } : {}),
                });

                agentDefinition.sessionCount += 1;
                agentDefinition.lastSessionActivityAt = latestIsoDate(
                  agentDefinition.lastSessionActivityAt,
                  lastActivityAt,
                );
              }
            }
          } catch (error) {
            addWarning(
              warning(
                "OPENCLAW_SESSION_STORE_PARSE_FAILED",
                "warn",
                `Failed to parse session store for ${agentDefinition.id}: ${error instanceof Error ? error.message : "unknown error"}`,
                "sessions",
                RUNTIME_SOURCE_ID,
              ),
            );
          }
        } else if (resolved.runtimeRoot && runtimeRootStat.exists) {
          addWarning(
            warning(
              "OPENCLAW_SESSION_STORE_MISSING",
              "warn",
              `Session store is missing for ${agentDefinition.id}: ${agentDefinition.sessionStorePath}`,
              "sessions",
              RUNTIME_SOURCE_ID,
            ),
          );
        }
      }
    }

    const gatewayRuntime = await this.loadGatewayRuntime(resolved, parsedConfig);

    for (const gatewayWarning of gatewayRuntime.warnings) {
      addWarning(gatewayWarning);
    }

    const useGatewayRuntimeSessions =
      gatewayRuntime.connected && gatewayRuntime.collections.sessions.coverage !== "unavailable";
    const sessions: Session[] = useGatewayRuntimeSessions
      ? gatewayRuntime.collections.sessions.items.map((session) => {
          if (session.workspaceId || !session.agentId) {
            return session;
          }

          const workspacePath = agentDefinitions.get(session.agentId)?.workspacePath;
          const workspaceId = workspacePath ? workspaceByPath.get(workspacePath)?.id : undefined;
          return workspaceId ? { ...session, workspaceId } : session;
        })
      : filesystemSessions;
    const sessionStatsByAgent = new Map<string, { count: number; lastActivityAt?: string }>();

    for (const session of sessions) {
      if (!session.agentId) {
        continue;
      }

      const existing = sessionStatsByAgent.get(session.agentId);

      sessionStatsByAgent.set(session.agentId, {
        count: (existing?.count ?? 0) + 1,
        ...(latestIsoDate(existing?.lastActivityAt, session.lastActivityAt)
          ? { lastActivityAt: latestIsoDate(existing?.lastActivityAt, session.lastActivityAt) as string }
          : {}),
      });
    }

    const agents: Agent[] = Array.from(agentDefinitions.values()).map((agentDefinition) => {
      const workspace = agentDefinition.workspacePath ? workspaceByPath.get(agentDefinition.workspacePath) : undefined;
      const sessionStats = sessionStatsByAgent.get(agentDefinition.id);
      const name = agentDefinition.rawConfig?.name ?? agentDefinition.id;
      const agentUpdatedAt = latestIsoDate(
        workspace?.updatedAt,
        sessionStats?.lastActivityAt ?? agentDefinition.lastSessionActivityAt,
        agentDefinition.authProfileUpdatedAt,
      );
      const tags = [
        agentDefinition.rawConfig?.default === true ? "default" : undefined,
        agentDefinition.rawConfig ? "config-defined" : "runtime-discovered",
      ].filter((entry): entry is string => typeof entry === "string");

      return {
        id: agentDefinition.id,
        name,
        role: agentDefinition.rawConfig?.default === true ? "coordinator" : "worker",
        status: agentStatus({
          workspaceStatus: workspace?.status,
          agentDirExists: agentDefinition.agentDirExists,
          authProfileCount: agentDefinition.authProfileIds.length,
          sessionCount: sessionStats?.count ?? agentDefinition.sessionCount,
        }),
        ...(workspace ? { workspaceId: workspace.id } : {}),
        ...(agentDefinition.primaryAuthProfileId ? { authProfileId: agentDefinition.primaryAuthProfileId } : {}),
        ...(tags.length > 0 ? { tags } : {}),
        ...(agentUpdatedAt ? { updatedAt: agentUpdatedAt } : {}),
      };
    });

    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const bindings: BindingRoute[] = rawBindings.map((binding, index) => {
      const targetAgent = typeof binding.agentId === "string" ? agentById.get(binding.agentId) : undefined;
      const workspaceId = targetAgent?.workspaceId;
      const bindingId = `binding:${binding.agentId ?? "unknown"}:${index + 1}`;

      if (!targetAgent) {
        addWarning(
          warning(
            "OPENCLAW_BINDING_TARGET_MISSING",
            "warn",
            `Binding ${bindingId} references an agent that was not discovered in the current snapshot.`,
            "bindings",
            CONFIG_SOURCE_ID,
          ),
        );
      }

      return {
        id: bindingId,
        ...(workspaceId ? { workspaceId } : {}),
        routeType: bindingRouteType(binding),
        source: summarizeBindingSource(binding),
        ...(targetAgent ? { targetAgentId: targetAgent.id } : {}),
        status: targetAgent ? "active" : "error",
        description: typeof binding.type === "string" ? `Config binding (${binding.type})` : "Config binding",
      };
    });

    const collections: Record<CollectionName, CollectionMetadata> = {
      agents: createCollectionMetadata({
        collection: "agents",
        status: buildCollectionStatus({
          hasSource: Boolean(parsedConfig) || runtimeAgentIds.length > 0 || Boolean(resolved.runtimeRoot),
          itemCount: agents.length,
          warnings: collectionWarnings.agents,
        }),
        freshness: collectionFreshness(Boolean(parsedConfig) || Boolean(resolved.runtimeRoot)),
        collectedAt: generatedAt,
        recordCount: agents.length,
        sourceIds: Array.from(
          new Set([
            ...(parsedConfig ? [CONFIG_SOURCE_ID] : []),
            ...(resolved.runtimeRoot ? [RUNTIME_SOURCE_ID] : []),
          ]),
        ),
        warnings: collectionWarnings.agents,
      }),
      workspaces: createCollectionMetadata({
        collection: "workspaces",
        status: buildCollectionStatus({
          hasSource: workspacePaths.size > 0 || Boolean(resolved.workspaceGlob) || Boolean(defaultWorkspacePath),
          itemCount: workspaces.length,
          warnings: collectionWarnings.workspaces,
        }),
        freshness: collectionFreshness(workspacePaths.size > 0 || Boolean(resolved.workspaceGlob) || Boolean(defaultWorkspacePath)),
        collectedAt: generatedAt,
        recordCount: workspaces.length,
        sourceIds: Array.from(
          new Set([
            ...(defaultWorkspacePath || Array.from(agentDefinitions.values()).some((agent) => agent.workspacePath)
              ? [CONFIG_SOURCE_ID]
              : []),
            ...(resolved.workspaceGlob ? [WORKSPACE_SOURCE_ID] : []),
          ]),
        ),
        warnings: collectionWarnings.workspaces,
      }),
      sessions: createCollectionMetadata({
        collection: "sessions",
        status: useGatewayRuntimeSessions
          ? gatewayRuntime.collections.sessions.coverage
          : buildCollectionStatus({
              hasSource: Boolean(resolved.runtimeRoot),
              itemCount: sessions.length,
              warnings: collectionWarnings.sessions,
              allowEmptyComplete: runtimeRootStat.exists && runtimeAgentIds.length === 0 && agents.length === 0,
            }),
        freshness: useGatewayRuntimeSessions
          ? gatewayRuntime.collections.sessions.freshness
          : collectionFreshness(Boolean(resolved.runtimeRoot)),
        collectedAt: generatedAt,
        recordCount: sessions.length,
        sourceIds: useGatewayRuntimeSessions ? [GATEWAY_WS_SOURCE_ID] : resolved.runtimeRoot ? [RUNTIME_SOURCE_ID] : [],
        warnings: collectionWarnings.sessions,
      }),
      bindings: createCollectionMetadata({
        collection: "bindings",
        status: buildCollectionStatus({
          hasSource: Boolean(parsedConfig),
          itemCount: bindings.length,
          warnings: collectionWarnings.bindings,
          allowEmptyComplete: Boolean(parsedConfig),
        }),
        freshness: collectionFreshness(Boolean(parsedConfig)),
        collectedAt: generatedAt,
        recordCount: bindings.length,
        sourceIds: parsedConfig ? [CONFIG_SOURCE_ID] : [],
        warnings: collectionWarnings.bindings,
      }),
      authProfiles: createCollectionMetadata({
        collection: "authProfiles",
        status: buildCollectionStatus({
          hasSource: Boolean(resolved.runtimeRoot),
          itemCount: authProfiles.length,
          warnings: collectionWarnings.authProfiles,
          allowEmptyComplete: runtimeRootStat.exists && runtimeAgentIds.length === 0 && agents.length === 0,
        }),
        freshness: collectionFreshness(Boolean(resolved.runtimeRoot)),
        collectedAt: generatedAt,
        recordCount: authProfiles.length,
        sourceIds: resolved.runtimeRoot ? [RUNTIME_SOURCE_ID] : [],
        warnings: collectionWarnings.authProfiles,
      }),
      runtimeStatuses: createCollectionMetadata({
        collection: "runtimeStatuses",
        status: warnings.some((entry) => entry.severity !== "info") ? "partial" : "complete",
        freshness: "fresh",
        collectedAt: generatedAt,
        recordCount: 0,
        sourceIds: sourceDescriptors.map((descriptor) => descriptor.id),
        warnings: collectionWarnings.runtimeStatuses,
      }),
      topology: createCollectionMetadata({
        collection: "topology",
        status: "unavailable",
        freshness: "unknown",
        collectedAt: generatedAt,
        recordCount: 0,
        sourceIds: [],
        warnings: collectionWarnings.topology,
      }),
    };
    const gatewayCollections = gatewayRuntime.collections;
    const gatewayCollectionList = [
      gatewayCollections.presence,
      gatewayCollections.nodes,
      gatewayCollections.sessions,
      gatewayCollections.tools,
      gatewayCollections.plugins,
    ];
    const gatewayDependencyStatus =
      !resolved.gatewayUrl
        ? "unknown"
        : !gatewayRuntime.connected
          ? "offline"
          : gatewayCollectionList.some((collection) => collection.coverage !== "complete")
            ? "degraded"
            : "healthy";

    const runtimeStatuses: RuntimeStatus[] = [
      {
        componentId: "filesystem-adapter",
        componentType: "adapter",
        status: warnings.some((entry) => entry.severity !== "info") ? "degraded" : "healthy",
        observedAt: generatedAt,
        details: {
          mode: "read-only",
          source: "filesystem",
          mockFallbackActive: false,
          discoveredAgents: agents.length,
          discoveredWorkspaces: workspaces.length,
        },
      },
      {
        componentId: "openclaw-runtime-root",
        componentType: "dependency",
        status: !resolved.runtimeRoot
          ? "unknown"
          : runtimeRootStat.exists && runtimeRootStat.isDirectory
            ? "healthy"
            : "offline",
        observedAt: generatedAt,
        details: {
          path: resolved.runtimeRoot ?? null,
          configured: Boolean(resolved.runtimeRoot),
          exists: runtimeRootStat.exists,
          agentsDirectoryCount: runtimeAgentIds.length,
        },
      },
      {
        componentId: "openclaw-config-file",
        componentType: "dependency",
        status: !resolved.configFile
          ? "unknown"
          : parsedConfig
            ? "healthy"
            : "offline",
        observedAt: generatedAt,
        details: {
          path: resolved.configFile ?? null,
          configured: Boolean(resolved.configFile),
          parsed: Boolean(parsedConfig),
          includeFileCount: parsedConfig ? Math.max(parsedConfig.files.length - 1, 0) : 0,
          configuredAgents: rawAgentList.length,
          configuredBindings: rawBindings.length,
        },
      },
      {
        componentId: "openclaw-workspace-scan",
        componentType: "dependency",
        status:
          workspaces.length === 0
            ? "offline"
            : workspaces.some((workspace) => workspace.status !== "healthy")
              ? "degraded"
              : "healthy",
        observedAt: generatedAt,
        details: {
          pattern: resolved.workspaceGlob ?? null,
          configReferencedWorkspaces: Array.from(workspacePathToAgents.keys()).length,
          globMatchedDirectories: globMatches.length,
          discoveredWorkspaces: workspaces.length,
          bootstrapFilesObserved: totalWorkspaceKeyFiles,
          optionalDirectoriesObserved: totalWorkspaceOptionalDirectories,
        },
      },
      {
        componentId: "openclaw-session-scan",
        componentType: "dependency",
        status: useGatewayRuntimeSessions
          ? gatewayRuntime.collections.sessions.coverage === "complete"
            ? "healthy"
            : gatewayRuntime.collections.sessions.coverage === "partial"
              ? "degraded"
              : "offline"
          : sessions.length > 0
            ? "healthy"
            : resolved.runtimeRoot
              ? "degraded"
              : "unknown",
        observedAt: generatedAt,
        details: {
          runtimeRootConfigured: Boolean(resolved.runtimeRoot),
          runtimeSource: useGatewayRuntimeSessions ? "gateway-ws" : "filesystem",
          discoveredSessions: sessions.length,
          activeSessions: sessions.filter((session) => session.status === "active").length,
        },
      },
      {
        componentId: "openclaw-auth-profile-scan",
        componentType: "dependency",
        status: authProfiles.length > 0 ? "healthy" : resolved.runtimeRoot ? "degraded" : "unknown",
        observedAt: generatedAt,
        details: {
          runtimeRootConfigured: Boolean(resolved.runtimeRoot),
          discoveredAuthProfiles: authProfiles.length,
          healthyAuthProfiles: authProfiles.filter((profile) => profile.status === "valid").length,
        },
      },
      {
        componentId: "openclaw-log-scan",
        componentType: "dependency",
        status:
          logDiscovery.collectionStatus.coverage === "complete"
            ? "healthy"
            : logDiscovery.collectionStatus.coverage === "partial"
              ? "degraded"
              : "offline",
        observedAt: generatedAt,
        details: {
          configuredGlob: resolved.logGlob ?? null,
          discoveredLogFiles: logDiscovery.items.length,
          latestLogPath: logDiscovery.items[0]?.path ?? null,
          latestLogModifiedAt: logDiscovery.items[0]?.modifiedAt ?? null,
        },
      },
      {
        componentId: "openclaw-gateway-ws",
        componentType: "dependency",
        status: gatewayDependencyStatus,
        observedAt: generatedAt,
        details: {
          url: resolved.gatewayUrl ?? null,
          configured: Boolean(resolved.gatewayUrl),
          connected: gatewayRuntime.connected,
          role: "operator",
          scopes: "operator.read",
          presenceCount: gatewayCollections.presence.items.length,
          nodeCount: gatewayCollections.nodes.items.length,
          runtimeSessionCount: gatewayCollections.sessions.items.length,
          toolCount: gatewayCollections.tools.items.length,
          pluginCount: gatewayCollections.plugins.items.length,
        },
      },
      ...(resolved.sourceRoot
        ? [
      {
        componentId: "openclaw-source-root",
        componentType: "dependency" as const,
        status: sourceRootStat.exists && sourceRootStat.isDirectory ? ("healthy" as const) : ("offline" as const),
        observedAt: generatedAt,
        details: {
          path: resolved.sourceRoot,
          configured: true,
          exists: sourceRootStat.exists,
          informationalOnly: true,
        },
      },
          ]
        : []),
    ];

    collections.runtimeStatuses = createCollectionMetadata({
      collection: "runtimeStatuses",
      status: warnings.some((entry) => entry.severity !== "info") ? "partial" : "complete",
      freshness: "fresh",
      collectedAt: generatedAt,
      recordCount: runtimeStatuses.length,
      sourceIds: sourceDescriptors.map((descriptor) => descriptor.id),
      warnings: collectionWarnings.runtimeStatuses,
    });

    const topology = buildTopologyView({
      generatedAt,
      agents,
      workspaces,
      sessions,
      bindings,
      authProfiles,
    });
    collections.topology = createCollectionMetadata({
      collection: "topology",
      status:
        topology.nodes.length === 0
          ? "unavailable"
          : [collections.agents, collections.workspaces, collections.sessions, collections.bindings, collections.authProfiles].some(
                (metadata) => metadata.status !== "complete",
              )
            ? "partial"
            : "complete",
      freshness: topology.nodes.length > 0 ? "fresh" : "unknown",
      collectedAt: generatedAt,
      recordCount: topology.nodes.length,
      sourceIds: Array.from(
        new Set([
          ...(collections.agents.sourceIds ?? []),
          ...(collections.workspaces.sourceIds ?? []),
          ...(collections.sessions.sourceIds ?? []),
          ...(collections.bindings.sourceIds ?? []),
          ...(collections.authProfiles.sourceIds ?? []),
        ]),
      ),
      warnings: collectionWarnings.topology,
    });

    const summary = buildInventorySummary({
      generatedAt,
      agents,
      workspaces,
      sessions,
      bindings,
      authProfiles,
      runtimeStatuses,
    });

    return {
      source: "openclaw",
      generatedAt,
      origin: {
        adapterName: this.adapterName,
        mode: this.mode,
        collectedAt: generatedAt,
        sources: sourceDescriptors,
      },
      collections,
      sourceRegistry: buildSourceRegistry({
        source: "openclaw",
        generatedAt,
        origin: {
          adapterName: this.adapterName,
          mode: this.mode,
          collectedAt: generatedAt,
          sources: sourceDescriptors,
        },
        collections,
        warnings,
      }, [
        logDiscovery.collectionStatus,
        await this.discoverCronConfig(resolved),
        ...(gatewayRuntime.configured
          ? [
              createGatewayCollectionStatus("presence", gatewayCollections.presence, gatewayRuntime.fetchedAt),
              ...(useGatewayRuntimeSessions
                ? [createGatewayCollectionStatus("sessions", gatewayCollections.sessions, gatewayRuntime.fetchedAt)]
                : []),
              createGatewayCollectionStatus("nodes", gatewayCollections.nodes, gatewayRuntime.fetchedAt),
              createGatewayCollectionStatus("tools", gatewayCollections.tools, gatewayRuntime.fetchedAt),
              createGatewayCollectionStatus("plugins", gatewayCollections.plugins, gatewayRuntime.fetchedAt),
            ]
          : []),
      ]),
      warnings,
      agents,
      workspaces,
      sessions,
      bindings,
      authProfiles,
      runtimeStatuses,
      summary,
      topology,
    };
  }

  async getWorkspaceDocument(workspaceId: string, fileName: string): Promise<WorkspaceDocument | undefined> {
    const normalizedFileName = fileName.trim();

    if (
      normalizedFileName.length === 0 ||
      path.basename(normalizedFileName) !== normalizedFileName ||
      !isWorkspaceBootstrapFileName(normalizedFileName)
    ) {
      return undefined;
    }

    const workspacePath = await this.findWorkspacePathById(workspaceId);

    if (!workspacePath) {
      return undefined;
    }

    const documentPath = path.join(workspacePath, normalizedFileName);
    const documentStat = await statIfExists(documentPath);

    if (!documentStat.exists || !documentStat.isFile) {
      return undefined;
    }

    const document: WorkspaceDocument = {
      workspaceId,
      fileName: normalizedFileName,
      contentType: "text/markdown",
      content: await readFile(documentPath, "utf8"),
      sourcePath: documentPath,
    };

    const updatedAt = toIsoDate(documentStat.stats?.mtime);

    if (updatedAt) {
      document.updatedAt = updatedAt;
    }

    return document;
  }

  async getLogFiles(): Promise<AdapterLogFilesResult> {
    const resolved = this.resolvePaths();

    return discoverLogFiles({
      configFile: resolved.configFile,
      configBaseDir: resolved.configBaseDir,
      logGlob: resolved.logGlob,
      now: this.clock.now(),
    });
  }

  async getLogSummary(date?: string): Promise<AdapterLogSummaryResult> {
    const filesResult = await this.getLogFiles();
    const fallbackDate = date ?? filesResult.items[0]?.date ?? this.clock.now().toISOString().slice(0, 10);
    const file = selectLogFile(filesResult.items, date);

    if (!file) {
      return {
        collectionStatus: filesResult.collectionStatus,
        ...withOptionalWarnings(filesResult.warnings),
        item: buildLogSummary(fallbackDate, []),
      };
    }

    try {
      const { lines } = await readLogFile(file);
      const entries = lines.map((line, index) => parseLogLine(line, index + 1));
      const summary = buildLogSummary(file.date, entries, file);

      return {
        collectionStatus: deriveParsedLogStatus(filesResult.collectionStatus, entries),
        ...withOptionalWarnings(filesResult.warnings),
        item: summary,
      };
    } catch (error) {
      const warning = buildLogReadWarning(file.path, error);

      return {
        collectionStatus: {
          ...filesResult.collectionStatus,
          coverage: "partial",
          warningCount: filesResult.collectionStatus.warningCount + 1,
        },
        warnings: [...(filesResult.warnings ?? []), warning],
        item: buildLogSummary(file.date, [], file),
      };
    }
  }

  async getLogEntries(query: LogEntriesQuery): Promise<AdapterLogEntriesResult> {
    const filesResult = await this.getLogFiles();
    const limit = normalizeLogLimit(query.limit);
    const fallbackDate = query.date ?? filesResult.items[0]?.date ?? this.clock.now().toISOString().slice(0, 10);
    const file = selectLogFile(filesResult.items, query.date);
    const cursor = typeof query.cursor === "string" && query.cursor.trim().length > 0 ? query.cursor : undefined;

    if (!file) {
      return {
        collectionStatus: filesResult.collectionStatus,
        ...withOptionalWarnings(filesResult.warnings),
        item: {
          date: fallbackDate,
          items: [],
          total: 0,
          limit,
          ...(cursor ? { cursor } : {}),
          availableLevels: [],
          availableSubsystems: [],
          availableTags: [],
        },
      };
    }

    try {
      const { lines } = await readLogFile(file);
      const entries = lines.map((line, index) => parseLogLine(line, index + 1));
      const availableLevels = Array.from(new Set(entries.map((entry) => entry.level))).sort();
      const availableSubsystems = Array.from(
        new Set(entries.map((entry) => entry.subsystem).filter((value): value is string => Boolean(value))),
      ).sort();
      const availableTags = Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort();
      const filtered = filterLogEntries(entries, query);
      const startIndex = cursor
        ? clampCursor(cursor, filtered.length, limit)
        : tailLogFile(filtered, limit).startIndex;
      const pageItems = filtered.slice(startIndex, startIndex + limit);
      const previousCursor = startIndex > 0 ? String(Math.max(0, startIndex - limit)) : undefined;
      const nextCursor = startIndex + limit < filtered.length ? String(startIndex + limit) : undefined;

      return {
        collectionStatus: deriveParsedLogStatus(filesResult.collectionStatus, entries),
        ...withOptionalWarnings(filesResult.warnings),
        item: {
          date: file.date,
          file,
          items: pageItems,
          total: filtered.length,
          limit,
          ...(cursor ? { cursor } : {}),
          ...(nextCursor ? { nextCursor } : {}),
          ...(previousCursor ? { previousCursor } : {}),
          availableLevels,
          availableSubsystems,
          availableTags,
        },
      };
    } catch (error) {
      const warning = buildLogReadWarning(file.path, error);

      return {
        collectionStatus: {
          ...filesResult.collectionStatus,
          coverage: "partial",
          warningCount: filesResult.collectionStatus.warningCount + 1,
        },
        warnings: [...(filesResult.warnings ?? []), warning],
        item: {
          date: file.date,
          file,
          items: [],
          total: 0,
          limit,
          ...(cursor ? { cursor } : {}),
          availableLevels: [],
          availableSubsystems: [],
          availableTags: [],
        },
      };
    }
  }

  async getLogRawFile(date?: string): Promise<AdapterLogRawFileResult> {
    const filesResult = await this.getLogFiles();
    const file = selectLogFile(filesResult.items, date);

    if (!file) {
      return {
        collectionStatus: filesResult.collectionStatus,
        ...withOptionalWarnings(filesResult.warnings),
      };
    }

    try {
      const { content, lines } = await readLogFile(file);

      return {
        collectionStatus: filesResult.collectionStatus,
        ...withOptionalWarnings(filesResult.warnings),
        item: {
          date: file.date,
          path: file.path,
          content,
          lineCount: lines.length,
          sizeBytes: file.sizeBytes,
          truncated: false,
        },
      };
    } catch (error) {
      const warning = buildLogReadWarning(file.path, error);

      return {
        collectionStatus: {
          ...filesResult.collectionStatus,
          coverage: "partial",
          warningCount: filesResult.collectionStatus.warningCount + 1,
        },
        warnings: [...(filesResult.warnings ?? []), warning],
      };
    }
  }

  async getPresence(): Promise<AdapterPresenceResult> {
    const runtimePlane = await this.loadGatewayRuntimePlaneState();
    const gatewayRuntime = await this.loadGatewayRuntime(this.resolvePaths());

    if (runtimePlane.state.presence.length === 0 && gatewayRuntime.connected && gatewayRuntime.collections.presence.items.length > 0) {
      return {
        items: gatewayRuntime.collections.presence.items,
        collectionStatus: createGatewayCollectionStatus(
          "presence",
          gatewayRuntime.collections.presence,
          gatewayRuntime.fetchedAt,
        ),
        ...withOptionalWarnings(gatewayRuntime.warnings),
      };
    }

    return {
      items: runtimePlane.state.presence,
      collectionStatus: createRuntimePlaneCollectionStatus(
        "presence",
        runtimePlane.state,
        runtimePlane.state.presence.length,
      ),
      ...withOptionalWarnings(runtimePlane.warnings),
    };
  }

  async getNodes(): Promise<AdapterNodesResult> {
    const runtimePlane = await this.loadGatewayRuntimePlaneState();
    const gatewayRuntime = await this.loadGatewayRuntime(this.resolvePaths());

    if (runtimePlane.state.nodes.length === 0 && gatewayRuntime.connected && gatewayRuntime.collections.nodes.items.length > 0) {
      return {
        items: gatewayRuntime.collections.nodes.items.map((node) => normalizeLegacyGatewayNode(node)),
        collectionStatus: createGatewayCollectionStatus(
          "nodes",
          gatewayRuntime.collections.nodes,
          gatewayRuntime.fetchedAt,
        ),
        ...withOptionalWarnings(gatewayRuntime.warnings),
      };
    }

    return {
      items: runtimePlane.state.nodes,
      collectionStatus: createRuntimePlaneCollectionStatus(
        "nodes",
        runtimePlane.state,
        runtimePlane.state.nodes.length,
      ),
      ...withOptionalWarnings(runtimePlane.warnings),
    };
  }

  async getTools(): Promise<AdapterToolsResult> {
    const gatewayRuntime = await this.loadGatewayRuntime(this.resolvePaths());

    return {
      items: gatewayRuntime.collections.tools.items,
      collectionStatus: gatewayRuntime.configured
        ? createGatewayCollectionStatus("tools", gatewayRuntime.collections.tools, gatewayRuntime.fetchedAt)
        : {
            key: "tools",
            sourceKind: "gateway-ws",
            freshness: "unknown",
            coverage: "unavailable",
            warningCount: 0,
          },
      ...withOptionalWarnings(gatewayRuntime.warnings),
    };
  }

  async getPlugins(): Promise<AdapterPluginsResult> {
    const gatewayRuntime = await this.loadGatewayRuntime(this.resolvePaths());

    return {
      items: gatewayRuntime.collections.plugins.items,
      collectionStatus: gatewayRuntime.configured
        ? createGatewayCollectionStatus("plugins", gatewayRuntime.collections.plugins, gatewayRuntime.fetchedAt)
        : {
            key: "plugins",
            sourceKind: "gateway-ws",
            freshness: "unknown",
            coverage: "unavailable",
            warningCount: 0,
          },
      ...withOptionalWarnings(gatewayRuntime.warnings),
    };
  }

  async getRuntimeStatus(): Promise<AdapterRuntimeStatusResult> {
    const resolved = this.resolvePaths();
    const [runtimePlane, cronSnapshot, logFiles] = await Promise.all([
      this.loadGatewayRuntimePlaneState(),
      buildCronSnapshot(resolved.runtimeRoot, this.clock.now()),
      discoverLogFiles({
        configFile: resolved.configFile,
        configBaseDir: resolved.configBaseDir,
        logGlob: resolved.logGlob,
        now: this.clock.now(),
      }),
    ]);
    const mergedCronJobs = mergeCronSummaries(cronSnapshot.items, runtimePlane.state.cronJobs);
    const stateDirStat = resolved.runtimeRoot ? await statIfExists(resolved.runtimeRoot) : { exists: false, isDirectory: false, modifiedAt: undefined };
    const configDetected = Boolean(
      resolved.configFile &&
        (await statIfExists(resolved.configFile)).exists,
    );
    const connectedNodes = runtimePlane.state.nodes.filter((node) => node.connected).length;
    const pairedNodes = runtimePlane.state.nodes.filter((node) => node.paired).length;
    const staleNodes = runtimePlane.state.nodes.filter((node) => node.paired && !node.connected).length;
    const failingCron = mergedCronJobs.filter((job) => job.lastRunState === "error").length;
    const cronLastSyncAt = latestIsoDate(cronSnapshot.lastSyncAt, runtimePlane.state.lastSeenAt);
    const runtimeStatus: RuntimeStatusDto = {
      sourceMode: deriveRuntimeSourceMode({
        gatewayState: runtimePlane.state,
        cronItems: mergedCronJobs,
        filesystemDetected: stateDirStat.exists || configDetected || logFiles.items.length > 0,
      }),
      snapshotAt: this.clock.now().toISOString(),
      gateway: {
        configured: runtimePlane.state.configured,
        authResolved: runtimePlane.state.authResolved,
        ...(resolved.gatewayUrl ? { url: resolved.gatewayUrl } : {}),
        connectionState: runtimePlane.state.connectionState,
        ...(typeof runtimePlane.state.rpcHealthy === "boolean" ? { rpcHealthy: runtimePlane.state.rpcHealthy } : {}),
        ...(runtimePlane.state.identity ? { identity: runtimePlane.state.identity } : {}),
        ...(runtimePlane.state.lastSeenAt ? { lastSeenAt: runtimePlane.state.lastSeenAt } : {}),
        warnings: runtimePlane.state.warnings,
      },
      openclaw: {
        overall: deriveOpenClawOverallState({
          stateDirDetected: stateDirStat.exists && stateDirStat.isDirectory,
          configDetected,
          logsDetected: logFiles.items.length > 0,
          gatewayState: runtimePlane.state.connectionState,
        }),
        stateDirDetected: stateDirStat.exists && stateDirStat.isDirectory,
        configDetected,
        logsDetected: logFiles.items.length > 0,
      },
      nodes: {
        paired: pairedNodes,
        connected: connectedNodes,
        stale: staleNodes,
        source:
          runtimePlane.state.nodes.length > 0
            ? "gateway"
            : runtimePlane.state.configured
              ? "unavailable"
              : "unavailable",
        ...(runtimePlane.state.lastSeenAt ? { lastSyncAt: runtimePlane.state.lastSeenAt } : {}),
      },
      cron: {
        total: mergedCronJobs.length,
        enabled: mergedCronJobs.filter((job) => job.enabled).length,
        overdue: mergedCronJobs.filter((job) => job.overdue).length,
        failing: failingCron,
        source: deriveCronSource(mergedCronJobs),
        ...(cronLastSyncAt ? { lastSyncAt: cronLastSyncAt } : {}),
      },
      presence: {
        onlineDevices: runtimePlane.state.presence.filter((entry) => entry.online).length,
        onlineOperators: runtimePlane.state.presence.filter((entry) => entry.online && entry.roles.includes("operator")).length,
        ...(runtimePlane.state.lastSeenAt ? { lastSyncAt: runtimePlane.state.lastSeenAt } : {}),
      },
    };

    return {
      item: runtimeStatus,
      collectionStatus: {
        key: "runtimeStatuses",
        sourceKind: runtimeStatus.sourceMode === "mock" ? "mock" : runtimeStatus.sourceMode === "gateway-ws" ? "gateway-ws" : "filesystem",
        freshness: runtimePlane.state.connectionState === "connected" ? "fresh" : "unknown",
        coverage: runtimePlane.state.connectionState === "degraded" ? "partial" : runtimePlane.state.connectionState === "connected" ? "complete" : "unavailable",
        warningCount: runtimePlane.warnings.length + cronSnapshot.warnings.length,
      },
      warnings: [
        ...runtimePlane.warnings,
        ...cronSnapshot.warnings.map((entry) =>
          warning("OPENCLAW_RUNTIME_PLANE_WARNING", "warn", entry, "runtimeStatuses", GATEWAY_WS_SOURCE_ID),
        ),
      ],
    };
  }

  async getCronJobs(): Promise<AdapterCronJobsResult> {
    const resolved = this.resolvePaths();
    const [snapshot, runtimePlane] = await Promise.all([
      buildCronSnapshot(resolved.runtimeRoot, this.clock.now()),
      this.loadGatewayRuntimePlaneState(),
    ]);
    const items = mergeCronSummaries(snapshot.items, runtimePlane.state.cronJobs);
    const warnings = [...runtimePlane.warnings, ...snapshot.warnings.map((message) => warning("OPENCLAW_CRON_READ_WARNING", "warn", message, undefined, RUNTIME_SOURCE_ID))];

    return {
      items,
      collectionStatus: snapshot.collectionStatus,
      warnings,
    };
  }

  async getCronJobById(id: string): Promise<AdapterCronJobResult> {
    const resolved = this.resolvePaths();
    const [snapshot, runtimePlane] = await Promise.all([
      buildCronSnapshot(resolved.runtimeRoot, this.clock.now()),
      this.loadGatewayRuntimePlaneState(),
    ]);
    const filesystemItem = snapshot.detailsById.get(id);
    let gatewayItem: CronJobDetailDto | undefined;

    if (runtimePlane.state.connectionState === "connected" || runtimePlane.state.connectionState === "degraded") {
      gatewayItem = await this.gatewayRuntimePlaneCache?.cache.getCronJobById(id);
    }

    const item = mergeCronDetails(filesystemItem, gatewayItem);
    const warnings = [...runtimePlane.warnings, ...snapshot.warnings.map((message) => warning("OPENCLAW_CRON_READ_WARNING", "warn", message, undefined, RUNTIME_SOURCE_ID))];

    return {
      item,
      collectionStatus: snapshot.collectionStatus,
      warnings,
    };
  }

  async healthCheck(): Promise<AdapterHealth> {
    const snapshot = await this.fetchSnapshot();
    const degraded = Object.values(snapshot.collections).some((collection) => collection.status !== "complete");

    return {
      name: this.adapterName,
      status: degraded ? "degraded" : "ok",
      observedAt: snapshot.generatedAt,
      details: `agents=${snapshot.agents.length} workspaces=${snapshot.workspaces.length} sessions=${snapshot.sessions.length} source=${snapshot.source}`,
      warnings: snapshot.warnings,
    };
  }

  private async discoverCronConfig(
    resolved: ResolvedFilesystemPaths,
  ): Promise<SourceCollectionStatus> {
    const cronDir = resolved.runtimeRoot ? path.join(resolved.runtimeRoot, "cron") : undefined;

    if (!cronDir) {
      return {
        key: "cron",
        sourceKind: "filesystem",
        freshness: "unknown",
        coverage: "unavailable",
        warningCount: 0,
      };
    }

    try {
      const stats = await stat(cronDir);
      if (stats.isDirectory()) {
        const files = await readdir(cronDir);
        const hasConfig = files.some(
          (f) => f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml"),
        );
        if (hasConfig) {
          return {
            key: "cron",
            sourceKind: "filesystem",
            freshness: "fresh",
            coverage: "complete",
            warningCount: 0,
          };
        }
      }
    } catch {
      // ignore
    }

    return {
      key: "cron",
      sourceKind: "filesystem",
      freshness: "unknown",
      coverage: "unavailable",
      warningCount: 0,
    };
  }

  private async loadGatewayRuntime(
    resolved: ResolvedFilesystemPaths,
    parsedConfig?: ParsedConfigResult,
  ): Promise<GatewayRuntimeLoadResult> {
    if (!resolved.gatewayUrl) {
      return {
        configured: false,
        connected: false,
        fetchedAt: this.clock.now().toISOString(),
        warnings: [],
        collections: {
          presence: {
            items: [],
            freshness: "unknown",
            coverage: "unavailable",
            warningMessages: [],
          },
          nodes: {
            items: [],
            freshness: "unknown",
            coverage: "unavailable",
            warningMessages: [],
          },
          sessions: {
            items: [],
            freshness: "unknown",
            coverage: "unavailable",
            warningMessages: [],
          },
          tools: {
            items: [],
            freshness: "unknown",
            coverage: "unavailable",
            warningMessages: [],
          },
          plugins: {
            items: [],
            freshness: "unknown",
            coverage: "unavailable",
            warningMessages: [],
          },
        },
      };
    }

    const nowMs = this.clock.now().getTime();

    if (this.gatewayRuntimeCache && nowMs - this.gatewayRuntimeCache.loadedAtMs <= GATEWAY_WS_CACHE_TTL_MS) {
      return this.gatewayRuntimeCache.result;
    }

    if (this.gatewayRuntimeLoadPromise) {
      return this.gatewayRuntimeLoadPromise;
    }

    this.gatewayRuntimeLoadPromise = (async () => {
      const gatewayAuth = await this.resolveGatewayAuth(resolved, parsedConfig);

      try {
        const client = this.gatewayClientFactory({
          url: resolved.gatewayUrl as string,
          timeoutMs: this.gatewayTimeoutMs,
          clock: this.clock,
          ...(gatewayAuth.token ? { authToken: gatewayAuth.token } : {}),
        });
        const snapshot = await client.readRuntimeSnapshot();
        const warnings = [
          ...gatewayAuth.warnings,
          ...snapshot.presence.warningMessages.map((message) =>
            warning("OPENCLAW_GATEWAY_PRESENCE_PARTIAL", "warn", message, undefined, GATEWAY_WS_SOURCE_ID),
          ),
          ...snapshot.nodes.warningMessages.map((message) =>
            warning("OPENCLAW_GATEWAY_NODES_PARTIAL", "warn", message, undefined, GATEWAY_WS_SOURCE_ID),
          ),
          ...snapshot.sessions.warningMessages.map((message) =>
            warning("OPENCLAW_GATEWAY_SESSIONS_PARTIAL", "warn", message, "sessions", GATEWAY_WS_SOURCE_ID),
          ),
          ...snapshot.tools.warningMessages.map((message) =>
            warning("OPENCLAW_GATEWAY_TOOLS_PARTIAL", "warn", message, undefined, GATEWAY_WS_SOURCE_ID),
          ),
          ...snapshot.plugins.warningMessages.map((message) =>
            warning("OPENCLAW_GATEWAY_PLUGINS_PARTIAL", "warn", message, undefined, GATEWAY_WS_SOURCE_ID),
          ),
        ];

        return {
          configured: true,
          connected: true,
          fetchedAt: snapshot.fetchedAt,
          warnings,
          collections: {
            presence: snapshot.presence,
            nodes: snapshot.nodes,
            sessions: snapshot.sessions,
            tools: snapshot.tools,
            plugins: snapshot.plugins,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";

        return {
          configured: true,
          connected: false,
          fetchedAt: this.clock.now().toISOString(),
          warnings: [
            ...gatewayAuth.warnings,
            warning(
              "OPENCLAW_GATEWAY_WS_CONNECT_FAILED",
              "warn",
              `Gateway WebSocket operator.read snapshot failed: ${message}`,
              "runtimeStatuses",
              GATEWAY_WS_SOURCE_ID,
            ),
          ],
          collections: {
            presence: {
              items: [],
              freshness: "unknown",
              coverage: "unavailable",
              warningMessages: [message],
            },
            nodes: {
              items: [],
              freshness: "unknown",
              coverage: "unavailable",
              warningMessages: [message],
            },
            sessions: {
              items: [],
              freshness: "unknown",
              coverage: "unavailable",
              warningMessages: [message],
            },
            tools: {
              items: [],
              freshness: "unknown",
              coverage: "unavailable",
              warningMessages: [message],
            },
            plugins: {
              items: [],
              freshness: "unknown",
              coverage: "unavailable",
              warningMessages: [message],
            },
          },
        };
      }
    })();

    try {
      const result = await this.gatewayRuntimeLoadPromise;
      this.gatewayRuntimeCache = {
        loadedAtMs: nowMs,
        result,
      };
      return result;
    } finally {
      this.gatewayRuntimeLoadPromise = undefined;
    }
  }

  private async loadGatewayRuntimePlaneState(): Promise<{
    state: GatewayRuntimePlaneState;
    warnings: SnapshotWarning[];
  }> {
    const resolved = this.resolvePaths();
    const gatewayAuth = await this.resolveGatewayAuth(resolved);
    const cacheKey = `${resolved.gatewayUrl ?? "none"}::${gatewayAuth.token ?? "none"}`;

    if (this.gatewayRuntimePlaneCache?.cacheKey !== cacheKey) {
      this.gatewayRuntimePlaneCache?.cache.reset();
      this.gatewayRuntimePlaneCache = {
        cacheKey,
        cache: new GatewayRuntimePlaneCache({
          timeoutMs: this.gatewayTimeoutMs,
          ...(resolved.gatewayUrl ? { url: resolved.gatewayUrl } : {}),
          ...(gatewayAuth.token ? { authToken: gatewayAuth.token } : {}),
        }),
      };
    }

    const state = await this.gatewayRuntimePlaneCache.cache.getState();
    const warningMessages = dedupeStrings([...gatewayAuth.warnings.map((entry) => entry.message), ...state.warnings]);
    const warnings = warningMessages.map((message) =>
      warning("OPENCLAW_GATEWAY_RUNTIME_PLANE_WARNING", "warn", message, "runtimeStatuses", GATEWAY_WS_SOURCE_ID),
    );

    return {
      state: {
        ...state,
        warnings: warningMessages,
      },
      warnings,
    };
  }

  private async findWorkspacePathById(workspaceId: string): Promise<string | undefined> {
    const resolved = this.resolvePaths();
    let parsedConfig: ParsedConfigResult | undefined;

    if (resolved.configFile) {
      try {
        parsedConfig = await loadConfigFile(resolved.configFile, 0, new Set<string>(), this.homedir);
      } catch {
        parsedConfig = undefined;
      }
    }

    const configBaseDir = parsedConfig ? path.dirname(parsedConfig.path) : resolved.configBaseDir;
    const rawAgentList = Array.isArray(parsedConfig?.data.agents?.list)
      ? parsedConfig.data.agents.list.filter(isRecord).map((entry) => entry as RawAgentConfig)
      : [];
    const defaultAgentId = resolveDefaultConfiguredAgentId(rawAgentList);
    const defaultWorkspacePath =
      typeof parsedConfig?.data.agents?.defaults?.workspace === "string"
        ? resolvePathInput(parsedConfig.data.agents.defaults.workspace, configBaseDir, this.homedir)
        : resolveDefaultWorkspacePath(resolved.profile, this.homedir);
    const workspacePathToAgents = new Map<string, string[]>();

    for (const rawAgent of rawAgentList) {
      if (typeof rawAgent.id !== "string" || rawAgent.id.trim().length === 0) {
        continue;
      }

      const workspacePath = resolveAgentWorkspacePath({
        agentId: rawAgent.id,
        configuredWorkspace: rawAgent.workspace,
        defaultWorkspacePath,
        defaultAgentId,
        configBaseDir,
        homedir: this.homedir,
      });

      if (workspacePath) {
        workspacePathToAgents.set(workspacePath, [...(workspacePathToAgents.get(workspacePath) ?? []), rawAgent.id]);
      }
    }

    const workspacePaths = new Set<string>();

    if (defaultWorkspacePath) {
      workspacePaths.add(defaultWorkspacePath);
    }

    for (const workspacePath of workspacePathToAgents.keys()) {
      workspacePaths.add(workspacePath);
    }

    if (resolved.workspaceGlob) {
      const globMatches = await scanWorkspaceDirectories(resolved.workspaceGlob);

      for (const match of globMatches) {
        workspacePaths.add(match);
      }
    }

    if (workspacePaths.size === 0) {
      const defaultRuntimeWorkspace = resolveDefaultWorkspacePath(resolved.profile, this.homedir);
      const defaultRuntimeWorkspaceStat = await statIfExists(defaultRuntimeWorkspace);

      if (defaultRuntimeWorkspaceStat.exists && defaultRuntimeWorkspaceStat.isDirectory) {
        workspacePaths.add(defaultRuntimeWorkspace);
      }
    }

    for (const workspacePath of Array.from(workspacePaths).sort()) {
      const linkedAgentNames = (workspacePathToAgents.get(workspacePath) ?? []).map((agentId) => {
        const configAgent = rawAgentList.find((entry) => entry.id === agentId);
        return configAgent?.name ?? agentId;
      });
      const scan = await inspectWorkspace(workspacePath, linkedAgentNames);

      if (scan.workspace.id === workspaceId) {
        return workspacePath;
      }
    }

    return undefined;
  }

  private async resolveGatewayAuth(
    resolved: ResolvedFilesystemPaths,
    parsedConfig?: ParsedConfigResult,
  ): Promise<GatewayAuthResolution> {
    if (resolved.gatewayToken) {
      return {
        token: resolved.gatewayToken,
        warnings: [],
      };
    }

    const effectiveParsedConfig =
      parsedConfig ??
      (resolved.configFile
        ? await loadConfigFile(resolved.configFile, 0, new Set<string>(), this.homedir).catch(() => undefined)
        : undefined);

    if (!effectiveParsedConfig) {
      return {
        token: undefined,
        warnings: [],
      };
    }

    return resolveConfiguredGatewayToken({
      config: effectiveParsedConfig.data,
      configBaseDir: path.dirname(effectiveParsedConfig.path),
      runtimeRoot: resolved.runtimeRoot,
      homedir: this.homedir,
    });
  }

  getStateDir(): string | undefined {
    return this.resolvePaths().runtimeRoot;
  }

  getConfigFile(): string | undefined {
    return this.resolvePaths().configFile;
  }

  getWorkspaceGlob(): string | undefined {
    return this.resolvePaths().workspaceGlob;
  }

  getGatewayUrl(): string | undefined {
    return this.resolvePaths().gatewayUrl;
  }

  private resolvePaths(): ResolvedFilesystemPaths {
    const profile = this.profileInput;
    const runtimeRootInput = this.runtimeRootInput ?? this.stateDirInput;
    const runtimeRoot = runtimeRootInput
      ? resolvePathInput(runtimeRootInput, process.cwd(), this.homedir)
      : resolveProfileAwareStateDir(profile, this.homedir);
    const configBaseDir = runtimeRoot ?? process.cwd();
    const configInput = this.configFileInput ?? this.configPathInput;
    const configFile = configInput
      ? resolvePathInput(configInput, configBaseDir, this.homedir)
      : selectConfigCandidate(resolveCanonicalConfigCandidates(runtimeRoot));
    const workspaceGlob = this.workspaceGlobInput
      ? resolvePathInput(this.workspaceGlobInput, runtimeRoot ?? process.cwd(), this.homedir)
      : runtimeRootInput
        ? path.join(runtimeRoot ?? process.cwd(), "workspace*")
        : resolveDefaultWorkspaceGlob(this.homedir);
    const logGlob = this.logGlobInput
      ? resolvePathInput(this.logGlobInput, process.cwd(), this.homedir)
      : undefined;
    const gatewayUrl = this.gatewayUrlInput;
    const gatewayToken = this.gatewayTokenInput;
    const sourceRoot = this.sourceRootInput
      ? resolvePathInput(this.sourceRootInput, process.cwd(), this.homedir)
      : undefined;

    return {
      runtimeRoot,
      configFile,
      workspaceGlob,
      logGlob,
      gatewayUrl,
      gatewayToken,
      sourceRoot,
      profile,
      configBaseDir,
    };
  }
}

function selectLogFile<T extends { date: string; isLatest: boolean }>(items: T[], date?: string): T | undefined {
  if (typeof date === "string" && date.trim().length > 0) {
    return items.find((item) => item.date === date);
  }

  return items.find((item) => item.isLatest) ?? items[0];
}

function normalizeLogLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 200;
  }

  return Math.min(Math.max(1, Math.trunc(limit)), 500);
}

function clampCursor(cursor: string, total: number, limit: number): number {
  const parsed = Number.parseInt(cursor, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return Math.max(0, total - limit);
  }

  return Math.min(parsed, Math.max(0, total - limit));
}

function filterLogEntries<T extends { message: string; raw: string; level: string; subsystem?: string; tags: string[] }>(
  items: T[],
  query: LogEntriesQuery,
): T[] {
  const q = normalizeInput(query.q)?.toLowerCase();
  const level = normalizeInput(query.level)?.toLowerCase();
  const subsystem = normalizeInput(query.subsystem)?.toLowerCase();
  const tag = normalizeInput(query.tag)?.toLowerCase();

  return items.filter((item) => {
    if (q && !`${item.message} ${item.raw}`.toLowerCase().includes(q)) {
      return false;
    }
    if (level && level !== "all" && item.level.toLowerCase() !== level) {
      return false;
    }
    if (subsystem && subsystem !== "all" && (item.subsystem ?? "").toLowerCase() !== subsystem) {
      return false;
    }
    if (tag && tag !== "all" && !item.tags.some((itemTag) => itemTag.toLowerCase() === tag)) {
      return false;
    }

    return true;
  });
}

function deriveParsedLogStatus<T extends { parsed: boolean }>(
  status: AdapterLogFilesResult["collectionStatus"],
  entries: T[],
): AdapterLogFilesResult["collectionStatus"] {
  if (status.coverage === "unavailable" || entries.length === 0) {
    return status;
  }

  const parsedCount = entries.filter((entry) => entry.parsed).length;
  if (parsedCount === entries.length) {
    return status;
  }

  return {
    ...status,
    coverage: "partial",
  };
}

function buildLogReadWarning(filePath: string, error: unknown): SnapshotWarning {
  return {
    code: "OPENCLAW_LOG_FILE_READ_FAILED",
    severity: "warn",
    message: `Failed to read log file ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`,
    sourceId: LOG_SOURCE_ID,
  };
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function normalizeLegacyGatewayNode(node: {
  deviceId: string;
  roles: string[];
  scopes: string[];
  online: boolean;
  lastSeenAt?: string;
}): NodeSummaryDto {
  return {
    id: node.deviceId,
    paired: true,
    connected: node.online,
    ...(node.lastSeenAt ? { lastConnectAt: node.lastSeenAt } : {}),
    ...(node.roles.length > 0 ? { capabilities: node.roles } : {}),
    source: "gateway",
    deviceId: node.deviceId,
    roles: node.roles,
    scopes: node.scopes,
    online: node.online,
    ...(node.lastSeenAt ? { lastSeenAt: node.lastSeenAt } : {}),
  };
}

function withOptionalWarnings(warnings: SnapshotWarning[] | undefined): { warnings?: SnapshotWarning[] } {
  return warnings && warnings.length > 0 ? { warnings } : {};
}
