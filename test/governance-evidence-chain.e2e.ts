import assert from "node:assert/strict";
import test from "node:test";

import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("browser e2e: governance dashboard drills from finding brief into finding detail and evidence", async () => {
  await withGovernanceBrowserFixture("partial-coverage", async ({ page, webUrl }) => {
    await page.goto(`${webUrl}/governance`);

    await page.getByRole("heading", { name: "Governance", exact: true }).waitFor();
    await page.locator(".governance-findings-brief").waitFor();
    await page.locator(".governance-findings-brief .dashboard-list-item").first().waitFor();
    assert.ok((await page.locator(".evidence-pill").count()) > 0);

    const findingLink = page.locator('.governance-findings-brief a[href^="/findings/"]').first();
    await findingLink.waitFor();
    await findingLink.click();
    await page.waitForURL(/\/findings\/.+$/);
    await page.getByRole("heading", { name: /Finding Summary/ }).waitFor();

    const evidenceLink = page.locator("tbody tr .inline-link").first();
    await evidenceLink.waitFor();
    await evidenceLink.click();
    await page.waitForURL(/\/evidence\/.+$/);
    await page.getByRole("heading", { name: /Evidence Details/ }).waitFor();
  });
});
