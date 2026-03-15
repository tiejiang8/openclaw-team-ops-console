import { randomUUID } from "node:crypto";

import type { Plugin, PresenceEntry, Session, Tool, Node as RuntimeNode } from "@openclaw-team-ops/shared";

import { connectOperatorRead } from "./connect-operator-read.js";
import { fetchRuntimeSessions } from "./fetch-session-runtime.js";
import { fetchSystemPresence, normalizeNodeEntries } from "./fetch-system-presence.js";
import { fetchToolsCatalog, normalizePluginsFromCatalog, normalizeToolsCatalog } from "./fetch-tools-catalog.js";
import {
  buildGatewayCollection,
  buildUnavailableGatewayCollection,
  isRecord,
  type GatewayClock,
  type GatewayConnection,
  type GatewayRuntimeCollection,
  type GatewayRuntimeSnapshot,
  type GatewayTransport,
  type GatewayTransportHandlers,
} from "./protocol.js";

interface GatewayWsRuntimeClientOptions {
  url: string;
  timeoutMs?: number;
  transport?: GatewayTransport;
  clock?: GatewayClock;
  authToken?: string;
}

export interface GatewayRuntimeClient {
  readRuntimeSnapshot(): Promise<GatewayRuntimeSnapshot>;
}

interface PendingRequest {
  method: string;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  timeout: NodeJS.Timeout;
}

type WebSocketLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  onopen?: (() => void) | null;
  onmessage?: ((event: unknown) => void) | null;
  onerror?: ((event: unknown) => void) | null;
  onclose?: ((event: unknown) => void) | null;
};

export class GatewayWsRuntimeClient implements GatewayRuntimeClient {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly transport: GatewayTransport;
  private readonly clock: GatewayClock;
  private readonly authToken: string | undefined;
  private readonly pending = new Map<string, PendingRequest>();
  private connection: GatewayConnection | undefined;

  constructor(options: GatewayWsRuntimeClientOptions) {
    this.url = options.url;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.transport = options.transport ?? new WebSocketGatewayTransport();
    this.clock = options.clock ?? { now: () => new Date() };
    this.authToken = typeof options.authToken === "string" && options.authToken.trim().length > 0 ? options.authToken.trim() : undefined;
  }

  async readRuntimeSnapshot(): Promise<GatewayRuntimeSnapshot> {
    this.connection = await this.transport.connect(
      this.url,
      {
        onMessage: (message) => {
          this.handleMessage(message);
        },
        onClose: (code, reason) => {
          this.failPending(new Error(`Gateway WebSocket closed before read completed (${code ?? "no-code"}: ${reason ?? "no-reason"})`));
        },
        onError: (error) => {
          this.failPending(error instanceof Error ? error : new Error("Gateway WebSocket transport error"));
        },
      },
      {
        timeoutMs: this.timeoutMs,
      },
    );

    try {
      await connectOperatorRead(this, {
        ...(this.authToken ? { authToken: this.authToken } : {}),
      });

      const [presenceResult, nodesResult, sessionsResult, toolsCatalogResult] = await Promise.allSettled([
        fetchSystemPresence(this),
        this.request("node.list"),
        fetchRuntimeSessions(this, this.clock.now()),
        fetchToolsCatalog(this),
      ]);
      const fetchedAt = this.clock.now().toISOString();
      const presence = toPresenceCollection(presenceResult);
      const nodes = toNodesCollection(nodesResult, presence.items);
      const sessions = toSessionsCollection(sessionsResult);
      const tools = toToolsCollection(toolsCatalogResult);
      const plugins = toPluginsCollection(toolsCatalogResult, tools.items);

      return {
        fetchedAt,
        presence,
        nodes,
        sessions,
        tools,
        plugins,
      };
    } finally {
      this.connection?.close(1000, "read-only runtime snapshot complete");
      this.connection = undefined;
      this.failPending(new Error("Gateway WebSocket request was cancelled"));
    }
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.connection) {
      throw new Error(`Gateway WebSocket is not connected. Cannot call ${method}.`);
    }

    const id = randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway request timed out: ${method}`));
      }, this.timeoutMs);

      this.pending.set(id, {
        method,
        resolve,
        reject,
        timeout,
      });

      this.connection?.send(
        JSON.stringify({
          type: "req",
          id,
          method,
          params,
        }),
      );
    });
  }

  private handleMessage(message: string): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    if (!isRecord(parsed)) {
      return;
    }

    const messageId = parsed.id;

    if (typeof messageId !== "string" && typeof messageId !== "number") {
      return;
    }

    const pending = this.pending.get(String(messageId));

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(String(messageId));

    const errorMessage = extractErrorMessage(parsed);

    if (errorMessage) {
      pending.reject(new Error(`${pending.method} failed: ${errorMessage}`));
      return;
    }

    pending.resolve(extractResult(parsed));
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }

    this.pending.clear();
  }
}

export class WebSocketGatewayTransport implements GatewayTransport {
  async connect(
    url: string,
    handlers: GatewayTransportHandlers,
    options: {
      timeoutMs?: number;
    } = {},
  ): Promise<GatewayConnection> {
    const WebSocketConstructor = (globalThis as unknown as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;

    if (!WebSocketConstructor) {
      throw new Error("WebSocket client support is unavailable in this Node runtime.");
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const socket = new WebSocketConstructor(url);
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Timed out while connecting to Gateway WebSocket ${url}`));
          socket.close(1000, "connection timeout");
        }
      }, options.timeoutMs ?? 5000);

      const resolveOpen = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        resolve({
          send(message: string) {
            socket.send(message);
          },
          close(code?: number, reason?: string) {
            socket.close(code, reason);
          },
        });
      };
      const rejectOpen = (error: unknown) => {
        if (settled) {
          handlers.onError(error);
          return;
        }

        settled = true;
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error("Failed to connect to Gateway WebSocket"));
      };
      const messageHandler = (event: unknown) => {
        handlers.onMessage(normalizeMessagePayload(event));
      };
      const closeHandler = (event: unknown) => {
        const closeEvent = isRecord(event) ? event : {};
        const code = typeof closeEvent.code === "number" ? closeEvent.code : undefined;
        const reason = typeof closeEvent.reason === "string" ? closeEvent.reason : undefined;
        handlers.onClose(code, reason);
      };
      const errorHandler = (event: unknown) => {
        rejectOpen(event instanceof Error ? event : new Error("Gateway WebSocket transport error"));
      };

      if (typeof socket.addEventListener === "function") {
        socket.addEventListener("open", resolveOpen);
        socket.addEventListener("message", messageHandler);
        socket.addEventListener("close", closeHandler);
        socket.addEventListener("error", errorHandler);
        return;
      }

      socket.onopen = resolveOpen;
      socket.onmessage = messageHandler;
      socket.onclose = closeHandler;
      socket.onerror = errorHandler;
    });
  }
}

function normalizeMessagePayload(event: unknown): string {
  if (typeof event === "string") {
    return event;
  }

  if (isRecord(event) && typeof event.data === "string") {
    return event.data;
  }

  if (isRecord(event) && event.data instanceof ArrayBuffer) {
    return Buffer.from(event.data).toString("utf8");
  }

  if (isRecord(event) && event.data instanceof Uint8Array) {
    return Buffer.from(event.data).toString("utf8");
  }

  return "";
}

function extractResult(message: Record<string, unknown>): unknown {
  if ("result" in message) {
    return message.result;
  }

  if ("data" in message) {
    return message.data;
  }

  if ("payload" in message) {
    return message.payload;
  }

  if ("params" in message) {
    return message.params;
  }

  return message;
}

function extractErrorMessage(message: Record<string, unknown>): string | undefined {
  if (typeof message.error === "string") {
    return message.error;
  }

  if (isRecord(message.error)) {
    const nestedMessage =
      (typeof message.error.message === "string" && message.error.message) ||
      (typeof message.error.code === "string" && message.error.code);

    if (nestedMessage) {
      return nestedMessage;
    }
  }

  if (message.ok === false && typeof message.message === "string") {
    return message.message;
  }

  return undefined;
}

function toPresenceCollection(
  result: PromiseSettledResult<PresenceEntry[]>,
): GatewayRuntimeCollection<PresenceEntry> {
  if (result.status === "fulfilled") {
    return buildGatewayCollection(result.value);
  }

  return buildUnavailableGatewayCollection(`system-presence failed: ${toErrorMessage(result.reason)}`);
}

function toNodesCollection(
  result: PromiseSettledResult<unknown>,
  fallbackPresence: PresenceEntry[],
): GatewayRuntimeCollection<RuntimeNode> {
  if (result.status === "fulfilled") {
    return buildGatewayCollection(normalizeNodeEntries(result.value));
  }

  if (fallbackPresence.length > 0) {
    return buildGatewayCollection(
      fallbackPresence.map((entry) => ({
        deviceId: entry.deviceId,
        roles: entry.roles,
        scopes: entry.scopes,
        online: entry.online,
        ...(entry.lastSeenAt ? { lastSeenAt: entry.lastSeenAt } : {}),
      })),
      {
        coverage: "partial",
        warningMessages: [`node.list failed and nodes were inferred from system-presence: ${toErrorMessage(result.reason)}`],
      },
    );
  }

  return buildUnavailableGatewayCollection(`node.list failed: ${toErrorMessage(result.reason)}`);
}

function toSessionsCollection(result: PromiseSettledResult<Session[]>): GatewayRuntimeCollection<Session> {
  if (result.status === "fulfilled") {
    return buildGatewayCollection(result.value);
  }

  return buildUnavailableGatewayCollection(`sessions.list failed: ${toErrorMessage(result.reason)}`);
}

function toToolsCollection(result: PromiseSettledResult<unknown>): GatewayRuntimeCollection<Tool> {
  if (result.status === "fulfilled") {
    return buildGatewayCollection(normalizeToolsCatalog(result.value));
  }

  return buildUnavailableGatewayCollection(`tools.catalog failed: ${toErrorMessage(result.reason)}`);
}

function toPluginsCollection(
  result: PromiseSettledResult<unknown>,
  tools: Tool[],
): GatewayRuntimeCollection<Plugin> {
  if (result.status === "fulfilled") {
    return buildGatewayCollection(normalizePluginsFromCatalog(result.value, tools));
  }

  return buildUnavailableGatewayCollection(`tools.catalog failed before plugin derivation: ${toErrorMessage(result.reason)}`);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
