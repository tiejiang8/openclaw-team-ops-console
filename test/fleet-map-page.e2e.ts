import { test } from "node:test";
import assert from "node:assert/strict";
import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("Fleet Map page - basic navigation and view toggle", async () => {
  await withGovernanceBrowserFixture("baseline", async ({ page, webUrl }) => {
    // 1. Navigate to Fleet Map
    await page.goto(`${webUrl}/fleet-map`);
    await page.waitForSelector(".fleet-map-svg");

    // 2. Check header and title
    const title = await page.textContent("header h2");
    assert.match(title ?? "", /Fleet Map|全舰队拓扑/);

    // 3. Verify topology view is default (check view toggle button)
    const activeToggle = await page.textContent(".view-toggle-btn.active");
    assert.match(activeToggle ?? "", /Topology|拓扑视图/);

    // 4. Switch to Governance View
    await page.click("button:has-text('Governance'), button:has-text('治理视图')");
    const governanceToggle = await page.textContent(".view-toggle-btn.active");
    assert.match(governanceToggle ?? "", /Governance|治理视图/);

    // 5. Verify governance mode still renders inspectable nodes
    const nodeCount = await page.locator(".topology-node").count();
    assert.ok(nodeCount > 0, "Topology nodes should still render in governance mode");

    // 6. Inspect a node
    await page.click(".topology-node");
    await page.waitForSelector(".fleet-inspector");
    
    const inspectorTitle = await page.textContent(".inspector-node-label");
    assert.ok(inspectorTitle, "Inspector should show node label");

    // 7. Check for read-only invariant (no 'Fix' or 'Remediate' buttons)
    const fixButtons = await page.locator("button:has-text('Fix'), button:has-text('Remediate'), button:has-text('修复')").count();
    assert.equal(fixButtons, 0, "Should not have write/fix buttons on Fleet Map");
  });
});
