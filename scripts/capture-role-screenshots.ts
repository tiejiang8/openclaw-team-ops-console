import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { withGovernanceBrowserFixture } from "../test/helpers/browser-e2e-fixture.js";

const repoRoot = process.cwd();
const screenshotDir = path.join(repoRoot, "docs", "screenshots");

async function ensureDirectory() {
  await mkdir(screenshotDir, { recursive: true });
}

async function captureBaselineScreens() {
  await withGovernanceBrowserFixture("baseline", async ({ page, webUrl }) => {
    await page.setViewportSize({ width: 1500, height: 1080 });

    await page.goto(`${webUrl}/`);
    await page.getByRole("heading", { name: /Overview|总览/ }).waitFor();
    await page.locator(".dashboard-hero-card").nth(3).waitFor();
    assert.equal(await page.locator(".dashboard-hero-card").count(), 4);
    await page.screenshot({
      path: path.join(screenshotDir, "overview-role-dashboard.png"),
      fullPage: true,
    });

    const operationsCard = page.locator(".role-summary-card").filter({ hasText: /Operations|运维/ }).first();
    await operationsCard.waitFor();
    await operationsCard.locator("a").first().click();
    await page.waitForURL(/\/operations$/);
    await page.getByRole("heading", { name: /Operations|运维/ }).waitFor();
    const hasTrendBars = (await page.locator(".mini-trend-bar").count()) > 0;
    const hasEmptyState = (await page.locator(".panel-empty-state").count()) > 0;
    assert.ok(hasTrendBars || hasEmptyState);
    await page.screenshot({
      path: path.join(screenshotDir, "operations-workbench.png"),
      fullPage: true,
    });

    await page.goto(`${webUrl}/adoption`);
    await page.getByRole("heading", { name: /Adoption|运营/ }).waitFor();
    const heatmapCells = page.locator(".usage-heatmap-cell");
    const adoptionEmptyState = page.locator(".panel-empty-state");
    const hasHeatmap = (await heatmapCells.count()) === 24;
    const hasAdoptionEmpty = (await adoptionEmptyState.count()) > 0;
    assert.ok(hasHeatmap || hasAdoptionEmpty);
    await page.screenshot({
      path: path.join(screenshotDir, "adoption-dashboard.png"),
      fullPage: true,
    });
  });
}

async function captureGovernanceScreen() {
    await withGovernanceBrowserFixture("partial-coverage", async ({ page, webUrl }) => {
    await page.setViewportSize({ width: 1500, height: 1080 });

    await page.goto(`${webUrl}/governance`);
    await page.locator(".page-header h2").filter({ hasText: /Governance|治理/ }).waitFor();
    await page.locator(".governance-findings-brief").waitFor();
    await page.locator(".governance-findings-brief .dashboard-list-item").first().waitFor();
    assert.ok((await page.locator(".evidence-pill").count()) > 0);
    await page.screenshot({
      path: path.join(screenshotDir, "governance-dashboard.png"),
      fullPage: true,
    });

    const findingLink = page.locator('.governance-findings-brief a[href^="/findings/"]').first();
    await findingLink.waitFor();
    await findingLink.click();
    await page.waitForURL(/\/findings\/.+$/);
    await page.locator(".panel-header h3").filter({ hasText: /Finding Summary|发现摘要/ }).waitFor();

    const evidenceLink = page.locator("tbody tr .inline-link").first();
    await evidenceLink.waitFor();
    await evidenceLink.click();
    await page.waitForURL(/\/evidence\/.+$/);
    await page.locator(".panel-header h3").filter({ hasText: /Evidence Details|证据详情/ }).waitFor();
  });
}

async function main() {
  await ensureDirectory();
  await captureBaselineScreens();
  await captureGovernanceScreen();

  console.log("role-dashboard-screenshots-ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
