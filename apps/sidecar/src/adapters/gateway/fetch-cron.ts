import type { CronJobDetailDto, CronJobRunDto, CronJobRunState, CronJobSummaryDto } from "@openclaw-team-ops/shared";

import { extractRecordArray, isRecord, toBoolean, toIsoDate, toString, type GatewayRequestClient } from "../gateway-ws/protocol.js";

export async function fetchGatewayCronJobs(
  client: GatewayRequestClient,
  now: Date = new Date(),
): Promise<CronJobSummaryDto[]> {
  const [listRaw, statusRaw] = await Promise.all([client.request("cron.list"), client.request("cron.status")]);
  const statuses = normalizeCronStatusMap(statusRaw);
  const jobs = normalizeCronList(listRaw)
    .map((job) => mergeCronSummary(job, statuses.get(job.id), now))
    .sort((left, right) => left.name.localeCompare(right.name));

  return jobs;
}

export async function fetchGatewayCronJobDetail(
  client: GatewayRequestClient,
  id: string,
  now: Date = new Date(),
): Promise<CronJobDetailDto | undefined> {
  const [listRaw, statusRaw, runsRaw] = await Promise.all([
    client.request("cron.list"),
    client.request("cron.status", { jobId: id }),
    client.request("cron.runs", { jobId: id, limit: 20 }),
  ]);
  const base = normalizeCronList(listRaw).find((job) => job.id === id);

  if (!base) {
    return undefined;
  }

  const merged = mergeCronSummary(base, normalizeCronStatusMap(statusRaw).get(id), now);
  const recentRuns = normalizeCronRuns(runsRaw);

  return {
    ...merged,
    warnings: [],
    recentRuns,
  };
}

function normalizeCronList(raw: unknown): CronJobSummaryDto[] {
  const items = extractRecordArray(raw, ["items", "jobs", "data", "result"]);

  return items
    .map((item) => mapCronSummary(item))
    .filter((item): item is CronJobSummaryDto => item !== undefined);
}

function normalizeCronStatusMap(raw: unknown): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  const items = extractRecordArray(raw, ["items", "jobs", "statuses", "data", "result"]);

  items.forEach((item) => {
    const id = toString(item.id) ?? toString(item.jobId);
    if (id) {
      result.set(id, item);
    }
  });

  if (items.length > 0) {
    return result;
  }

  if (!isRecord(raw)) {
    return result;
  }

  Object.entries(raw)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .forEach(([key, value]) => {
      result.set(key, value);
    });

  return result;
}

function normalizeCronRuns(raw: unknown): CronJobRunDto[] {
  const items = extractRecordArray(raw, ["items", "runs", "data", "result"]);

  return items
    .map((item) => {
      const state = normalizeRunState(item.state ?? item.status ?? item.result ?? item.outcome);

      if (!state) {
        return undefined;
      }

      const runId = toString(item.runId) ?? toString(item.id);
      const startedAt = toIsoDate(item.startedAt) ?? toIsoDate(item.started);
      const finishedAt = toIsoDate(item.finishedAt) ?? toIsoDate(item.completedAt);
      const summary = toString(item.summary) ?? toString(item.message);

      return {
        ...(runId ? { runId } : {}),
        ...(startedAt ? { startedAt } : {}),
        ...(finishedAt ? { finishedAt } : {}),
        state,
        ...(summary ? { summary } : {}),
      };
    })
    .filter((item): item is CronJobRunDto => item !== undefined);
}

function mapCronSummary(value: Record<string, unknown>): CronJobSummaryDto | undefined {
  const id = toString(value.id) ?? toString(value.jobId);

  if (!id) {
    return undefined;
  }

  const timezone = toString(value.timezone);
  const sessionTarget = toString(value.sessionTarget) ?? toString(value.sessionId);
  const deliveryMode = toString(value.deliveryMode) ?? toString(value.delivery);
  const nextRunAt = toIsoDate(value.nextRunAt) ?? toIsoDate(value.nextAt);
  const lastRunAt = toIsoDate(value.lastRunAt) ?? toIsoDate(value.lastFinishedAt);
  const lastRunState = normalizeRunState(value.lastRunState ?? value.lastStatus ?? value.state);

  return {
    id,
    name: toString(value.name) ?? toString(value.title) ?? id,
    scheduleText:
      toString(value.scheduleText) ??
      toString(value.schedule) ??
      toString(value.cron) ??
      "unknown",
    ...(timezone ? { timezone } : {}),
    enabled: toBoolean(value.enabled) ?? !["paused", "disabled"].includes(toString(value.status)?.toLowerCase() ?? ""),
    ...(sessionTarget ? { sessionTarget } : {}),
    ...(deliveryMode ? { deliveryMode } : {}),
    ...(nextRunAt ? { nextRunAt } : {}),
    ...(lastRunAt ? { lastRunAt } : {}),
    ...(lastRunState ? { lastRunState } : {}),
    overdue: false,
    source: "gateway",
    evidenceRefs: [{ kind: "field", value: `gateway.cron.${id}` }],
  };
}

function mergeCronSummary(
  base: CronJobSummaryDto,
  status: Record<string, unknown> | undefined,
  now: Date,
): CronJobSummaryDto {
  const nextRunAt = toIsoDate(status?.nextRunAt) ?? toIsoDate(status?.nextAt) ?? base.nextRunAt;
  const lastRunAt = toIsoDate(status?.lastRunAt) ?? toIsoDate(status?.lastFinishedAt) ?? base.lastRunAt;
  const lastRunState = normalizeRunState(status?.lastRunState ?? status?.lastStatus ?? status?.state) ?? base.lastRunState;
  const lastSuccessAt = toIsoDate(status?.lastSuccessAt);

  return {
    ...base,
    ...(nextRunAt ? { nextRunAt } : {}),
    ...(lastRunAt ? { lastRunAt } : {}),
    ...(lastRunState ? { lastRunState } : {}),
    overdue:
      base.enabled &&
      Boolean(nextRunAt) &&
      Date.parse(nextRunAt as string) <= now.getTime() &&
      lastRunState !== "running" &&
      (!lastSuccessAt || Date.parse(lastSuccessAt) < Date.parse(nextRunAt as string)),
  };
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
