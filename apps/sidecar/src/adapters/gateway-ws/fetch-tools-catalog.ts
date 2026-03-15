import type { Plugin, Tool } from "@openclaw-team-ops/shared";

import { extractRecordArray, isRecord, toBoolean, toString, type GatewayRequestClient } from "./protocol.js";

interface ToolCandidate {
  agentId: string;
  value: Record<string, unknown>;
}

export async function fetchToolsCatalog(client: GatewayRequestClient): Promise<unknown> {
  return client.request("tools.catalog");
}

export function normalizeToolsCatalog(raw: unknown): Tool[] {
  const candidates = collectToolCandidates(raw);
  const tools = candidates
    .map((candidate) => mapTool(candidate))
    .filter((tool): tool is Tool => tool !== undefined);
  const deduped = new Map<string, Tool>();

  for (const tool of tools) {
    deduped.set(`${tool.agentId}:${tool.name}`, tool);
  }

  return Array.from(deduped.values());
}

export function normalizePluginsFromCatalog(raw: unknown, tools: Tool[]): Plugin[] {
  const plugins = new Map<string, Plugin>();

  for (const tool of tools) {
    if (!tool.pluginId) {
      continue;
    }

    plugins.set(tool.pluginId, {
      id: tool.pluginId,
      sourceKind: "gateway",
      enabled: true,
    });
  }

  collectPluginEntries(raw).forEach((entry) => {
    const pluginId = toString(entry.id) ?? toString(entry.pluginId) ?? toString(entry.name);

    if (!pluginId) {
      return;
    }

    const notes = [
      toString(entry.note),
      ...(Array.isArray(entry.notes)
        ? entry.notes.map((note) => toString(note)).filter((note): note is string => typeof note === "string")
        : []),
      ...(Array.isArray(entry.warnings)
        ? entry.warnings
            .map((warning) => {
              if (isRecord(warning)) {
                return toString(warning.message) ?? toString(warning.code);
              }

              return toString(warning);
            })
            .filter((warning): warning is string => typeof warning === "string")
        : []),
    ].filter((note): note is string => typeof note === "string");
    const hasRuntimeErrors =
      toBoolean(entry.hasRuntimeErrors) ??
      (Array.isArray(entry.errors) && entry.errors.length > 0 ? true : undefined) ??
      (typeof entry.errorCount === "number" && entry.errorCount > 0 ? true : undefined);
    const existing = plugins.get(pluginId);
    const enabled = toBoolean(entry.enabled) ?? existing?.enabled;

    plugins.set(pluginId, {
      id: pluginId,
      sourceKind: "gateway",
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      ...(typeof hasRuntimeErrors === "boolean" ? { hasRuntimeErrors } : {}),
      ...(notes.length > 0 ? { notes } : existing?.notes ? { notes: existing.notes } : {}),
    });
  });

  return Array.from(plugins.values());
}

function collectToolCandidates(raw: unknown): ToolCandidate[] {
  const directItems = extractRecordArray(raw, ["items", "tools", "catalog", "data", "result"]);

  if (directItems.some((entry) => Array.isArray(entry.tools))) {
    return flattenGroupedToolEntries(directItems);
  }

  const directToolItems = directItems
    .map((entry) => {
      const agentId = toString(entry.agentId) ?? toString(entry.agent);
      return agentId ? { agentId, value: entry } : undefined;
    })
    .filter((entry): entry is ToolCandidate => entry !== undefined);

  if (directToolItems.length > 0) {
    return directToolItems;
  }

  if (!isRecord(raw)) {
    return [];
  }

  const nestedGroupedEntries = flattenGroupedToolEntries(
    Object.entries(raw)
      .filter(([, value]) => isRecord(value))
      .map(([, value]) => value)
      .filter((value): value is Record<string, unknown> => isRecord(value)),
  );

  if (nestedGroupedEntries.length > 0) {
    return nestedGroupedEntries;
  }

  return [];
}

function flattenGroupedToolEntries(groups: Record<string, unknown>[]): ToolCandidate[] {
  const tools: ToolCandidate[] = [];

  for (const group of groups) {
    const agentId = toString(group.agentId) ?? toString(group.agent) ?? toString(group.id);
    const entries = extractRecordArray(group.tools ?? group.items ?? group.catalog, ["items", "tools", "catalog"]);

    if (!agentId || entries.length === 0) {
      continue;
    }

    for (const entry of entries) {
      tools.push({
        agentId,
        value: entry,
      });
    }
  }

  return tools;
}

function mapTool(candidate: ToolCandidate): Tool | undefined {
  const name = toString(candidate.value.name) ?? toString(candidate.value.toolName) ?? toString(candidate.value.id);

  if (!name) {
    return undefined;
  }

  const explicitPluginId =
    toString(candidate.value.pluginId) ??
    (isRecord(candidate.value.plugin) ? toString(candidate.value.plugin.id) ?? toString(candidate.value.plugin.name) : undefined);
  const rawSource = toString(candidate.value.source) ?? toString(candidate.value.origin) ?? toString(candidate.value.provider);
  const pluginId = explicitPluginId ?? (rawSource?.startsWith("plugin:") ? rawSource.slice("plugin:".length) : undefined);
  const optional = toBoolean(candidate.value.optional);
  const group = toString(candidate.value.group) ?? toString(candidate.value.category);

  return {
    agentId: candidate.agentId,
    name,
    source: pluginId ? "plugin" : "core",
    ...(pluginId ? { pluginId } : {}),
    ...(typeof optional === "boolean" ? { optional } : {}),
    ...(group ? { group } : {}),
  };
}

function collectPluginEntries(raw: unknown): Record<string, unknown>[] {
  const direct = extractRecordArray(raw, ["plugins", "pluginStates"]);

  if (direct.length > 0) {
    return direct;
  }

  if (!isRecord(raw)) {
    return [];
  }

  const pluginMap = isRecord(raw.plugins) ? raw.plugins : isRecord(raw.pluginStates) ? raw.pluginStates : undefined;

  if (!pluginMap) {
    return [];
  }

  return Object.entries(pluginMap)
    .map((entry) => mapPluginEntry(entry[0], entry[1]))
    .filter((value): value is Record<string, unknown> => value !== undefined);
}

function mapPluginEntry(key: string, value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    id: key,
    ...value,
  };
}
