import type { LogEntry, LogFile, LogLevel, LogSummary } from "@openclaw-team-ops/shared";

export function buildLogSummary(date: string, entries: LogEntry[], file?: LogFile): LogSummary {
  const levelCounts = buildEmptyLevelCounts();
  const signalCounts: Record<string, number> = {};
  let parsedLines = 0;
  let latestErrorAt: string | undefined;

  for (const entry of entries) {
    levelCounts[entry.level] += 1;
    if (entry.parsed) {
      parsedLines += 1;
    }

    for (const tag of entry.tags) {
      signalCounts[tag] = (signalCounts[tag] ?? 0) + 1;
    }

    if (entry.level === "error" || entry.level === "fatal") {
      latestErrorAt = entry.ts ?? latestErrorAt;
    }
  }

  return {
    date,
    ...(file ? { file } : {}),
    totalLines: entries.length,
    parsedLines,
    levelCounts,
    signalCounts,
    ...(latestErrorAt ? { latestErrorAt } : {}),
  };
}

function buildEmptyLevelCounts(): Record<LogLevel, number> {
  return {
    trace: 0,
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0,
    unknown: 0,
  };
}
