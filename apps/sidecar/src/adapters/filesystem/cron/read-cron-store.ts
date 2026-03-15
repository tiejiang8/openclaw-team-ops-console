import { readFile } from "node:fs/promises";
import path from "node:path";

import JSON5 from "json5";

export interface RawCronJobEntry {
  key?: string;
  value: Record<string, unknown>;
}

export interface CronStoreReadResult {
  jobsPath: string;
  exists: boolean;
  jobs: RawCronJobEntry[];
  warnings: string[];
}

export async function readCronStore(stateDir: string): Promise<CronStoreReadResult> {
  const jobsPath = path.join(stateDir, "cron", "jobs.json");

  try {
    const contents = await readFile(jobsPath, "utf8");
    const parsed = JSON5.parse(contents) as unknown;

    return {
      jobsPath,
      exists: true,
      jobs: normalizeCronJobEntries(parsed),
      warnings: [],
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        jobsPath,
        exists: false,
        jobs: [],
        warnings: [`Cron store not found at ${jobsPath}.`],
      };
    }

    return {
      jobsPath,
      exists: true,
      jobs: [],
      warnings: [`Failed to parse cron store at ${jobsPath}: ${toErrorMessage(error)}`],
    };
  }
}

function normalizeCronJobEntries(raw: unknown): RawCronJobEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(isRecord)
      .map((value) => ({
        value,
      }));
  }

  if (!isRecord(raw)) {
    return [];
  }

  const collectionValue = raw.jobs ?? raw.items ?? raw.data;

  if (Array.isArray(collectionValue)) {
    return collectionValue
      .filter(isRecord)
      .map((value) => ({
        value,
      }));
  }

  if (isRecord(collectionValue)) {
    return Object.entries(collectionValue)
      .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
      .map(([key, value]) => ({
        key,
        value,
      }));
  }

  return Object.entries(raw)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([key, value]) => ({
      key,
      value,
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error) && typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
