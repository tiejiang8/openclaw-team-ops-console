import type {
  AgentResponse,
  AgentsResponse,
  AuthProfilesResponse,
  BindingsResponse,
  HealthResponse,
  RuntimeStatusesResponse,
  SummaryResponse,
  TopologyResponse,
  WorkspacesResponse,
  SessionsResponse,
} from "@openclaw-team-ops/shared";

const API_BASE_URL = import.meta.env.VITE_OVERLAY_API_URL ?? "http://localhost:4300";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}

export const overlayApi = {
  getHealth: () => request<HealthResponse>("/health"),
  getSummary: () => request<SummaryResponse>("/api/summary"),
  getAgents: () => request<AgentsResponse>("/api/agents"),
  getAgent: (agentId: string) => request<AgentResponse>(`/api/agents/${encodeURIComponent(agentId)}`),
  getWorkspaces: () => request<WorkspacesResponse>("/api/workspaces"),
  getSessions: () => request<SessionsResponse>("/api/sessions"),
  getBindings: () => request<BindingsResponse>("/api/bindings"),
  getAuthProfiles: () => request<AuthProfilesResponse>("/api/auth-profiles"),
  getTopology: () => request<TopologyResponse>("/api/topology"),
  getRuntimeStatuses: () => request<RuntimeStatusesResponse>("/api/runtime-status"),
};
