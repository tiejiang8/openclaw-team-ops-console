import assert from "node:assert/strict";
import test from "node:test";

import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("browser e2e: operations dashboard shows trends and drills into raw operational pages", async () => {
  await withGovernanceBrowserFixture("baseline", async ({ page, webUrl }) => {
    await page.goto(`${webUrl}/operations`);

    await page.getByRole("heading", { name: /Operations|运维/ }).waitFor();
    await page.locator(".dashboard-health-strip .metric-card").nth(3).waitFor();
    assert.ok((await page.locator(".dashboard-health-strip .metric-card").count()) >= 4);
    assert.ok((await page.locator(".mini-trend-bar").count()) > 0);

    const logsLink = page.locator('a[href="/logs"]').first();
    await logsLink.waitFor();
    await logsLink.click();
    await page.waitForURL(/\/logs$/);

    const buttons = await page.locator("button").allTextContents();
    const hasWriteAction = buttons.some((value) => /Fix|Execute|Apply|修复|执行|应用/.test(value));
    assert.equal(hasWriteAction, false);
  });
});
