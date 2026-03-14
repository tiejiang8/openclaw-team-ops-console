import type {
  AgentResponse,
  AgentsResponse,
  AuthProfilesResponse,
  BindingsResponse,
  HealthResponse,
  SummaryResponse,
  TopologyResponse,
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

  async getSessions(): Promise<SessionsResponse> {
    return this.request<SessionsResponse>("/sidecar/sessions");
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
