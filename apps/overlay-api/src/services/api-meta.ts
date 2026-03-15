import {
  createResponseMeta,
  type CollectionMetadata,
  type CollectionName,
  type CollectionStatus,
  type CollectionFreshness,
  type ResponseMeta,
  type SnapshotSource,
  type SnapshotWarning,
  type SourceCollectionStatus,
  type SourceKind,
} from "@openclaw-team-ops/shared";

interface ApiMetaOverrides {
  generatedAt?: string;
  fetchedAt?: string;
  source?: SnapshotSource;
  targetId?: string;
  collections?: Partial<Record<CollectionName, CollectionMetadata>>;
  collectionStatuses?: SourceCollectionStatus[];
  sourceKinds?: SourceKind[];
  freshness?: CollectionFreshness;
  coverage?: CollectionStatus;
  warnings?: SnapshotWarning[];
  warningCount?: number;
}

export function buildApiMeta(base: Pick<ResponseMeta, "generatedAt" | "source"> & Partial<ResponseMeta>, overrides: ApiMetaOverrides = {}): ResponseMeta {
  return createResponseMeta(overrides.generatedAt ?? base.generatedAt, overrides.source ?? base.source, {
    ...(overrides.fetchedAt ?? base.fetchedAt ? { fetchedAt: overrides.fetchedAt ?? base.fetchedAt } : {}),
    ...(overrides.targetId ?? base.targetId ? { targetId: overrides.targetId ?? base.targetId } : {}),
    ...(overrides.collections ?? base.collections ? { collections: overrides.collections ?? base.collections } : {}),
    ...(overrides.collectionStatuses ?? base.collectionStatuses
      ? { collectionStatuses: overrides.collectionStatuses ?? base.collectionStatuses }
      : {}),
    ...(overrides.sourceKinds ?? base.sourceKinds ? { sourceKinds: overrides.sourceKinds ?? base.sourceKinds } : {}),
    ...(overrides.freshness ?? base.freshness ? { freshness: overrides.freshness ?? base.freshness } : {}),
    ...(overrides.coverage ?? base.coverage ? { coverage: overrides.coverage ?? base.coverage } : {}),
    ...(overrides.warnings ?? base.warnings ? { warnings: overrides.warnings ?? base.warnings } : {}),
    ...(typeof (overrides.warningCount ?? base.warningCount) === "number"
      ? { warningCount: overrides.warningCount ?? base.warningCount }
      : {}),
  });
}
