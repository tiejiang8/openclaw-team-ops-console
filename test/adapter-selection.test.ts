import assert from "node:assert/strict";
import test from "node:test";

import { createSidecarAdapterFromEnv, hasFilesystemAdapterConfiguration } from "../apps/sidecar/src/adapters/create-adapter.js";

test("mock mode stays the default when no OpenClaw runtime paths are configured", () => {
  assert.equal(hasFilesystemAdapterConfiguration({}), false);
  assert.equal(hasFilesystemAdapterConfiguration({ OPENCLAW_SOURCE_ROOT: "/tmp/openclaw" }), false);
  assert.equal(createSidecarAdapterFromEnv({}).mode, "mock");
  assert.equal(createSidecarAdapterFromEnv({ OPENCLAW_SOURCE_ROOT: "/tmp/openclaw" }).mode, "mock");
});

test("filesystem adapter activates for sidecar and official OpenClaw read-only envs", () => {
  assert.equal(hasFilesystemAdapterConfiguration({ OPENCLAW_RUNTIME_ROOT: "/tmp/.openclaw" }), true);
  assert.equal(hasFilesystemAdapterConfiguration({ OPENCLAW_STATE_DIR: "/tmp/.openclaw" }), true);
  assert.equal(createSidecarAdapterFromEnv({ OPENCLAW_CONFIG_FILE: "/tmp/.openclaw/openclaw.json" }).mode, "external-readonly");
  assert.equal(createSidecarAdapterFromEnv({ OPENCLAW_CONFIG_PATH: "/tmp/.openclaw/openclaw.json" }).mode, "external-readonly");
  assert.equal(createSidecarAdapterFromEnv({ OPENCLAW_WORKSPACE_GLOB: "/tmp/.openclaw/workspace*" }).source, "openclaw");
  assert.equal(createSidecarAdapterFromEnv({ OPENCLAW_PROFILE: "dev" }).mode, "external-readonly");
});
