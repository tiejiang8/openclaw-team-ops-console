import type { LogEntriesResponse, LogFilesResponse } from "@openclaw-team-ops/shared";

export interface LogFilterOptions {
  fileDates: string[];
  levels: string[];
  subsystems: string[];
  tags: string[];
}

export function buildLogFilterOptions(
  filesResponse?: LogFilesResponse,
  entriesResponse?: LogEntriesResponse,
): LogFilterOptions {
  return {
    fileDates: filesResponse?.data.map((file) => file.date) ?? [],
    levels: [...(entriesResponse?.data.availableLevels ?? [])].sort(),
    subsystems: [...(entriesResponse?.data.availableSubsystems ?? [])].sort(),
    tags: [...(entriesResponse?.data.availableTags ?? [])].sort(),
  };
}
