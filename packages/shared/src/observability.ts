import {
  COLLECTION_FRESHNESS,
  COLLECTION_NAMES,
  COLLECTION_STATUSES,
  type AdapterSourceKind,
  type CollectionFreshness,
  type CollectionMetadata,
  type CollectionName,
  type CollectionStatus,
  type SnapshotSource,
  type SnapshotWarning,
} from "./domain.js";

export const SOURCE_KINDS = ["mock", "filesystem", "gateway-ws", "cli-probe"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_COLLECTION_KEYS = [
  ...COLLECTION_NAMES,
  "targets",
  "logs",
  "cron",
  "presence",
  "nodes",
  "tools",
  "plugins",
] as const;
export type SourceCollectionKey = (typeof SOURCE_COLLECTION_KEYS)[number];

export interface SourceCollectionStatus {
  key: SourceCollectionKey;
  sourceKind: SourceKind;
  freshness: CollectionFreshness;
  coverage: CollectionStatus;
  warningCount: number;
  lastSuccessAt?: string;
}

export interface CoverageSummary {
  collections: SourceCollectionStatus[];
}

export interface ApiMeta {
  generatedAt: string;
  fetchedAt: string;
  source: SnapshotSource;
  sourceKinds: SourceKind[];
  readOnly: true;
  freshness: CollectionFreshness;
  coverage: CollectionStatus;
  targetId?: string;
  collections?: Partial<Record<CollectionName, CollectionMetadata>>;
  collectionStatuses?: SourceCollectionStatus[];
  warnings?: SnapshotWarning[];
  warningCount: number;
}

function isCollectionFreshness(value: string): value is CollectionFreshness {
  return COLLECTION_FRESHNESS.includes(value as CollectionFreshness);
}

function isCollectionStatus(value: string): value is CollectionStatus {
  return COLLECTION_STATUSES.includes(value as CollectionStatus);
}

export function mapAdapterSourceKind(kind: AdapterSourceKind | undefined): SourceKind {
  switch (kind) {
    case "filesystem":
      return "filesystem";
    case "cli":
      return "cli-probe";
    case "http":
    case "websocket":
      return "gateway-ws";
    case "mock":
    case "composite":
    default:
      return "mock";
  }
}

export function mapSnapshotSourceToSourceKinds(source: SnapshotSource): SourceKind[] {
  switch (source) {
    case "mock":
      return ["mock"];
    case "openclaw":
      return ["filesystem"];
    case "mixed":
    default:
      return ["mock", "filesystem"];
  }
}

export function dedupeSourceKinds(values: readonly SourceKind[]): SourceKind[] {
  return Array.from(new Set(values));
}

export function deriveFreshness(
  collections?: Partial<Record<CollectionName, CollectionMetadata>>,
  collectionStatuses?: readonly SourceCollectionStatus[],
): CollectionFreshness {
  const values = [
    ...Object.values(collections ?? {})
      .map((collection) => collection?.freshness)
      .filter((value): value is CollectionFreshness => typeof value === "string" && isCollectionFreshness(value)),
    ...(collectionStatuses ?? [])
      .map((collection) => collection.freshness)
      .filter((value): value is CollectionFreshness => typeof value === "string" && isCollectionFreshness(value)),
  ];

  if (values.includes("stale")) {
    return "stale";
  }

  if (values.includes("fresh")) {
    return "fresh";
  }

  return "unknown";
}

export function deriveCoverage(
  collections?: Partial<Record<CollectionName, CollectionMetadata>>,
  collectionStatuses?: readonly SourceCollectionStatus[],
): CollectionStatus {
  const values = [
    ...Object.values(collections ?? {})
      .map((collection) => collection?.status)
      .filter((value): value is CollectionStatus => typeof value === "string" && isCollectionStatus(value)),
    ...(collectionStatuses ?? [])
      .map((collection) => collection.coverage)
      .filter((value): value is CollectionStatus => typeof value === "string" && isCollectionStatus(value)),
  ];

  if (values.length === 0) {
    return "unavailable";
  }

  if (values.every((value) => value === "complete")) {
    return "complete";
  }

  if (values.every((value) => value === "unavailable")) {
    return "unavailable";
  }

  return "partial";
}
