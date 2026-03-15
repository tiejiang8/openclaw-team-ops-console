import type { CollectionFreshness, CollectionStatus, Node, Plugin, PresenceEntry, Session, Tool } from "@openclaw-team-ops/shared";

export const GATEWAY_OPERATOR_ROLE = "operator" as const;
export const GATEWAY_READONLY_SCOPES = ["operator.read"] as const;

export interface GatewayClock {
  now(): Date;
}

export interface GatewayConnection {
  send(message: string): void;
  close(code?: number, reason?: string): void;
}

export interface GatewayTransportHandlers {
  onMessage(message: string): void;
  onClose(code?: number, reason?: string): void;
  onError(error: unknown): void;
}

export interface GatewayTransport {
  connect(
    url: string,
    handlers: GatewayTransportHandlers,
    options?: {
      timeoutMs?: number;
    },
  ): Promise<GatewayConnection>;
}

export interface GatewayRequestClient {
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface GatewayRuntimeCollection<T> {
  items: T[];
  freshness: CollectionFreshness;
  coverage: CollectionStatus;
  warningMessages: string[];
}

export interface GatewayRuntimeSnapshot {
  fetchedAt: string;
  presence: GatewayRuntimeCollection<PresenceEntry>;
  nodes: GatewayRuntimeCollection<Node>;
  sessions: GatewayRuntimeCollection<Session>;
  tools: GatewayRuntimeCollection<Tool>;
  plugins: GatewayRuntimeCollection<Plugin>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function toBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => toString(entry))
    .filter((entry): entry is string => typeof entry === "string");
}

export function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

export function buildGatewayCollection<T>(
  items: T[],
  input: {
    coverage?: CollectionStatus;
    freshness?: CollectionFreshness;
    warningMessages?: string[];
  } = {},
): GatewayRuntimeCollection<T> {
  return {
    items,
    coverage: input.coverage ?? "complete",
    freshness: input.freshness ?? "fresh",
    warningMessages: input.warningMessages ?? [],
  };
}

export function buildUnavailableGatewayCollection<T>(warningMessage: string): GatewayRuntimeCollection<T> {
  return {
    items: [],
    coverage: "unavailable",
    freshness: "unknown",
    warningMessages: [warningMessage],
  };
}

export function extractRecordArray(value: unknown, preferredKeys: string[]): Record<string, unknown>[] {
  const direct = asRecordArray(value);

  if (direct.length > 0) {
    return direct;
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of preferredKeys) {
    const nested = asRecordArray(value[key]);

    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

export function normalizeSessionStatus(
  value: unknown,
  endedAt: string | undefined,
  lastActivityAt: string | undefined,
  nowMs: number,
): Session["status"] {
  const explicit = toString(value)?.toLowerCase();

  if (explicit === "active" || explicit === "idle" || explicit === "ended" || explicit === "error") {
    return explicit;
  }

  if (endedAt) {
    return "ended";
  }

  if (!lastActivityAt) {
    return "idle";
  }

  return nowMs - new Date(lastActivityAt).getTime() <= 6 * 60 * 60 * 1000 ? "active" : "idle";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}
