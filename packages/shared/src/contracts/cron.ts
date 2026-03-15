export type CronJobRunState = "ok" | "error" | "running" | "unknown";

export type CronJobSource = "mock" | "filesystem" | "gateway" | "hybrid";

export interface CronEvidenceRefDto {
  kind: "path" | "field";
  value: string;
}

export interface CronJobRunDto {
  runId?: string;
  startedAt?: string;
  finishedAt?: string;
  state: CronJobRunState;
  summary?: string;
}

export interface CronJobSummaryDto {
  id: string;
  name: string;
  scheduleText: string;
  timezone?: string;
  enabled: boolean;
  sessionTarget?: string;
  deliveryMode?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunState?: CronJobRunState;
  overdue: boolean;
  source: CronJobSource;
  evidenceRefs: CronEvidenceRefDto[];
}

export interface CronJobDetailDto extends CronJobSummaryDto {
  rawPath?: string;
  rawRunLogPath?: string;
  warnings: string[];
  recentRuns: CronJobRunDto[];
}
