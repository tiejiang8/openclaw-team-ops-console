import type { AdapterSourceDescriptor, SystemSnapshot, WorkspaceDocument } from "@openclaw-team-ops/shared";

import type { AdapterHealth, SidecarInventoryAdapter } from "../source-adapter.js";
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
