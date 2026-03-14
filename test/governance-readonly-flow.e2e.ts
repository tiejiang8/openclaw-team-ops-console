import assert from "node:assert/strict";
import test from "node:test";

import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("browser e2e: mock governance flow stays read-only from risks to finding detail, evidence, and recommendations", async () => {
  await withGovernanceBrowserFixture("partial-coverage", async ({ page, webUrl }) => {
    await page.goto(`${webUrl}/risks?f_type=dangling-binding`, {
      waitUntil: "networkidle",
    });

    await page.getByRole("heading", { name: "Risks" }).waitFor();
    await page.getByRole("heading", { name: "Open Findings" }).waitFor();

    const riskRowLink = page.locator("tbody tr .inline-link").first();
    await riskRowLink.waitFor();
    const riskSummary = (await riskRowLink.textContent())?.trim() ?? "";

    assert.ok(riskSummary.length > 0);
    await riskRowLink.click();
    await page.waitForURL(/\/findings\/.+$/);

    await page.getByRole("heading", { name: "Finding Summary" }).waitFor();
    await page.getByRole("heading", { name: "Recommended Checks" }).waitFor();
    await page.getByRole("heading", { name: "Evidence Chain" }).waitFor();

    const recommendationCards = page.locator(".recommendation-card");
    const evidenceLinks = page.locator("tbody tr .inline-link");

    assert.ok((await recommendationCards.count()) > 0, "expected at least one read-only recommendation");
    assert.ok((await evidenceLinks.count()) > 0, "expected at least one linked evidence record");

    const firstRecommendationText = (await recommendationCards.first().textContent())?.trim() ?? "";
    assert.match(firstRecommendationText, /Inspect|Verify|Compare|Collect/i);

    await evidenceLinks.first().click();
    await page.waitForURL(/\/evidence\/.+$/);

    await page.getByRole("heading", { name: "Evidence Details" }).waitFor();
    await page.getByRole("heading", { name: "Resource Drill-down" }).waitFor();
    await page.getByText("Path References").waitFor();

    const detailText = (await page.locator(".detail-list").first().textContent()) ?? "";
    assert.match(detailText, /Target|Subject/);
  });
});
