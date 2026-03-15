import { existsSync } from "node:fs";
import { glob, readFile, stat } from "node:fs/promises";
import path from "node:path";

import JSON5 from "json5";

import type { LogFile, SnapshotWarning, SourceCollectionStatus } from "@openclaw-team-ops/shared";

const DEFAULT_LOG_GLOB = "/tmp/openclaw/openclaw-*.log";
const ISO_DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2})\b/;

export interface DiscoverLogFilesOptions {
  configFile?: string | undefined;
  configBaseDir?: string | undefined;
  logGlob?: string | undefined;
  now?: Date | undefined;
}

export interface DiscoverLogFilesResult {
  items: LogFile[];
  collectionStatus: SourceCollectionStatus;
  warnings: SnapshotWarning[];
}

interface RawLoggingConfig {
  logging?: {
    file?: string;
  };
}

export async function discoverLogFiles(options: DiscoverLogFilesOptions = {}): Promise<DiscoverLogFilesResult> {
  const now = options.now ?? new Date();
  const warnings: SnapshotWarning[] = [];

  const configuredGlob = normalizeInput(options.logGlob);
  if (configuredGlob) {
    const items = await collectFromPattern(configuredGlob, "glob");

    if (items.length === 0) {
      warnings.push({
        code: "OPENCLAW_LOG_GLOB_NO_MATCHES",
        severity: "warn",
        message: `Configured log glob did not match any files: ${configuredGlob}`,
        sourceId: "filesystem:logs",
      });
    }

    return {
      items,
      collectionStatus: buildLogCollectionStatus(items, warnings, now, "filesystem"),
      warnings,
    };
  }

  const configuredPath = await resolveConfiguredLogPath(options.configFile, options.configBaseDir);
  if (configuredPath.warning) {
    warnings.push(configuredPath.warning);
  }

  if (configuredPath.path) {
    const items = await collectFromPattern(configuredPath.path, "configured");

    if (items.length > 0) {
      return {
        items,
        collectionStatus: buildLogCollectionStatus(items, warnings, now, "filesystem"),
        warnings,
      };
    }

    warnings.push({
      code: "OPENCLAW_CONFIGURED_LOG_FILE_MISSING",
      severity: "warn",
      message: `Configured log path did not match any files: ${configuredPath.path}`,
      sourceId: "filesystem:logs",
    });
  }

  const items = await collectFromPattern(DEFAULT_LOG_GLOB, "default");
  if (items.length === 0) {
    warnings.push({
      code: "OPENCLAW_DEFAULT_LOG_FILE_MISSING",
      severity: "warn",
      message: `Default OpenClaw log files were not found under ${DEFAULT_LOG_GLOB}`,
      sourceId: "filesystem:logs",
    });
  }

  return {
    items,
    collectionStatus: buildLogCollectionStatus(items, warnings, now, "filesystem"),
    warnings,
  };
}

async function resolveConfiguredLogPath(configFile?: string, configBaseDir?: string): Promise<{ path?: string; warning?: SnapshotWarning }> {
  const normalizedConfigFile = normalizeInput(configFile);
  if (!normalizedConfigFile) {
    return {};
  }

  if (!existsSync(normalizedConfigFile)) {
    return {};
  }

  try {
    const raw = await readFile(normalizedConfigFile, "utf8");
    const parsed = JSON5.parse(raw) as RawLoggingConfig;
    const configuredPath = normalizeInput(parsed.logging?.file);

    if (!configuredPath) {
      return {};
    }

    return {
      path: path.isAbsolute(configuredPath)
        ? path.normalize(configuredPath)
        : path.resolve(configBaseDir ?? path.dirname(normalizedConfigFile), configuredPath),
    };
  } catch (error) {
    return {
      warning: {
        code: "OPENCLAW_LOG_CONFIG_PARSE_FAILED",
        severity: "warn",
        message: `Failed to parse logging.file from ${normalizedConfigFile}: ${error instanceof Error ? error.message : "unknown error"}`,
        sourceId: "filesystem:logs",
      },
    };
  }
}

async function collectFromPattern(pattern: string, sourceKind: LogFile["sourceKind"]): Promise<LogFile[]> {
  const matches: string[] = [];

  if (patternHasGlob(pattern)) {
    for await (const match of glob(pattern)) {
      matches.push(match);
    }
  } else {
    matches.push(pattern);
  }

  const files: LogFile[] = [];

  for (const match of matches) {
    try {
      const fileStat = await stat(match);
      if (!fileStat.isFile()) {
        continue;
      }

      const modifiedAt = fileStat.mtime.toISOString();
      files.push({
        date: extractDate(match, modifiedAt),
        path: path.normalize(match),
        sizeBytes: fileStat.size,
        modifiedAt,
        sourceKind,
        isLatest: false,
      });
    } catch {
      continue;
    }
  }

  const sorted = files.sort((left, right) => {
    const leftTime = Date.parse(left.modifiedAt);
    const rightTime = Date.parse(right.modifiedAt);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return right.date.localeCompare(left.date);
  });

  return sorted.map((file, index) => ({
    ...file,
    isLatest: index === 0,
  }));
}

function buildLogCollectionStatus(
  items: LogFile[],
  warnings: SnapshotWarning[],
  now: Date,
  sourceKind: SourceCollectionStatus["sourceKind"],
): SourceCollectionStatus {
  const latestModifiedAt = items[0]?.modifiedAt;
  const freshness =
    latestModifiedAt && now.getTime() - Date.parse(latestModifiedAt) > 36 * 60 * 60 * 1000
      ? "stale"
      : items.length > 0
        ? "fresh"
        : "unknown";
  const coverage =
    items.length === 0 ? "unavailable" : warnings.length > 0 ? "partial" : "complete";

  return {
    key: "logs",
    sourceKind,
    freshness,
    coverage,
    warningCount: warnings.length,
    ...(items[0] ? { lastSuccessAt: items[0].modifiedAt } : {}),
  };
}

function extractDate(filePath: string, fallbackTimestamp: string): string {
  const match = path.basename(filePath).match(ISO_DATE_PATTERN);
  if (match?.[1]) {
    return match[1];
  }

  return fallbackTimestamp.slice(0, 10);
}

function normalizeInput(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function patternHasGlob(value: string): boolean {
  return /[*?[\]{}]/.test(value);
}
