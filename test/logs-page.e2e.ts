import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createSidecarApp } from "../apps/sidecar/src/app.js";
import { FilesystemOpenClawAdapter } from "../apps/sidecar/src/adapters/filesystem/filesystem-adapter.js";
import { withCustomSidecarBrowserFixture } from "./helpers/browser-e2e-fixture.js";
import { createFilesystemRuntimeFixture } from "./helpers/filesystem-runtime-fixture.js";

test("browser e2e: logs page opens the latest log file and shows log details", async () => {
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

  try {
    const sidecarApp = createSidecarApp(
      new FilesystemOpenClawAdapter({
        runtimeRoot: fixture.runtimeRoot,
        configFile: fixture.configFile,
        workspaceGlob: fixture.workspaceGlob,
        logGlob: path.join(fixture.logDir, "openclaw-*.log"),
        homedir: () => fixture.homeDir,
      }),
    );

    await withCustomSidecarBrowserFixture(sidecarApp, async ({ page, webUrl }) => {
      await page.goto(`${webUrl}/logs`, {
        waitUntil: "networkidle",
      });

      await page.getByRole("heading", { name: "Logs", exact: true }).waitFor();
      await page.getByText("Read-only", { exact: true }).waitFor();
      await page.getByRole("heading", { name: "Log Entries" }).waitFor();

      const tableText = (await page.locator("tbody").textContent()) ?? "";
      assert.match(tableText, /Gateway disconnected/);
      assert.match(tableText, /WARN/);

      await page.getByRole("button", { name: /Gateway disconnected/i }).click();
      await page.getByRole("heading", { name: "Log Details" }).waitFor();

      const detailText = (await page.locator(".log-detail-panel").textContent()) ?? "";
      assert.match(detailText, /session-1/);
      assert.match(detailText, /device-1/);
    });
  } finally {
    await fixture.cleanup();
  }
});
