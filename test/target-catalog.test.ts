import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { FilesystemOpenClawAdapter } from "../apps/sidecar/src/adapters/filesystem/filesystem-adapter.js";
import { MockOpenClawAdapter } from "../apps/sidecar/src/adapters/mock/mock-adapter.js";
import { SidecarTargetCatalog } from "../apps/sidecar/src/targets/target-catalog.js";
import { createFilesystemRuntimeFixture } from "./helpers/filesystem-runtime-fixture.js";

test("target catalog derives a mock target with sandbox environment and read-only collection policy", async () => {
  const catalog = new SidecarTargetCatalog(new MockOpenClawAdapter({ scenario: "baseline" }), {
    SIDECAR_MOCK_SCENARIO: "baseline",
  });

  const targets = await catalog.getTargets();

  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.sourceKind, "mock");
  assert.equal(targets[0]?.type, "local-runtime");
  assert.equal(targets[0]?.environment, "sandbox");
  assert.equal(targets[0]?.collectionPolicy.readOnly, true);
  assert.equal(targets[0]?.collectionPolicy.mockFallbackAllowed, true);
  assert.ok((targets[0]?.coverage.completeCollections ?? 0) > 0);
});

test("target catalog surfaces filesystem connection hints and summary for a local runtime", async () => {
  const fixture = await createFilesystemRuntimeFixture();

  try {
    const adapter = new FilesystemOpenClawAdapter({
      runtimeRoot: fixture.runtimeRoot,
      configFile: fixture.configFile,
      workspaceGlob: fixture.workspaceGlob,
      sourceRoot: fixture.sourceRoot,
    });
    const catalog = new SidecarTargetCatalog(adapter, {
      OPENCLAW_RUNTIME_ROOT: fixture.runtimeRoot,
      OPENCLAW_CONFIG_FILE: fixture.configFile,
      OPENCLAW_WORKSPACE_GLOB: fixture.workspaceGlob,
      OPENCLAW_SOURCE_ROOT: fixture.sourceRoot,
      SIDECAR_TARGET_NAME: "Fixture Runtime",
      SIDECAR_TARGET_ENVIRONMENT: "development",
      SIDECAR_TARGET_OWNER: "team-ops",
    });

    const targets = await catalog.getTargets();
    const target = targets[0];

    assert.ok(target);
    assert.equal(target.sourceKind, "filesystem");
    assert.equal(target.type, "local-runtime");
    assert.equal(target.environment, "development");
    assert.equal(target.owner, "team-ops");
    assert.equal(target.connection.runtimeRoot, fixture.runtimeRoot);
    assert.equal(target.connection.configFile, fixture.configFile);
    assert.equal(target.collectionPolicy.mockFallbackAllowed, false);

    const summary = await catalog.getTargetSummary(target.id);

    assert.ok(summary);
    assert.equal(summary.target.id, target.id);
    assert.equal(summary.summary.totals.agents, 2);
    assert.equal(summary.collections.workspaces.status, "partial");
    assert.ok(summary.warnings.some((warning) => warning.code === "OPENCLAW_WORKSPACE_DIRECTORY_MISSING"));
  } finally {
    await fixture.cleanup();
  }
});

test("target catalog can enumerate multiple configured targets from a registry file", async () => {
  const fixture = await createFilesystemRuntimeFixture();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-ops-targets-"));
  const registryFile = path.join(tempDir, "targets.json");

  try {
    await writeFile(
      registryFile,
      JSON.stringify(
        [
          {
            id: "mock-sandbox",
            name: "Mock Sandbox",
            environment: "sandbox",
            mockScenario: "baseline",
          },
          {
            id: "fixture-runtime",
            name: "Fixture Runtime",
            environment: "development",
            runtimeRoot: fixture.runtimeRoot,
            configFile: fixture.configFile,
            workspaceGlob: fixture.workspaceGlob,
            sourceRoot: fixture.sourceRoot,
          },
        ],
        null,
        2,
      ),
    );

    const catalog = new SidecarTargetCatalog(new MockOpenClawAdapter({ scenario: "baseline" }), {
      SIDECAR_TARGETS_FILE: registryFile,
    });
    const targets = await catalog.getTargets();

    assert.equal(targets.length, 2);
    assert.ok(targets.some((target) => target.sourceKind === "mock"));
    assert.ok(targets.some((target) => target.sourceKind === "filesystem"));

    const filesystemTarget = targets.find((target) => target.id === "fixture-runtime");
    assert.ok(filesystemTarget);

    const summary = await catalog.getTargetSummary(filesystemTarget.id);
    assert.ok(summary);
    assert.equal(summary.target.id, filesystemTarget.id);
    assert.equal(summary.summary.totals.agents, 2);
  } finally {
    await fixture.cleanup();
    await rm(tempDir, { recursive: true, force: true });
  }
});
