import {
  buildInventorySummary,
  buildTopologyView,
  type Agent,
  type AuthProfile,
  type BindingRoute,
  type RuntimeStatus,
  type Session,
  type SystemSnapshot,
  type Workspace,
} from "@openclaw-team-ops/shared";

function createWorkspaces(): Workspace[] {
  return [
    {
      id: "ws-core-prod",
      name: "Core Production",
      status: "healthy",
      environment: "production",
      ownerTeam: "Platform Operations",
      region: "us-east-1",
      createdAt: "2026-01-05T08:00:00.000Z",
      updatedAt: "2026-03-12T18:05:00.000Z",
    },
    {
      id: "ws-analytics-stg",
      name: "Analytics Staging",
      status: "degraded",
      environment: "staging",
      ownerTeam: "Data Engineering",
      region: "us-west-2",
      createdAt: "2026-01-20T09:00:00.000Z",
      updatedAt: "2026-03-12T17:40:00.000Z",
    },
    {
      id: "ws-partner-dev",
      name: "Partner Development",
      status: "healthy",
      environment: "development",
      ownerTeam: "Partner Integrations",
      region: "eu-central-1",
      createdAt: "2026-02-10T10:00:00.000Z",
      updatedAt: "2026-03-12T19:12:00.000Z",
    },
  ];
}

function createAuthProfiles(): AuthProfile[] {
  return [
    {
      id: "auth-platform-oauth",
      name: "Platform OAuth",
      provider: "oauth",
      status: "valid",
      scopes: ["agents:read", "sessions:read", "routes:read"],
      workspaceIds: ["ws-core-prod", "ws-analytics-stg"],
      expiresAt: "2026-12-31T23:59:59.000Z",
      lastUsedAt: "2026-03-13T03:59:00.000Z",
      createdAt: "2026-01-02T09:30:00.000Z",
      updatedAt: "2026-03-11T08:20:00.000Z",
    },
    {
      id: "auth-bot-token",
      name: "Bot Token Pool",
      provider: "token",
      status: "expiring",
      scopes: ["channels:read", "bindings:read"],
      workspaceIds: ["ws-core-prod", "ws-partner-dev"],
      expiresAt: "2026-04-01T00:00:00.000Z",
      lastUsedAt: "2026-03-13T03:20:00.000Z",
      createdAt: "2026-01-12T11:00:00.000Z",
      updatedAt: "2026-03-12T16:45:00.000Z",
    },
    {
      id: "auth-partner-key",
      name: "Partner API Key",
      provider: "api-key",
      status: "expired",
      scopes: ["partner:webhook:read"],
      workspaceIds: ["ws-partner-dev"],
      expiresAt: "2026-03-01T00:00:00.000Z",
      lastUsedAt: "2026-02-28T21:00:00.000Z",
      createdAt: "2026-02-12T12:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
}

function createAgents(): Agent[] {
  return [
    {
      id: "ag-router-01",
      name: "Global Router",
      role: "router",
      status: "healthy",
      workspaceId: "ws-core-prod",
      authProfileId: "auth-platform-oauth",
      host: "router-a.openclaw.internal",
      runtimeVersion: "0.1.0-mock",
      lastHeartbeatAt: "2026-03-13T04:00:00.000Z",
      uptimeSeconds: 942001,
      tags: ["routing", "ingress"],
      createdAt: "2026-01-05T09:00:00.000Z",
      updatedAt: "2026-03-13T04:00:00.000Z",
    },
    {
      id: "ag-discord-worker-01",
      name: "Discord Worker",
      role: "worker",
      status: "healthy",
      workspaceId: "ws-core-prod",
      authProfileId: "auth-bot-token",
      host: "worker-discord-01.openclaw.internal",
      runtimeVersion: "0.1.0-mock",
      lastHeartbeatAt: "2026-03-13T03:58:00.000Z",
      uptimeSeconds: 620004,
      tags: ["discord", "support"],
      createdAt: "2026-01-07T10:00:00.000Z",
      updatedAt: "2026-03-13T03:58:00.000Z",
    },
    {
      id: "ag-telegram-worker-01",
      name: "Telegram Worker",
      role: "worker",
      status: "degraded",
      workspaceId: "ws-core-prod",
      authProfileId: "auth-bot-token",
      host: "worker-telegram-01.openclaw.internal",
      runtimeVersion: "0.1.0-mock",
      lastHeartbeatAt: "2026-03-13T03:54:00.000Z",
      uptimeSeconds: 515223,
      tags: ["telegram", "alerts"],
      createdAt: "2026-01-08T10:30:00.000Z",
      updatedAt: "2026-03-13T03:54:00.000Z",
    },
    {
      id: "ag-analytics-coordinator-01",
      name: "Analytics Coordinator",
      role: "coordinator",
      status: "healthy",
      workspaceId: "ws-analytics-stg",
      authProfileId: "auth-platform-oauth",
      host: "analytics-coord-01.openclaw.internal",
      runtimeVersion: "0.1.0-mock",
      lastHeartbeatAt: "2026-03-13T03:57:00.000Z",
      uptimeSeconds: 330442,
      tags: ["analytics", "staging"],
      createdAt: "2026-01-22T09:00:00.000Z",
      updatedAt: "2026-03-13T03:57:00.000Z",
    },
    {
      id: "ag-partner-observer-01",
      name: "Partner Observer",
      role: "observer",
      status: "offline",
      workspaceId: "ws-partner-dev",
      authProfileId: "auth-partner-key",
      host: "partner-observer-01.openclaw.internal",
      runtimeVersion: "0.1.0-mock",
      lastHeartbeatAt: "2026-03-12T22:10:00.000Z",
      uptimeSeconds: 24011,
      tags: ["partner", "observer"],
      createdAt: "2026-02-13T14:00:00.000Z",
      updatedAt: "2026-03-12T22:10:00.000Z",
    },
    {
      id: "ag-dev-worker-01",
      name: "Dev Worker",
      role: "worker",
      status: "healthy",
      workspaceId: "ws-partner-dev",
      authProfileId: "auth-bot-token",
      host: "dev-worker-01.openclaw.internal",
      runtimeVersion: "0.1.0-mock",
      lastHeartbeatAt: "2026-03-13T03:59:00.000Z",
      uptimeSeconds: 150004,
      tags: ["dev", "partner"],
      createdAt: "2026-02-14T14:00:00.000Z",
      updatedAt: "2026-03-13T03:59:00.000Z",
    },
  ];
}

function createBindings(): BindingRoute[] {
  return [
    {
      id: "bd-discord-ingress",
      workspaceId: "ws-core-prod",
      routeType: "channel",
      source: "discord:#ops-control",
      targetAgentId: "ag-discord-worker-01",
      status: "active",
      description: "Primary Discord ingress for operations triage",
      createdAt: "2026-01-09T10:30:00.000Z",
      updatedAt: "2026-03-12T18:10:00.000Z",
    },
    {
      id: "bd-telegram-ingress",
      workspaceId: "ws-core-prod",
      routeType: "channel",
      source: "telegram:@openclaw_ops",
      targetAgentId: "ag-telegram-worker-01",
      status: "paused",
      description: "Telegram ingress paused pending token rotation",
      createdAt: "2026-01-09T11:00:00.000Z",
      updatedAt: "2026-03-12T17:00:00.000Z",
    },
    {
      id: "bd-analytics-api",
      workspaceId: "ws-analytics-stg",
      routeType: "api",
      source: "https://analytics-gateway.internal/events",
      targetAgentId: "ag-analytics-coordinator-01",
      status: "active",
      description: "Staging analytics event feed",
      createdAt: "2026-01-25T08:00:00.000Z",
      updatedAt: "2026-03-12T15:00:00.000Z",
    },
    {
      id: "bd-partner-webhook",
      workspaceId: "ws-partner-dev",
      routeType: "webhook",
      source: "https://partners.example.com/hooks/openclaw",
      targetAgentId: "ag-partner-observer-01",
      status: "error",
      description: "Partner webhook failing auth validation",
      createdAt: "2026-02-16T12:00:00.000Z",
      updatedAt: "2026-03-12T20:40:00.000Z",
    },
    {
      id: "bd-nightly-sync",
      workspaceId: "ws-analytics-stg",
      routeType: "schedule",
      source: "cron://0 */6 * * *",
      targetAgentId: "ag-analytics-coordinator-01",
      status: "active",
      description: "Scheduled refresh for analytics state",
      createdAt: "2026-01-27T09:00:00.000Z",
      updatedAt: "2026-03-12T18:40:00.000Z",
    },
  ];
}

function createSessions(): Session[] {
  return [
    {
      id: "sess-001",
      workspaceId: "ws-core-prod",
      agentId: "ag-discord-worker-01",
      bindingId: "bd-discord-ingress",
      status: "active",
      channel: "discord",
      startedAt: "2026-03-12T09:00:00.000Z",
      lastActivityAt: "2026-03-13T03:59:00.000Z",
      messageCount: 482,
    },
    {
      id: "sess-002",
      workspaceId: "ws-core-prod",
      agentId: "ag-telegram-worker-01",
      bindingId: "bd-telegram-ingress",
      status: "idle",
      channel: "telegram",
      startedAt: "2026-03-12T10:30:00.000Z",
      lastActivityAt: "2026-03-13T02:30:00.000Z",
      messageCount: 121,
    },
    {
      id: "sess-003",
      workspaceId: "ws-analytics-stg",
      agentId: "ag-analytics-coordinator-01",
      bindingId: "bd-analytics-api",
      status: "active",
      channel: "api",
      startedAt: "2026-03-12T11:00:00.000Z",
      lastActivityAt: "2026-03-13T03:51:00.000Z",
      messageCount: 941,
    },
    {
      id: "sess-004",
      workspaceId: "ws-partner-dev",
      agentId: "ag-partner-observer-01",
      bindingId: "bd-partner-webhook",
      status: "error",
      channel: "webhook",
      startedAt: "2026-03-12T15:40:00.000Z",
      lastActivityAt: "2026-03-12T20:39:00.000Z",
      messageCount: 18,
    },
    {
      id: "sess-005",
      workspaceId: "ws-partner-dev",
      agentId: "ag-dev-worker-01",
      bindingId: "bd-partner-webhook",
      status: "ended",
      channel: "webhook",
      startedAt: "2026-03-12T16:00:00.000Z",
      lastActivityAt: "2026-03-12T21:00:00.000Z",
      messageCount: 77,
    },
    {
      id: "sess-006",
      workspaceId: "ws-analytics-stg",
      agentId: "ag-analytics-coordinator-01",
      bindingId: "bd-nightly-sync",
      status: "active",
      channel: "schedule",
      startedAt: "2026-03-12T23:00:00.000Z",
      lastActivityAt: "2026-03-13T03:45:00.000Z",
      messageCount: 64,
    },
  ];
}

function createRuntimeStatuses(generatedAt: string): RuntimeStatus[] {
  return [
    {
      componentId: "sidecar",
      componentType: "service",
      status: "healthy",
      observedAt: generatedAt,
      details: {
        mode: "read-only",
        source: "mock",
      },
    },
    {
      componentId: "adapter:mock",
      componentType: "adapter",
      status: "healthy",
      observedAt: generatedAt,
      details: {
        adapterName: "MockOpenClawAdapter",
      },
    },
  ];
}

export function buildMockSnapshot(): SystemSnapshot {
  const generatedAt = new Date().toISOString();
  const workspaces = createWorkspaces();
  const authProfiles = createAuthProfiles();
  const agents = createAgents();
  const bindings = createBindings();
  const sessions = createSessions();
  const runtimeStatuses = createRuntimeStatuses(generatedAt);

  const summary = buildInventorySummary({
    generatedAt,
    agents,
    workspaces,
    sessions,
    bindings,
    authProfiles,
    runtimeStatuses,
  });

  const topology = buildTopologyView({
    generatedAt,
    agents,
    workspaces,
    sessions,
    bindings,
    authProfiles,
  });

  return {
    source: "mock",
    generatedAt,
    agents,
    workspaces,
    sessions,
    bindings,
    authProfiles,
    runtimeStatuses,
    summary,
    topology,
  };
}
