import type { BootstrapStatusResponse } from "@openclaw-team-ops/shared";
import { SidecarClient } from "../clients/sidecar-client.js";
import { buildApiMeta } from "./api-meta.js";

export class BootstrapService {
  constructor(private readonly sidecarClient: SidecarClient) {}

  async getStatus(): Promise<BootstrapStatusResponse> {
    const response = await this.sidecarClient.getBootstrapStatus();
    return {
      data: response.data,
      meta: {
        generatedAt: response.meta.generatedAt,
        readOnly: response.meta.readOnly,
        source: (response.meta as any).source ?? "mixed",
      } as any,
    };
  }
}
