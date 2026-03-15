import type { Session } from "@openclaw-team-ops/shared";

import {
  extractRecordArray,
  isRecord,
  normalizeSessionStatus,
  toIsoDate,
  toNumber,
  toString,
  type GatewayRequestClient,
} from "./protocol.js";

export async function fetchRuntimeSessions(
  client: GatewayRequestClient,
  now: Date = new Date(),
): Promise<Session[]> {
  return normalizeRuntimeSessions(await client.request("sessions.list"), now);
}

export function normalizeRuntimeSessions(raw: unknown, now: Date = new Date()): Session[] {
  const items = extractRecordArray(raw, ["items", "sessions", "data", "result"]);

  if (items.length === 0 && isRecord(raw)) {
    const single = mapRuntimeSession(raw, now);
    return single ? [single] : [];
  }

  return items
    .map((entry) => mapRuntimeSession(entry, now))
    .filter((entry): entry is Session => entry !== undefined);
}

function mapRuntimeSession(value: Record<string, unknown>, now: Date): Session | undefined {
  const agentId = toString(value.agentId) ?? toString(value.agent);
  const rawId = toString(value.id) ?? toString(value.sessionId) ?? toString(value.sessionID);
  const channel = toString(value.channel) ?? toString(value.provider) ?? toString(value.transport) ?? "unknown";

  if (!rawId && !agentId) {
    return undefined;
  }

  const normalizedId =
    rawId && rawId.startsWith("session:")
      ? rawId
      : agentId && rawId
        ? `session:${agentId}:${rawId}`
        : rawId ?? `session:runtime:${channel}`;
  const startedAt = toIsoDate(value.startedAt) ?? toIsoDate(value.createdAt);
  const lastActivityAt = toIsoDate(value.lastActivityAt) ?? toIsoDate(value.updatedAt) ?? toIsoDate(value.lastSeenAt);
  const endedAt = toIsoDate(value.endedAt) ?? toIsoDate(value.closedAt);
  const messageCount = toNumber(value.messageCount) ?? toNumber(value.messages);
  const workspaceId = toString(value.workspaceId);
  const bindingId = toString(value.bindingId);

  return {
    id: normalizedId,
    ...(workspaceId ? { workspaceId } : {}),
    ...(agentId ? { agentId } : {}),
    ...(bindingId ? { bindingId } : {}),
    status: normalizeSessionStatus(value.status, endedAt, lastActivityAt, now.getTime()),
    channel,
    ...(startedAt ? { startedAt } : {}),
    ...(lastActivityAt ? { lastActivityAt } : {}),
    ...(typeof messageCount === "number" ? { messageCount } : {}),
  };
}
