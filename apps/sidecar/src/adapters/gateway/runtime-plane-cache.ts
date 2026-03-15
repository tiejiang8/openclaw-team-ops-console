import type { CronJobDetailDto, CronJobSummaryDto, NodeSummaryDto, PresenceEntry, RuntimeConnectionState } from "@openclaw-team-ops/shared";

import { fetchGatewayCronJobDetail, fetchGatewayCronJobs } from "./fetch-cron.js";
import { fetchGatewayNodes } from "./fetch-nodes.js";
import { fetchGatewayPresence } from "./fetch-presence.js";
import { fetchGatewayIdentity, fetchGatewayStatus, type GatewayIdentityProbe, type GatewayStatusProbe } from "./fetch-runtime-status.js";
import { GatewayRuntimePlaneClient } from "./gateway-client.js";

export interface GatewayRuntimePlaneState {
  configured: boolean;
  authResolved: boolean;
  connectionState: RuntimeConnectionState;
  rpcHealthy?: boolean;
  identity?: GatewayIdentityProbe;
  lastSeenAt?: string;
  warnings: string[];
  snapshotAt: string;
  presence: PresenceEntry[];
  nodes: NodeSummaryDto[];
  cronJobs: CronJobSummaryDto[];
  cronDetailsById: Map<string, CronJobDetailDto>;
  status?: GatewayStatusProbe;
}

interface GatewayRuntimePlaneCacheOptions {
  url?: string;
  authToken?: string;
  timeoutMs?: number;
  clientFactory?: (options: GatewayRuntimePlaneClientOptions) => GatewayRuntimePlaneClientLike;
}

interface GatewayRuntimePlaneClientOptions {
  url: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface GatewayRuntimePlaneClientLike {
  ensureConnected(): Promise<void>;
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;
  subscribe(listener: (event: { name: string; payload: unknown }) => void): () => void;
  disconnect(): void;
}

export class GatewayRuntimePlaneCache {
  private readonly url: string | undefined;
  private readonly authToken: string | undefined;
  private readonly timeoutMs: number;
  private readonly clientFactory: (options: GatewayRuntimePlaneClientOptions) => GatewayRuntimePlaneClientLike;
  private client: GatewayRuntimePlaneClientLike | undefined;
  private snapshot: GatewayRuntimePlaneState | undefined;
  private refreshPromise: Promise<GatewayRuntimePlaneState> | undefined;
  private lastLoadedAtMs = 0;
  private unsubscribeEventListener: (() => void) | undefined;

  constructor(options: GatewayRuntimePlaneCacheOptions) {
    this.url = normalizeInput(options.url);
    this.authToken = normalizeInput(options.authToken);
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.clientFactory = options.clientFactory ?? ((clientOptions) => new GatewayRuntimePlaneClient(clientOptions));
  }

  async getState(): Promise<GatewayRuntimePlaneState> {
    if (!this.url) {
      return this.buildBaseState("not-configured");
    }

    if (!this.authToken) {
      return this.buildBaseState("auth-missing");
    }

    if (this.snapshot && Date.now() - this.lastLoadedAtMs <= 5_000) {
      return this.snapshot;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshAll();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  async getCronJobById(id: string): Promise<CronJobDetailDto | undefined> {
    const state = await this.getState();

    if (state.connectionState !== "connected" && state.connectionState !== "degraded") {
      return undefined;
    }

    const existing = state.cronDetailsById.get(id);

    if (existing) {
      return existing;
    }

    if (!this.client) {
      return undefined;
    }

    const detail = await fetchGatewayCronJobDetail(this.client, id);

    if (detail) {
      state.cronDetailsById.set(id, detail);
    }

    return detail;
  }

  reset(): void {
    this.unsubscribeEventListener?.();
    this.unsubscribeEventListener = undefined;
    this.client?.disconnect();
    this.client = undefined;
    this.snapshot = undefined;
    this.refreshPromise = undefined;
    this.lastLoadedAtMs = 0;
  }

  private async refreshAll(): Promise<GatewayRuntimePlaneState> {
    if (!this.url) {
      return this.buildBaseState("not-configured");
    }

    if (!this.authToken) {
      return this.buildBaseState("auth-missing");
    }

    const client = this.ensureClient();
    const base = this.buildBaseState("connecting");

    try {
      await client.ensureConnected();
      this.bindEventListener(client);

      const [statusResult, identityResult, presenceResult, nodesResult, cronResult] = await Promise.allSettled([
        fetchGatewayStatus(client),
        fetchGatewayIdentity(client),
        fetchGatewayPresence(client),
        fetchGatewayNodes(client),
        fetchGatewayCronJobs(client),
      ]);

      const warnings = [
        ...extractRejectedWarning(statusResult),
        ...extractRejectedWarning(identityResult),
        ...extractRejectedWarning(presenceResult),
        ...extractRejectedWarning(nodesResult),
        ...extractRejectedWarning(cronResult),
      ];
      const connectionState = determineConnectionState([statusResult, identityResult], warnings);
      const snapshotAt = new Date().toISOString();
      const snapshot: GatewayRuntimePlaneState = {
        configured: true,
        authResolved: true,
        connectionState,
        rpcHealthy: statusResult.status === "fulfilled" ? statusResult.value.rpcHealthy : connectionState === "connected",
        ...(identityResult.status === "fulfilled" ? { identity: identityResult.value } : {}),
        lastSeenAt: snapshotAt,
        warnings,
        snapshotAt,
        presence: presenceResult.status === "fulfilled" ? presenceResult.value : [],
        nodes: nodesResult.status === "fulfilled" ? nodesResult.value : [],
        cronJobs: cronResult.status === "fulfilled" ? cronResult.value : [],
        cronDetailsById: new Map(),
        ...(statusResult.status === "fulfilled" ? { status: statusResult.value } : {}),
      };

      this.snapshot = snapshot;
      this.lastLoadedAtMs = Date.now();
      return snapshot;
    } catch (error) {
      const message = toErrorMessage(error);
      const connectionState: RuntimeConnectionState = message.toLowerCase().includes("scope")
        ? "degraded"
        : "disconnected";
      const snapshot: GatewayRuntimePlaneState = {
        ...base,
        connectionState,
        warnings: [message],
        snapshotAt: new Date().toISOString(),
      };

      this.snapshot = snapshot;
      this.lastLoadedAtMs = Date.now();
      return snapshot;
    }
  }

  private bindEventListener(client: GatewayRuntimePlaneClientLike): void {
    if (this.unsubscribeEventListener) {
      return;
    }

    this.unsubscribeEventListener = client.subscribe((event) => {
      if (!this.snapshot) {
        return;
      }

      if (["tick", "presence", "health", "cron"].includes(event.name)) {
        this.snapshot.lastSeenAt = new Date().toISOString();
      }

      if (event.name === "tick") {
        this.snapshot.snapshotAt = new Date().toISOString();
      }
    });
  }

  private ensureClient(): GatewayRuntimePlaneClientLike {
    if (!this.client) {
      this.client = this.clientFactory({
        url: this.url as string,
        timeoutMs: this.timeoutMs,
        ...(this.authToken ? { authToken: this.authToken } : {}),
      });
    }

    return this.client;
  }

  private buildBaseState(connectionState: RuntimeConnectionState): GatewayRuntimePlaneState {
    return {
      configured: Boolean(this.url),
      authResolved: Boolean(this.authToken),
      connectionState,
      warnings: [],
      snapshotAt: new Date().toISOString(),
      presence: [],
      nodes: [],
      cronJobs: [],
      cronDetailsById: new Map(),
    };
  }
}

function determineConnectionState(
  criticalResults: Array<PromiseSettledResult<unknown>>,
  warnings: string[],
): RuntimeConnectionState {
  if (criticalResults.every((result) => result.status === "fulfilled")) {
    return warnings.length > 0 ? "degraded" : "connected";
  }

  if (warnings.some((warning) => warning.toLowerCase().includes("scope"))) {
    return "degraded";
  }

  return "disconnected";
}

function extractRejectedWarning(result: PromiseSettledResult<unknown>): string[] {
  return result.status === "rejected" ? [toErrorMessage(result.reason)] : [];
}

function normalizeInput(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
