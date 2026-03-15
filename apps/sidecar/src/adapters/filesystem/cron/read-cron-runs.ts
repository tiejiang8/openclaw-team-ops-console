import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface RawCronRunEntry {
  jobId: string;
  lineNumber: number;
  value: Record<string, unknown>;
}

export interface CronRunsReadResult {
  runsDir: string;
  runLogPaths: Record<string, string>;
  runsByJobId: Map<string, RawCronRunEntry[]>;
  warnings: string[];
}

export async function readCronRuns(stateDir: string, limit = 20): Promise<CronRunsReadResult> {
  const runsDir = path.join(stateDir, "cron", "runs");
  const warnings: string[] = [];
  const runsByJobId = new Map<string, RawCronRunEntry[]>();
  const runLogPaths: Record<string, string> = {};

  let fileNames: string[];

  try {
    fileNames = (await readdir(runsDir)).filter((fileName) => fileName.endsWith(".jsonl"));
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        runsDir,
        runLogPaths,
        runsByJobId,
        warnings: [],
      };
    }

    return {
      runsDir,
      runLogPaths,
      runsByJobId,
      warnings: [`Failed to read cron run directory ${runsDir}: ${toErrorMessage(error)}`],
    };
  }

  await Promise.all(
    fileNames.map(async (fileName) => {
      const jobId = fileName.replace(/\.jsonl$/i, "");
      const targetPath = path.join(runsDir, fileName);
      runLogPaths[jobId] = targetPath;

      try {
        const contents = await readFile(targetPath, "utf8");
        const entries = contents
          .split(/\r?\n/)
          .map((line, index) => ({
            line,
            lineNumber: index + 1,
          }))
          .filter((entry) => entry.line.trim().length > 0)
          .map((entry) => parseRunEntry(jobId, entry.line, entry.lineNumber, targetPath, warnings))
          .filter((entry): entry is RawCronRunEntry => entry !== undefined)
          .sort((left, right) => compareRunEntries(right.value, left.value))
          .slice(0, limit);

        runsByJobId.set(jobId, entries);
      } catch (error) {
        warnings.push(`Failed to read cron runs for ${jobId} at ${targetPath}: ${toErrorMessage(error)}`);
      }
    }),
  );

  return {
    runsDir,
    runLogPaths,
    runsByJobId,
    warnings,
  };
}

function parseRunEntry(
  jobId: string,
  line: string,
  lineNumber: number,
  targetPath: string,
  warnings: string[],
): RawCronRunEntry | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;

    if (!isRecord(parsed)) {
      warnings.push(`Skipped non-object cron run entry in ${targetPath}:${lineNumber}.`);
      return undefined;
    }

    return {
      jobId,
      lineNumber,
      value: parsed,
    };
  } catch (error) {
    warnings.push(`Skipped invalid cron run JSON in ${targetPath}:${lineNumber}: ${toErrorMessage(error)}`);
    return undefined;
  }
}

function compareRunEntries(left: Record<string, unknown>, right: Record<string, unknown>): number {
  return toTimestamp(left) - toTimestamp(right);
}

function toTimestamp(value: Record<string, unknown>): number {
  const candidate =
    toIsoDate(value.startedAt) ??
    toIsoDate(value.finishedAt) ??
    toIsoDate(value.updatedAt) ??
    toIsoDate(value.ts);

  return candidate ? Date.parse(candidate) : 0;
}

function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
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
