import {
  buildInventorySummary,
  buildTopologyView,
  createCollectionMetadata,
  type Agent,
  type AuthProfile,
  type BindingRoute,
  type CollectionMetadata,
  type CollectionName,
  type RuntimeStatus,
  type Session,
  type SnapshotWarning,
  type SystemSnapshot,
  type Workspace,
  type WorkspaceDocument,
} from "@openclaw-team-ops/shared";

export const MOCK_SCENARIOS = ["baseline", "partial-coverage", "stale-observability"] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export const DEFAULT_MOCK_SCENARIO: MockScenario = "baseline";

const MOCK_SOURCE_LOCATION = "apps/sidecar/src/adapters/mock/mock-data.ts";

interface FixtureData {
  workspaces: Workspace[];
  authProfiles: AuthProfile[];
  agents: Agent[];
  bindings: BindingRoute[];
  sessions: Session[];
  runtimeStatuses: RuntimeStatus[];
}

function cloneFixture<T>(value: T): T {
  return structuredClone(value);
}

function buildBaselineFixture(generatedAt: string): FixtureData {
  return {
    workspaces: [
      {
        id: "ws-core-prod",
        name: "Core Production",
        status: "healthy",
        environment: "production",
        ownerTeam: "Platform Operations",
        region: "us-east-1",
        coreMarkdownFiles: ["AGENTS.md", "BOOT.md", "BOOTSTRAP.md", "IDENTITY.md", "SOUL.md", "TOOLS.md", "USER.md", "HEARTBEAT.md"],
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
        coreMarkdownFiles: ["AGENTS.md", "BOOT.md", "BOOTSTRAP.md", "TOOLS.md", "USER.md"],
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
        coreMarkdownFiles: ["AGENTS.md", "BOOT.md", "BOOTSTRAP.md", "IDENTITY.md", "SOUL.md", "TOOLS.md", "USER.md"],
        createdAt: "2026-02-10T10:00:00.000Z",
        updatedAt: "2026-03-12T19:12:00.000Z",
      },
      {
        id: "ws-compliance-prod",
        name: "Compliance Production",
        status: "healthy",
        environment: "production",
        ownerTeam: "Risk and Compliance",
        region: "us-east-2",
        coreMarkdownFiles: ["AGENTS.md", "BOOT.md", "BOOTSTRAP.md", "HEARTBEAT.md", "IDENTITY.md", "MEMORY.md", "SOUL.md", "TOOLS.md", "USER.md"],
        createdAt: "2026-01-18T07:00:00.000Z",
        updatedAt: "2026-03-12T18:55:00.000Z",
      },
    ],
    authProfiles: [
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
      {
        id: "auth-compliance-cert",
        name: "Compliance Certificate",
        provider: "certificate",
        status: "disabled",
        scopes: ["audit:read", "archive:read"],
        workspaceIds: ["ws-compliance-prod"],
        createdAt: "2026-01-15T10:00:00.000Z",
        updatedAt: "2026-03-10T15:00:00.000Z",
      },
    ],
    agents: [
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
      {
        id: "ag-compliance-worker-01",
        name: "Compliance Worker",
        role: "worker",
        status: "healthy",
        workspaceId: "ws-compliance-prod",
        authProfileId: "auth-compliance-cert",
        host: "compliance-worker-01.openclaw.internal",
        runtimeVersion: "0.1.0-mock",
        lastHeartbeatAt: "2026-03-13T03:56:00.000Z",
        uptimeSeconds: 420112,
        tags: ["compliance", "audit"],
        createdAt: "2026-01-18T08:30:00.000Z",
        updatedAt: "2026-03-13T03:56:00.000Z",
      },
    ],
    bindings: [
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
      {
        id: "bd-compliance-audit",
        workspaceId: "ws-compliance-prod",
        routeType: "schedule",
        source: "cron://30 2 * * *",
        targetAgentId: "ag-compliance-worker-01",
        status: "active",
        description: "Nightly compliance audit sweep",
        createdAt: "2026-01-19T06:00:00.000Z",
        updatedAt: "2026-03-12T21:10:00.000Z",
      },
    ],
    sessions: [
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
      {
        id: "sess-007",
        workspaceId: "ws-compliance-prod",
        agentId: "ag-compliance-worker-01",
        bindingId: "bd-compliance-audit",
        status: "active",
        channel: "schedule",
        startedAt: "2026-03-12T02:30:00.000Z",
        lastActivityAt: "2026-03-13T03:25:00.000Z",
        messageCount: 203,
      },
      {
        id: "sess-008",
        workspaceId: "ws-core-prod",
        agentId: "ag-router-01",
        bindingId: "bd-discord-ingress",
        status: "idle",
        channel: "channel",
        startedAt: "2026-03-12T12:10:00.000Z",
        lastActivityAt: "2026-03-13T01:14:00.000Z",
        messageCount: 33,
      },
    ],
    runtimeStatuses: [
      {
        componentId: "sidecar",
        componentType: "service",
        status: "healthy",
        observedAt: generatedAt,
        details: {
          mode: "read-only",
          source: "mock",
          scenario: "baseline",
        },
      },
      {
        componentId: "adapter:mock",
        componentType: "adapter",
        status: "healthy",
        observedAt: generatedAt,
        details: {
          adapterName: "MockOpenClawAdapter",
          scenario: "baseline",
        },
      },
      {
        componentId: "gateway-probe",
        componentType: "dependency",
        status: "healthy",
        observedAt: generatedAt,
        details: {
          access: "simulated-external-readonly",
          probeLatencyMs: 42,
        },
      },
    ],
  };
}

function scenarioNotes(scenario: MockScenario): string {
  switch (scenario) {
    case "partial-coverage":
      return "Simulates partial inventory coverage and unavailable credential inventory.";
    case "stale-observability":
      return "Simulates cached but stale inventory after upstream reachability degradation.";
    case "baseline":
    default:
      return "Healthy enterprise-style standalone mock inventory.";
  }
}

function buildCollections(
  generatedAt: string,
  scenario: MockScenario,
  fixture: FixtureData,
  topologyRecordCount: number,
  overrides: Partial<Record<CollectionName, Partial<CollectionMetadata>>> = {},
): Record<CollectionName, CollectionMetadata> {
  const sourceIds = [`mock:${scenario}`];
  const baseCollections: Record<CollectionName, CollectionMetadata> = {
    agents: createCollectionMetadata({
      collection: "agents",
      collectedAt: generatedAt,
      recordCount: fixture.agents.length,
      sourceIds,
    }),
    workspaces: createCollectionMetadata({
      collection: "workspaces",
      collectedAt: generatedAt,
      recordCount: fixture.workspaces.length,
      sourceIds,
    }),
    sessions: createCollectionMetadata({
      collection: "sessions",
      collectedAt: generatedAt,
      recordCount: fixture.sessions.length,
      sourceIds,
    }),
    bindings: createCollectionMetadata({
      collection: "bindings",
      collectedAt: generatedAt,
      recordCount: fixture.bindings.length,
      sourceIds,
    }),
    authProfiles: createCollectionMetadata({
      collection: "authProfiles",
      collectedAt: generatedAt,
      recordCount: fixture.authProfiles.length,
      sourceIds,
    }),
    runtimeStatuses: createCollectionMetadata({
      collection: "runtimeStatuses",
      collectedAt: generatedAt,
      recordCount: fixture.runtimeStatuses.length,
      sourceIds,
    }),
    topology: createCollectionMetadata({
      collection: "topology",
      collectedAt: generatedAt,
      recordCount: topologyRecordCount,
      sourceIds,
    }),
  };

  for (const collectionName of Object.keys(overrides) as CollectionName[]) {
    const baseCollection = baseCollections[collectionName];
    const override = overrides[collectionName];

    if (!override) {
      continue;
    }

    baseCollections[collectionName] = {
      ...baseCollection,
      ...override,
      warnings: override.warnings ?? baseCollection.warnings,
    };
  }

  return baseCollections;
}

function assembleSnapshot(
  generatedAt: string,
  scenario: MockScenario,
  fixture: FixtureData,
  warnings: SnapshotWarning[] = [],
  collectionOverrides: Partial<Record<CollectionName, Partial<CollectionMetadata>>> = {},
): SystemSnapshot {
  const summary = buildInventorySummary({
    generatedAt,
    agents: fixture.agents,
    workspaces: fixture.workspaces,
    sessions: fixture.sessions,
    bindings: fixture.bindings,
    authProfiles: fixture.authProfiles,
    runtimeStatuses: fixture.runtimeStatuses,
  });

  const topology = buildTopologyView({
    generatedAt,
    agents: fixture.agents,
    workspaces: fixture.workspaces,
    sessions: fixture.sessions,
    bindings: fixture.bindings,
    authProfiles: fixture.authProfiles,
  });

  return {
    source: "mock",
    generatedAt,
    origin: {
      adapterName: "MockOpenClawAdapter",
      mode: "mock",
      collectedAt: generatedAt,
      sources: [
        {
          id: `mock:${scenario}`,
          displayName: `Mock Scenario: ${scenario}`,
          kind: "mock",
          readOnly: true,
          confidence: "confirmed",
          location: MOCK_SOURCE_LOCATION,
          notes: scenarioNotes(scenario),
        },
      ],
    },
    collections: buildCollections(
      generatedAt,
      scenario,
      fixture,
      topology.nodes.length + topology.edges.length,
      collectionOverrides,
    ),
    warnings,
    agents: fixture.agents,
    workspaces: fixture.workspaces,
    sessions: fixture.sessions,
    bindings: fixture.bindings,
    authProfiles: fixture.authProfiles,
    runtimeStatuses: fixture.runtimeStatuses,
    summary,
    topology,
  };
}

function buildBaselineSnapshot(generatedAt: string): SystemSnapshot {
  const fixture = buildBaselineFixture(generatedAt);

  return assembleSnapshot(
    generatedAt,
    "baseline",
    fixture,
    [
      {
        code: "MOCK_MODE_ACTIVE",
        severity: "info",
        message: "Standalone mock scenario is active; no live OpenClaw data is being collected.",
        sourceId: "mock:baseline",
      },
    ],
  );
}

function buildPartialCoverageSnapshot(generatedAt: string): SystemSnapshot {
  const fixture = cloneFixture(buildBaselineFixture(generatedAt));

  fixture.authProfiles = [];

  fixture.runtimeStatuses = [
    {
      componentId: "sidecar",
      componentType: "service",
      status: "degraded",
      observedAt: generatedAt,
      details: {
        mode: "read-only",
        source: "mock",
        scenario: "partial-coverage",
      },
    },
    {
      componentId: "adapter:mock",
      componentType: "adapter",
      status: "degraded",
      observedAt: generatedAt,
      details: {
        adapterName: "MockOpenClawAdapter",
        scenario: "partial-coverage",
        authProfiles: "unavailable",
      },
    },
    {
      componentId: "filesystem-cache",
      componentType: "dependency",
      status: "healthy",
      observedAt: generatedAt,
      details: {
        mode: "simulated-cache",
        coverage: "partial",
      },
    },
  ];

  const partialAgent = fixture.agents.find((agent) => agent.id === "ag-partner-observer-01");
  if (partialAgent) {
    delete partialAgent.authProfileId;
    delete partialAgent.host;
    delete partialAgent.lastHeartbeatAt;
    delete partialAgent.uptimeSeconds;
    partialAgent.tags = ["partner"];
  }

  const orphanAgent = fixture.agents.find((agent) => agent.id === "ag-compliance-worker-01");
  if (orphanAgent) {
    delete orphanAgent.workspaceId;
    delete orphanAgent.runtimeVersion;
  }

  const partialWorkspace = fixture.workspaces.find((workspace) => workspace.id === "ws-compliance-prod");
  if (partialWorkspace) {
    delete partialWorkspace.ownerTeam;
    delete partialWorkspace.region;
    delete partialWorkspace.updatedAt;
  }

  const partialBinding = fixture.bindings.find((binding) => binding.id === "bd-compliance-audit");
  if (partialBinding) {
    delete partialBinding.targetAgentId;
    delete partialBinding.description;
    delete partialBinding.updatedAt;
  }

  const partialSession = fixture.sessions.find((session) => session.id === "sess-007");
  if (partialSession) {
    delete partialSession.bindingId;
    delete partialSession.lastActivityAt;
    delete partialSession.messageCount;
  }

  return assembleSnapshot(
    generatedAt,
    "partial-coverage",
    fixture,
    [
      {
        code: "AUTH_PROFILES_UNAVAILABLE",
        severity: "warn",
        message: "Auth profile inventory is unavailable in this scenario and agent links may be incomplete.",
        collection: "authProfiles",
        sourceId: "mock:partial-coverage",
      },
      {
        code: "PARTIAL_LINK_DATA",
        severity: "warn",
        message: "Some relationship fields are intentionally missing to simulate degraded external source coverage.",
        collection: "topology",
        sourceId: "mock:partial-coverage",
      },
    ],
    {
      bindings: {
        status: "partial",
        warnings: [
          {
            code: "TARGET_AGENT_MISSING",
            severity: "warn",
            message: "One binding lacks a target agent identifier.",
            collection: "bindings",
            sourceId: "mock:partial-coverage",
          },
        ],
      },
      authProfiles: {
        status: "unavailable",
        freshness: "unknown",
        recordCount: 0,
        warnings: [
          {
            code: "AUTH_PROFILE_SOURCE_DISABLED",
            severity: "warn",
            message: "Credential profile collection is intentionally unavailable in this scenario.",
            collection: "authProfiles",
            sourceId: "mock:partial-coverage",
          },
        ],
      },
      sessions: {
        status: "partial",
        warnings: [
          {
            code: "SESSION_ACTIVITY_REDACTED",
            severity: "warn",
            message: "Some session activity fields are omitted to exercise degraded UI handling.",
            collection: "sessions",
            sourceId: "mock:partial-coverage",
          },
        ],
      },
      topology: {
        status: "partial",
        warnings: [
          {
            code: "RELATIONSHIP_GAPS",
            severity: "warn",
            message: "Topology excludes edges whose required identifiers were missing from the source fixture.",
            collection: "topology",
            sourceId: "mock:partial-coverage",
          },
        ],
      },
      runtimeStatuses: {
        status: "partial",
      },
    },
  );
}

function buildStaleObservabilitySnapshot(generatedAt: string): SystemSnapshot {
  const fixture = cloneFixture(buildBaselineFixture(generatedAt));
  const staleCollectedAt = "2026-03-10T18:00:00.000Z";

  for (const agent of fixture.agents) {
    if (agent.lastHeartbeatAt) {
      agent.lastHeartbeatAt = "2026-03-10T17:30:00.000Z";
    }
  }

  for (const workspace of fixture.workspaces) {
    workspace.updatedAt = "2026-03-10T17:00:00.000Z";
  }

  for (const binding of fixture.bindings) {
    binding.updatedAt = "2026-03-10T16:30:00.000Z";
  }

  for (const session of fixture.sessions) {
    session.lastActivityAt = "2026-03-10T16:15:00.000Z";
  }

  fixture.runtimeStatuses = [
    {
      componentId: "sidecar",
      componentType: "service",
      status: "degraded",
      observedAt: generatedAt,
      details: {
        mode: "read-only",
        source: "mock",
        scenario: "stale-observability",
      },
    },
    {
      componentId: "adapter:mock",
      componentType: "adapter",
      status: "degraded",
      observedAt: generatedAt,
      details: {
        adapterName: "MockOpenClawAdapter",
        scenario: "stale-observability",
        staleMinutes: 3480,
      },
    },
    {
      componentId: "gateway-probe",
      componentType: "dependency",
      status: "offline",
      observedAt: generatedAt,
      details: {
        access: "simulated-external-readonly",
        lastSuccessfulProbeAt: staleCollectedAt,
      },
    },
  ];

  return assembleSnapshot(
    generatedAt,
    "stale-observability",
    fixture,
    [
      {
        code: "STALE_COLLECTIONS",
        severity: "warn",
        message: "Snapshot is serving cached inventory after simulated upstream probe failures.",
        sourceId: "mock:stale-observability",
      },
    ],
    {
      agents: {
        freshness: "stale",
        collectedAt: staleCollectedAt,
        warnings: [
          {
            code: "HEARTBEAT_STALE",
            severity: "warn",
            message: "Agent heartbeat data is older than the preferred freshness window.",
            collection: "agents",
            sourceId: "mock:stale-observability",
          },
        ],
      },
      workspaces: {
        freshness: "stale",
        collectedAt: staleCollectedAt,
      },
      sessions: {
        freshness: "stale",
        collectedAt: staleCollectedAt,
      },
      bindings: {
        freshness: "stale",
        collectedAt: staleCollectedAt,
      },
      authProfiles: {
        freshness: "stale",
        collectedAt: staleCollectedAt,
      },
      runtimeStatuses: {
        freshness: "stale",
        collectedAt: staleCollectedAt,
        warnings: [
          {
            code: "UPSTREAM_PROBE_FAILED",
            severity: "error",
            message: "Simulated gateway probe is offline; runtime health is based on stale cached state.",
            collection: "runtimeStatuses",
            sourceId: "mock:stale-observability",
          },
        ],
      },
      topology: {
        freshness: "stale",
        collectedAt: staleCollectedAt,
      },
    },
  );
}

export function normalizeMockScenario(input?: string): MockScenario {
  if (!input) {
    return DEFAULT_MOCK_SCENARIO;
  }

  const normalized = input.trim().toLowerCase();
  return (MOCK_SCENARIOS as readonly string[]).includes(normalized)
    ? (normalized as MockScenario)
    : DEFAULT_MOCK_SCENARIO;
}

export function buildMockSnapshot(scenario: MockScenario = DEFAULT_MOCK_SCENARIO): SystemSnapshot {
  const generatedAt = new Date().toISOString();

  switch (scenario) {
    case "partial-coverage":
      return buildPartialCoverageSnapshot(generatedAt);
    case "stale-observability":
      return buildStaleObservabilitySnapshot(generatedAt);
    case "baseline":
    default:
      return buildBaselineSnapshot(generatedAt);
  }
}

export function buildMockWorkspaceDocument(
  workspaceId: string,
  fileName: string,
  scenario: MockScenario = DEFAULT_MOCK_SCENARIO,
): WorkspaceDocument | undefined {
  const snapshot = buildMockSnapshot(scenario);
  const workspace = snapshot.workspaces.find((candidate) => candidate.id === workspaceId);

  if (!workspace || !workspace.coreMarkdownFiles?.includes(fileName)) {
    return undefined;
  }

  const generatedAt = snapshot.generatedAt;
  const sections = [
    `# ${workspace.name} · ${fileName}`,
    "",
    `- Workspace ID: ${workspace.id}`,
    `- Status: ${workspace.status}`,
    `- Environment: ${workspace.environment ?? "unknown"}`,
    `- Owner Team: ${workspace.ownerTeam ?? "unknown"}`,
    `- Source: mock/${scenario}`,
    `- Generated At: ${generatedAt}`,
    "",
    "## Notes",
    "",
    "This is mock markdown content generated by the standalone read-only sidecar.",
    "It is intended for UI preview and integration testing only.",
  ];

  return {
    workspaceId: workspace.id,
    fileName,
    contentType: "text/markdown",
    content: sections.join("\n"),
    sourcePath: `${MOCK_SOURCE_LOCATION}#${workspace.id}/${fileName}`,
    updatedAt: workspace.updatedAt ?? generatedAt,
  };
}
