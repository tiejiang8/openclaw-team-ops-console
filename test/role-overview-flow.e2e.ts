import assert from "node:assert/strict";
import test from "node:test";

import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("browser e2e: overview routes into role workbenches for operations and adoption", async () => {
  await withGovernanceBrowserFixture("baseline", async ({ page, webUrl }) => {
    await page.goto(`${webUrl}/`);

    await page.getByRole("heading", { name: /Overview|总览/ }).waitFor();
    await page.locator(".dashboard-hero-card").nth(3).waitFor();
    const heroCount = await page.locator(".dashboard-hero-card").count();
    assert.equal(heroCount, 4);

    const operationsCard = page.locator(".role-summary-card").filter({ hasText: /Operations|运维/ }).first();
    await operationsCard.waitFor();
    await operationsCard.locator("a").first().click();
    await page.waitForURL(/\/operations$/);
    await page.getByRole("heading", { name: /Operations|运维/ }).waitFor();

    await page.goto(`${webUrl}/`);
    await page.locator(".role-summary-card").nth(3).waitFor();
    const adoptionCard = page.locator(".role-summary-card").filter({ hasText: /Adoption|运营/ }).first();
    await adoptionCard.waitFor();
    await adoptionCard.locator("a").first().click();
    await page.waitForURL(/\/adoption$/);
    await page.getByRole("heading", { name: /Adoption|运营/ }).waitFor();
  });
});
