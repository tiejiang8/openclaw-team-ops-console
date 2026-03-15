import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverLogFiles } from "../apps/sidecar/src/adapters/filesystem/logs/discover-log-files.js";

test("discover log files prefers an explicit OPENCLAW_LOG_GLOB override", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-ops-logs-"));
  const logDir = path.join(rootDir, "logs");

  try {
    await mkdir(logDir, { recursive: true });
    await writeFile(path.join(logDir, "openclaw-2026-03-14.log"), '{"level":"info","message":"older"}\n');
    await writeFile(path.join(logDir, "openclaw-2026-03-15.log"), '{"level":"warn","message":"latest"}\n');

    const result = await discoverLogFiles({
      logGlob: path.join(logDir, "openclaw-*.log"),
      now: new Date("2026-03-15T12:00:00.000Z"),
    });

    assert.equal(result.collectionStatus.key, "logs");
    assert.equal(result.collectionStatus.coverage, "complete");
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.date, "2026-03-15");
    assert.equal(result.items[0]?.sourceKind, "glob");
    assert.equal(result.items[0]?.isLatest, true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("discover log files can resolve logging.file from openclaw.json", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-ops-config-logs-"));
  const logDir = path.join(rootDir, "logs");
  const configFile = path.join(rootDir, "openclaw.json");

  try {
    await mkdir(logDir, { recursive: true });
    await writeFile(
      configFile,
      `{
        logging: {
          file: "./logs/openclaw-*.log"
        }
      }
`,
    );
    await writeFile(path.join(logDir, "openclaw-2026-03-15.log"), '{"level":"info","message":"configured"}\n');

    const result = await discoverLogFiles({
      configFile,
      configBaseDir: rootDir,
      now: new Date("2026-03-15T12:00:00.000Z"),
    });

    assert.equal(result.collectionStatus.coverage, "complete");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.sourceKind, "configured");
    assert.equal(result.items[0]?.date, "2026-03-15");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
