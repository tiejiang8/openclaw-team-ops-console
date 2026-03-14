import {
  createResponseMeta,
  type RuntimeStatus,
  type RuntimeStatusesResponse,
  type SummaryResponse,
} from "@openclaw-team-ops/shared";

import { SidecarClient } from "../clients/sidecar-client.js";

export class OverlayService {
  constructor(private readonly sidecarClient: SidecarClient) {}

  async getSummary(): Promise<SummaryResponse> {
    const summary = await this.sidecarClient.getSummary();
    const overlayRuntimeStatus: RuntimeStatus = {
      componentId: "overlay-api",
      componentType: "service",
      status: "healthy",
      observedAt: new Date().toISOString(),
      details: {
        mode: "read-only",
      },
    };

    return {
      data: summary.data,
      runtimeStatuses: [...summary.runtimeStatuses, overlayRuntimeStatus],
      meta: summary.meta,
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
      meta: createResponseMeta(summary.meta.generatedAt, summary.meta.source),
    };
  }
}
