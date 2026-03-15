import assert from "node:assert/strict";
import test from "node:test";

import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("browser e2e: runtime status bar, cron page, and nodes page render in strict read-only mode", async () => {
  await withGovernanceBrowserFixture("baseline", async ({ page, webUrl }) => {
    await page.goto(`${webUrl}/`, {
      waitUntil: "networkidle",
    });

    await page.getByText("Runtime Plane").waitFor();
    await page.locator(".runtime-pill", { hasText: "Gateway: Not configured" }).waitFor();
    await page.locator(".runtime-chip", { hasText: "Nodes: 1 connected / 2 paired" }).waitFor();
    await page.locator(".runtime-chip", { hasText: "Cron: 2 jobs / 1 overdue" }).waitFor();

    assert.equal(await page.getByRole("button", { name: /run cron now/i }).count(), 0);

    await page.goto(`${webUrl}/cron`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("heading", { name: "Cron", exact: true }).waitFor();
    await page.getByText("Workspace Heartbeat").waitFor();
    await page.getByText("Escalation Sweep").waitFor();

    await page.goto(`${webUrl}/nodes`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("heading", { name: "Nodes", exact: true }).waitFor();
    await page.getByText("Ops Relay").waitFor();
    await page.getByText("Night Shift Runner").waitFor();
  });
});
