import assert from "node:assert/strict";
import test from "node:test";

import { GatewayRuntimePlaneCache, type GatewayRuntimePlaneClientLike } from "../apps/sidecar/src/adapters/gateway/runtime-plane-cache.js";

function createStubClient(
  handlers: Partial<Record<string, () => Promise<unknown> | unknown>>,
  options: {
    connectError?: Error;
  } = {},
): GatewayRuntimePlaneClientLike {
  return {
    async ensureConnected() {
      if (options.connectError) {
        throw options.connectError;
      }
    },
    async request(method: string) {
      const handler = handlers[method];

      if (!handler) {
        throw new Error(`unexpected method: ${method}`);
      }

      return await handler();
    },
    subscribe() {
      return () => {};
    },
    disconnect() {},
  };
}

test("gateway runtime plane cache reports connected when operator.read runtime probes succeed", async () => {
  const cache = new GatewayRuntimePlaneCache({
    url: "ws://127.0.0.1:4318/gateway",
    authToken: "operator-read-token",
    clientFactory: () =>
      createStubClient({
        status: () => ({ healthy: true, openclawHealthy: true }),
        "gateway.identity.get": () => ({ name: "Mock Gateway", version: "1.2.3" }),
        "system-presence": () => ({
          items: [{ deviceId: "gateway-1", roles: ["operator"], scopes: ["operator.read"], online: true }],
        }),
        "node.list": () => ({
          items: [
            {
              id: "node-1",
              name: "Relay",
              platform: "linux",
              paired: true,
              connected: true,
              lastSeenAt: "2026-03-15T09:00:00.000Z",
            },
          ],
        }),
        "cron.list": () => ({
          items: [
            {
              id: "cron-1",
              name: "Heartbeat",
              schedule: "*/5 * * * *",
              enabled: true,
              nextRunAt: "2026-03-15T09:05:00.000Z",
            },
          ],
        }),
        "cron.status": () => ({
          items: [
            {
              id: "cron-1",
              lastRunAt: "2026-03-15T09:00:00.000Z",
              lastRunState: "ok",
            },
          ],
        }),
      }),
  });

  const state = await cache.getState();

  assert.equal(state.connectionState, "connected");
  assert.equal(state.identity?.name, "Mock Gateway");
  assert.equal(state.rpcHealthy, true);
  assert.equal(state.nodes.length, 1);
  assert.equal(state.cronJobs.length, 1);
});

test("gateway runtime plane cache reports degraded when scopes are missing but connection succeeds", async () => {
  const cache = new GatewayRuntimePlaneCache({
    url: "ws://127.0.0.1:4318/gateway",
    authToken: "operator-read-token",
    clientFactory: () =>
      createStubClient({
        status: () => ({ healthy: true }),
        "gateway.identity.get": () => ({ name: "Mock Gateway" }),
        "system-presence": () => {
          throw new Error("missing scope: operator.read");
        },
        "node.list": () => {
          throw new Error("missing scope: operator.read");
        },
        "cron.list": () => {
          throw new Error("missing scope: operator.read");
        },
        "cron.status": () => {
          throw new Error("missing scope: operator.read");
        },
      }),
  });

  const state = await cache.getState();

  assert.equal(state.connectionState, "degraded");
  assert.ok(state.warnings.some((warning) => warning.includes("operator.read")));
});

test("gateway runtime plane cache reports disconnected when websocket handshake fails", async () => {
  const cache = new GatewayRuntimePlaneCache({
    url: "ws://127.0.0.1:4318/gateway",
    authToken: "operator-read-token",
    clientFactory: () =>
      createStubClient(
        {},
        {
          connectError: new Error("connect ECONNREFUSED 127.0.0.1:4318"),
        },
      ),
  });

  const state = await cache.getState();

  assert.equal(state.connectionState, "disconnected");
  assert.ok(state.warnings.some((warning) => warning.includes("ECONNREFUSED")));
});
