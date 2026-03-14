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
  type EntityStatus,
  type RuntimeStatus,
  type Session,
  type SnapshotWarning,
  type SystemSnapshot,
  type Workspace,
  type WorkspaceDocument,
} from "@openclaw-team-ops/shared";

import type { AdapterHealth, SidecarInventoryAdapter } from "../source-adapter.js";

const CONFIG_SOURCE_ID = "filesystem:config-file";
const RUNTIME_SOURCE_ID = "filesystem:runtime-root";
const WORKSPACE_SOURCE_ID = "filesystem:workspace-scan";
const SOURCE_ROOT_SOURCE_ID = "filesystem:source-root";
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
  sourceRoot?: string | undefined;
  profile?: string | undefined;
  clock?: FilesystemOpenClawAdapterClock | undefined;
  homedir?: (() => string) | undefined;
}

interface ResolvedFilesystemPaths {
  runtimeRoot: string | undefined;
  configFile: string | undefined;
  workspaceGlob: string | undefined;
  sourceRoot: string | undefined;
  profile: string | undefined;
  configBaseDir: string;
}

interface RawOpenClawConfig {
  agents?: {
    defaults?: {
      workspace?: string;
    };
    list?: RawAgentConfig[];
  };
  session?: {
    store?: string;
  };
  bindings?: RawBindingConfig[];
}

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
  private readonly sourceRootInput: string | undefined;
  private readonly profileInput: string | undefined;
  private readonly clock: FilesystemOpenClawAdapterClock;
  private readonly homedir: () => string;

  constructor(options: FilesystemOpenClawAdapterOptions = {}) {
    this.runtimeRootInput = normalizeInput(options.runtimeRoot);
    this.stateDirInput = normalizeInput(options.stateDir);
    this.configFileInput = normalizeInput(options.configFile);
    this.configPathInput = normalizeInput(options.configPath);
    this.workspaceGlobInput = normalizeInput(options.workspaceGlob);
    this.sourceRootInput = normalizeInput(options.sourceRoot);
    this.profileInput = normalizeProfile(options.profile);
    this.clock = options.clock ?? { now: () => new Date() };
    this.homedir = options.homedir ?? os.homedir;
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
    const sessions: Session[] = [];

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

                sessions.push({
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

    const agents: Agent[] = Array.from(agentDefinitions.values()).map((agentDefinition) => {
      const workspace = agentDefinition.workspacePath ? workspaceByPath.get(agentDefinition.workspacePath) : undefined;
      const name = agentDefinition.rawConfig?.name ?? agentDefinition.id;
      const agentUpdatedAt = latestIsoDate(
        workspace?.updatedAt,
        agentDefinition.lastSessionActivityAt,
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
          sessionCount: agentDefinition.sessionCount,
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
        status: buildCollectionStatus({
          hasSource: Boolean(resolved.runtimeRoot),
          itemCount: sessions.length,
          warnings: collectionWarnings.sessions,
          allowEmptyComplete: runtimeRootStat.exists && runtimeAgentIds.length === 0 && agents.length === 0,
        }),
        freshness: collectionFreshness(Boolean(resolved.runtimeRoot)),
        collectedAt: generatedAt,
        recordCount: sessions.length,
        sourceIds: resolved.runtimeRoot ? [RUNTIME_SOURCE_ID] : [],
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
        status: sessions.length > 0 ? "healthy" : resolved.runtimeRoot ? "degraded" : "unknown",
        observedAt: generatedAt,
        details: {
          runtimeRootConfigured: Boolean(resolved.runtimeRoot),
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
      : resolveDefaultWorkspaceGlob(this.homedir);
    const sourceRoot = this.sourceRootInput
      ? resolvePathInput(this.sourceRootInput, process.cwd(), this.homedir)
      : undefined;

    return {
      runtimeRoot,
      configFile,
      workspaceGlob,
      sourceRoot,
      profile,
      configBaseDir,
    };
  }
}
