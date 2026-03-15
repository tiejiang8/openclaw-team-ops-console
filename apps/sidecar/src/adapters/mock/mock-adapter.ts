import type {
  AdapterSourceDescriptor,
  LogEntriesQuery,
  LogLevel,
  SystemSnapshot,
  WorkspaceDocument,
} from "@openclaw-team-ops/shared";

import type {
  AdapterHealth,
  AdapterLogEntriesResult,
  AdapterLogFilesResult,
  AdapterLogRawFileResult,
  AdapterLogSummaryResult,
  AdapterNodesResult,
  AdapterPluginsResult,
  AdapterPresenceResult,
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
    return {
      items: [],
      collectionStatus: {
        key: "presence",
        sourceKind: "mock",
        freshness: "unknown",
        coverage: "unavailable",
        warningCount: 1,
      },
      warnings: [
        {
          code: "MOCK_GATEWAY_PRESENCE_UNAVAILABLE",
          severity: "info",
          message: "Mock mode does not provide Gateway WebSocket presence data.",
          sourceId: `mock:${this.scenario}`,
        },
      ],
    };
  }

  async getNodes(): Promise<AdapterNodesResult> {
    return {
      items: [],
      collectionStatus: {
        key: "nodes",
        sourceKind: "mock",
        freshness: "unknown",
        coverage: "unavailable",
        warningCount: 1,
      },
      warnings: [
        {
          code: "MOCK_GATEWAY_NODES_UNAVAILABLE",
          severity: "info",
          message: "Mock mode does not provide Gateway WebSocket node inventory.",
          sourceId: `mock:${this.scenario}`,
        },
      ],
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
