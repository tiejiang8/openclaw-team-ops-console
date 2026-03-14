import type { Agent, AuthProfile, BindingRoute, InventorySummary, RuntimeStatus, Session, SystemSnapshot, TopologyView, Workspace } from "@openclaw-team-ops/shared";

import type { SidecarInventoryAdapter } from "../adapters/source-adapter.js";

export class SidecarService {
  constructor(private readonly adapter: SidecarInventoryAdapter) {}

  async getSnapshot(): Promise<SystemSnapshot> {
    return this.adapter.fetchSnapshot();
  }

  async getAgents(): Promise<Agent[]> {
    return (await this.getSnapshot()).agents;
  }

  async getAgentById(agentId: string): Promise<Agent | undefined> {
    return (await this.getAgents()).find((agent) => agent.id === agentId);
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return (await this.getSnapshot()).workspaces;
  }

  async getSessions(): Promise<Session[]> {
    return (await this.getSnapshot()).sessions;
  }

  async getBindings(): Promise<BindingRoute[]> {
    return (await this.getSnapshot()).bindings;
  }

  async getAuthProfiles(): Promise<AuthProfile[]> {
    return (await this.getSnapshot()).authProfiles;
  }

  async getRuntimeStatuses(): Promise<RuntimeStatus[]> {
    return (await this.getSnapshot()).runtimeStatuses;
  }

  async getSummary(): Promise<InventorySummary> {
    return (await this.getSnapshot()).summary;
  }

  async getTopology(): Promise<TopologyView> {
    return (await this.getSnapshot()).topology;
  }
}
