import type { Node, PresenceEntry } from "@openclaw-team-ops/shared";

import {
  extractRecordArray,
  isRecord,
  toBoolean,
  toIsoDate,
  toString,
  toStringArray,
  type GatewayRequestClient,
} from "./protocol.js";

export async function fetchSystemPresence(client: GatewayRequestClient): Promise<PresenceEntry[]> {
  return normalizePresenceEntries(await client.request("system-presence"));
}

export function normalizePresenceEntries(raw: unknown): PresenceEntry[] {
  const entries = extractRecordArray(raw, ["items", "presence", "nodes", "data", "result"]);

  if (entries.length > 0) {
    return dedupePresenceEntries(entries.map(mapPresenceEntry).filter((entry): entry is PresenceEntry => entry !== undefined));
  }

  if (isRecord(raw)) {
    const presence = mapPresenceEntry(raw);

    if (presence) {
      return [presence];
    }
  }

  return [];
}

export function normalizeNodeEntries(raw: unknown): Node[] {
  const entries = extractRecordArray(raw, ["items", "nodes", "presence", "data", "result"]);

  if (entries.length > 0) {
    return dedupeNodes(entries.map(mapNodeEntry).filter((entry): entry is Node => entry !== undefined));
  }

  if (isRecord(raw)) {
    const node = mapNodeEntry(raw);

    if (node) {
      return [node];
    }
  }

  return [];
}

function mapPresenceEntry(value: Record<string, unknown>): PresenceEntry | undefined {
  const deviceId = toString(value.deviceId) ?? toString(value.id) ?? toString(value.deviceID);

  if (!deviceId) {
    return undefined;
  }

  const lastSeenAt =
    toIsoDate(value.lastSeenAt) ??
    toIsoDate(value.updatedAt) ??
    toIsoDate(value.seenAt) ??
    toIsoDate(value.ts);
  const online =
    toBoolean(value.online) ??
    toBoolean(value.connected) ??
    (toString(value.status)?.toLowerCase() === "online" ? true : undefined) ??
    true;

  return {
    deviceId,
    roles: toStringArray(value.roles),
    scopes: toStringArray(value.scopes),
    online,
    ...(lastSeenAt ? { lastSeenAt } : {}),
  };
}

function mapNodeEntry(value: Record<string, unknown>): Node | undefined {
  const presence = mapPresenceEntry(value);

  if (!presence) {
    return undefined;
  }

  return {
    deviceId: presence.deviceId,
    roles: presence.roles,
    scopes: presence.scopes,
    online: presence.online,
    ...(presence.lastSeenAt ? { lastSeenAt: presence.lastSeenAt } : {}),
  };
}

function dedupePresenceEntries(items: PresenceEntry[]): PresenceEntry[] {
  const seen = new Map<string, PresenceEntry>();

  for (const item of items) {
    seen.set(item.deviceId, item);
  }

  return Array.from(seen.values());
}

function dedupeNodes(items: Node[]): Node[] {
  const seen = new Map<string, Node>();

  for (const item of items) {
    seen.set(item.deviceId, item);
  }

  return Array.from(seen.values());
}
