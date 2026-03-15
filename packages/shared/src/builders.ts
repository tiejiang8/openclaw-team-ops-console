import type {
  Agent,
  CollectionFreshness,
  CollectionMetadata,
  CollectionName,
  CollectionStatus,
  AuthProfile,
  BindingRoute,
  InventorySummary,
  RuntimeStatus,
  Session,
  SnapshotSource,
  SnapshotWarning,
  TopologyEdge,
  TopologyNode,
  TopologyView,
  Workspace,
} from "./domain.js";
import type { ItemResponse, ListResponse, ResponseMeta } from "./contracts.js";
import {
  dedupeSourceKinds,
  deriveCoverage,
  deriveFreshness,
  mapSnapshotSourceToSourceKinds,
  type SourceCollectionStatus,
  type SourceKind,
} from "./observability.js";

function tally(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function buildInventorySummary(input: {
  generatedAt: string;
  agents: Agent[];
  workspaces: Workspace[];
  sessions: Session[];
  bindings: BindingRoute[];
  authProfiles: AuthProfile[];
  runtimeStatuses: RuntimeStatus[];
}): InventorySummary {
  const { generatedAt, agents, workspaces, sessions, bindings, authProfiles, runtimeStatuses } = input;

  return {
    generatedAt,
    totals: {
      agents: agents.length,
      workspaces: workspaces.length,
      sessions: sessions.length,
      bindings: bindings.length,
      authProfiles: authProfiles.length,
    },
    activeSessions: sessions.filter((session) => session.status === "active").length,
    statusBreakdown: {
      agents: tally(agents.map((agent) => agent.status)),
      sessions: tally(sessions.map((session) => session.status)),
      bindings: tally(bindings.map((binding) => binding.status)),
      authProfiles: tally(authProfiles.map((profile) => profile.status)),
      runtime: tally(runtimeStatuses.map((runtimeStatus) => runtimeStatus.status)),
    },
  };
}

export function buildTopologyView(input: {
  generatedAt: string;
  agents: Agent[];
  workspaces: Workspace[];
  sessions: Session[];
  bindings: BindingRoute[];
  authProfiles: AuthProfile[];
}): TopologyView {
  const { generatedAt, agents, workspaces, sessions, bindings, authProfiles } = input;
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const agentIds = new Set(agents.map((agent) => agent.id));
  const bindingIds = new Set(bindings.map((binding) => binding.id));
  const authProfileIds = new Set(authProfiles.map((authProfile) => authProfile.id));

  const nodes: TopologyNode[] = [
    ...workspaces.map((workspace) => ({
      id: workspace.id,
      nodeType: "workspace" as const,
      label: workspace.name,
      status: workspace.status,
      workspaceId: workspace.id,
    })),
    ...agents.map((agent) => ({
      id: agent.id,
      nodeType: "agent" as const,
      label: agent.name,
      status: agent.status,
      ...(agent.workspaceId ? { workspaceId: agent.workspaceId } : {}),
    })),
    ...sessions.map((session) => ({
      id: session.id,
      nodeType: "session" as const,
      label: session.id,
      status: session.status,
      ...(session.workspaceId ? { workspaceId: session.workspaceId } : {}),
    })),
    ...bindings.map((binding) => ({
      id: binding.id,
      nodeType: "binding" as const,
      label: binding.id,
      status: binding.status,
      ...(binding.workspaceId ? { workspaceId: binding.workspaceId } : {}),
    })),
    ...authProfiles.map((authProfile) => ({
      id: authProfile.id,
      nodeType: "auth-profile" as const,
      label: authProfile.name,
      status: authProfile.status,
    })),
  ];

  const edges: TopologyEdge[] = [];
  const pushEdge = (edge: TopologyEdge, isValid: boolean) => {
    if (isValid) {
      edges.push(edge);
    }
  };

  for (const agent of agents) {
    const workspaceId = agent.workspaceId;
    const authProfileId = agent.authProfileId;

    pushEdge(
      {
        fromType: "workspace",
        fromId: workspaceId ?? "",
        toType: "agent",
        toId: agent.id,
        relation: "contains-agent",
      },
      typeof workspaceId === "string" && workspaceIds.has(workspaceId),
    );

    pushEdge(
      {
        fromType: "auth-profile",
        fromId: authProfileId ?? "",
        toType: "agent",
        toId: agent.id,
        relation: "authenticates-agent",
      },
      typeof authProfileId === "string" && authProfileIds.has(authProfileId),
    );
  }

  for (const session of sessions) {
    const workspaceId = session.workspaceId;
    const agentId = session.agentId;
    const bindingId = session.bindingId;

    pushEdge(
      {
        fromType: "workspace",
        fromId: workspaceId ?? "",
        toType: "session",
        toId: session.id,
        relation: "contains-session",
      },
      typeof workspaceId === "string" && workspaceIds.has(workspaceId),
    );

    pushEdge(
      {
        fromType: "agent",
        fromId: agentId ?? "",
        toType: "session",
        toId: session.id,
        relation: "owns-session",
      },
      typeof agentId === "string" && agentIds.has(agentId),
    );

    pushEdge(
      {
        fromType: "binding",
        fromId: bindingId ?? "",
        toType: "session",
        toId: session.id,
        relation: "feeds-session",
      },
      typeof bindingId === "string" && bindingIds.has(bindingId),
    );
  }

  for (const binding of bindings) {
    const workspaceId = binding.workspaceId;
    const targetAgentId = binding.targetAgentId;

    pushEdge(
      {
        fromType: "workspace",
        fromId: workspaceId ?? "",
        toType: "binding",
        toId: binding.id,
        relation: "contains-binding",
      },
      typeof workspaceId === "string" && workspaceIds.has(workspaceId),
    );

    pushEdge(
      {
        fromType: "binding",
        fromId: binding.id,
        toType: "agent",
        toId: targetAgentId ?? "",
        relation: "targets-agent",
      },
      typeof targetAgentId === "string" && agentIds.has(targetAgentId),
    );
  }

  for (const authProfile of authProfiles) {
    for (const workspaceId of authProfile.workspaceIds ?? []) {
      pushEdge(
        {
          fromType: "auth-profile",
          fromId: authProfile.id,
          toType: "workspace",
          toId: workspaceId,
          relation: "scoped-to-workspace",
        },
        workspaceIds.has(workspaceId),
      );
    }
  }

  return {
    generatedAt,
    nodes,
    edges,
  };
}

export function createCollectionMetadata(input: {
  collection: CollectionName;
  status?: CollectionStatus;
  freshness?: CollectionFreshness;
  collectedAt?: string;
  recordCount?: number;
  sourceIds?: string[];
  warnings?: SnapshotWarning[];
}): CollectionMetadata {
  return {
    collection: input.collection,
    status: input.status ?? "complete",
    freshness: input.freshness ?? "fresh",
    ...(input.collectedAt ? { collectedAt: input.collectedAt } : {}),
    ...(typeof input.recordCount === "number" ? { recordCount: input.recordCount } : {}),
    ...(input.sourceIds ? { sourceIds: input.sourceIds } : {}),
    warnings: input.warnings ?? [],
  };
}

export function createResponseMeta(
  generatedAt: string,
  source: SnapshotSource,
  options?: {
    fetchedAt?: string;
    targetId?: string;
    collections?: Partial<Record<CollectionName, CollectionMetadata>>;
    collectionStatuses?: SourceCollectionStatus[];
    sourceKinds?: SourceKind[];
    freshness?: CollectionFreshness;
    coverage?: CollectionStatus;
    warnings?: SnapshotWarning[] | undefined;
    warningCount?: number;
  },
): ResponseMeta {
  const warnings = options?.warnings ?? [];
  const derivedWarningCount =
    typeof options?.warningCount === "number"
      ? options.warningCount
      : warnings.length > 0
      ? warnings.length
      : Object.values(options?.collections ?? {}).reduce((count, collection) => count + (collection?.warnings.length ?? 0), 0);
  const sourceKinds = dedupeSourceKinds(
    options?.sourceKinds ??
      (options?.collectionStatuses?.map((collection) => collection.sourceKind) ?? mapSnapshotSourceToSourceKinds(source)),
  );

  return {
    generatedAt,
    fetchedAt: options?.fetchedAt ?? generatedAt,
    source,
    sourceKinds,
    readOnly: true as const,
    freshness: options?.freshness ?? deriveFreshness(options?.collections, options?.collectionStatuses),
    coverage: options?.coverage ?? deriveCoverage(options?.collections, options?.collectionStatuses),
    ...(options?.targetId ? { targetId: options.targetId } : {}),
    ...(options?.collections ? { collections: options.collections } : {}),
    ...(options?.collectionStatuses ? { collectionStatuses: options.collectionStatuses } : {}),
    ...(options?.warnings && options.warnings.length > 0 ? { warnings: options.warnings } : {}),
    warningCount: derivedWarningCount,
  };
}

export function createListResponse<T>(items: T[], meta: ResponseMeta): ListResponse<T> {
  return {
    data: items,
    items,
    total: items.length,
    meta: {
      ...meta,
      count: items.length,
    },
  };
}

export function createItemResponse<T>(item: T, meta: ResponseMeta): ItemResponse<T> {
  return {
    data: item,
    item,
    meta,
  };
}
