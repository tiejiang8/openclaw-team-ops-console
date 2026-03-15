import type { CronJobDetailDto, CronJobRunDto, CronJobRunState, CronJobSummaryDto, SourceCollectionStatus } from "@openclaw-team-ops/shared";

import type { RawCronRunEntry } from "./read-cron-runs.js";
import { readCronRuns } from "./read-cron-runs.js";
import type { RawCronJobEntry } from "./read-cron-store.js";
import { readCronStore } from "./read-cron-store.js";

export interface CronSnapshot {
  items: CronJobSummaryDto[];
  detailsById: Map<string, CronJobDetailDto>;
  collectionStatus: SourceCollectionStatus;
  warnings: string[];
  lastSyncAt?: string;
}

export async function buildCronSnapshot(
  stateDir: string | undefined,
  now: Date = new Date(),
  runLimit = 20,
): Promise<CronSnapshot> {
  if (!stateDir) {
    return {
      items: [],
      detailsById: new Map(),
      collectionStatus: {
        key: "cron",
        sourceKind: "filesystem",
        freshness: "unknown",
        coverage: "unavailable",
        warningCount: 0,
      },
      warnings: [],
    };
  }

  const store = await readCronStore(stateDir);
  const runs = await readCronRuns(stateDir, runLimit);
  const warnings = [...store.warnings, ...runs.warnings];
  const detailsById = new Map<string, CronJobDetailDto>();

  for (const entry of store.jobs) {
    const entryId = normalizeJobId(entry.value, entry.key);
    const detail = buildCronDetail(entry, {
      jobsPath: store.jobsPath,
      ...(runs.runLogPaths[entryId] ? { runLogPath: runs.runLogPaths[entryId] } : {}),
      runs: runs.runsByJobId.get(entryId) ?? [],
      now,
    });
    detailsById.set(detail.id, detail);
  }

  const items = Array.from(detailsById.values())
    .map((detail) => toSummary(detail))
    .sort((left, right) => left.name.localeCompare(right.name));
  const lastSyncAt = latestIsoDate(
    ...items.flatMap((item) => [item.nextRunAt, item.lastRunAt]),
    ...Array.from(detailsById.values()).flatMap((detail) =>
      detail.recentRuns.flatMap((run: CronJobRunDto) => [run.startedAt, run.finishedAt]),
    ),
  );
  const coverage = store.exists ? (warnings.length > 0 ? "partial" : "complete") : "unavailable";
  const freshness = store.exists ? "fresh" : "unknown";

  return {
    items,
    detailsById,
    collectionStatus: {
      key: "cron",
      sourceKind: "filesystem",
      freshness,
      coverage,
      warningCount: warnings.length,
      ...(lastSyncAt ? { lastSuccessAt: lastSyncAt } : {}),
    },
    warnings,
    ...(lastSyncAt ? { lastSyncAt } : {}),
  };
}

function buildCronDetail(
  entry: RawCronJobEntry,
  input: {
    jobsPath: string;
    runLogPath?: string;
    runs: RawCronRunEntry[];
    now: Date;
  },
): CronJobDetailDto {
  const id = normalizeJobId(entry.value, entry.key);
  const name = toString(entry.value.name) ?? toString(entry.value.title) ?? toString(entry.value.displayName) ?? id;
  const scheduleText =
    toString(entry.value.scheduleText) ??
    toString(entry.value.schedule) ??
    toString(entry.value.cron) ??
    toString(entry.value.expression) ??
    "unknown";
  const timezone =
    toString(entry.value.timezone) ??
    toString(entry.value.tz) ??
    toString(entry.value.zone);
  const enabled = normalizeEnabled(entry.value);
  const sessionTarget =
    toString(entry.value.sessionTarget) ??
    toString(entry.value.sessionId) ??
    toString(entry.value.targetSession) ??
    (isRecord(entry.value.target) ? toString(entry.value.target.sessionId) : undefined);
  const deliveryMode =
    toString(entry.value.deliveryMode) ??
    toString(entry.value.delivery) ??
    (isRecord(entry.value.delivery) ? toString(entry.value.delivery.mode) : undefined);
  const nextRunAt =
    toIsoDate(entry.value.nextRunAt) ??
    toIsoDate(entry.value.nextAt) ??
    toIsoDate(entry.value.nextExecutionAt) ??
    toIsoDate(entry.value.next);
  const rawLastRunAt =
    toIsoDate(entry.value.lastRunAt) ??
    toIsoDate(entry.value.lastSuccessAt) ??
    toIsoDate(entry.value.lastFinishedAt);
  const recentRuns = input.runs.map((run) => mapRun(run.value)).filter((run): run is CronJobRunDto => run !== undefined);
  const latestRun = recentRuns[0];
  const lastRunAt = latestIsoDate(latestRun?.finishedAt, latestRun?.startedAt, rawLastRunAt);
  const lastRunState = latestRun?.state ?? normalizeRunState(entry.value.lastRunState ?? entry.value.lastStatus ?? entry.value.state);
  const lastSuccessfulRunAt =
    recentRuns.find((run) => run.state === "ok")?.finishedAt ??
    recentRuns.find((run) => run.state === "ok")?.startedAt ??
    toIsoDate(entry.value.lastSuccessAt);
  const overdue = computeOverdue({
    enabled,
    nextRunAt,
    lastSuccessfulRunAt,
    lastRunState,
    now: input.now,
  });
  const warnings: string[] = [];

  if (!input.runLogPath) {
    warnings.push(`No run log file found for cron job ${id}.`);
  }

  if (!nextRunAt && enabled) {
    warnings.push(`Cron job ${id} does not expose nextRunAt in the read-only snapshot.`);
  }

  return {
    id,
    name,
    scheduleText,
    ...(timezone ? { timezone } : {}),
    enabled,
    ...(sessionTarget ? { sessionTarget } : {}),
    ...(deliveryMode ? { deliveryMode } : {}),
    ...(nextRunAt ? { nextRunAt } : {}),
    ...(lastRunAt ? { lastRunAt } : {}),
    ...(lastRunState ? { lastRunState } : {}),
    overdue,
    source: "filesystem",
    evidenceRefs: [
      { kind: "path", value: input.jobsPath },
      { kind: "field", value: `cron.jobs.${id}` },
      ...(input.runLogPath ? [{ kind: "path" as const, value: input.runLogPath }] : []),
    ],
    rawPath: input.jobsPath,
    ...(input.runLogPath ? { rawRunLogPath: input.runLogPath } : {}),
    warnings,
    recentRuns,
  };
}

function toSummary(detail: CronJobDetailDto): CronJobSummaryDto {
  return {
    id: detail.id,
    name: detail.name,
    scheduleText: detail.scheduleText,
    ...(detail.timezone ? { timezone: detail.timezone } : {}),
    enabled: detail.enabled,
    ...(detail.sessionTarget ? { sessionTarget: detail.sessionTarget } : {}),
    ...(detail.deliveryMode ? { deliveryMode: detail.deliveryMode } : {}),
    ...(detail.nextRunAt ? { nextRunAt: detail.nextRunAt } : {}),
    ...(detail.lastRunAt ? { lastRunAt: detail.lastRunAt } : {}),
    ...(detail.lastRunState ? { lastRunState: detail.lastRunState } : {}),
    overdue: detail.overdue,
    source: detail.source,
    evidenceRefs: detail.evidenceRefs,
  };
}

function mapRun(value: Record<string, unknown>): CronJobRunDto | undefined {
  const state = normalizeRunState(value.state ?? value.status ?? value.result ?? value.outcome);

  if (!state) {
    return undefined;
  }

  const runId = toString(value.runId) ?? toString(value.id);
  const startedAt = toIsoDate(value.startedAt) ?? toIsoDate(value.started);
  const finishedAt = toIsoDate(value.finishedAt) ?? toIsoDate(value.finished) ?? toIsoDate(value.completedAt);
  const summary = toString(value.summary) ?? toString(value.message);

  return {
    ...(runId ? { runId } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    state,
    ...(summary ? { summary } : {}),
  };
}

function normalizeJobId(value: Record<string, unknown>, fallbackKey: string | undefined): string {
  return (
    toString(value.id) ??
    toString(value.jobId) ??
    fallbackKey ??
    toString(value.name) ??
    `cron-${stableHash(JSON.stringify(value))}`
  );
}

function normalizeEnabled(value: Record<string, unknown>): boolean {
  const enabled = toBoolean(value.enabled);
  const disabled = toBoolean(value.disabled);
  const paused = toBoolean(value.paused);
  const active = toBoolean(value.active);
  const status = toString(value.status)?.toLowerCase();

  if (typeof enabled === "boolean") {
    return enabled;
  }

  if (typeof disabled === "boolean") {
    return !disabled;
  }

  if (typeof paused === "boolean") {
    return !paused;
  }

  if (typeof active === "boolean") {
    return active;
  }

  if (status === "disabled" || status === "paused") {
    return false;
  }

  return true;
}

function normalizeRunState(value: unknown): CronJobRunState | undefined {
  const normalized = toString(value)?.toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["ok", "success", "succeeded", "completed"].includes(normalized)) {
    return "ok";
  }

  if (["error", "failed", "failure"].includes(normalized)) {
    return "error";
  }

  if (["running", "in-progress", "in_progress"].includes(normalized)) {
    return "running";
  }

  return "unknown";
}

function computeOverdue(input: {
  enabled: boolean;
  nextRunAt: string | undefined;
  lastSuccessfulRunAt: string | undefined;
  lastRunState: CronJobRunState | undefined;
  now: Date;
}): boolean {
  if (!input.enabled || !input.nextRunAt) {
    return false;
  }

  if (Date.parse(input.nextRunAt) > input.now.getTime()) {
    return false;
  }

  if (input.lastRunState === "running") {
    return false;
  }

  if (!input.lastSuccessfulRunAt) {
    return true;
  }

  return Date.parse(input.lastSuccessfulRunAt) < Date.parse(input.nextRunAt);
}

function latestIsoDate(...values: Array<string | undefined>): string | undefined {
  const [latest] = values
    .map((value) => (value ? new Date(value) : undefined))
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  return latest ? latest.toISOString() : undefined;
}

function stableHash(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}
