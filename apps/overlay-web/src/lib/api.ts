import type {
  AgentResponse,
  AgentsResponse,
  AuthProfilesResponse,
  BindingsResponse,
  EvidenceResponse,
  EvidencesResponse,
  FindingResponse,
  FindingsResponse,
  HealthResponse,
  RecommendationResponse,
  RecommendationsResponse,
  RisksSummaryResponse,
  RuntimeStatusesResponse,
  SummaryResponse,
  TargetResponse,
  TargetsResponse,
  TargetSummaryResponse,
  TopologyResponse,
  WorkspaceDocumentResponse,
  WorkspacesResponse,
  SessionsResponse,
} from "@openclaw-team-ops/shared";

const API_BASE_URL = (import.meta.env.VITE_OVERLAY_API_URL ?? "").replace(/\/$/, "");

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

export const overlayApi = {
  getHealth: () => request<HealthResponse>("/health"),
  getSummary: () => request<SummaryResponse>("/api/summary"),
  getTargets: () => request<TargetsResponse>("/api/targets"),
  getTarget: (targetId: string) => request<TargetResponse>(`/api/targets/${encodeURIComponent(targetId)}`),
  getTargetSummary: (targetId: string) =>
    request<TargetSummaryResponse>(`/api/targets/${encodeURIComponent(targetId)}/summary`),
  getEvidences: (query: Record<string, string | undefined> = {}) =>
    request<EvidencesResponse>(withQuery("/api/evidence", query)),
  getEvidence: (evidenceId: string) => request<EvidenceResponse>(`/api/evidence/${encodeURIComponent(evidenceId)}`),
  getFindings: (query: Record<string, string | undefined> = {}) =>
    request<FindingsResponse>(withQuery("/api/findings", query)),
  getFinding: (findingId: string) => request<FindingResponse>(`/api/findings/${encodeURIComponent(findingId)}`),
  getRecommendations: (query: Record<string, string | undefined> = {}) =>
    request<RecommendationsResponse>(withQuery("/api/recommendations", query)),
  getRecommendation: (recommendationId: string) =>
    request<RecommendationResponse>(`/api/recommendations/${encodeURIComponent(recommendationId)}`),
  getRisksSummary: () => request<RisksSummaryResponse>("/api/risks/summary"),
  getAgents: () => request<AgentsResponse>("/api/agents"),
  getAgent: (agentId: string) => request<AgentResponse>(`/api/agents/${encodeURIComponent(agentId)}`),
  getWorkspaces: () => request<WorkspacesResponse>("/api/workspaces"),
  getWorkspaceDocument: (workspaceId: string, fileName: string) =>
    request<WorkspaceDocumentResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(fileName)}`,
    ),
  getSessions: () => request<SessionsResponse>("/api/sessions"),
  getBindings: () => request<BindingsResponse>("/api/bindings"),
  getAuthProfiles: () => request<AuthProfilesResponse>("/api/auth-profiles"),
  getTopology: () => request<TopologyResponse>("/api/topology"),
  getRuntimeStatuses: () => request<RuntimeStatusesResponse>("/api/runtime-status"),
};
