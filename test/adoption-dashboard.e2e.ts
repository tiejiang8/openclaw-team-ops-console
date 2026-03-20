import assert from "node:assert/strict";
import test from "node:test";

import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("browser e2e: adoption dashboard shows usage trend, rankings, and heatmap", async () => {
  await withGovernanceBrowserFixture("baseline", async ({ page, webUrl }) => {
    await page.goto(`${webUrl}/adoption`);

    await page.getByRole("heading", { name: /Adoption|运营/ }).waitFor();
    await page.locator(".usage-heatmap-cell").nth(23).waitFor();
    assert.ok((await page.locator(".dashboard-health-strip .metric-card").count()) >= 4);
    assert.equal(await page.locator(".usage-heatmap-cell").count(), 24);
    assert.ok((await page.locator(".dashboard-list .dashboard-list-item").count()) > 0);

    const workspaceLink = page.locator('a[href="/workspaces"]').first();
    await workspaceLink.waitFor();
    await workspaceLink.click();
    await page.waitForURL(/\/workspaces$/);
  });
});
