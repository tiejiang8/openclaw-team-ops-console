import {
  createCollectionMetadata,
  createResponseMeta,
  type CollectionMetadata,
  type EvidenceResponse,
  type EvidencesResponse,
  type FindingResponse,
  type FindingsResponse,
  type RecommendationResponse,
  type RecommendationsResponse,
  type RuntimeStatus,
  type RisksSummaryResponse,
  type RuntimeStatusesResponse,
  type SnapshotSource,
  type SummaryResponse,
  type Target,
  type TargetSnapshotSummary,
} from "@openclaw-team-ops/shared";

import { SidecarClient } from "../clients/sidecar-client.js";
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
        ...summary.meta,
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

    return {
      data,
      meta: {
        ...createResponseMeta(governance.generatedAt, governance.source),
        count: data.length,
      },
    };
  }

  async getEvidenceById(evidenceId: string): Promise<EvidenceResponse | undefined> {
    const governance = await this.collectGovernanceData();
    const evidence = governance.dataset.evidences.find((candidate) => candidate.id === evidenceId);

    if (!evidence) {
      return undefined;
    }

    return {
      data: evidence,
      meta: createResponseMeta(governance.generatedAt, governance.source),
    };
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

    return {
      data,
      meta: {
        ...createResponseMeta(governance.generatedAt, governance.source),
        count: data.length,
      },
    };
  }

  async getFindingById(findingId: string): Promise<FindingResponse | undefined> {
    const governance = await this.collectGovernanceData();
    const finding = governance.dataset.findings.find((candidate) => candidate.id === findingId);

    if (!finding) {
      return undefined;
    }

    return {
      data: finding,
      meta: createResponseMeta(governance.generatedAt, governance.source),
    };
  }

  async getRecommendations(query: RecommendationQuery = {}): Promise<RecommendationsResponse> {
    const governance = await this.collectGovernanceData();
    const data = governance.dataset.recommendations.filter((recommendation) => {
      if (query.findingId && recommendation.findingId !== query.findingId) {
        return false;
      }

      return true;
    });

    return {
      data,
      meta: {
        ...createResponseMeta(governance.generatedAt, governance.source),
        count: data.length,
      },
    };
  }

  async getRecommendationById(recommendationId: string): Promise<RecommendationResponse | undefined> {
    const governance = await this.collectGovernanceData();
    const recommendation = governance.dataset.recommendations.find((candidate) => candidate.id === recommendationId);

    if (!recommendation) {
      return undefined;
    }

    return {
      data: recommendation,
      meta: createResponseMeta(governance.generatedAt, governance.source),
    };
  }

  async getRisksSummary(): Promise<RisksSummaryResponse> {
    const governance = await this.collectGovernanceData();

    return {
      data: governance.dataset.risksSummary,
      meta: createResponseMeta(governance.generatedAt, governance.source),
    };
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

  getBindings() {
    return this.sidecarClient.getBindings();
  }

  getAuthProfiles() {
    return this.sidecarClient.getAuthProfiles();
  }

  getTopology() {
    return this.sidecarClient.getTopology();
  }

  async getRuntimeStatuses(): Promise<RuntimeStatusesResponse> {
    const summary = await this.getSummary();
    return {
      data: summary.runtimeStatuses,
      meta: createResponseMeta(summary.meta.generatedAt, summary.meta.source, {
        ...(summary.meta.collections?.runtimeStatuses
          ? { collections: { runtimeStatuses: summary.meta.collections.runtimeStatuses } }
          : {}),
        ...(summary.meta.warnings ? { warnings: summary.meta.warnings } : {}),
      }),
    };
  }

  private async collectGovernanceData(): Promise<{
    dataset: ReturnType<typeof buildGovernanceDataset>;
    generatedAt: string;
    source: SnapshotSource;
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

    return {
      dataset,
      generatedAt: this.latestGovernanceTimestamp(targets, targetSummaries),
      source: this.detectGovernanceSource(targets),
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
}
