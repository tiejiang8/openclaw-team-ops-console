import type {
  AgentResponse,
  AgentsResponse,
  AuthProfilesResponse,
  BindingsResponse,
  CronJobResponse,
  CronJobsResponse,
  CoverageResponse,
  HealthResponse,
  LogEntriesQuery,
  LogEntriesResponse,
  LogFilesResponse,
  LogRawFileResponse,
  LogSummaryResponse,
  NodesResponse,
  PluginsResponse,
  PresenceResponse,
  RuntimeStatusResponse,
  SummaryResponse,
  TargetResponse,
  TargetsResponse,
  TargetSummaryResponse,
  TopologyResponse,
  ToolsResponse,
  WorkspaceDocumentResponse,
  WorkspacesResponse,
  SessionsResponse,
} from "@openclaw-team-ops/shared";

interface SidecarClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export class SidecarClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: SidecarClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  async getSummary(): Promise<SummaryResponse> {
    return this.request<SummaryResponse>("/sidecar/summary");
  }

  async getTargets(): Promise<TargetsResponse> {
    return this.request<TargetsResponse>("/sidecar/targets");
  }

  async getCoverage(): Promise<CoverageResponse> {
    return this.request<CoverageResponse>("/sidecar/coverage");
  }

  async getLogFiles(): Promise<LogFilesResponse> {
    return this.request<LogFilesResponse>("/sidecar/logs/files");
  }

  async getLogSummary(date?: string): Promise<LogSummaryResponse> {
    return this.request<LogSummaryResponse>(withQuery("/sidecar/logs/summary", {
      ...(date ? { date } : {}),
    }));
  }

  async getLogEntries(query: LogEntriesQuery = {}): Promise<LogEntriesResponse> {
    return this.request<LogEntriesResponse>(
      withQuery("/sidecar/logs/entries", {
        ...(query.date ? { date: query.date } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(typeof query.limit === "number" ? { limit: String(query.limit) } : {}),
        ...(query.q ? { q: query.q } : {}),
        ...(query.level ? { level: query.level } : {}),
        ...(query.subsystem ? { subsystem: query.subsystem } : {}),
        ...(query.tag ? { tag: query.tag } : {}),
      }),
    );
  }

  async getLogRawFile(date: string): Promise<LogRawFileResponse | undefined> {
    const response = await this.fetch(`/sidecar/logs/files/${encodeURIComponent(date)}/raw`);

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Sidecar returned ${response.status} for log raw file ${date}`);
    }

    return (await response.json()) as LogRawFileResponse;
  }

  async getTargetById(id: string): Promise<TargetResponse | undefined> {
    const response = await this.fetch(`/sidecar/targets/${encodeURIComponent(id)}`);

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Sidecar returned ${response.status} for target ${id}`);
    }

    return (await response.json()) as TargetResponse;
  }

  async getTargetSummary(id: string): Promise<TargetSummaryResponse | undefined> {
    const response = await this.fetch(`/sidecar/targets/${encodeURIComponent(id)}/summary`);

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Sidecar returned ${response.status} for target summary ${id}`);
    }

    return (await response.json()) as TargetSummaryResponse;
  }

  async getAgents(): Promise<AgentsResponse> {
    return this.request<AgentsResponse>("/sidecar/agents");
  }

  async getAgentById(id: string): Promise<AgentResponse | undefined> {
    const response = await this.fetch(`/sidecar/agents/${encodeURIComponent(id)}`);

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Sidecar returned ${response.status} for agent ${id}`);
    }

    return (await response.json()) as AgentResponse;
  }

  async getWorkspaces(): Promise<WorkspacesResponse> {
    return this.request<WorkspacesResponse>("/sidecar/workspaces");
  }

  async getWorkspaceDocument(workspaceId: string, fileName: string): Promise<WorkspaceDocumentResponse | undefined> {
    const response = await this.fetch(
      `/sidecar/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(fileName)}`,
    );

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Sidecar returned ${response.status} for workspace document ${workspaceId}/${fileName}`);
    }

    return (await response.json()) as WorkspaceDocumentResponse;
  }

  async getSessions(): Promise<SessionsResponse> {
    return this.request<SessionsResponse>("/sidecar/sessions");
  }

  async getPresence(): Promise<PresenceResponse> {
    return this.request<PresenceResponse>("/sidecar/presence");
  }

  async getNodes(): Promise<NodesResponse> {
    return this.request<NodesResponse>("/sidecar/nodes");
  }

  async getRuntimeStatus(): Promise<RuntimeStatusResponse> {
    return this.request<RuntimeStatusResponse>("/sidecar/runtime-status");
  }

  async getCronJobs(): Promise<CronJobsResponse> {
    return this.request<CronJobsResponse>("/sidecar/cron");
  }

  async getCronJob(id: string): Promise<CronJobResponse | undefined> {
    const response = await this.fetch(`/sidecar/cron/${encodeURIComponent(id)}`);

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Sidecar returned ${response.status} for cron job ${id}`);
    }

    return (await response.json()) as CronJobResponse;
  }

  async getTools(): Promise<ToolsResponse> {
    return this.request<ToolsResponse>("/sidecar/tools");
  }

  async getPlugins(): Promise<PluginsResponse> {
    return this.request<PluginsResponse>("/sidecar/plugins");
  }

  async getBindings(): Promise<BindingsResponse> {
    return this.request<BindingsResponse>("/sidecar/bindings");
  }

  async getAuthProfiles(): Promise<AuthProfilesResponse> {
    return this.request<AuthProfilesResponse>("/sidecar/auth-profiles");
  }

  async getTopology(): Promise<TopologyResponse> {
    return this.request<TopologyResponse>("/sidecar/topology");
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetch(path);

    if (!response.ok) {
      throw new Error(`Sidecar request failed: ${path} -> ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async fetch(path: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        headers: {
          accept: "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}
