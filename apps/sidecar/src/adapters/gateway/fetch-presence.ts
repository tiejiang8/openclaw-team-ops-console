import type { PresenceEntry } from "@openclaw-team-ops/shared";

import { normalizePresenceEntries } from "../gateway-ws/fetch-system-presence.js";
import type { GatewayRequestClient } from "../gateway-ws/protocol.js";

export async function fetchGatewayPresence(client: GatewayRequestClient): Promise<PresenceEntry[]> {
  return normalizePresenceEntries(await client.request("system-presence"));
}
