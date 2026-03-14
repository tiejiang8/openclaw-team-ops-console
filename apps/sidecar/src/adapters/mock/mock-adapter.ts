import type { SystemSnapshot } from "@openclaw-team-ops/shared";

import type { AdapterHealth, SidecarInventoryAdapter } from "../source-adapter.js";
import { buildMockSnapshot } from "./mock-data.js";

export class MockOpenClawAdapter implements SidecarInventoryAdapter {
  public readonly adapterName = "MockOpenClawAdapter";
  public readonly source = "mock" as const;

  async fetchSnapshot(): Promise<SystemSnapshot> {
    return buildMockSnapshot();
  }

  async healthCheck(): Promise<AdapterHealth> {
    return {
      name: this.adapterName,
      status: "ok",
      details: "Mock data adapter is serving in-memory inventory",
    };
  }
}
