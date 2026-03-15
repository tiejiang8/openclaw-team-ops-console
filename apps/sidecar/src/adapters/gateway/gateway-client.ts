import { randomUUID } from "node:crypto";

import { connectOperatorRead } from "../gateway-ws/connect-operator-read.js";
import {
  isRecord,
  type GatewayClock,
  type GatewayConnection,
  type GatewayTransport,
} from "../gateway-ws/protocol.js";
import { WebSocketGatewayTransport } from "../gateway-ws/gateway-client.js";

export const GATEWAY_RUNTIME_READONLY_METHOD_ALLOWLIST = [
  "connect",
  "status",
  "gateway.identity.get",
  "system-presence",
  "node.list",
  "node.describe",
  "sessions.list",
  "cron.list",
  "cron.status",
  "cron.runs",
] as const;

type GatewayReadonlyMethod = (typeof GATEWAY_RUNTIME_READONLY_METHOD_ALLOWLIST)[number];

interface GatewayRuntimePlaneClientOptions {
  url: string;
  authToken?: string;
  timeoutMs?: number;
  clock?: GatewayClock;
  transport?: GatewayTransport;
}

interface PendingRequest {
  method: string;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  timeout: NodeJS.Timeout;
}

export interface GatewayEvent {
  name: string;
  payload: unknown;
}

export class GatewayRuntimePlaneClient {
  private readonly url: string;
  private readonly authToken: string | undefined;
  private readonly timeoutMs: number;
  private readonly clock: GatewayClock;
  private readonly transport: GatewayTransport;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Set<(event: GatewayEvent) => void>();
  private connection: GatewayConnection | undefined;
  private connectPromise: Promise<void> | undefined;

  constructor(options: GatewayRuntimePlaneClientOptions) {
    this.url = options.url;
    this.authToken = normalizeInput(options.authToken);
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.clock = options.clock ?? { now: () => new Date() };
    this.transport = options.transport ?? new WebSocketGatewayTransport();
  }

  async ensureConnected(): Promise<void> {
    if (this.connection) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      this.connection = await this.transport.connect(
        this.url,
        {
          onMessage: (message) => {
            this.handleMessage(message);
          },
          onClose: (code, reason) => {
            this.connection = undefined;
            this.failPending(
              new Error(`Gateway WebSocket closed (${code ?? "no-code"}: ${reason ?? "no-reason"})`),
            );
          },
          onError: (error) => {
            this.connection = undefined;
            this.failPending(error instanceof Error ? error : new Error("Gateway WebSocket transport error"));
          },
        },
        {
          timeoutMs: this.timeoutMs,
        },
      );

      await connectOperatorRead(this, {
        ...(this.authToken ? { authToken: this.authToken } : {}),
      });
    })();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }
  }

  async request(method: GatewayReadonlyMethod | string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!isReadonlyAllowedMethod(method)) {
      throw new Error(`Gateway method is not allowlisted for read-only runtime plane access: ${method}`);
    }

    await this.ensureConnected();

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

  subscribe(listener: (event: GatewayEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  disconnect(): void {
    this.connection?.close(1000, "runtime plane cache reset");
    this.connection = undefined;
    this.failPending(new Error("Gateway runtime plane client disconnected"));
  }

  now(): string {
    return this.clock.now().toISOString();
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

    if (typeof messageId === "string" || typeof messageId === "number") {
      const pending = this.pending.get(String(messageId));

      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(String(messageId));

        const errorMessage = extractErrorMessage(parsed);

        if (errorMessage) {
          pending.reject(new Error(`${pending.method} failed: ${errorMessage}`));
          return;
        }

        pending.resolve(extractResult(parsed));
        return;
      }
    }

    const event = extractGatewayEvent(parsed);

    if (!event) {
      return;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }

    this.pending.clear();
  }
}

export function isReadonlyAllowedMethod(method: string): method is GatewayReadonlyMethod {
  return (GATEWAY_RUNTIME_READONLY_METHOD_ALLOWLIST as readonly string[]).includes(method);
}

function extractGatewayEvent(value: Record<string, unknown>): GatewayEvent | undefined {
  const explicitName =
    normalizeInput(value.event) ??
    normalizeInput(value.topic) ??
    (value.type === "event" || value.type === "evt" ? normalizeInput(value.name) : undefined);
  const nestedPayload = isRecord(value.payload) ? value.payload : undefined;
  const nestedName =
    normalizeInput(nestedPayload?.event) ??
    normalizeInput(nestedPayload?.topic) ??
    normalizeInput(nestedPayload?.name);
  const name = explicitName ?? nestedName;

  if (!name) {
    return undefined;
  }

  return {
    name,
    payload: value.payload ?? value.data ?? value.result ?? value,
  };
}

function normalizeInput(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function extractResult(message: Record<string, unknown>): unknown {
  if ("payload" in message) {
    return message.payload;
  }

  if ("result" in message) {
    return message.result;
  }

  if ("data" in message) {
    return message.data;
  }

  return message;
}

function extractErrorMessage(message: Record<string, unknown>): string | undefined {
  if (typeof message.error === "string") {
    return message.error;
  }

  if (isRecord(message.error)) {
    return normalizeInput(message.error.message) ?? normalizeInput(message.error.code);
  }

  return normalizeInput(message.message);
}
