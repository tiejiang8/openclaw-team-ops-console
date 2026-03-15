import type { RuntimeStatusResponse } from "@openclaw-team-ops/shared";

import { request } from "../api.js";

export function getRuntimeStatus() {
  return request<RuntimeStatusResponse>("/api/runtime-status");
}
