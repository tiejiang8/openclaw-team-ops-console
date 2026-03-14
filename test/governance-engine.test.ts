import assert from "node:assert/strict";
import test from "node:test";

import { buildGovernanceDataset } from "../apps/overlay-api/src/services/governance-engine.js";
import { FilesystemOpenClawAdapter } from "../apps/sidecar/src/adapters/filesystem/filesystem-adapter.js";
import { MockOpenClawAdapter } from "../apps/sidecar/src/adapters/mock/mock-adapter.js";
import { SidecarTargetCatalog } from "../apps/sidecar/src/targets/target-catalog.js";
import { createFilesystemRuntimeFixture } from "./helpers/filesystem-runtime-fixture.js";

test("governance engine builds evidence from warnings, partial coverage, and workspace drift", async () => {
  const catalog = new SidecarTargetCatalog(new MockOpenClawAdapter({ scenario: "partial-coverage" }), {
    SIDECAR_MOCK_SCENARIO: "partial-coverage",
  });
  const targets = await catalog.getTargets();
  const targetSummary = await catalog.getTargetSummary(targets[0]!.id);

  assert.ok(targetSummary);

  const dataset = buildGovernanceDataset([targetSummary]);

  assert.ok(dataset.evidences.some((evidence) => evidence.kind === "coverage-gap"));
  assert.ok(dataset.evidences.some((evidence) => evidence.kind === "binding-parse"));
  assert.ok(dataset.findings.some((finding) => finding.type === "workspace-drift"));
});

test("governance engine emits orphan-session and dangling-binding findings with recommendations", async () => {
  const catalog = new SidecarTargetCatalog(new MockOpenClawAdapter({ scenario: "partial-coverage" }), {
    SIDECAR_MOCK_SCENARIO: "partial-coverage",
  });
  const targets = await catalog.getTargets();
  const targetSummary = await catalog.getTargetSummary(targets[0]!.id);

  assert.ok(targetSummary);

  const mutatedSummary = structuredClone(targetSummary);
  if (mutatedSummary.sessions[0]) {
    delete mutatedSummary.sessions[0].agentId;
    delete mutatedSummary.sessions[0].workspaceId;
  }

  const dataset = buildGovernanceDataset([mutatedSummary]);
  const orphanFinding = dataset.findings.find((finding) => finding.type === "orphan-session");
  const danglingBindingFinding = dataset.findings.find((finding) => finding.type === "dangling-binding");

  assert.ok(orphanFinding);
  assert.ok(orphanFinding.evidenceRefs.length > 0);
  assert.ok(danglingBindingFinding);
  assert.ok(
    dataset.recommendations.some((recommendation) => recommendation.findingId === orphanFinding.id),
  );
  assert.ok(
    dataset.recommendations.some((recommendation) => recommendation.findingId === danglingBindingFinding.id),
  );
});

test("governance engine surfaces config include anomalies and snapshot freshness degradation", async () => {
  const fixture = await createFilesystemRuntimeFixture();

  try {
    const staleCatalog = new SidecarTargetCatalog(new MockOpenClawAdapter({ scenario: "stale-observability" }), {
      SIDECAR_MOCK_SCENARIO: "stale-observability",
    });
    const staleTargets = await staleCatalog.getTargets();
    const staleSummary = await staleCatalog.getTargetSummary(staleTargets[0]!.id);

    const filesystemCatalog = new SidecarTargetCatalog(
      new FilesystemOpenClawAdapter({
        runtimeRoot: fixture.runtimeRoot,
        configFile: `${fixture.runtimeRoot}/missing-openclaw.json`,
        workspaceGlob: fixture.workspaceGlob,
        sourceRoot: fixture.sourceRoot,
      }),
      {
        OPENCLAW_RUNTIME_ROOT: fixture.runtimeRoot,
        OPENCLAW_CONFIG_FILE: `${fixture.runtimeRoot}/missing-openclaw.json`,
        OPENCLAW_WORKSPACE_GLOB: fixture.workspaceGlob,
        OPENCLAW_SOURCE_ROOT: fixture.sourceRoot,
      },
    );
    const filesystemTargets = await filesystemCatalog.getTargets();
    const filesystemSummary = await filesystemCatalog.getTargetSummary(filesystemTargets[0]!.id);

    assert.ok(staleSummary);
    assert.ok(filesystemSummary);

    const dataset = buildGovernanceDataset([staleSummary, filesystemSummary]);

    assert.ok(
      dataset.findings.some((finding) => finding.type === "snapshot-freshness-degradation"),
    );
    assert.ok(
      dataset.findings.some((finding) => finding.type === "config-include-anomaly"),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("filesystem fixture can drive workspace drift and orphan-session findings", async () => {
  const fixture = await createFilesystemRuntimeFixture();

  try {
    const filesystemCatalog = new SidecarTargetCatalog(
      new FilesystemOpenClawAdapter({
        runtimeRoot: fixture.runtimeRoot,
        configFile: fixture.configFile,
        workspaceGlob: fixture.workspaceGlob,
        sourceRoot: fixture.sourceRoot,
      }),
      {
        OPENCLAW_RUNTIME_ROOT: fixture.runtimeRoot,
        OPENCLAW_CONFIG_FILE: fixture.configFile,
        OPENCLAW_WORKSPACE_GLOB: fixture.workspaceGlob,
        OPENCLAW_SOURCE_ROOT: fixture.sourceRoot,
      },
    );
    const targets = await filesystemCatalog.getTargets();
    const summary = await filesystemCatalog.getTargetSummary(targets[0]!.id);

    assert.ok(summary);

    const mutatedSummary = structuredClone(summary);
    if (mutatedSummary.sessions[0]) {
      delete mutatedSummary.sessions[0].agentId;
      delete mutatedSummary.sessions[0].workspaceId;
    }

    const dataset = buildGovernanceDataset([mutatedSummary]);

    assert.ok(dataset.findings.some((finding) => finding.type === "workspace-drift"));
    assert.ok(dataset.findings.some((finding) => finding.type === "orphan-session"));
  } finally {
    await fixture.cleanup();
  }
});
