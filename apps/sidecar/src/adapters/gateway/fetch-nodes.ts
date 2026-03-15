import type { NodeSummaryDto } from "@openclaw-team-ops/shared";

import {
  extractRecordArray,
  isRecord,
  toBoolean,
  toIsoDate,
  toString,
  toStringArray,
  type GatewayRequestClient,
} from "../gateway-ws/protocol.js";

export async function fetchGatewayNodes(client: GatewayRequestClient): Promise<NodeSummaryDto[]> {
  return normalizeGatewayNodes(await client.request("node.list"));
}

export function normalizeGatewayNodes(raw: unknown): NodeSummaryDto[] {
  const items = extractRecordArray(raw, ["items", "nodes", "data", "result"]);

  if (items.length === 0 && isRecord(raw)) {
    const single = mapGatewayNode(raw);
    return single ? [single] : [];
  }

  const deduped = new Map<string, NodeSummaryDto>();

  items
    .map((item) => mapGatewayNode(item))
    .filter((item): item is NodeSummaryDto => item !== undefined)
    .forEach((item) => {
      deduped.set(item.id, item);
    });

  return Array.from(deduped.values());
}

function mapGatewayNode(value: Record<string, unknown>): NodeSummaryDto | undefined {
  const id = toString(value.id) ?? toString(value.deviceId) ?? toString(value.deviceID);

  if (!id) {
    return undefined;
  }

  const connected =
    toBoolean(value.connected) ??
    toBoolean(value.online) ??
    (toString(value.status)?.toLowerCase() === "online" ? true : undefined) ??
    false;
  const lastConnectAt =
    toIsoDate(value.lastConnectAt) ??
    toIsoDate(value.lastSeenAt) ??
    toIsoDate(value.updatedAt) ??
    toIsoDate(value.seenAt);
  const capabilities = dedupeStringArray([
    ...toStringArray(value.capabilities),
    ...toStringArray(value.features),
    ...toStringArray(value.roles),
  ]);
  const roles = toStringArray(value.roles);
  const scopes = toStringArray(value.scopes);
  const name = toString(value.name) ?? toString(value.label);
  const platform = toString(value.platform) ?? toString(value.os);

  return {
    id,
    ...(name ? { name } : {}),
    ...(platform ? { platform } : {}),
    paired: toBoolean(value.paired) ?? toBoolean(value.isPaired) ?? true,
    connected,
    ...(lastConnectAt ? { lastConnectAt } : {}),
    ...(capabilities.length > 0 ? { capabilities } : {}),
    source: "gateway",
    deviceId: id,
    ...(roles.length > 0 ? { roles } : {}),
    ...(scopes.length > 0 ? { scopes } : {}),
    online: connected,
    ...(lastConnectAt ? { lastSeenAt: lastConnectAt } : {}),
  };
}

function dedupeStringArray(values: string[]): string[] {
  return Array.from(new Set(values));
}
