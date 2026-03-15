import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type {
  NodesResponse,
  PluginsResponse,
  PresenceResponse,
  SessionsResponse,
  ToolsResponse,
} from "@openclaw-team-ops/shared";
import type { Express } from "express";

import { createOverlayApiApp } from "../apps/overlay-api/src/app.js";
import { SidecarClient } from "../apps/overlay-api/src/clients/sidecar-client.js";
import { createSidecarApp } from "../apps/sidecar/src/app.js";
import { FilesystemOpenClawAdapter } from "../apps/sidecar/src/adapters/filesystem/filesystem-adapter.js";
import type { GatewayRuntimeClient } from "../apps/sidecar/src/adapters/gateway-ws/gateway-client.js";
import type { GatewayRuntimeSnapshot } from "../apps/sidecar/src/adapters/gateway-ws/protocol.js";
import { createFilesystemRuntimeFixture } from "./helpers/filesystem-runtime-fixture.js";

async function startServer(app: Express): Promise<{ close: () => Promise<void>; url: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Expected AddressInfo for listener."));
        return;
      }

      resolve({
        url: `http://127.0.0.1:${(address as AddressInfo).port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          }),
      });
    });

    server.once("error", reject);
  });
}

function createGatewaySnapshot(): GatewayRuntimeSnapshot {
  return {
    fetchedAt: "2026-03-15T09:18:00.000Z",
    presence: {
      items: [
        {
          deviceId: "device-1",
          roles: ["gateway", "operator"],
          scopes: ["operator.read"],
          online: true,
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
          lastActivityAt: "2026-03-15T09:17:00.000Z",
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
        },
      ],
      freshness: "fresh",
      coverage: "complete",
      warningMessages: [],
    },
  };
}

test("overlay api exposes read-only gateway runtime endpoints and session runtime source preference", async () => {
  const fixture = await createFilesystemRuntimeFixture();
  const sidecar = await startServer(
    createSidecarApp(
      new FilesystemOpenClawAdapter({
        runtimeRoot: fixture.runtimeRoot,
        configFile: fixture.configFile,
        workspaceGlob: fixture.workspaceGlob,
        gatewayUrl: "ws://127.0.0.1:4318/gateway",
        homedir: () => fixture.homeDir,
        gatewayClientFactory: () =>
          ({
            readRuntimeSnapshot: async () => createGatewaySnapshot(),
          }) satisfies GatewayRuntimeClient,
      }),
    ),
  );
  const api = await startServer(
    createOverlayApiApp(
      new SidecarClient({
        baseUrl: sidecar.url,
      }),
    ),
  );

  try {
    const [presenceResponse, nodesResponse, toolsResponse, pluginsResponse, sessionsResponse] = await Promise.all([
      fetch(`${api.url}/api/presence`),
      fetch(`${api.url}/api/nodes`),
      fetch(`${api.url}/api/tools`),
      fetch(`${api.url}/api/plugins`),
      fetch(`${api.url}/api/sessions`),
    ]);
    const presenceBody = (await presenceResponse.json()) as PresenceResponse;
    const nodesBody = (await nodesResponse.json()) as NodesResponse;
    const toolsBody = (await toolsResponse.json()) as ToolsResponse;
    const pluginsBody = (await pluginsResponse.json()) as PluginsResponse;
    const sessionsBody = (await sessionsResponse.json()) as SessionsResponse;

    assert.equal(presenceResponse.status, 200);
    assert.equal(nodesResponse.status, 200);
    assert.equal(toolsResponse.status, 200);
    assert.equal(pluginsResponse.status, 200);
    assert.equal(sessionsResponse.status, 200);

    assert.equal(presenceBody.meta.readOnly, true);
    assert.ok(presenceBody.meta.sourceKinds.includes("gateway-ws"));
    assert.equal(presenceBody.data[0]?.deviceId, "device-1");

    assert.equal(nodesBody.data[0]?.deviceId, "device-1");
    assert.equal(toolsBody.data[1]?.pluginId, "deployments");
    assert.equal(pluginsBody.data[0]?.id, "deployments");
    assert.ok(sessionsBody.meta.sourceKinds.includes("gateway-ws"));
    assert.equal(sessionsBody.data[0]?.id, "session:main:runtime-thread");
  } finally {
    await api.close();
    await sidecar.close();
    await fixture.cleanup();
  }
});
