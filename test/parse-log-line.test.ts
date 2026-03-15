import assert from "node:assert/strict";
import test from "node:test";

import { parseLogLine } from "../apps/sidecar/src/adapters/filesystem/logs/parse-log-line.js";

test("parse log line extracts JSON fields, refs, and tags", () => {
  const entry = parseLogLine(
    JSON.stringify({
      ts: "2026-03-15T09:00:00.000Z",
      level: "warn",
      subsystem: "gateway",
      message: "Gateway disconnected sessionId=session-1 deviceId=device-1 plugin=demo",
    }),
    42,
  );

  assert.equal(entry.lineNumber, 42);
  assert.equal(entry.level, "warn");
  assert.equal(entry.subsystem, "gateway");
  assert.equal(entry.parsed, true);
  assert.match(entry.message, /disconnected/i);
  assert.ok(entry.tags.includes("disconnect"));
  assert.ok(entry.tags.includes("plugin"));
  assert.ok(entry.tags.includes("session"));
  assert.equal(entry.refs?.sessionId, "session-1");
  assert.equal(entry.refs?.deviceId, "device-1");
});

test("parse log line preserves raw content when parsing fails", () => {
  const rawLine = "unstructured cron heartbeat without timestamp";
  const entry = parseLogLine(rawLine, 7);

  assert.equal(entry.lineNumber, 7);
  assert.equal(entry.raw, rawLine);
  assert.match(entry.message, /cron heartbeat without timestamp/);
  assert.ok(entry.tags.includes("cron"));
});
