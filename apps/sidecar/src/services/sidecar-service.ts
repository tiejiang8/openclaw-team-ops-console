import type {
  Agent,
  AuthProfile,
  BindingRoute,
  CoverageSummary,
  InventorySummary,
  LogEntriesQuery,
  Node,
  Plugin,
  PresenceEntry,
  RuntimeStatus,
  Session,
  SystemSnapshot,
  Target,
  TargetSnapshotSummary,
  TopologyView,
  Tool,
  Workspace,
  WorkspaceDocument,
} from "@openclaw-team-ops/shared";

import type { SidecarInventoryAdapter } from "../adapters/source-adapter.js";
import { SidecarTargetCatalog } from "../targets/target-catalog.js";

export class SidecarService {
  private readonly targetCatalog: SidecarTargetCatalog;

  constructor(private readonly adapter: SidecarInventoryAdapter) {
    this.targetCatalog = new SidecarTargetCatalog(adapter);
  }

  async getSnapshot(): Promise<SystemSnapshot> {
    return this.adapter.fetchSnapshot();
  }

  async getTargets(): Promise<Target[]> {
    return this.targetCatalog.getTargets();
  }

  async getTargetById(targetId: string): Promise<Target | undefined> {
    return this.targetCatalog.getTargetById(targetId);
  }

  async getTargetSummary(targetId: string): Promise<TargetSnapshotSummary | undefined> {
    return this.targetCatalog.getTargetSummary(targetId);
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

  async getWorkspaceDocument(workspaceId: string, fileName: string): Promise<WorkspaceDocument | undefined> {
    return this.adapter.getWorkspaceDocument(workspaceId, fileName);
  }

  async getSessions(): Promise<Session[]> {
    return (await this.getSnapshot()).sessions;
  }

  async getPresence(): Promise<PresenceEntry[]> {
    return (await this.adapter.getPresence()).items;
  }

  async getNodes(): Promise<Node[]> {
    return (await this.adapter.getNodes()).items;
  }

  async getTools(): Promise<Tool[]> {
    return (await this.adapter.getTools()).items;
  }

  async getPlugins(): Promise<Plugin[]> {
    return (await this.adapter.getPlugins()).items;
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

  async getCoverage(): Promise<CoverageSummary> {
    return (await this.getSnapshot()).sourceRegistry;
  }

  getLogFiles() {
    return this.adapter.getLogFiles();
  }

  getLogSummary(date?: string) {
    return this.adapter.getLogSummary(date);
  }

  getLogEntries(query: LogEntriesQuery) {
    return this.adapter.getLogEntries(query);
  }

  getLogRawFile(date?: string) {
    return this.adapter.getLogRawFile(date);
  }

  async getTopology(): Promise<TopologyView> {
    return (await this.getSnapshot()).topology;
  }
}
