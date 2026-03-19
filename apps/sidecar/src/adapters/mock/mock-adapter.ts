import type {
  AdapterSourceDescriptor,
  CronJobDetailDto,
  CronJobSummaryDto,
  LogEntriesQuery,
  LogLevel,
  NodeSummaryDto,
  PresenceEntry,
  RuntimeStatusDto,
  SystemSnapshot,
  WorkspaceDocument,
} from "@openclaw-team-ops/shared";

import type {
  AdapterHealth,
  AdapterCronJobResult,
  AdapterCronJobsResult,
  AdapterLogEntriesResult,
  AdapterLogFilesResult,
  AdapterLogRawFileResult,
  AdapterLogSummaryResult,
  AdapterNodesResult,
  AdapterPluginsResult,
  AdapterPresenceResult,
  AdapterRuntimeStatusResult,
  AdapterToolsResult,
  SidecarInventoryAdapter,
} from "../source-adapter.js";
import {
  buildMockSnapshot,
  buildMockWorkspaceDocument,
  DEFAULT_MOCK_SCENARIO,
  type MockScenario,
  normalizeMockScenario,
} from "./mock-data.js";

export const MOCK_ADAPTER_SCENARIOS = [
  DEFAULT_MOCK_SCENARIO,
  "partial-coverage",
  "stale-observability",
  "error-upstream",
] as const;
export type MockAdapterScenario = (typeof MOCK_ADAPTER_SCENARIOS)[number];

interface MockOpenClawAdapterOptions {
  scenario?: MockAdapterScenario;
}

export class MockOpenClawAdapter implements SidecarInventoryAdapter {
  public readonly adapterName = "MockOpenClawAdapter";
  public readonly source = "mock" as const;
  public readonly mode = "mock" as const;
  public readonly capabilities = {
    supportsCollectionMetadata: true,
    supportsPartialData: true,
    supportsDegradedSnapshots: true,
    supportsScenarioSelection: true,
    supportsSourceDescriptors: true,
  };

  private readonly scenario: MockAdapterScenario;

  constructor(options: MockOpenClawAdapterOptions = {}) {
    this.scenario = options.scenario ?? DEFAULT_MOCK_SCENARIO;
  }

  async describeSources(): Promise<AdapterSourceDescriptor[]> {
    return [
      {
        id: `mock:${this.scenario}`,
        displayName: `Mock Scenario: ${this.scenario}`,
        kind: "mock",
        readOnly: true,
        confidence: "confirmed",
        location: "apps/sidecar/src/adapters/mock/mock-data.ts",
        notes:
          this.scenario === "error-upstream"
            ? "Simulates upstream collection failure without introducing write paths."
            : "Standalone in-memory scenario fixture for read-only inventory development.",
      },
    ];
  }

  async fetchSnapshot(): Promise<SystemSnapshot> {
    if (this.scenario === "error-upstream") {
      throw new Error("Configured mock scenario simulates an upstream read failure.");
    }

    return buildMockSnapshot(normalizeMockScenario(this.scenario));
  }

  async getWorkspaceDocument(workspaceId: string, fileName: string): Promise<WorkspaceDocument | undefined> {
    if (this.scenario === "error-upstream") {
      throw new Error("Configured mock scenario simulates an upstream read failure.");
    }

    return buildMockWorkspaceDocument(workspaceId, fileName, normalizeMockScenario(this.scenario));
  }

  async getLogFiles(): Promise<AdapterLogFilesResult> {
    return {
      items: [],
      collectionStatus: {
        key: "logs",
        sourceKind: "mock",
        freshness: "unknown",
        coverage: "unavailable",
        warningCount: 1,
      },
      warnings: [
        {
          code: "MOCK_LOGS_UNAVAILABLE",
          severity: "info",
          message: "Mock mode does not provide filesystem-backed OpenClaw log files.",
          sourceId: `mock:${this.scenario}`,
        },
      ],
    };
  }

  async getLogSummary(date?: string): Promise<AdapterLogSummaryResult> {
    const files = await this.getLogFiles();

    return {
      collectionStatus: files.collectionStatus,
      ...(files.warnings ? { warnings: files.warnings } : {}),
      item: {
        date: date ?? new Date().toISOString().slice(0, 10),
        totalLines: 0,
        parsedLines: 0,
        levelCounts: buildEmptyLevelCounts(),
        signalCounts: {},
      },
    };
  }

  async getLogEntries(query: LogEntriesQuery): Promise<AdapterLogEntriesResult> {
    const files = await this.getLogFiles();

    return {
      collectionStatus: files.collectionStatus,
      ...(files.warnings ? { warnings: files.warnings } : {}),
      item: {
        date: query.date ?? new Date().toISOString().slice(0, 10),
        items: [],
        total: 0,
        limit: normalizeLimit(query.limit),
        ...(query.cursor ? { cursor: query.cursor } : {}),
        availableLevels: [],
        availableSubsystems: [],
        availableTags: [],
      },
    };
  }

  async getLogRawFile(date?: string): Promise<AdapterLogRawFileResult> {
    const files = await this.getLogFiles();

    return {
      collectionStatus: files.collectionStatus,
      ...(files.warnings ? { warnings: files.warnings } : {}),
      ...(date
        ? {
            item: {
              date,
              path: "",
              content: "",
              lineCount: 0,
              sizeBytes: 0,
              truncated: false,
            },
          }
        : {}),
    };
  }

  async getPresence(): Promise<AdapterPresenceResult> {
    const items = buildMockPresence();

    return {
      items,
      collectionStatus: {
        key: "presence",
        sourceKind: "mock",
        freshness: "fresh",
        coverage: "complete",
        warningCount: 0,
      },
    };
  }

  async getNodes(): Promise<AdapterNodesResult> {
    const items = buildMockNodes();

    return {
      items,
      collectionStatus: {
        key: "nodes",
        sourceKind: "mock",
        freshness: "fresh",
        coverage: "complete",
        warningCount: 0,
      },
    };
  }

  async getTools(): Promise<AdapterToolsResult> {
    return {
      items: [],
      collectionStatus: {
        key: "tools",
        sourceKind: "mock",
        freshness: "unknown",
        coverage: "unavailable",
        warningCount: 1,
      },
      warnings: [
        {
          code: "MOCK_GATEWAY_TOOLS_UNAVAILABLE",
          severity: "info",
          message: "Mock mode does not provide Gateway WebSocket tools.catalog data.",
          sourceId: `mock:${this.scenario}`,
        },
      ],
    };
  }

  async getPlugins(): Promise<AdapterPluginsResult> {
    return {
      items: [],
      collectionStatus: {
        key: "plugins",
        sourceKind: "mock",
        freshness: "unknown",
        coverage: "unavailable",
        warningCount: 1,
      },
      warnings: [
        {
          code: "MOCK_GATEWAY_PLUGINS_UNAVAILABLE",
          severity: "info",
          message: "Mock mode does not provide Gateway WebSocket plugin runtime inventory.",
          sourceId: `mock:${this.scenario}`,
        },
      ],
    };
  }

  async getRuntimeStatus(): Promise<AdapterRuntimeStatusResult> {
    const now = new Date().toISOString();
    const cronJobs = buildMockCronJobs();
    const nodes = buildMockNodes();
    const presence = buildMockPresence();

    const item: RuntimeStatusDto = {
      sourceMode: "mock",
      snapshotAt: now,
      gateway: {
        configured: false,
        authResolved: false,
        connectionState: "not-configured",
        transportProbe: "not-configured",
        dataReaderHealth: "healthy",
        lastSuccessAt: now,
        warnings: [],
      },
      openclaw: {
        overall: "healthy",
        stateDirDetected: true,
        configDetected: true,
        logsDetected: true,
      },
      nodes: {
        paired: nodes.filter((node) => node.paired).length,
        connected: nodes.filter((node) => node.connected).length,
        stale: nodes.filter((node) => node.paired && !node.connected).length,
        source: "mock",
        lastSyncAt: now,
      },
      cron: {
        total: cronJobs.length,
        enabled: cronJobs.filter((job) => job.enabled).length,
        overdue: cronJobs.filter((job) => job.overdue).length,
        failing: cronJobs.filter((job) => job.lastRunState === "error").length,
        source: "mock",
        lastSyncAt: now,
      },
      presence: {
        onlineDevices: presence.filter((entry) => entry.online).length,
        onlineOperators: presence.filter((entry) => entry.online && entry.roles.includes("operator")).length,
        lastSyncAt: now,
      },
    };

    return {
      item,
      collectionStatus: {
        key: "runtimeStatuses",
        sourceKind: "mock",
        freshness: "fresh",
        coverage: "complete",
        warningCount: 0,
        lastSuccessAt: now,
      },
    };
  }

  async getCronJobs(): Promise<AdapterCronJobsResult> {
    const now = new Date().toISOString();

    return {
      items: buildMockCronJobs(),
      collectionStatus: {
        key: "cron",
        sourceKind: "mock",
        freshness: "fresh",
        coverage: "complete",
        warningCount: 0,
        lastSuccessAt: now,
      },
    };
  }

  async getCronJobById(id: string): Promise<AdapterCronJobResult> {
    const item = buildMockCronJobDetail(id);
    const now = new Date().toISOString();

    return {
      item,
      collectionStatus: {
        key: "cron",
        sourceKind: "mock",
        freshness: "fresh",
        coverage: item ? "complete" : "unavailable",
        warningCount: 0,
        ...(item ? { lastSuccessAt: now } : {}),
      },
    };
  }

  async healthCheck(): Promise<AdapterHealth> {
    const observedAt = new Date().toISOString();

    if (this.scenario === "error-upstream") {
      return {
        name: this.adapterName,
        status: "down",
        observedAt,
        details: "Mock adapter is simulating an upstream read failure",
        warnings: [
          {
            code: "MOCK_UPSTREAM_FAILURE",
            severity: "error",
            message: "The configured mock scenario forces snapshot collection failures.",
            sourceId: "mock:error-upstream",
          },
        ],
      };
    }

    const normalizedScenario = normalizeMockScenario(this.scenario);
    const scenarioStatus = normalizedScenario === "baseline" ? "ok" : "degraded";

    return {
      name: this.adapterName,
      status: scenarioStatus,
      observedAt,
      details: `Mock data adapter is serving in-memory inventory (${normalizedScenario})`,
      ...(scenarioStatus === "degraded"
        ? {
            warnings: [
              {
                code: "MOCK_SCENARIO_DEGRADED",
                severity: "warn" as const,
                message: `The ${normalizedScenario} scenario is intentionally simulating degraded external data.`,
                sourceId: `mock:${normalizedScenario}`,
              },
            ],
          }
        : {}),
    };
  }

  async isDataPlaneHealthy(): Promise<boolean> {
    return this.scenario !== "error-upstream";
  }

  getStateDir(): string | undefined {
    return undefined;
  }

  getConfigFile(): string | undefined {
    return undefined;
  }

  getWorkspaceGlob(): string | undefined {
    return undefined;
  }

  getGatewayUrl(): string | undefined {
    return undefined;
  }
}

function buildMockPresence(): PresenceEntry[] {
  return [
    {
      deviceId: "mock-gateway",
      roles: ["gateway", "operator"],
      scopes: ["operator.read"],
      online: true,
      lastSeenAt: "2026-03-15T09:20:00.000Z",
    },
    {
      deviceId: "mock-node-1",
      roles: ["operator"],
      scopes: ["operator.read"],
      online: true,
      lastSeenAt: "2026-03-15T09:19:00.000Z",
    },
  ];
}

function buildMockNodes(): NodeSummaryDto[] {
  return [
    {
      id: "mock-node-1",
      name: "Ops Relay",
      platform: "linux",
      paired: true,
      connected: true,
      lastConnectAt: "2026-03-15T09:19:00.000Z",
      capabilities: ["gateway", "sessions", "cron"],
      source: "mock",
      deviceId: "mock-node-1",
      roles: ["operator"],
      scopes: ["operator.read"],
      online: true,
      lastSeenAt: "2026-03-15T09:19:00.000Z",
    },
    {
      id: "mock-node-2",
      name: "Night Shift Runner",
      platform: "darwin",
      paired: true,
      connected: false,
      lastConnectAt: "2026-03-15T08:10:00.000Z",
      capabilities: ["cron"],
      source: "mock",
      deviceId: "mock-node-2",
      roles: ["operator"],
      scopes: ["operator.read"],
      online: false,
      lastSeenAt: "2026-03-15T08:10:00.000Z",
    },
  ];
}

function buildMockCronJobs(): CronJobSummaryDto[] {
  return [
    {
      id: "mock-cron-1",
      name: "Workspace Heartbeat",
      scheduleText: "*/15 * * * *",
      timezone: "UTC",
      enabled: true,
      sessionTarget: "session:main:heartbeat",
      deliveryMode: "notify",
      nextRunAt: "2026-03-15T09:30:00.000Z",
      lastRunAt: "2026-03-15T09:15:00.000Z",
      lastRunState: "ok",
      overdue: false,
      source: "mock",
      evidenceRefs: [{ kind: "field", value: "mock.cron.Workspace Heartbeat" }],
    },
    {
      id: "mock-cron-2",
      name: "Escalation Sweep",
      scheduleText: "0 * * * *",
      timezone: "UTC",
      enabled: true,
      sessionTarget: "session:ops:alerts",
      deliveryMode: "broadcast",
      nextRunAt: "2026-03-15T08:00:00.000Z",
      lastRunAt: "2026-03-15T07:00:00.000Z",
      lastRunState: "error",
      overdue: true,
      source: "mock",
      evidenceRefs: [{ kind: "field", value: "mock.cron.Escalation Sweep" }],
    },
  ];
}

function buildMockCronJobDetail(id: string): CronJobDetailDto | undefined {
  const summary = buildMockCronJobs().find((job) => job.id === id);

  if (!summary) {
    return undefined;
  }

  return {
    ...summary,
    warnings: summary.overdue ? ["Mock scenario marks this cron as overdue."] : [],
    recentRuns:
      summary.id === "mock-cron-2"
        ? [
            {
              runId: "run-err-1",
              startedAt: "2026-03-15T07:00:00.000Z",
              finishedAt: "2026-03-15T07:00:12.000Z",
              state: "error",
              summary: "Gateway ping timed out.",
            },
          ]
        : [
            {
              runId: "run-ok-1",
              startedAt: "2026-03-15T09:15:00.000Z",
              finishedAt: "2026-03-15T09:15:04.000Z",
              state: "ok",
              summary: "Completed normally.",
            },
          ],
  };
}

function buildEmptyLevelCounts(): Record<LogLevel, number> {
  return {
    trace: 0,
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0,
    unknown: 0,
  };
}

function normalizeLimit(limit?: number): number {
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.min(Math.trunc(limit), 500) : 200;
}
