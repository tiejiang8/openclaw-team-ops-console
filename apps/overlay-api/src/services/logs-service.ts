import {
  createItemResponse,
  createListResponse,
  type LogEntriesQuery,
  type LogEntriesResponse,
  type LogFilesResponse,
  type LogRawFileResponse,
  type LogSummaryResponse,
} from "@openclaw-team-ops/shared";

import { SidecarClient } from "../clients/sidecar-client.js";
import { buildApiMeta } from "./api-meta.js";

export class LogsService {
  constructor(private readonly sidecarClient: SidecarClient) {}

  async getLogFiles(): Promise<LogFilesResponse> {
    const response = await this.sidecarClient.getLogFiles();

    return createListResponse(
      response.data,
      buildApiMeta(response.meta, {
        ...(response.meta.collectionStatuses ? { collectionStatuses: response.meta.collectionStatuses } : {}),
        ...(response.meta.sourceKinds ? { sourceKinds: response.meta.sourceKinds } : {}),
        ...(response.meta.warnings ? { warnings: response.meta.warnings } : {}),
        warningCount: response.meta.warningCount,
      }),
    );
  }

  async getLogSummary(date?: string): Promise<LogSummaryResponse> {
    const response = await this.sidecarClient.getLogSummary(date);

    return createItemResponse(
      response.data,
      buildApiMeta(response.meta, {
        ...(response.meta.collectionStatuses ? { collectionStatuses: response.meta.collectionStatuses } : {}),
        ...(response.meta.sourceKinds ? { sourceKinds: response.meta.sourceKinds } : {}),
        ...(response.meta.warnings ? { warnings: response.meta.warnings } : {}),
        warningCount: response.meta.warningCount,
      }),
    );
  }

  async getLogEntries(query: LogEntriesQuery = {}): Promise<LogEntriesResponse> {
    const response = await this.sidecarClient.getLogEntries(query);

    return createItemResponse(
      response.data,
      buildApiMeta(response.meta, {
        ...(response.meta.collectionStatuses ? { collectionStatuses: response.meta.collectionStatuses } : {}),
        ...(response.meta.sourceKinds ? { sourceKinds: response.meta.sourceKinds } : {}),
        ...(response.meta.warnings ? { warnings: response.meta.warnings } : {}),
        warningCount: response.meta.warningCount,
      }),
    );
  }

  async getLogRawFile(date: string): Promise<LogRawFileResponse | undefined> {
    const response = await this.sidecarClient.getLogRawFile(date);

    if (!response) {
      return undefined;
    }

    return createItemResponse(
      response.data,
      buildApiMeta(response.meta, {
        ...(response.meta.collectionStatuses ? { collectionStatuses: response.meta.collectionStatuses } : {}),
        ...(response.meta.sourceKinds ? { sourceKinds: response.meta.sourceKinds } : {}),
        ...(response.meta.warnings ? { warnings: response.meta.warnings } : {}),
        warningCount: response.meta.warningCount,
      }),
    );
  }
}
