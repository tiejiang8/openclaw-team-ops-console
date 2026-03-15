import { createHash } from "node:crypto";

import type { LogEntry, LogLevel } from "@openclaw-team-ops/shared";

const PLAIN_LOG_PATTERN =
  /^(?<ts>\d{4}-\d{2}-\d{2}[T ][0-9:.+-Z]+)?\s*(?:\[(?<level>[A-Z]+)\]|\b(?<levelWord>TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b)?\s*(?<subsystem>[a-zA-Z0-9_.:-]+)?\s*(?:-|:)?\s*(?<message>.*)$/;

export function parseLogLine(line: string, lineNumber: number): LogEntry {
  const fromJson = parseJsonLine(line, lineNumber);
  if (fromJson) {
    return fromJson;
  }

  const match = line.match(PLAIN_LOG_PATTERN);
  const ts = normalizeTimestamp(match?.groups?.ts);
  const level = normalizeLevel(match?.groups?.level ?? match?.groups?.levelWord);
  const subsystem = normalizeInput(match?.groups?.subsystem);
  const message = normalizeInput(match?.groups?.message) ?? line;
  const refs = extractRefs(line);
  const tags = extractTags(line);
  const parsed = Boolean(ts || level !== "unknown" || subsystem);

  return {
    id: buildLogEntryId(lineNumber, line),
    lineNumber,
    ...(ts ? { ts } : {}),
    level,
    ...(subsystem ? { subsystem } : {}),
    message,
    raw: line,
    parsed,
    tags,
    ...(hasRefs(refs) ? { refs } : {}),
  };
}

function parseJsonLine(line: string, lineNumber: number): LogEntry | undefined {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    const payload =
      isRecord(parsed.log) ? parsed.log : isRecord(parsed.payload) ? parsed.payload : parsed;
    const message =
      normalizeInput(readString(payload.message) ?? readString(payload.msg) ?? readString(parsed.message) ?? readString(parsed.raw)) ??
      line;
    const ts = normalizeTimestamp(readString(payload.ts) ?? readString(payload.timestamp) ?? readString(parsed.ts) ?? readString(parsed.timestamp));
    const level = normalizeLevel(
      readString(payload.level) ?? readString(parsed.level) ?? readString(parsed.type),
    );
    const subsystem = normalizeInput(
      readString(payload.subsystem) ??
        readString(payload.logger) ??
        readString(payload.component) ??
        readString(parsed.subsystem),
    );
    const refs = extractRefs(line);
    const tags = extractTags(`${message} ${line}`);

    return {
      id: buildLogEntryId(lineNumber, line),
      lineNumber,
      ...(ts ? { ts } : {}),
      level,
      ...(subsystem ? { subsystem } : {}),
      message,
      raw: line,
      parsed: true,
      tags,
      ...(hasRefs(refs) ? { refs } : {}),
    };
  } catch {
    return undefined;
  }
}

function normalizeLevel(value?: string): LogLevel {
  switch ((value ?? "").trim().toLowerCase()) {
    case "trace":
      return "trace";
    case "debug":
      return "debug";
    case "info":
    case "log":
      return "info";
    case "warn":
    case "warning":
      return "warn";
    case "error":
      return "error";
    case "fatal":
      return "fatal";
    default:
      return "unknown";
  }
}

function normalizeTimestamp(value?: string): string | undefined {
  const normalized = normalizeInput(value);
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function extractTags(value: string): string[] {
  const normalized = value.toLowerCase();
  const tags = new Set<string>();

  if (normalized.includes("disconnect")) {
    tags.add("disconnect");
  }
  if (normalized.includes("cron")) {
    tags.add("cron");
  }
  if (normalized.includes("plugin")) {
    tags.add("plugin");
  }
  if (normalized.includes("sessionid=") || normalized.includes("session ")) {
    tags.add("session");
  }
  if (normalized.includes("node") || normalized.includes("deviceid=")) {
    tags.add("node");
  }

  return Array.from(tags);
}

function extractRefs(value: string): NonNullable<LogEntry["refs"]> {
  return {
    ...extractRef("sessionId", /sessionId[=:"]+([A-Za-z0-9:_-]+)/i, value),
    ...extractRef("agentId", /agentId[=:"]+([A-Za-z0-9:_-]+)/i, value),
    ...extractRef("deviceId", /deviceId[=:"]+([A-Za-z0-9:_-]+)/i, value),
    ...extractRef("jobId", /jobId[=:"]+([A-Za-z0-9:_-]+)/i, value),
  };
}

function extractRef(key: keyof NonNullable<LogEntry["refs"]>, pattern: RegExp, value: string) {
  const match = value.match(pattern);
  return match?.[1] ? { [key]: match[1] } : {};
}

function buildLogEntryId(lineNumber: number, line: string): string {
  return `log:${lineNumber}:${createHash("sha1").update(line).digest("hex").slice(0, 10)}`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeInput(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasRefs(refs: NonNullable<LogEntry["refs"]>): boolean {
  return Object.keys(refs).length > 0;
}
