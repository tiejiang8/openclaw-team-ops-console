import {
  createCollectionMetadata,
  createResponseMeta,
  type CollectionMetadata,
  type RuntimeStatus,
  type RuntimeStatusesResponse,
  type SummaryResponse,
} from "@openclaw-team-ops/shared";

import { SidecarClient } from "../clients/sidecar-client.js";

export class OverlayService {
  constructor(private readonly sidecarClient: SidecarClient) {}

  async getSummary(): Promise<SummaryResponse> {
    const summary = await this.sidecarClient.getSummary();
    const observedAt = new Date().toISOString();
    const overlayRuntimeStatus: RuntimeStatus = {
      componentId: "overlay-api",
      componentType: "service",
      status: "healthy",
      observedAt,
      details: {
        mode: "read-only",
      },
    };
    const runtimeStatuses = [...summary.runtimeStatuses, overlayRuntimeStatus];
    const upstreamRuntimeMetadata = summary.meta.collections?.runtimeStatuses;
    const runtimeMetadata: CollectionMetadata = {
      ...(upstreamRuntimeMetadata ??
        createCollectionMetadata({
          collection: "runtimeStatuses",
          collectedAt: observedAt,
          recordCount: runtimeStatuses.length,
          sourceIds: ["sidecar", "overlay-api"],
        })),
      recordCount: runtimeStatuses.length,
      sourceIds: Array.from(new Set([...(upstreamRuntimeMetadata?.sourceIds ?? ["sidecar"]), "overlay-api"])),
    };

    return {
      data: summary.data,
      runtimeStatuses,
      meta: {
        ...summary.meta,
        collections: {
          ...summary.meta.collections,
          runtimeStatuses: runtimeMetadata,
        },
      },
    };
  }

  getAgents() {
    return this.sidecarClient.getAgents();
  }

  getAgentById(agentId: string) {
    return this.sidecarClient.getAgentById(agentId);
  }

  getWorkspaces() {
    return this.sidecarClient.getWorkspaces();
  }

  getWorkspaceDocument(workspaceId: string, fileName: string) {
    return this.sidecarClient.getWorkspaceDocument(workspaceId, fileName);
  }

  getSessions() {
    return this.sidecarClient.getSessions();
  }

  getBindings() {
    return this.sidecarClient.getBindings();
  }

  getAuthProfiles() {
    return this.sidecarClient.getAuthProfiles();
  }

  getTopology() {
    return this.sidecarClient.getTopology();
  }

  async getRuntimeStatuses(): Promise<RuntimeStatusesResponse> {
    const summary = await this.getSummary();
    return {
      data: summary.runtimeStatuses,
      meta: createResponseMeta(summary.meta.generatedAt, summary.meta.source, {
        ...(summary.meta.collections?.runtimeStatuses
          ? { collections: { runtimeStatuses: summary.meta.collections.runtimeStatuses } }
          : {}),
        ...(summary.meta.warnings ? { warnings: summary.meta.warnings } : {}),
      }),
    };
  }
}
