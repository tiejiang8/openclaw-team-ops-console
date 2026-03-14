import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { FilesystemOpenClawAdapter } from "../apps/sidecar/src/adapters/filesystem/filesystem-adapter.js";
import { createFilesystemRuntimeFixture } from "./helpers/filesystem-runtime-fixture.js";

test("filesystem adapter degrades gracefully when configured paths are missing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-ops-empty-"));

  try {
    const adapter = new FilesystemOpenClawAdapter({
      runtimeRoot: path.join(tempDir, "missing-runtime"),
      configFile: path.join(tempDir, "missing-runtime", "openclaw.json"),
      workspaceGlob: path.join(tempDir, "workspace*"),
    });
    const snapshot = await adapter.fetchSnapshot();
    const health = await adapter.healthCheck();

    assert.equal(snapshot.source, "openclaw");
    assert.equal(snapshot.collections.agents.status, "unavailable");
    assert.equal(snapshot.collections.workspaces.status, "unavailable");
    assert.equal(snapshot.collections.sessions.status, "unavailable");
    assert.equal(health.status, "degraded");
    assert.ok(snapshot.warnings.some((warning) => warning.code === "OPENCLAW_RUNTIME_ROOT_MISSING"));
    assert.ok(snapshot.warnings.some((warning) => warning.code === "OPENCLAW_CONFIG_FILE_MISSING"));
    assert.ok(
      snapshot.runtimeStatuses.some(
        (status) => status.componentId === "openclaw-config-file" && status.status === "offline",
      ),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filesystem adapter normalizes config, workspace, session, and auth inventory from a local runtime", async () => {
  const fixture = await createFilesystemRuntimeFixture();

  try {
    const adapter = new FilesystemOpenClawAdapter({
      runtimeRoot: fixture.runtimeRoot,
      configFile: fixture.configFile,
      workspaceGlob: fixture.workspaceGlob,
      sourceRoot: fixture.sourceRoot,
    });
    const snapshot = await adapter.fetchSnapshot();

    assert.equal(snapshot.origin.adapterName, "FilesystemOpenClawAdapter");
    assert.equal(snapshot.collections.workspaces.status, "partial");
    assert.equal(snapshot.collections.agents.status, "complete");
    assert.equal(snapshot.collections.sessions.status, "partial");
    assert.equal(snapshot.collections.authProfiles.status, "partial");
    assert.equal(snapshot.collections.bindings.status, "complete");
    assert.equal(snapshot.agents.length, 2);
    assert.equal(snapshot.workspaces.length, 2);
    assert.equal(snapshot.sessions.length, 1);
    assert.equal(snapshot.authProfiles.length, 1);
    assert.equal(snapshot.bindings.length, 2);
    assert.ok(snapshot.workspaces.some((workspace) => workspace.status === "offline"));
    assert.deepEqual(
      snapshot.workspaces.find((workspace) => (workspace.coreMarkdownFiles?.length ?? 0) > 0)?.coreMarkdownFiles,
      ["AGENTS.md", "SOUL.md", "TOOLS.md", "BOOTSTRAP.md", "IDENTITY.md", "USER.md"],
    );
    assert.ok(snapshot.warnings.some((warning) => warning.code === "OPENCLAW_WORKSPACE_DIRECTORY_MISSING"));
    assert.ok(snapshot.runtimeStatuses.some((status) => status.componentId === "openclaw-source-root"));
    assert.ok(snapshot.topology.nodes.length > 0);
  } finally {
    await fixture.cleanup();
  }
});

test("filesystem adapter returns workspace markdown content for discovered core files", async () => {
  const fixture = await createFilesystemRuntimeFixture();

  try {
    const adapter = new FilesystemOpenClawAdapter({
      runtimeRoot: fixture.runtimeRoot,
      configFile: fixture.configFile,
      workspaceGlob: fixture.workspaceGlob,
      sourceRoot: fixture.sourceRoot,
    });
    const snapshot = await adapter.fetchSnapshot();
    const workspaceWithDocs = snapshot.workspaces.find((workspace) => (workspace.coreMarkdownFiles?.length ?? 0) > 0);

    assert.ok(workspaceWithDocs);

    const document = await adapter.getWorkspaceDocument(workspaceWithDocs.id, "AGENTS.md");

    assert.ok(document);
    assert.equal(document.workspaceId, workspaceWithDocs.id);
    assert.equal(document.fileName, "AGENTS.md");
    assert.match(document.content, /# Main workspace/);
  } finally {
    await fixture.cleanup();
  }
});
