import assert from "node:assert/strict";
import test from "node:test";

import {
  GATEWAY_RUNTIME_READONLY_METHOD_ALLOWLIST,
  isReadonlyAllowedMethod,
} from "../apps/sidecar/src/adapters/gateway/gateway-client.js";

test("gateway runtime plane allowlist remains read-only", () => {
  const expected = [
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
  ];
  const forbidden = [
    "cron.add",
    "cron.update",
    "cron.remove",
    "cron.run",
    "node.invoke",
    "config.set",
    "config.apply",
    "sessions.patch",
    "sessions.reset",
  ];

  assert.deepEqual([...GATEWAY_RUNTIME_READONLY_METHOD_ALLOWLIST], expected);

  for (const method of forbidden) {
    assert.equal(isReadonlyAllowedMethod(method), false, `${method} must not be allowlisted`);
    assert.ok(!GATEWAY_RUNTIME_READONLY_METHOD_ALLOWLIST.includes(method as never), `${method} leaked into allowlist`);
  }
});
