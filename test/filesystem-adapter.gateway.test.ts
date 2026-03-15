import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import { FilesystemOpenClawAdapter } from "../apps/sidecar/src/adapters/filesystem/filesystem-adapter.js";
import type { GatewayRuntimeClient } from "../apps/sidecar/src/adapters/gateway-ws/gateway-client.js";
import type { GatewayRuntimeSnapshot } from "../apps/sidecar/src/adapters/gateway-ws/protocol.js";
import { createFilesystemRuntimeFixture } from "./helpers/filesystem-runtime-fixture.js";

function createGatewaySnapshot(): GatewayRuntimeSnapshot {
  return {
    fetchedAt: "2026-03-15T09:15:00.000Z",
    presence: {
      items: [
        {
          deviceId: "device-1",
          roles: ["gateway", "operator"],
          scopes: ["operator.read"],
          online: true,
          lastSeenAt: "2026-03-15T09:14:00.000Z",
        },
      ],
      freshness: "fresh",
      coverage: "complete",
      warningMessages: [],
    },
    nodes: {
      items: [
        {
          deviceId: "device-1",
          roles: ["gateway", "operator"],
          scopes: ["operator.read"],
          online: true,
          lastSeenAt: "2026-03-15T09:14:00.000Z",
        },
      ],
      freshness: "fresh",
      coverage: "complete",
      warningMessages: [],
    },
    sessions: {
      items: [
        {
          id: "session:main:runtime-thread",
          agentId: "main",
          channel: "discord",
          status: "active",
          lastActivityAt: "2026-03-15T09:13:00.000Z",
          messageCount: 23,
        },
      ],
      freshness: "fresh",
      coverage: "complete",
      warningMessages: [],
    },
    tools: {
      items: [
        {
          agentId: "main",
          name: "gateway.status",
          source: "core",
          optional: false,
        },
        {
          agentId: "main",
          name: "deploy.preview",
          source: "plugin",
          pluginId: "deployments",
          optional: true,
        },
      ],
      freshness: "fresh",
      coverage: "complete",
      warningMessages: [],
    },
    plugins: {
      items: [
        {
          id: "deployments",
          enabled: true,
          sourceKind: "gateway",
          notes: ["in-process plugin runtime"],
        },
      ],
      freshness: "fresh",
      coverage: "complete",
      warningMessages: [],
    },
  };
}

test("filesystem adapter prefers gateway runtime sessions and exposes gateway runtime collections", async () => {
  const fixture = await createFilesystemRuntimeFixture();

  try {
    const adapter = new FilesystemOpenClawAdapter({
      runtimeRoot: fixture.runtimeRoot,
      configFile: fixture.configFile,
      workspaceGlob: fixture.workspaceGlob,
      gatewayUrl: "ws://127.0.0.1:4318/gateway",
      homedir: () => fixture.homeDir,
      gatewayClientFactory: () =>
        ({
          readRuntimeSnapshot: async () => createGatewaySnapshot(),
        }) satisfies GatewayRuntimeClient,
    });
    const snapshot = await adapter.fetchSnapshot();
    const presence = await adapter.getPresence();
    const nodes = await adapter.getNodes();
    const tools = await adapter.getTools();
    const plugins = await adapter.getPlugins();

    assert.equal(snapshot.sessions.length, 1);
    assert.equal(snapshot.sessions[0]?.id, "session:main:runtime-thread");
    assert.ok(!snapshot.sessions.some((session) => session.id === "session:main:discord-ops-thread"));
    assert.deepEqual(snapshot.collections.sessions.sourceIds, ["gateway-ws:operator-read"]);
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "sessions")?.sourceKind, "gateway-ws");
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "presence")?.coverage, "complete");
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "nodes")?.coverage, "complete");
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "tools")?.coverage, "complete");
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "plugins")?.coverage, "complete");
    assert.equal(snapshot.runtimeStatuses.find((status) => status.componentId === "openclaw-gateway-ws")?.status, "healthy");
    assert.equal(snapshot.runtimeStatuses.find((status) => status.componentId === "openclaw-gateway-ws")?.details.scopes, "operator.read");

    assert.equal(presence.collectionStatus.sourceKind, "gateway-ws");
    assert.equal(nodes.items[0]?.deviceId, "device-1");
    assert.equal(tools.items[1]?.pluginId, "deployments");
    assert.equal(plugins.items[0]?.id, "deployments");
  } finally {
    await fixture.cleanup();
  }
});

test("filesystem adapter falls back to filesystem sessions when gateway ws is unavailable", async () => {
  const fixture = await createFilesystemRuntimeFixture();

  try {
    const adapter = new FilesystemOpenClawAdapter({
      runtimeRoot: fixture.runtimeRoot,
      configFile: fixture.configFile,
      workspaceGlob: fixture.workspaceGlob,
      gatewayUrl: "ws://127.0.0.1:4318/gateway",
      homedir: () => fixture.homeDir,
      gatewayClientFactory: () =>
        ({
          readRuntimeSnapshot: async () => {
            throw new Error("gateway connection refused");
          },
        }) satisfies GatewayRuntimeClient,
    });
    const snapshot = await adapter.fetchSnapshot();
    const presence = await adapter.getPresence();

    assert.ok(snapshot.sessions.some((session) => session.id === "session:main:discord-ops-thread"));
    assert.equal(snapshot.collections.sessions.sourceIds?.[0], "filesystem:runtime-root");
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "presence")?.coverage, "unavailable");
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "nodes")?.coverage, "unavailable");
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "tools")?.coverage, "unavailable");
    assert.equal(snapshot.sourceRegistry.collections.find((collection) => collection.key === "plugins")?.coverage, "unavailable");
    assert.equal(snapshot.runtimeStatuses.find((status) => status.componentId === "openclaw-gateway-ws")?.status, "offline");
    assert.ok(snapshot.warnings.some((warning) => warning.code === "OPENCLAW_GATEWAY_WS_CONNECT_FAILED"));
    assert.equal(presence.collectionStatus.coverage, "unavailable");
  } finally {
    await fixture.cleanup();
  }
});

test("filesystem adapter auto-discovers gateway auth token from openclaw.json env templates", async () => {
  const fixture = await createFilesystemRuntimeFixture();
  const previousToken = process.env.AUTO_GATEWAY_TOKEN;
  let gatewayClientOptions:
    | {
        url: string;
        timeoutMs: number;
        clock: { now(): Date };
        authToken?: string;
      }
    | undefined;

  process.env.AUTO_GATEWAY_TOKEN = "resolved-from-env-template";

  try {
    await writeFile(
      fixture.configFile,
      `{
        gateway: {
          auth: {
            mode: "token",
            token: "\${AUTO_GATEWAY_TOKEN}",
          },
        },
        agents: { $include: "./agents.json5" },
        bindings: [
          { agentId: "main", match: { channel: "discord", accountId: "default" } },
          { agentId: "ops", match: { channel: "slack", accountId: "*" } },
        ],
      }
`,
    );

    const adapter = new FilesystemOpenClawAdapter({
      runtimeRoot: fixture.runtimeRoot,
      configFile: fixture.configFile,
      workspaceGlob: fixture.workspaceGlob,
      gatewayUrl: "ws://127.0.0.1:4318/gateway",
      homedir: () => fixture.homeDir,
      gatewayClientFactory: (options) => {
        gatewayClientOptions = options;
        return {
          readRuntimeSnapshot: async () => createGatewaySnapshot(),
        } satisfies GatewayRuntimeClient;
      },
    });

    await adapter.fetchSnapshot();

    assert.equal(gatewayClientOptions?.authToken, "resolved-from-env-template");
  } finally {
    if (previousToken === undefined) {
      delete process.env.AUTO_GATEWAY_TOKEN;
    } else {
      process.env.AUTO_GATEWAY_TOKEN = previousToken;
    }

    await fixture.cleanup();
  }
});
