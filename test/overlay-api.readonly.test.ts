import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type { ErrorResponse, SummaryResponse, WorkspaceDocumentResponse, WorkspacesResponse } from "@openclaw-team-ops/shared";
import type { Express } from "express";

import { createOverlayApiApp } from "../apps/overlay-api/src/app.js";
import { SidecarClient } from "../apps/overlay-api/src/clients/sidecar-client.js";
import { createSidecarApp } from "../apps/sidecar/src/app.js";
import { FilesystemOpenClawAdapter } from "../apps/sidecar/src/adapters/filesystem/filesystem-adapter.js";
import { MockOpenClawAdapter, type MockAdapterScenario } from "../apps/sidecar/src/adapters/mock/mock-adapter.js";
import { createFilesystemRuntimeFixture } from "./helpers/filesystem-runtime-fixture.js";

async function startServer(app: Express): Promise<{ close: () => Promise<void>; url: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Expected an AddressInfo listener result."));
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

async function withApiStack<T>(scenario: MockAdapterScenario, run: (apiBaseUrl: string) => Promise<T>): Promise<T> {
  const sidecar = await startServer(createSidecarApp(new MockOpenClawAdapter({ scenario })));
  const api = await startServer(
    createOverlayApiApp(
      new SidecarClient({
        baseUrl: sidecar.url,
        timeoutMs: 5000,
      }),
    ),
  );

  try {
    return await run(api.url);
  } finally {
    await api.close();
    await sidecar.close();
  }
}

test("overlay api summary remains read-only and includes collection metadata", async () => {
  await withApiStack("baseline", async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/api/summary`);
    const body = (await response.json()) as SummaryResponse;

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-openclaw-ops-readonly"), "true");
    assert.equal(body.meta.readOnly, true);
    assert.equal(body.meta.collections?.agents?.status, "complete");
    assert.equal(body.meta.collections?.runtimeStatuses?.recordCount, body.runtimeStatuses.length);
    assert.ok(body.runtimeStatuses.some((status) => status.componentId === "overlay-api"));
  });
});

test("overlay api stays GET-only for inventory endpoints", async () => {
  await withApiStack("baseline", async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/api/agents`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 404);
  });
});

test("overlay api returns workspace markdown previews through the read-only contract", async () => {
  await withApiStack("baseline", async (apiBaseUrl) => {
    const workspacesResponse = await fetch(`${apiBaseUrl}/api/workspaces`);
    const workspacesBody = (await workspacesResponse.json()) as WorkspacesResponse;
    const workspace = workspacesBody.data.find((entry) => (entry.coreMarkdownFiles?.length ?? 0) > 0);

    assert.ok(workspace);

    const response = await fetch(
      `${apiBaseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/documents/${encodeURIComponent(workspace.coreMarkdownFiles![0])}`,
    );
    const body = (await response.json()) as WorkspaceDocumentResponse;

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-openclaw-ops-readonly"), "true");
    assert.equal(body.meta.readOnly, true);
    assert.equal(body.data.workspaceId, workspace.id);
    assert.equal(body.data.fileName, workspace.coreMarkdownFiles![0]);
    assert.match(body.data.content, /Source: mock\/baseline/);
  });
});

test("degraded mock scenarios surface partial metadata through overlay api", async () => {
  await withApiStack("partial-coverage", async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/api/summary`);
    const body = (await response.json()) as SummaryResponse;

    assert.equal(response.status, 200);
    assert.equal(body.meta.collections?.authProfiles?.status, "unavailable");
    assert.equal(body.meta.collections?.topology?.status, "partial");
    assert.ok(body.meta.warnings?.some((warning) => warning.code === "AUTH_PROFILES_UNAVAILABLE"));
  });
});

test("adapter failures return read-only error responses", async () => {
  await withApiStack("error-upstream", async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/api/summary`);
    const body = (await response.json()) as ErrorResponse;

    assert.equal(response.status, 502);
    assert.equal(body.meta.readOnly, true);
    assert.equal(body.error.code, "UPSTREAM_UNAVAILABLE");
  });
});

test("overlay api forwards filesystem-adapter snapshots through the read-only contract", async () => {
  const fixture = await createFilesystemRuntimeFixture();
  const sidecar = await startServer(
    createSidecarApp(
      new FilesystemOpenClawAdapter({
        runtimeRoot: fixture.runtimeRoot,
        configFile: fixture.configFile,
        workspaceGlob: fixture.workspaceGlob,
        sourceRoot: fixture.sourceRoot,
      }),
    ),
  );
  const api = await startServer(
    createOverlayApiApp(
      new SidecarClient({
        baseUrl: sidecar.url,
        timeoutMs: 5000,
      }),
    ),
  );

  try {
    const response = await fetch(`${api.url}/api/summary`);
    const body = (await response.json()) as SummaryResponse;

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-openclaw-ops-readonly"), "true");
    assert.equal(body.meta.readOnly, true);
    assert.equal(body.meta.source, "openclaw");
    assert.equal(body.meta.collections?.workspaces?.status, "partial");
    assert.ok(body.meta.warnings?.some((warning) => warning.code === "OPENCLAW_WORKSPACE_DIRECTORY_MISSING"));
    assert.ok(body.runtimeStatuses.some((status) => status.componentId === "openclaw-config-file"));
  } finally {
    await api.close();
    await sidecar.close();
    await fixture.cleanup();
  }
});
