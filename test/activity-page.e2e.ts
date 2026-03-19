import { test } from "node:test";
import assert from "node:assert/strict";
import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("Activity page - event grouping and traceability", async () => {
  await withGovernanceBrowserFixture("baseline", async ({ page, webUrl }) => {
    // 1. Navigate to Activity Page
    await page.goto(`${webUrl}/activity`);
    await page.waitForSelector(".activity-timeline");

    // 2. Check for date headers
    const dateHeaders = await page.locator(".activity-date-header").count();
    assert.ok(dateHeaders > 0, "Should have date groups in activity timeline");

    // 3. Verify event items
    const timelineItems = await page.locator(".timeline-item").count();
    assert.ok(timelineItems > 0, "Should have activity items");

    // 4. Test filtering
    await page.selectOption("select:first-of-type", "cron");
    // Wait for data refresh (useResource polling or SSE)
    await page.waitForTimeout(1000); 
    
    // 5. Check traceability link
    const detailLink = page.locator(".btn-link").first();
    if (await detailLink.isVisible()) {
      const href = await detailLink.getAttribute("href");
      assert.ok(href?.startsWith("/"), "Traceability link should be a valid root-relative path");
      
      await detailLink.click();
      await page.waitForTimeout(500);
      assert.ok(page.url().includes(href!), "Should navigate to detail page");
    }

    // 6. Read-only check
    const buttons = await page.locator("button").allTextContents();
    const hasWriteAction = buttons.some(b => /Fix|Execute|Apply|修复|执行|应用/.test(b));
    assert.equal(hasWriteAction, false, "Activity page should remain strictly read-only");
  });
});
