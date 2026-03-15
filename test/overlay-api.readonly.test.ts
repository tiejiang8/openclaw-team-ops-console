import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type {
  CoverageResponse,
  EvidenceResponse,
  EvidencesResponse,
  ErrorResponse,
  FindingResponse,
  FindingsResponse,
  LogEntriesResponse,
  LogFilesResponse,
  LogRawFileResponse,
  LogSummaryResponse,
  RecommendationsResponse,
  RisksSummaryResponse,
  SummaryResponse,
  TargetResponse,
  TargetSummaryResponse,
  TargetsResponse,
  WorkspaceDocumentResponse,
  WorkspacesResponse,
} from "@openclaw-team-ops/shared";
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

async function withFilesystemApiStack<T>(run: (apiBaseUrl: string) => Promise<T>): Promise<T> {
  const fixture = await createFilesystemRuntimeFixture({
    logFiles: [
      {
        date: "2026-03-14",
        lines: ['{"ts":"2026-03-14T07:00:00.000Z","level":"info","subsystem":"cron","message":"cron warmup"}'],
      },
      {
        date: "2026-03-15",
        lines: [
          '{"ts":"2026-03-15T09:00:00.000Z","level":"warn","subsystem":"gateway","message":"Gateway disconnected sessionId=session-1 deviceId=device-1"}',
          "2026-03-15T10:00:00.000Z INFO plugin plugin ready agentId=main",
        ],
      },
    ],
  });
  const sidecar = await startServer(
    createSidecarApp(
      new FilesystemOpenClawAdapter({
        runtimeRoot: fixture.runtimeRoot,
        configFile: fixture.configFile,
        workspaceGlob: fixture.workspaceGlob,
        logGlob: `${fixture.logDir}/openclaw-*.log`,
        homedir: () => fixture.homeDir,
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
    return await run(api.url);
  } finally {
    await api.close();
    await sidecar.close();
    await fixture.cleanup();
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

test("overlay api exposes collection coverage and planned source gaps", async () => {
  await withApiStack("partial-coverage", async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/api/coverage`);
    const body = (await response.json()) as CoverageResponse;

    assert.equal(response.status, 200);
    assert.equal(body.meta.readOnly, true);
    assert.equal(body.meta.coverage, "partial");
    assert.ok(body.meta.sourceKinds.includes("mock"));
    assert.ok(body.data.collections.some((collection) => collection.key === "agents" && collection.coverage === "complete"));
    assert.ok(
      body.data.collections.some(
        (collection) =>
          collection.key === "logs" && collection.sourceKind === "filesystem" && collection.coverage === "unavailable",
      ),
    );
    assert.ok(
      body.data.collections.some(
        (collection) =>
          collection.key === "nodes" && collection.sourceKind === "gateway-ws" && collection.coverage === "unavailable",
      ),
    );
  });
});

test("overlay api exposes a read-only target registry and target summary", async () => {
  await withApiStack("baseline", async (apiBaseUrl) => {
    const targetsResponse = await fetch(`${apiBaseUrl}/api/targets`);
    const targetsBody = (await targetsResponse.json()) as TargetsResponse;
    const target = targetsBody.data[0];

    assert.equal(targetsResponse.status, 200);
    assert.equal(targetsResponse.headers.get("x-openclaw-ops-readonly"), "true");
    assert.equal(targetsBody.meta.readOnly, true);
    assert.ok(target);
    assert.equal(target.sourceKind, "mock");
    assert.equal(target.collectionPolicy.readOnly, true);

    const targetResponse = await fetch(`${apiBaseUrl}/api/targets/${encodeURIComponent(target.id)}`);
    const targetBody = (await targetResponse.json()) as TargetResponse;

    assert.equal(targetResponse.status, 200);
    assert.equal(targetBody.data.id, target.id);
    assert.equal(targetBody.data.name, target.name);

    const targetSummaryResponse = await fetch(`${apiBaseUrl}/api/targets/${encodeURIComponent(target.id)}/summary`);
    const targetSummaryBody = (await targetSummaryResponse.json()) as TargetSummaryResponse;

    assert.equal(targetSummaryResponse.status, 200);
    assert.equal(targetSummaryBody.meta.readOnly, true);
    assert.equal(targetSummaryBody.data.target.id, target.id);
    assert.ok(targetSummaryBody.data.summary.totals.agents > 0);
    assert.ok(targetSummaryBody.data.runtimeStatuses.length > 0);
  });
});

test("overlay api returns 404 for unknown targets without creating write paths", async () => {
  await withApiStack("baseline", async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/api/targets/does-not-exist`);
    const body = (await response.json()) as ErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-openclaw-ops-readonly"), "true");
    assert.equal(body.meta.readOnly, true);
    assert.equal(body.error.code, "TARGET_NOT_FOUND");
  });
});

test("overlay api exposes read-only evidence, findings, risks, and recommendations", async () => {
  await withApiStack("partial-coverage", async (apiBaseUrl) => {
    const risksResponse = await fetch(`${apiBaseUrl}/api/risks/summary`);
    const risksBody = (await risksResponse.json()) as RisksSummaryResponse;

    assert.equal(risksResponse.status, 200);
    assert.equal(risksBody.meta.readOnly, true);
    assert.ok(risksBody.data.openFindings > 0);
    assert.ok(risksBody.data.targetBreakdown.length > 0);

    const evidenceResponse = await fetch(`${apiBaseUrl}/api/evidence?severity=warn`);
    const evidenceBody = (await evidenceResponse.json()) as EvidencesResponse;

    assert.equal(evidenceResponse.status, 200);
    assert.equal(evidenceBody.meta.readOnly, true);
    assert.ok(evidenceBody.data.length > 0);
    assert.ok(evidenceBody.data.some((evidence) => evidence.kind === "coverage-gap"));

    const findingListResponse = await fetch(`${apiBaseUrl}/api/findings?type=dangling-binding`);
    const findingListBody = (await findingListResponse.json()) as FindingsResponse;
    const finding = findingListBody.data[0];

    assert.equal(findingListResponse.status, 200);
    assert.ok(finding);
    assert.ok(finding.evidenceRefs.length > 0);
    assert.equal(finding.type, "dangling-binding");

    const findingResponse = await fetch(`${apiBaseUrl}/api/findings/${encodeURIComponent(finding.id)}`);
    const findingBody = (await findingResponse.json()) as FindingResponse;

    assert.equal(findingResponse.status, 200);
    assert.equal(findingBody.data.id, finding.id);

    const recommendationResponse = await fetch(
      `${apiBaseUrl}/api/recommendations?findingId=${encodeURIComponent(finding.id)}`,
    );
    const recommendationBody = (await recommendationResponse.json()) as RecommendationsResponse;

    assert.equal(recommendationResponse.status, 200);
    assert.ok(recommendationBody.data.length >= 1);
    assert.ok(recommendationBody.data.every((recommendation) => recommendation.findingId === finding.id));

    const evidenceDetailResponse = await fetch(
      `${apiBaseUrl}/api/evidence/${encodeURIComponent(finding.evidenceRefs[0]!)}`,
    );
    const evidenceDetailBody = (await evidenceDetailResponse.json()) as EvidenceResponse;

    assert.equal(evidenceDetailResponse.status, 200);
    assert.equal(evidenceDetailBody.data.id, finding.evidenceRefs[0]);
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

test("overlay api exposes read-only logs files, summaries, entries, and raw file content", async () => {
  await withFilesystemApiStack(async (apiBaseUrl) => {
    const filesResponse = await fetch(`${apiBaseUrl}/api/logs/files`);
    const filesBody = (await filesResponse.json()) as LogFilesResponse;

    assert.equal(filesResponse.status, 200);
    assert.equal(filesBody.meta.readOnly, true);
    assert.equal(filesBody.meta.coverage, "complete");
    assert.equal(filesBody.data[0]?.date, "2026-03-15");

    const summaryResponse = await fetch(`${apiBaseUrl}/api/logs/summary`);
    const summaryBody = (await summaryResponse.json()) as LogSummaryResponse;

    assert.equal(summaryResponse.status, 200);
    assert.equal(summaryBody.meta.readOnly, true);
    assert.equal(summaryBody.data.totalLines, 2);
    assert.equal(summaryBody.data.signalCounts.disconnect, 1);

    const entriesResponse = await fetch(`${apiBaseUrl}/api/logs/entries?tag=session`);
    const entriesBody = (await entriesResponse.json()) as LogEntriesResponse;

    assert.equal(entriesResponse.status, 200);
    assert.equal(entriesBody.meta.readOnly, true);
    assert.equal(entriesBody.data.total, 1);
    assert.equal(entriesBody.data.items[0]?.refs?.sessionId, "session-1");

    const rawResponse = await fetch(`${apiBaseUrl}/api/logs/files/2026-03-15/raw`);
    const rawBody = (await rawResponse.json()) as LogRawFileResponse;

    assert.equal(rawResponse.status, 200);
    assert.equal(rawBody.meta.readOnly, true);
    assert.match(rawBody.data.content, /Gateway disconnected/);
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

test("overlay api exposes filesystem-backed targets through the same read-only target contract", async () => {
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
    const targetsResponse = await fetch(`${api.url}/api/targets`);
    const targetsBody = (await targetsResponse.json()) as TargetsResponse;
    const target = targetsBody.data[0];

    assert.equal(targetsResponse.status, 200);
    assert.ok(target);
    assert.equal(target.sourceKind, "filesystem");
    assert.equal(target.collectionPolicy.readOnly, true);
    assert.equal(target.connection.runtimeRoot, fixture.runtimeRoot);

    const summaryResponse = await fetch(`${api.url}/api/targets/${encodeURIComponent(target.id)}/summary`);
    const summaryBody = (await summaryResponse.json()) as TargetSummaryResponse;

    assert.equal(summaryResponse.status, 200);
    assert.equal(summaryBody.data.target.id, target.id);
    assert.equal(summaryBody.data.collections.workspaces.status, "partial");
    assert.ok(summaryBody.data.warnings.some((warning) => warning.code === "OPENCLAW_WORKSPACE_DIRECTORY_MISSING"));
  } finally {
    await api.close();
    await sidecar.close();
    await fixture.cleanup();
  }
});

test("overlay api surfaces config include anomalies as findings when filesystem config is unavailable", async () => {
  const fixture = await createFilesystemRuntimeFixture();
  const sidecar = await startServer(
    createSidecarApp(
      new FilesystemOpenClawAdapter({
        runtimeRoot: fixture.runtimeRoot,
        configFile: `${fixture.runtimeRoot}/missing-openclaw.json`,
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
    const response = await fetch(`${api.url}/api/findings?type=config-include-anomaly`);
    const body = (await response.json()) as FindingsResponse;

    assert.equal(response.status, 200);
    assert.ok(body.data.length > 0);
    assert.ok(body.data.every((finding) => finding.type === "config-include-anomaly"));
  } finally {
    await api.close();
    await sidecar.close();
    await fixture.cleanup();
  }
});
