import type { CronJobResponse, CronJobsResponse } from "@openclaw-team-ops/shared";

import { request, withQuery } from "../api.js";

export function getCronJobs(query: Record<string, string | undefined> = {}) {
  return request<CronJobsResponse>(withQuery("/api/cron", query));
}

export function getCronJob(cronId: string) {
  return request<CronJobResponse>(`/api/cron/${encodeURIComponent(cronId)}`);
}
