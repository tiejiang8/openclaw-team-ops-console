import assert from "node:assert/strict";
import test from "node:test";

import { withGovernanceBrowserFixture } from "./helpers/browser-e2e-fixture.js";

test("browser e2e: coverage page renders read-only coverage rows and planned gaps", async () => {
  await withGovernanceBrowserFixture("partial-coverage", async ({ page, webUrl }) => {
    await page.goto(`${webUrl}/coverage`);

    await page.getByRole("heading", { name: "Coverage", exact: true }).waitFor();
    await page.locator("tbody tr").first().waitFor();
    await page.getByText("Read-only", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Collection Coverage" }).waitFor();

    const tableText = (await page.locator("tbody").textContent()) ?? "";

    assert.match(tableText, /agents/i);
    assert.match(tableText, /logs/i);
    assert.match(tableText, /gateway ws|gateway/i);
  });
});
