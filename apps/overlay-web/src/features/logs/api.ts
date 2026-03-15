import type { LogEntriesQuery, LogEntriesResponse, LogFilesResponse, LogSummaryResponse } from "@openclaw-team-ops/shared";

import { overlayApi } from "../../lib/api.js";

export interface LogsPageData {
  files: LogFilesResponse;
  summary: LogSummaryResponse;
  entries: LogEntriesResponse;
  resolvedDate?: string;
}

export async function loadLogsPageData(query: LogEntriesQuery = {}): Promise<LogsPageData> {
  const files = await overlayApi.getLogFiles();
  const resolvedDate = query.date ?? files.data.find((file) => file.isLatest)?.date ?? files.data[0]?.date;
  const [summary, entries] = await Promise.all([
    overlayApi.getLogSummary(resolvedDate),
    overlayApi.getLogEntries({
      ...query,
      ...(resolvedDate ? { date: resolvedDate } : {}),
    }),
  ]);

  return {
    files,
    summary,
    entries,
    ...(resolvedDate ? { resolvedDate } : {}),
  };
}
