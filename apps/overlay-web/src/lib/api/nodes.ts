import type { NodesResponse } from "@openclaw-team-ops/shared";

import { request, withQuery } from "../api.js";

export function getNodes(query: Record<string, string | undefined> = {}) {
  return request<NodesResponse>(withQuery("/api/nodes", query));
}
