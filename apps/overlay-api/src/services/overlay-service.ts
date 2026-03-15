import {
  createItemResponse,
  createListResponse,
  createCollectionMetadata,
  createResponseMeta,
  type CollectionMetadata,
  type CronJobResponse,
  type CronJobsResponse,
  type CoverageResponse,
  type CollectionStatus,
  type CollectionFreshness,
  type EvidenceResponse,
  type EvidencesResponse,
  type FindingResponse,
  type FindingsResponse,
  type NodesResponse,
  type PluginsResponse,
  type PresenceResponse,
  type RecommendationResponse,
  type RecommendationsResponse,
  type RuntimeStatus,
  type RuntimeStatusResponse,
  type RisksSummaryResponse,
  type RuntimeStatusesResponse,
  type SnapshotSource,
  type SourceKind,
  type SummaryResponse,
  type Target,
  type TargetSnapshotSummary,
  type ToolsResponse,
} from "@openclaw-team-ops/shared";

import { SidecarClient } from "../clients/sidecar-client.js";
import { buildApiMeta } from "./api-meta.js";
import { buildGovernanceDataset } from "./governance-engine.js";

interface EvidenceQuery {
  targetId?: string;
  severity?: string;
  kind?: string;
  subjectType?: string;
  subjectId?: string;
}

interface FindingQuery {
  targetId?: string;
  severity?: string;
  type?: string;
  status?: string;
}

interface RecommendationQuery {
  findingId?: string;
}

interface CronQuery {
  source?: string;
  status?: string;
  q?: string;
}

interface NodeQuery {
  q?: string;
  status?: string;
}

export class OverlayService {
  constructor(private readonly sidecarClient: SidecarClient) {}

  async getSummary(): Promise<SummaryResponse> {
    const summary = await this.sidecarClient.getSummary();
    const observedAt = new Date().toISOString();
    const overlayRuntimeStatus: RuntimeStatus = {
      componentId: "overlay-api",
      componentType: "service",
      status: "healthy",
      observedAt,
      details: {
        mode: "read-only",
      },
    };
    const runtimeStatuses = [...summary.runtimeStatuses, overlayRuntimeStatus];
    const upstreamRuntimeMetadata = summary.meta.collections?.runtimeStatuses;
    const runtimeMetadata: CollectionMetadata = {
      ...(upstreamRuntimeMetadata ??
        createCollectionMetadata({
          collection: "runtimeStatuses",
          collectedAt: observedAt,
          recordCount: runtimeStatuses.length,
          sourceIds: ["sidecar", "overlay-api"],
        })),
      recordCount: runtimeStatuses.length,
      sourceIds: Array.from(new Set([...(upstreamRuntimeMetadata?.sourceIds ?? ["sidecar"]), "overlay-api"])),
    };

    return {
      data: summary.data,
      runtimeStatuses,
      meta: {
        ...buildApiMeta(summary.meta, {
          collections: {
            ...summary.meta.collections,
            runtimeStatuses: runtimeMetadata,
          },
        }),
        collections: {
          ...summary.meta.collections,
          runtimeStatuses: runtimeMetadata,
        },
      },
    };
  }

  getTargets() {
    return this.sidecarClient.getTargets();
  }

  async getCoverage(): Promise<CoverageResponse> {
    const coverage = await this.sidecarClient.getCoverage();

    return createItemResponse(
      coverage.data,
      buildApiMeta(coverage.meta, {
        ...(coverage.meta.collections ? { collections: coverage.meta.collections } : {}),
        collectionStatuses: coverage.data.collections,
      }),
    );
  }

  getTargetById(targetId: string) {
    return this.sidecarClient.getTargetById(targetId);
  }

  getTargetSummary(targetId: string) {
    return this.sidecarClient.getTargetSummary(targetId);
  }

  async getEvidences(query: EvidenceQuery = {}): Promise<EvidencesResponse> {
    const governance = await this.collectGovernanceData();
    const data = governance.dataset.evidences.filter((evidence) => {
      if (query.targetId && evidence.targetId !== query.targetId) {
        return false;
      }

      if (query.severity && evidence.severity !== query.severity) {
        return false;
      }

      if (query.kind && evidence.kind !== query.kind) {
        return false;
      }

      if (query.subjectType && evidence.subjectType !== query.subjectType) {
        return false;
      }

      if (query.subjectId && evidence.subjectId !== query.subjectId) {
        return false;
      }

      return true;
    });

    return createListResponse(data, governance.meta);
  }

  async getEvidenceById(evidenceId: string): Promise<EvidenceResponse | undefined> {
    const governance = await this.collectGovernanceData();
    const evidence = governance.dataset.evidences.find((candidate) => candidate.id === evidenceId);

    if (!evidence) {
      return undefined;
    }

    return createItemResponse(evidence, governance.meta);
  }

  async getFindings(query: FindingQuery = {}): Promise<FindingsResponse> {
    const governance = await this.collectGovernanceData();
    const data = governance.dataset.findings.filter((finding) => {
      if (query.targetId && finding.targetId !== query.targetId) {
        return false;
      }

      if (query.severity && finding.severity !== query.severity) {
        return false;
      }

      if (query.type && finding.type !== query.type) {
        return false;
      }

      if (query.status && finding.status !== query.status) {
        return false;
      }

      return true;
    });

    return createListResponse(data, governance.meta);
  }

  async getFindingById(findingId: string): Promise<FindingResponse | undefined> {
    const governance = await this.collectGovernanceData();
    const finding = governance.dataset.findings.find((candidate) => candidate.id === findingId);

    if (!finding) {
      return undefined;
    }

    return createItemResponse(finding, governance.meta);
  }

  async getRecommendations(query: RecommendationQuery = {}): Promise<RecommendationsResponse> {
    const governance = await this.collectGovernanceData();
    const data = governance.dataset.recommendations.filter((recommendation) => {
      if (query.findingId && recommendation.findingId !== query.findingId) {
        return false;
      }

      return true;
    });

    return createListResponse(data, governance.meta);
  }

  async getRecommendationById(recommendationId: string): Promise<RecommendationResponse | undefined> {
    const governance = await this.collectGovernanceData();
    const recommendation = governance.dataset.recommendations.find((candidate) => candidate.id === recommendationId);

    if (!recommendation) {
      return undefined;
    }

    return createItemResponse(recommendation, governance.meta);
  }

  async getRisksSummary(): Promise<RisksSummaryResponse> {
    const governance = await this.collectGovernanceData();

    return createItemResponse(governance.dataset.risksSummary, governance.meta);
  }

  getAgents() {
    return this.sidecarClient.getAgents();
  }

  getAgentById(agentId: string) {
    return this.sidecarClient.getAgentById(agentId);
  }

  getWorkspaces() {
    return this.sidecarClient.getWorkspaces();
  }

  getWorkspaceDocument(workspaceId: string, fileName: string) {
    return this.sidecarClient.getWorkspaceDocument(workspaceId, fileName);
  }

  getSessions() {
    return this.sidecarClient.getSessions();
  }

  getPresence(): Promise<PresenceResponse> {
    return this.sidecarClient.getPresence();
  }

  getNodes(): Promise<NodesResponse> {
    return this.getNodeSummaries();
  }

  getTools(): Promise<ToolsResponse> {
    return this.sidecarClient.getTools();
  }

  getPlugins(): Promise<PluginsResponse> {
    return this.sidecarClient.getPlugins();
  }

  getBindings() {
    return this.sidecarClient.getBindings();
  }

  getAuthProfiles() {
    return this.sidecarClient.getAuthProfiles();
  }

  getTopology() {
    return this.sidecarClient.getTopology();
  }

  async getRuntimeStatus(): Promise<RuntimeStatusResponse> {
    const response = await this.sidecarClient.getRuntimeStatus();

    return createItemResponse(response.data, buildApiMeta(response.meta));
  }

  async getCronJobs(query: CronQuery = {}): Promise<CronJobsResponse> {
    const response = await this.sidecarClient.getCronJobs();
    const items = response.data.filter((job) => {
      if (query.source && query.source !== "all" && job.source !== query.source) {
        return false;
      }

      if (query.status === "enabled" && !job.enabled) {
        return false;
      }

      if (query.status === "disabled" && job.enabled) {
        return false;
      }

      if (query.status === "overdue" && !job.overdue) {
        return false;
      }

      if (query.status === "failing" && job.lastRunState !== "error") {
        return false;
      }

      if (query.q) {
        const needle = query.q.toLowerCase();
        const haystack = [job.id, job.name, job.scheduleText, job.sessionTarget, job.deliveryMode].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) {
          return false;
        }
      }

      return true;
    });

    return createListResponse(items, buildApiMeta(response.meta));
  }

  async getCronJob(id: string): Promise<CronJobResponse | undefined> {
    const response = await this.sidecarClient.getCronJob(id);

    if (!response) {
      return undefined;
    }

    return createItemResponse(response.data, buildApiMeta(response.meta));
  }

  async getNodeSummaries(query: NodeQuery = {}): Promise<NodesResponse> {
    const response = await this.sidecarClient.getNodes();
    const items = response.data.filter((node) => {
      if (query.status === "connected" && !node.connected) {
        return false;
      }

      if (query.status === "paired" && !node.paired) {
        return false;
      }

      if (query.status === "stale" && (node.connected || !node.paired)) {
        return false;
      }

      if (query.q) {
        const needle = query.q.toLowerCase();
        const haystack = [node.id, node.name, node.platform, ...(node.capabilities ?? [])].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) {
          return false;
        }
      }

      return true;
    });
    const list = createListResponse(items, buildApiMeta(response.meta));

    return {
      ...list,
      summary: {
        paired: items.filter((node) => node.paired).length,
        connected: items.filter((node) => node.connected).length,
        stale: items.filter((node) => node.paired && !node.connected).length,
      },
    };
  }

  async getRuntimeStatuses(): Promise<RuntimeStatusesResponse> {
    const summary = await this.getSummary();
    return createListResponse(
      summary.runtimeStatuses,
      buildApiMeta(summary.meta, {
        ...(summary.meta.collections?.runtimeStatuses
          ? { collections: { runtimeStatuses: summary.meta.collections.runtimeStatuses } }
          : {}),
      }),
    );
  }

  private async collectGovernanceData(): Promise<{
    dataset: ReturnType<typeof buildGovernanceDataset>;
    generatedAt: string;
    source: SnapshotSource;
    meta: ReturnType<typeof createResponseMeta>;
  }> {
    const targetsResponse = await this.sidecarClient.getTargets();
    const targets = targetsResponse.data;
    const targetSummaries = (
      await Promise.all(
        targets.map(async (target) => {
          const response = await this.sidecarClient.getTargetSummary(target.id);
          return response?.data;
        }),
      )
    ).filter((summary): summary is TargetSnapshotSummary => Boolean(summary));

    const dataset = buildGovernanceDataset(targetSummaries);

    const generatedAt = this.latestGovernanceTimestamp(targets, targetSummaries);
    const source = this.detectGovernanceSource(targets);

    return {
      dataset,
      generatedAt,
      source,
      meta: this.buildGovernanceMeta(targets, targetSummaries, generatedAt, source),
    };
  }

  private detectGovernanceSource(targets: Target[]): SnapshotSource {
    if (targets.length === 0) {
      return "mixed";
    }

    if (targets.every((target) => target.sourceKind === "mock")) {
      return "mock";
    }

    if (targets.every((target) => target.sourceKind === "filesystem")) {
      return "openclaw";
    }

    return "mixed";
  }

  private latestGovernanceTimestamp(targets: Target[], targetSummaries: TargetSnapshotSummary[]): string {
    const timestamps = [
      ...targets.map((target) => target.lastCollectedAt),
      ...targetSummaries.map((targetSummary) => targetSummary.summary.generatedAt),
    ]
      .filter((timestamp): timestamp is string => typeof timestamp === "string")
      .map((timestamp) => Date.parse(timestamp))
      .filter((timestamp) => !Number.isNaN(timestamp))
      .sort((left, right) => right - left);

    return timestamps.length > 0 && typeof timestamps[0] === "number"
      ? new Date(timestamps[0]).toISOString()
      : new Date().toISOString();
  }

  private buildGovernanceMeta(
    targets: Target[],
    targetSummaries: TargetSnapshotSummary[],
    generatedAt: string,
    source: SnapshotSource,
  ) {
    const sourceKinds = Array.from(
      new Set(
        targets.map((target) => {
          switch (target.sourceKind) {
            case "filesystem":
            case "logs":
              return "filesystem" as const;
            case "cli":
              return "cli-probe" as const;
            case "gateway-health":
              return "gateway-ws" as const;
            case "mock":
            default:
              return "mock" as const;
          }
        }),
      ),
    ) as SourceKind[];
    const freshnessValues = targets.map((target) => target.freshness);
    const freshness: CollectionFreshness = freshnessValues.includes("stale")
      ? "stale"
      : freshnessValues.includes("fresh")
        ? "fresh"
        : "unknown";
    const coverage: CollectionStatus =
      targets.length === 0
        ? "unavailable"
        : targets.every((target) => target.coverage.partialCollections === 0 && target.coverage.unavailableCollections === 0)
          ? "complete"
          : targets.every(
                (target) =>
                  target.coverage.completeCollections === 0 &&
                  target.coverage.partialCollections === 0 &&
                  target.coverage.unavailableCollections > 0,
              )
            ? "unavailable"
            : "partial";
    const warnings = targetSummaries.flatMap((targetSummary) => targetSummary.warnings);
    const warningCount = targets.reduce((count, target) => count + target.warningCount, 0);

    return buildApiMeta(createResponseMeta(generatedAt, source), {
      sourceKinds,
      freshness,
      coverage,
      warnings: warnings.slice(0, 50),
      warningCount,
    });
  }
}
