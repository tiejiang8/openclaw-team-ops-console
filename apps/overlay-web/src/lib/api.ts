import type {
  AgentResponse,
  AgentsResponse,
  AuthProfilesResponse,
  BindingsResponse,
  CoverageResponse,
  CronJobResponse,
  CronJobsResponse,
  EvidenceResponse,
  EvidencesResponse,
  FindingResponse,
  FindingsResponse,
  HealthResponse,
  LogEntriesQuery,
  LogEntriesResponse,
  LogFilesResponse,
  LogRawFileResponse,
  LogSummaryResponse,
  NodesResponse,
  RecommendationResponse,
  RecommendationsResponse,
  RisksSummaryResponse,
  RuntimeStatusResponse,
  SummaryResponse,
  TargetResponse,
  TargetsResponse,
  TargetSummaryResponse,
  TopologyResponse,
  WorkspaceDocumentResponse,
  WorkspacesResponse,
  SessionsResponse,
  BootstrapStatusResponse,
  FleetMapResponseContract,
  ActivityResponseContract,
  RecommendationsResponseContract,
  RecommendationResponseContract,
} from "@openclaw-team-ops/shared";

export const API_BASE_URL = (import.meta.env.VITE_OVERLAY_API_URL ?? "").replace(/\/$/, "");

export async function request<T>(path: string): Promise<T> {
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

export function withQuery(path: string, query: Record<string, string | undefined>): string {
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
  getBootstrapStatus: () => request<BootstrapStatusResponse>("/api/bootstrap/status"),
  getFleetMap: () => request<FleetMapResponseContract>("/api/fleet-map"),
  getActivity: (params: { type?: string; severity?: string; limit?: number } = {}) => 
    request<ActivityResponseContract>(withQuery("/api/activity", {
      ...(params.type ? { type: params.type } : {}),
      ...(params.severity ? { severity: params.severity } : {}),
      ...(params.limit ? { limit: String(params.limit) } : {}),
    })),
  getRecommendations: (params: { findingId?: string } = {}) => 
    request<RecommendationsResponseContract>(withQuery("/api/recommendations", params)),
  getRecommendation: (id: string) => 
    request<RecommendationResponseContract>(`/api/recommendations/${encodeURIComponent(id)}`),
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
  getRisksSummary: () => request<RisksSummaryResponse>("/api/risks/summary"),
  getCoverage: () => request<CoverageResponse>("/api/coverage"),
  getLogFiles: () => request<LogFilesResponse>("/api/logs/files"),
  getLogSummary: (date?: string) =>
    request<LogSummaryResponse>(
      withQuery("/api/logs/summary", {
        ...(date ? { date } : {}),
      }),
    ),
  getLogEntries: (query: LogEntriesQuery = {}) =>
    request<LogEntriesResponse>(
      withQuery("/api/logs/entries", {
        ...(query.date ? { date: query.date } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(typeof query.limit === "number" ? { limit: String(query.limit) } : {}),
        ...(query.q ? { q: query.q } : {}),
        ...(query.level ? { level: query.level } : {}),
        ...(query.subsystem ? { subsystem: query.subsystem } : {}),
        ...(query.tag ? { tag: query.tag } : {}),
      }),
    ),
  getLogRawFile: (date: string) => request<LogRawFileResponse>(`/api/logs/files/${encodeURIComponent(date)}/raw`),
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
  getRuntimeStatus: () => request<RuntimeStatusResponse>("/api/runtime-status"),
  getNodes: (query: Record<string, string | undefined> = {}) => request<NodesResponse>(withQuery("/api/nodes", query)),
  getCronJobs: (query: Record<string, string | undefined> = {}) => request<CronJobsResponse>(withQuery("/api/cron", query)),
  getCronJob: (cronId: string) => request<CronJobResponse>(`/api/cron/${encodeURIComponent(cronId)}`),
};
