import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type { CronJobResponse, CronJobsResponse } from "@openclaw-team-ops/shared";
import type { Express } from "express";

import { createOverlayApiApp } from "../apps/overlay-api/src/app.js";
import { SidecarClient } from "../apps/overlay-api/src/clients/sidecar-client.js";
import { createSidecarApp } from "../apps/sidecar/src/app.js";
import { FilesystemOpenClawAdapter } from "../apps/sidecar/src/adapters/filesystem/filesystem-adapter.js";
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

test("filesystem cron read exposes read-only cron summaries and details through the overlay api", async () => {
  const fixture = await createFilesystemRuntimeFixture();
  const cronDir = `${fixture.runtimeRoot}/cron`;
  const runsDir = `${cronDir}/runs`;

  await mkdir(runsDir, { recursive: true });
  await writeFile(
    `${cronDir}/jobs.json`,
    JSON.stringify(
      {
        "daily-report": {
          name: "Daily Report",
          schedule: "0 * * * *",
          enabled: true,
          sessionTarget: "session:ops:reports",
          deliveryMode: "notify",
          nextRunAt: "2026-03-15T07:00:00.000Z",
          lastRunAt: "2026-03-15T06:00:00.000Z",
        },
        cleanup: {
          name: "Cleanup",
          schedule: "*/30 * * * *",
          enabled: false,
          nextRunAt: "2026-03-15T10:00:00.000Z",
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    `${runsDir}/daily-report.jsonl`,
    `${JSON.stringify({
      runId: "run-err-1",
      startedAt: "2026-03-15T06:00:00.000Z",
      finishedAt: "2026-03-15T06:00:21.000Z",
      state: "error",
      summary: "Gateway ping timed out.",
    })}\n`,
  );

  const sidecar = await startServer(
    createSidecarApp(
      new FilesystemOpenClawAdapter({
        runtimeRoot: fixture.runtimeRoot,
        configFile: fixture.configFile,
        workspaceGlob: fixture.workspaceGlob,
        clock: {
          now: () => new Date("2026-03-15T09:00:00.000Z"),
        },
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
    const [listResponse, detailResponse] = await Promise.all([
      fetch(`${api.url}/api/cron`),
      fetch(`${api.url}/api/cron/daily-report`),
    ]);
    const listBody = (await listResponse.json()) as CronJobsResponse;
    const detailBody = (await detailResponse.json()) as CronJobResponse;

    assert.equal(listResponse.status, 200);
    assert.equal(detailResponse.status, 200);
    assert.equal(listBody.meta.readOnly, true);
    assert.equal(listBody.data.length, 2);

    const overdueJob = listBody.data.find((job) => job.id === "daily-report");
    assert.equal(overdueJob?.source, "filesystem");
    assert.equal(overdueJob?.overdue, true);
    assert.equal(overdueJob?.lastRunState, "error");

    assert.equal(detailBody.data.id, "daily-report");
    assert.equal(detailBody.data.rawPath?.endsWith("/cron/jobs.json"), true);
    assert.equal(detailBody.data.rawRunLogPath?.endsWith("/cron/runs/daily-report.jsonl"), true);
    assert.equal(detailBody.data.recentRuns[0]?.state, "error");
    assert.ok(detailBody.data.evidenceRefs.some((ref) => ref.kind === "path"));
  } finally {
    await api.close();
    await sidecar.close();
    await fixture.cleanup();
  }
});
