import assert from "node:assert/strict";
import test from "node:test";

import { GatewayWsRuntimeClient } from "../apps/sidecar/src/adapters/gateway-ws/gateway-client.js";
import type { GatewayTransport, GatewayTransportHandlers } from "../apps/sidecar/src/adapters/gateway-ws/protocol.js";

class FakeGatewayTransport implements GatewayTransport {
  public readonly requests: Array<Record<string, unknown>> = [];

  async connect(
    _url: string,
    handlers: GatewayTransportHandlers,
  ) {
    return {
      send: (message: string) => {
        const request = JSON.parse(message) as Record<string, unknown>;
        this.requests.push(request);
        queueMicrotask(() => {
          handlers.onMessage(JSON.stringify(this.buildResponse(request)));
        });
      },
      close: () => {
        return undefined;
      },
    };
  }

  private buildResponse(request: Record<string, unknown>): Record<string, unknown> {
    const id = request.id;
    const method = request.method;

    switch (method) {
      case "connect":
        return {
          type: "res",
          id,
          ok: true,
          payload: {
            auth: {
              role: "operator",
              scopes: ["operator.read"],
            },
          },
        };
      case "system-presence":
        return {
          type: "res",
          id,
          ok: true,
          payload: {
            items: [
              {
                deviceId: "device-1",
                roles: ["gateway", "operator"],
                scopes: ["operator.read"],
                online: true,
                lastSeenAt: "2026-03-15T09:10:00.000Z",
              },
            ],
          },
        };
      case "node.list":
        return {
          type: "res",
          id,
          ok: true,
          payload: {
            items: [
              {
                deviceId: "device-1",
                roles: ["gateway", "operator"],
                scopes: ["operator.read"],
                online: true,
                lastSeenAt: "2026-03-15T09:10:00.000Z",
              },
            ],
          },
        };
      case "sessions.list":
        return {
          type: "res",
          id,
          ok: true,
          payload: {
            items: [
              {
                id: "runtime-session-1",
                agentId: "main",
                channel: "discord",
                status: "active",
                lastActivityAt: "2026-03-15T09:11:00.000Z",
                messageCount: 14,
              },
            ],
          },
        };
      case "tools.catalog":
        return {
          type: "res",
          id,
          ok: true,
          payload: {
            items: [
              {
                agentId: "main",
                tools: [
                  {
                    name: "gateway.status",
                    source: "core",
                    optional: false,
                  },
                  {
                    name: "deploy.preview",
                    source: "plugin:deployments",
                    optional: true,
                  },
                ],
              },
            ],
            plugins: [
              {
                id: "deployments",
                enabled: true,
                notes: ["plugin runtime healthy"],
              },
            ],
          },
        };
      default:
        return {
          type: "res",
          id,
          ok: false,
          error: {
            message: `unsupported method ${String(method)}`,
          },
        };
    }
  }
}

test("gateway ws runtime client uses operator.read handshake and only read-only methods", async () => {
  const transport = new FakeGatewayTransport();
  const client = new GatewayWsRuntimeClient({
    url: "ws://127.0.0.1:4318/gateway",
    transport,
    authToken: "config-shared-token",
  });

  const snapshot = await client.readRuntimeSnapshot();
  const methods = transport.requests.map((request) => request.method);
  const connectRequest = transport.requests.find((request) => request.method === "connect");
  const connectParams = connectRequest?.params as
    | {
        role?: string;
        scopes?: string[];
        auth?: { token?: string };
        minProtocol?: number;
        client?: {
          id?: string;
          mode?: string;
          displayName?: string;
        };
      }
    | undefined;

  assert.deepEqual(methods, ["connect", "system-presence", "node.list", "sessions.list", "tools.catalog"]);
  assert.equal(connectRequest?.type, "req");
  assert.equal(connectParams?.role, "operator");
  assert.deepEqual(connectParams?.scopes, ["operator.read"]);
  assert.equal(connectParams?.auth?.token, "config-shared-token");
  assert.equal(connectParams?.minProtocol, 3);
  assert.equal(connectParams?.client?.id, "gateway-client");
  assert.equal(connectParams?.client?.mode, "backend");
  assert.equal(connectParams?.client?.displayName, "OpenClaw Team Ops Console");
  assert.ok(!methods.some((method) => ["operator.write", "operator.admin", "operator.approvals", "pairing"].includes(String(method))));

  assert.equal(snapshot.presence.items[0]?.deviceId, "device-1");
  assert.equal(snapshot.nodes.items[0]?.deviceId, "device-1");
  assert.equal(snapshot.sessions.items[0]?.id, "session:main:runtime-session-1");
  assert.equal(snapshot.tools.items[0]?.agentId, "main");
  assert.equal(snapshot.tools.items[1]?.pluginId, "deployments");
  assert.equal(snapshot.plugins.items[0]?.id, "deployments");
});
