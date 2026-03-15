import {
  mapAdapterSourceKind,
  mapSnapshotSourceToSourceKinds,
  type CollectionName,
  type CoverageSummary,
  type SnapshotWarning,
  type SourceCollectionStatus,
  type SourceKind,
  type SystemSnapshot,
} from "@openclaw-team-ops/shared";

type CoverageSnapshotInput = Pick<SystemSnapshot, "source" | "generatedAt" | "origin" | "collections" | "warnings">;

const PLANNED_COLLECTION_SOURCES: Array<{ key: SourceCollectionStatus["key"]; sourceKind: SourceKind }> = [
  { key: "logs", sourceKind: "filesystem" },
  { key: "cron", sourceKind: "filesystem" },
  { key: "presence", sourceKind: "gateway-ws" },
  { key: "nodes", sourceKind: "gateway-ws" },
  { key: "tools", sourceKind: "gateway-ws" },
  { key: "plugins", sourceKind: "gateway-ws" },
];

function warningSignature(warning: SnapshotWarning): string {
  return [warning.code, warning.collection ?? "", warning.message, warning.sourceId ?? ""].join("::");
}

function countWarnings(warnings: SnapshotWarning[]): number {
  return new Set(warnings.map(warningSignature)).size;
}

function resolveDefaultSourceKind(snapshot: CoverageSnapshotInput): SourceKind {
  const sourceKinds = snapshot.origin.sources.map((source) => mapAdapterSourceKind(source.kind));
  return sourceKinds[0] ?? mapSnapshotSourceToSourceKinds(snapshot.source)[0] ?? "mock";
}

function buildCollectedCollectionStatuses(snapshot: CoverageSnapshotInput): SourceCollectionStatus[] {
  const defaultSourceKind = resolveDefaultSourceKind(snapshot);

  return (Object.keys(snapshot.collections) as CollectionName[]).map((key) => {
    const collection = snapshot.collections[key];
    const relatedWarnings = [
      ...collection.warnings,
      ...snapshot.warnings.filter((warning) => warning.collection === key),
    ];

    return {
      key,
      sourceKind: defaultSourceKind,
      freshness: collection.freshness,
      coverage: collection.status,
      warningCount: countWarnings(relatedWarnings),
      ...(collection.status !== "unavailable" ? { lastSuccessAt: collection.collectedAt ?? snapshot.generatedAt } : {}),
    };
  });
}

export function buildSourceRegistry(
  snapshot: CoverageSnapshotInput,
  overrides: SourceCollectionStatus[] = [],
): CoverageSummary {
  const collectedStatuses = buildCollectedCollectionStatuses(snapshot);
  const mergedStatuses = [...collectedStatuses];

  for (const override of overrides) {
    const existingIndex = mergedStatuses.findIndex((collection) => collection.key === override.key);
    if (existingIndex >= 0) {
      mergedStatuses[existingIndex] = override;
      continue;
    }

    mergedStatuses.push(override);
  }

  const knownKeys = new Set(mergedStatuses.map((collection) => collection.key));
  const plannedStatuses = PLANNED_COLLECTION_SOURCES.filter((collection) => !knownKeys.has(collection.key)).map((collection) => ({
    key: collection.key,
    sourceKind: collection.sourceKind,
    freshness: "unknown" as const,
    coverage: "unavailable" as const,
    warningCount: 0,
  }));

  return {
    collections: [...mergedStatuses, ...plannedStatuses],
  };
}
