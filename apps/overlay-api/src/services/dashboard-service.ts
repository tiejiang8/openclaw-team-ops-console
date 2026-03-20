import {
  createItemResponse,
  type ActivityEventDto,
  type DashboardAdoptionResponse,
  type DashboardDrilldownLink,
  type DashboardGovernanceResponse,
  type DashboardOperationsResponse,
  type DashboardOutcomesResponse,
  type DashboardOverviewResponse,
  type DashboardSignal,
  type Evidence,
  type EvidenceReference,
  type FindingsBriefItem,
  type Finding,
  type GovernanceDashboard,
  type OperationsDashboard,
  type OutcomesDashboard,
  type Recommendation,
  type RecommendationPriorityItem,
  type RiskPostureSummary,
  type RoleOverviewSummary,
  type Session,
  type SourceTraceSummary,
  type Target,
  type TeamCoverageSummary,
  type TopAgentUsage,
  type TopWorkspaceUsage,
  type UsageTrendPoint,
  type ValueSignalSummary,
  type Workspace,
} from "@openclaw-team-ops/shared";

import { buildApiMeta } from "./api-meta.js";
import { ActivityService } from "./activity-service.js";
import { OverlayService } from "./overlay-service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isWithinDays(value: string | undefined, days: number, now: number): boolean {
  const timestamp = toTimestamp(value);

  return typeof timestamp === "number" && now - timestamp <= days * DAY_MS;
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentageDelta(current: number, previous: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return round(((current - previous) / previous) * 100, 1);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sessionDurationMinutes(session: Session): number {
  const startedAt = toTimestamp(session.startedAt);
  const endedAt = toTimestamp(session.lastActivityAt) ?? startedAt;

  if (typeof startedAt !== "number" || typeof endedAt !== "number" || endedAt < startedAt) {
    return 0;
  }

  return Math.max(1, Math.round((endedAt - startedAt) / (60 * 1000)));
}

function sessionActivityAt(session: Session): string | undefined {
  return session.lastActivityAt ?? session.startedAt;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function safeLabel(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function joinNaturalLabels(labels: string[]): string {
  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return labels[0]!;
  }

  if (labels.length === 2) {
    return `${labels[0]!} and ${labels[1]!}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]!}`;
}

function buildLink(label: string, to: string, description?: string, badge?: string): DashboardDrilldownLink {
  return {
    label,
    to,
    ...(description ? { description } : {}),
    ...(badge ? { badge } : {}),
  };
}

function buildEvidenceReference(evidence: Evidence): EvidenceReference {
  return {
    id: evidence.id,
    label: evidence.message,
    to: `/evidence/${encodeURIComponent(evidence.id)}`,
    severity: evidence.severity,
    kind: evidence.kind,
    ...(evidence.subjectLabel ? { subjectLabel: evidence.subjectLabel } : {}),
    observedAt: evidence.observedAt,
  };
}

function severityWeight(severity: string): number {
  switch (severity) {
    case "critical":
    case "error":
      return 4;
    case "high":
    case "warn":
      return 3;
    case "medium":
      return 2;
    case "low":
    case "info":
      return 1;
    default:
      return 0;
  }
}

function signalFromSeverity(count: number, highWatermark: number): DashboardSignal {
  if (count >= highWatermark) {
    return "risk";
  }

  if (count > 0) {
    return "attention";
  }

  return "healthy";
}

function buildSourceTrace(
  generatedAt: string,
  runtime: Awaited<ReturnType<OverlayService["getRuntimeStatus"]>>["data"],
  sourceKinds: string[],
): SourceTraceSummary {
  const notes = [
    `Gateway ${runtime.gateway.connectionState}`,
    `${runtime.nodes.connected}/${runtime.nodes.paired} nodes connected`,
    `${runtime.cron.overdue} cron overdue`,
  ];

  return {
    generatedAt,
    snapshotAt: runtime.snapshotAt,
    sourceMode: runtime.sourceMode,
    sourceKinds: sourceKinds.filter((value): value is SourceTraceSummary["sourceKinds"][number] => typeof value === "string"),
    readOnly: true,
    notes,
  };
}

function takeTopEvidence(evidence: Evidence[], count: number, subjectIds: string[] = []): EvidenceReference[] {
  const ranked = [...evidence].sort((left, right) => {
    const severityCompare = severityWeight(right.severity) - severityWeight(left.severity);
    if (severityCompare !== 0) {
      return severityCompare;
    }

    return (toTimestamp(right.observedAt) ?? 0) - (toTimestamp(left.observedAt) ?? 0);
  });

  if (subjectIds.length === 0) {
    return ranked.slice(0, count).map(buildEvidenceReference);
  }

  const preferred = ranked.filter((item) => subjectIds.includes(item.subjectId)).slice(0, count);
  const remainder = ranked.filter((item) => !subjectIds.includes(item.subjectId)).slice(0, Math.max(0, count - preferred.length));

  return [...preferred, ...remainder].map(buildEvidenceReference);
}

function buildUsageBuckets(sessions: Session[], now: number) {
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const baseDate = new Date(now - (6 - index) * DAY_MS);
    const key = baseDate.toISOString().slice(0, 10);
    return {
      key,
      label: baseDate.toLocaleDateString("en-US", { weekday: "short" }),
      sessions: 0,
      turns: 0,
      proxies: new Set<string>(),
    };
  });

  const bucketMap = new Map(last7Days.map((bucket) => [bucket.key, bucket]));

  for (const session of sessions) {
    const activityAt = sessionActivityAt(session);
    const timestamp = toTimestamp(activityAt);

    if (typeof timestamp !== "number" || now - timestamp > 7 * DAY_MS) {
      continue;
    }

    const key = new Date(timestamp).toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);

    if (!bucket) {
      continue;
    }

    bucket.sessions += 1;
    bucket.turns += session.messageCount ?? 0;
    bucket.proxies.add(session.workspaceId ?? session.agentId ?? session.bindingId ?? session.channel);
  }

  return last7Days;
}

function buildHourlyHeatmap(sessions: Session[], now: number) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    sessions: 0,
    turns: 0,
  }));

  for (const session of sessions) {
    const timestamp = toTimestamp(sessionActivityAt(session));

    if (typeof timestamp !== "number" || now - timestamp > DAY_MS) {
      continue;
    }

    const hour = new Date(timestamp).getHours();
    const bucket = buckets[hour];

    if (!bucket) {
      continue;
    }

    bucket.sessions += 1;
    bucket.turns += session.messageCount ?? 0;
  }

  return buckets;
}

function buildRecommendationPriorityItems(recommendations: Recommendation[]): RecommendationPriorityItem[] {
  return (["high", "medium", "low"] as const).map((priority) => {
    const count = recommendations.filter((recommendation) => recommendation.priority === priority).length;

    return {
      priority,
      count,
      summary:
        count > 0
          ? `${count} read-only checks are waiting at ${priority} priority.`
          : `No ${priority} priority checks are currently outstanding.`,
      detailLink: buildLink("View recommendations", `/recommendations`),
    };
  });
}

function buildFindingsBrief(findings: Finding[]): FindingsBriefItem[] {
  return [...findings]
    .sort((left, right) => {
      const severityCompare = severityWeight(right.severity) - severityWeight(left.severity);
      if (severityCompare !== 0) {
        return severityCompare;
      }

      return (toTimestamp(right.observedAt) ?? 0) - (toTimestamp(left.observedAt) ?? 0);
    })
    .slice(0, 5)
    .map((finding) => ({
      id: finding.id,
      summary: finding.summary,
      severity: finding.severity,
      ...(finding.targetName ? { targetName: finding.targetName } : {}),
      evidenceCount: finding.evidenceRefs.length,
      detailLink: buildLink("View related finding", `/findings/${encodeURIComponent(finding.id)}`),
    }));
}

function teamForWorkspace(workspace: Workspace): string {
  return safeLabel(workspace.ownerTeam, "Unassigned team");
}

export class DashboardService {
  constructor(
    private readonly overlayService: OverlayService,
    private readonly activityService: ActivityService,
  ) {}

  async getOverview(): Promise<DashboardOverviewResponse> {
    const context = await this.collectContext(6);
    const healthScore = this.computeHealthScore(context);
    const activeUsersProxy = this.computeActiveUsersProxy(context.sessions, context.now);
    const repeatUsageRatio = this.computeRepeatUsageRatio(context.sessions, context.now);
    const evidenceRefs = takeTopEvidence(context.evidence, 4, context.findings.flatMap((finding) => finding.evidenceRefs));

    const data: RoleOverviewSummary = {
      heroKpis: [
        {
          id: "stability",
          label: "Stability",
          value: `${healthScore}/100`,
          summary: `${context.runtime.data.nodes.stale} stale nodes, ${context.runtime.data.cron.overdue} overdue cron jobs, ${context.errors24h} log errors in the last 24 hours.`,
          signal: healthScore >= 85 ? "healthy" : healthScore >= 70 ? "attention" : "risk",
          trendLabel: `${context.runtime.data.gateway.connectionState} gateway`,
          detailLink: buildLink("View details", "/operations"),
          evidenceLink: buildLink("View evidence", "/evidence?kind=runtime-health"),
          relatedFindingsLink: buildLink("View related findings", "/findings?type=snapshot-freshness-degradation"),
          evidenceRefs,
        },
        {
          id: "adoption",
          label: "Adoption",
          value: activeUsersProxy,
          summary: `${context.sessionsToday} sessions today across ${context.activeWorkspacesToday} active workspaces.`,
          signal: activeUsersProxy >= 4 ? "healthy" : activeUsersProxy > 1 ? "attention" : "neutral",
          trendLabel: `${context.dayDeltaPercent >= 0 ? "+" : ""}${context.dayDeltaPercent}% vs yesterday`,
          detailLink: buildLink("View details", "/adoption"),
          evidenceLink: buildLink("View evidence", "/sessions"),
          relatedFindingsLink: buildLink("View related findings", "/activity"),
          evidenceRefs: takeTopEvidence(context.evidence, 3),
        },
        {
          id: "outcome",
          label: "Outcome",
          value: `${repeatUsageRatio}%`,
          summary: `${context.highIntensityWorkspaces} workspaces are showing repeat usage patterns this week.`,
          signal: repeatUsageRatio >= 55 ? "healthy" : repeatUsageRatio >= 30 ? "attention" : "neutral",
          trendLabel: `${context.multiDayActiveUsers} multi-day active proxies`,
          detailLink: buildLink("View details", "/outcomes"),
          evidenceLink: buildLink("View evidence", "/workspaces"),
          relatedFindingsLink: buildLink("View related findings", "/governance"),
          evidenceRefs: takeTopEvidence(context.evidence, 3),
        },
        {
          id: "risk",
          label: "Risk",
          value: context.risks.data.openFindings,
          summary: `${context.risks.data.bySeverity.critical} critical findings and ${context.configMismatchCount} configuration mismatches are still open.`,
          signal: signalFromSeverity(context.risks.data.openFindings, 4),
          trendLabel: `${context.recommendationsHighCount} high priority checks queued`,
          detailLink: buildLink("View details", "/governance"),
          evidenceLink: buildLink("View evidence", "/evidence"),
          relatedFindingsLink: buildLink("View related findings", "/findings"),
          evidenceRefs: takeTopEvidence(context.evidence, 4, context.findings.flatMap((finding) => finding.evidenceRefs)),
        },
      ],
      attentionItems: [
        {
          id: "stability-anomaly",
          title: "Stability anomaly",
          summary:
            context.errors24h > 0
              ? `${context.errors24h} log errors were observed in the last 24 hours, with the heaviest pressure coming from ${context.primaryHotspotLabel}.`
              : `No new log-error spikes were observed in the last 24 hours, but ${context.runtime.data.cron.overdue} cron jobs remain overdue.`,
          severity: context.errors24h > 0 ? "error" : context.runtime.data.cron.overdue > 0 ? "warn" : "info",
          trendLabel: `${context.runtime.data.nodes.stale} stale nodes`,
          detailLink: buildLink("View details", "/operations"),
          evidenceLink: buildLink("View evidence", "/logs?level=error"),
          relatedFindingsLink: buildLink("View related findings", "/findings"),
        },
        {
          id: "adoption-shift",
          title: "Usage growth / decline",
          summary:
            context.dayDeltaPercent >= 0
              ? `Sessions are up ${context.dayDeltaPercent}% day over day, led by ${context.topWorkspaceLabel}.`
              : `Sessions are down ${Math.abs(context.dayDeltaPercent)}% day over day and need a closer workspace-level readout.`,
          severity: context.dayDeltaPercent < -10 ? "warn" : "info",
          trendLabel: `${context.weekDeltaPercent >= 0 ? "+" : ""}${context.weekDeltaPercent}% vs last week`,
          detailLink: buildLink("View details", "/adoption"),
          evidenceLink: buildLink("View evidence", "/sessions"),
          relatedFindingsLink: buildLink("View related findings", "/activity"),
        },
        {
          id: "governance-drift",
          title: "Risk / configuration deviation",
          summary:
            context.configMismatchCount > 0
              ? `${context.configMismatchCount} configuration mismatches and ${context.authGapCount} auth coverage gaps are now affecting governance posture.`
              : `${context.risks.data.openFindings} findings remain open, but no new configuration drift was detected in this pass.`,
          severity: context.configMismatchCount > 0 || context.risks.data.bySeverity.critical > 0 ? "critical" : "warn",
          trendLabel: `${context.risks.data.coverageGaps} coverage gaps`,
          detailLink: buildLink("View details", "/governance"),
          evidenceLink: buildLink("View evidence", "/evidence"),
          relatedFindingsLink: buildLink("View related findings", "/findings"),
        },
      ],
      roleEntries: [
        {
          id: "operations",
          label: "Operations",
          audience: "Runtime response",
          value: `${healthScore}/100`,
          summary: `${context.runtime.data.nodes.stale} stale nodes, ${context.runtime.data.cron.overdue} overdue cron jobs, ${context.errors24h} log errors.`,
          trendLabel: `${context.primaryHotspotLabel} is the current hotspot`,
          signal: healthScore >= 85 ? "healthy" : "attention",
          detailLink: buildLink("View details", "/operations"),
          evidenceLink: buildLink("View evidence", "/logs"),
        },
        {
          id: "adoption",
          label: "Adoption",
          audience: "Usage growth",
          value: `${activeUsersProxy}`,
          summary: `${context.sessionsToday} sessions today and ${context.activeWorkspacesToday} active workspaces.`,
          trendLabel: `${context.dayDeltaPercent >= 0 ? "+" : ""}${context.dayDeltaPercent}% vs yesterday`,
          signal: activeUsersProxy >= 4 ? "healthy" : "attention",
          detailLink: buildLink("View details", "/adoption"),
          evidenceLink: buildLink("View evidence", "/sessions"),
        },
        {
          id: "outcomes",
          label: "Outcomes",
          audience: "Management roll-up",
          value: `${context.activeTeams}`,
          summary: `${context.activeTeams} teams are active, with ${context.repeatedUsageTeams} teams showing repeat usage.`,
          trendLabel: `${context.highIntensityWorkspaces} high-intensity workspaces`,
          signal: context.repeatedUsageTeams > 0 ? "healthy" : "attention",
          detailLink: buildLink("View details", "/outcomes"),
          evidenceLink: buildLink("View evidence", "/workspaces"),
        },
        {
          id: "governance",
          label: "Governance",
          audience: "Risk posture",
          value: `${context.risks.data.openFindings}`,
          summary: `${context.risks.data.bySeverity.critical} critical findings and ${context.recommendationsHighCount} high-priority checks need review.`,
          trendLabel: `${context.authGapCount} auth coverage gaps`,
          signal: context.risks.data.bySeverity.critical > 0 ? "risk" : "attention",
          detailLink: buildLink("View details", "/governance"),
          evidenceLink: buildLink("View evidence", "/evidence"),
        },
      ],
      recentActivity: context.activity.data.slice(0, 6),
      topRisks: context.risks.data.targetBreakdown.slice(0, 4).map((item) => ({
        targetId: item.targetId,
        targetName: item.targetName,
        openFindings: item.openFindings,
        highestScore: item.highestScore,
        ...(item.highestSeverity ? { highestSeverity: item.highestSeverity } : {}),
        to: `/targets/${encodeURIComponent(item.targetId)}`,
      })),
      targetSnapshot: [...context.targets]
        .sort((left, right) => right.riskScore - left.riskScore || right.warningCount - left.warningCount)
        .slice(0, 4)
        .map((target) => ({
          id: target.id,
          label: target.name,
          status: target.status,
          sourceKind: target.sourceKind,
          freshness: target.freshness,
          warningCount: target.warningCount,
          riskScore: target.riskScore,
          to: `/targets/${encodeURIComponent(target.id)}`,
        })),
      coverageHighlight: {
        complete: context.coverage.collections.filter((item) => item.coverage === "complete").length,
        partial: context.coverage.collections.filter((item) => item.coverage === "partial").length,
        unavailable: context.coverage.collections.filter((item) => item.coverage === "unavailable").length,
        warnings: context.coverage.collections.reduce((sum, item) => sum + item.warningCount, 0),
        detailLink: buildLink("View details", "/coverage"),
      },
      runtime: context.runtime.data,
      sourceTrace: buildSourceTrace(context.meta.generatedAt, context.runtime.data, context.meta.sourceKinds),
    };

    return createItemResponse(data, context.meta);
  }

  async getOperations(): Promise<DashboardOperationsResponse> {
    const context = await this.collectContext(10);
    const healthScore = this.computeHealthScore(context);
    const hotspots = this.buildHotspots(context);
    const configHealthItems = [
      context.configMismatchCount > 0 ? formatCountLabel(context.configMismatchCount, "config mismatch", "config mismatches") : null,
      context.authGapCount > 0 ? formatCountLabel(context.authGapCount, "auth gap", "auth gaps") : null,
      context.risks.data.coverageGaps > 0 ? formatCountLabel(context.risks.data.coverageGaps, "coverage gap", "coverage gaps") : null,
      context.risks.data.staleTargets > 0 ? formatCountLabel(context.risks.data.staleTargets, "stale target", "stale targets") : null,
    ].filter((item): item is string => Boolean(item));
    const summary =
      hotspots.length > 0
        ? `${context.primaryHotspotLabel} is carrying the highest operational pressure.`
        : "No concentrated operational hotspot was detected in this pass.";
    const configHealthSummary =
      configHealthItems.length > 0
        ? `${joinNaturalLabels(configHealthItems)} are the main operational hygiene issues.`
        : "No configuration mismatches, auth gaps, coverage gaps, or stale targets were detected in this pass.";
    const impactSummary =
      context.runtime.data.nodes.stale > 0
        ? `${formatCountLabel(context.runtime.data.nodes.stale, "stale node", "stale nodes")} are likely degrading cron execution and runtime freshness.`
        : context.runtime.data.cron.overdue > 0
          ? `${formatCountLabel(context.runtime.data.cron.overdue, "overdue cron job", "overdue cron jobs")} are the main remaining runtime drag.`
          : context.errors24h > 0
            ? `${formatCountLabel(context.errors24h, "log error", "log errors")} were observed in the last 24 hours, even though no stale nodes or overdue cron jobs were detected.`
            : "No stale nodes or overdue cron jobs were detected in this pass.";

    const data: OperationsDashboard = {
      healthScore,
      errors24h: context.errors24h,
      staleNodes: context.runtime.data.nodes.stale,
      overdueCron: context.runtime.data.cron.overdue,
      connectionState: context.runtime.data.gateway.connectionState,
      summary: `${summary} ${configHealthSummary}`,
      trendPoints: this.buildOperationsTrend(context),
      hotspots,
      configHealth: {
        mismatchCount: context.configMismatchCount,
        authCoverageGapCount: context.authGapCount,
        staleTargets: context.risks.data.staleTargets,
        coverageGapCount: context.risks.data.coverageGaps,
        summary: configHealthSummary,
        detailLinks: [
          buildLink("View details", "/coverage"),
          buildLink("View related findings", "/findings"),
          buildLink("View evidence", "/evidence"),
        ],
      },
      impactSummary,
      recentActivity: context.activity.data.slice(0, 8),
      quickLinks: [
        buildLink("View details", "/logs", "Inspect raw runtime signals"),
        buildLink("View details", "/nodes", "Review node connectivity"),
        buildLink("View details", "/cron", "Review overdue jobs"),
        buildLink("View related findings", "/findings", "Inspect linked findings"),
      ],
      sourceTrace: buildSourceTrace(context.meta.generatedAt, context.runtime.data, context.meta.sourceKinds),
      evidenceRefs: takeTopEvidence(context.evidence, 6),
    };

    return createItemResponse(data, context.meta);
  }

  async getAdoption(): Promise<DashboardAdoptionResponse> {
    const context = await this.collectContext(8);
    const usageBuckets = buildUsageBuckets(context.sessions, context.now);
    const activeUsersProxy = this.computeActiveUsersProxy(context.sessions, context.now);
    const avgDuration = round(average(context.sessions.map(sessionDurationMinutes)), 1);

    const topWorkspaceUsage = this.buildTopWorkspaceUsage(context);
    const topAgentUsage = this.buildTopAgentUsage(context);

    const data = {
      activeUsersProxy,
      sessionsToday: context.sessionsToday,
      turnsToday: context.turnsToday,
      avgSessionDurationMinutes: avgDuration,
      activeWorkspaces: context.activeWorkspacesToday,
      dayDeltaPercent: context.dayDeltaPercent,
      weekDeltaPercent: context.weekDeltaPercent,
      trendPoints: usageBuckets.map<UsageTrendPoint>((bucket) => ({
        label: bucket.label,
        sessions: bucket.sessions,
        turns: bucket.turns,
        activeUsersProxy: bucket.proxies.size,
      })),
      topWorkspaces: topWorkspaceUsage,
      topAgents: topAgentUsage,
      hourlyHeatmap: buildHourlyHeatmap(context.sessions, context.now),
      retention: {
        repeatUsageRatio: this.computeRepeatUsageRatio(context.sessions, context.now),
        multiDayActiveUsers: context.multiDayActiveUsers,
        summary: `${context.multiDayActiveUsers} proxy users were active on multiple days this week, while ${context.lowActivityTeams.join(", ") || "no teams"} are still low-activity.`,
        lowActivityTeams: context.lowActivityTeams,
      },
      quickLinks: [
        buildLink("View details", "/sessions", "Inspect session-level usage"),
        buildLink("View details", "/workspaces", "Review workspace adoption"),
        buildLink("View details", "/agents", "Review agent spread"),
        buildLink("View evidence", "/activity", "Cross-check with activity timeline"),
      ],
      sourceTrace: buildSourceTrace(context.meta.generatedAt, context.runtime.data, context.meta.sourceKinds),
      evidenceRefs: takeTopEvidence(context.evidence, 4),
    };

    return createItemResponse(data, context.meta);
  }

  async getOutcomes(): Promise<DashboardOutcomesResponse> {
    const context = await this.collectContext(8);
    const teamCoverage = this.buildTeamCoverage(context);
    const repeatUsageRatio = this.computeRepeatUsageRatio(context.sessions, context.now);

    const data: OutcomesDashboard = {
      activeTeams: context.activeTeams,
      repeatedUsageTeams: context.repeatedUsageTeams,
      highIntensityWorkspaces: context.highIntensityWorkspaces,
      biggestBlocker: context.biggestBlocker,
      executiveSummary: `${context.activeTeams} teams are active, but ${context.biggestBlocker.toLowerCase()} is still the largest blocker before wider rollout.`,
      teamCoverage,
      valueSignals: [
        {
          label: "Repeat usage ratio",
          value: `${repeatUsageRatio}%`,
          summary: `${context.repeatedUsageTeams} teams are already forming repeated usage habits.`,
          signal: repeatUsageRatio >= 55 ? "healthy" : repeatUsageRatio >= 30 ? "attention" : "neutral",
          detailLink: buildLink("View details", "/adoption"),
        },
        {
          label: "High-intensity workspaces",
          value: context.highIntensityWorkspaces,
          summary: `${context.highIntensityWorkspaces} workspaces show sustained session depth.`,
          signal: context.highIntensityWorkspaces > 0 ? "healthy" : "attention",
          detailLink: buildLink("View details", "/workspaces"),
        },
        {
          label: "Risk pressure on rollout",
          value: context.risks.data.openFindings,
          summary: `${context.risks.data.bySeverity.critical} critical findings are still affecting expansion confidence.`,
          signal: context.risks.data.bySeverity.critical > 0 ? "risk" : "attention",
          detailLink: buildLink("View details", "/governance"),
        },
      ],
      blockers: [
        context.biggestBlocker,
        `${context.authGapCount} auth coverage gaps remain visible in the latest snapshot.`,
        `${context.risks.data.coverageGaps} coverage gaps are reducing confidence in cross-team rollout visibility.`,
      ],
      recommendedFocus: buildLink("View details", "/governance", "Review the highest-friction blocker before broader promotion."),
      quickLinks: [
        buildLink("View details", "/outcomes"),
        buildLink("View details", "/adoption"),
        buildLink("View details", "/governance"),
      ],
      sourceTrace: buildSourceTrace(context.meta.generatedAt, context.runtime.data, context.meta.sourceKinds),
      evidenceRefs: takeTopEvidence(context.evidence, 4),
    };

    return createItemResponse(data, context.meta);
  }

  async getGovernance(): Promise<DashboardGovernanceResponse> {
    const context = await this.collectContext(8);

    const riskPosture: RiskPostureSummary = {
      openRisks: context.risks.data.openFindings,
      criticalFindings: context.risks.data.bySeverity.critical,
      configMismatchCount: context.configMismatchCount,
      authCoverageGapCount: context.authGapCount,
      summary: `${context.risks.data.openFindings} findings remain open, with ${context.configMismatchCount} configuration mismatches and ${context.authGapCount} auth gaps leading the posture.`,
      severityBreakdown: (["critical", "high", "medium", "low"] as const).map((severity) => ({
        severity,
        count: context.risks.data.bySeverity[severity],
      })),
      typeBreakdown: Object.entries(context.risks.data.byType)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count })),
    };

    const data: GovernanceDashboard = {
      riskPosture,
      complianceGaps: [
        {
          label: "Config mismatch",
          count: context.configMismatchCount,
          summary: "Configuration include anomalies and workspace drift currently dominate the compliance picture.",
          detailLink: buildLink("View related findings", "/findings?type=config-include-anomaly"),
        },
        {
          label: "Auth coverage gaps",
          count: context.authGapCount,
          summary: "Expired, disabled, or missing auth coverage is increasing operator review load.",
          detailLink: buildLink("View details", "/auth-profiles"),
        },
        {
          label: "Coverage gaps",
          count: context.risks.data.coverageGaps,
          summary: "Partial or unavailable collections are weakening governance confidence.",
          detailLink: buildLink("View details", "/coverage"),
        },
      ],
      findingsBrief: buildFindingsBrief(context.findings),
      recommendationPriorities: buildRecommendationPriorityItems(context.recommendations),
      evidenceLinks: [
        buildLink("View evidence", "/evidence"),
        buildLink("View related findings", "/findings"),
        buildLink("View details", "/recommendations"),
      ],
      sourceTrace: buildSourceTrace(context.meta.generatedAt, context.runtime.data, context.meta.sourceKinds),
      evidenceRefs: takeTopEvidence(context.evidence, 6, context.findings.flatMap((finding) => finding.evidenceRefs)),
    };

    return createItemResponse(data, context.meta);
  }

  private async collectContext(activityLimit: number) {
    const [
      summary,
      targets,
      coverage,
      runtime,
      risks,
      findings,
      recommendations,
      evidence,
      sessions,
      workspaces,
      agents,
      authProfiles,
      nodes,
      cron,
      logs,
      activity,
    ] = await Promise.all([
      this.overlayService.getSummary(),
      this.overlayService.getTargets(),
      this.overlayService.getCoverage(),
      this.overlayService.getRuntimeStatus(),
      this.overlayService.getRisksSummary(),
      this.overlayService.getFindings(),
      this.overlayService.getRecommendations(),
      this.overlayService.getEvidences(),
      this.overlayService.getSessions(),
      this.overlayService.getWorkspaces(),
      this.overlayService.getAgents(),
      this.overlayService.getAuthProfiles(),
      this.overlayService.getNodes(),
      this.overlayService.getCronJobs(),
      this.overlayService.getLogEntries({ limit: 200 }),
      this.activityService.getActivity({ limit: activityLimit }),
    ]);

    const now = Date.now();
    const sessionMetrics = this.computeSessionMetrics(sessions.data, now);
    const activeTeams = unique(
      workspaces.data
        .filter((workspace) => sessionMetrics.activeWorkspaceIds.has(workspace.id))
        .map(teamForWorkspace),
    );
    const repeatedUsageTeams = unique(
      workspaces.data
        .filter((workspace) => sessionMetrics.repeatWorkspaceIds.has(workspace.id))
        .map(teamForWorkspace),
    );
    const highIntensityWorkspaces = sessionMetrics.highIntensityWorkspaceIds.size;
    const authGapCount = authProfiles.data.filter((profile) => profile.status === "expired" || profile.status === "disabled").length;
    const configMismatchCount = findings.data.filter(
      (finding) => finding.type === "config-include-anomaly" || finding.type === "workspace-drift",
    ).length;
    const recommendationsHighCount = recommendations.data.filter((item) => item.priority === "high").length;
    const logEntries = logs.data.items;
    const errors24h = logEntries.filter((entry) => entry.level === "error" && isWithinDays(entry.ts, 1, now)).length;

    const hotspotCounts = new Map<string, { label: string; count: number }>();
    for (const entry of logEntries.filter((item) => item.level === "error" || item.level === "warn")) {
      const label = safeLabel(entry.subsystem, "runtime");
      const current = hotspotCounts.get(label) ?? { label, count: 0 };
      current.count += 1;
      hotspotCounts.set(label, current);
    }
    const primaryHotspotLabel = [...hotspotCounts.values()].sort((left, right) => right.count - left.count)[0]?.label ?? "runtime";

    const workspaceMap = new Map(workspaces.data.map((workspace) => [workspace.id, workspace]));
    const topWorkspaceLabel =
      this.buildTopWorkspaceUsage({
        sessions: sessions.data,
        workspaces: workspaces.data,
      })[0]?.workspaceName ?? "the current fleet";

    const biggestBlocker =
      configMismatchCount > 0
        ? "Configuration mismatch is slowing broader rollout"
        : authGapCount > 0
          ? "Auth coverage gaps are slowing broader rollout"
          : risks.data.bySeverity.critical > 0
            ? "Critical findings are still blocking confident expansion"
            : "Usage breadth still needs stronger multi-team repetition";

    const meta = buildApiMeta(summary.meta, {
      generatedAt: new Date().toISOString(),
      sourceKinds: unique([...(summary.meta.sourceKinds ?? []), ...(runtime.meta.sourceKinds ?? [])]),
      warningCount: Math.max(summary.meta.warningCount, coverage.meta.warningCount, risks.data.openFindings),
    });

    return {
      now,
      summary,
      targets: targets.data,
      coverage: coverage.data,
      runtime,
      risks,
      findings: findings.data,
      recommendations: recommendations.data,
      evidence: evidence.data,
      sessions: sessions.data,
      workspaces: workspaces.data,
      agents: agents.data,
      authProfiles: authProfiles.data,
      nodes: nodes.data,
      cron: cron.data,
      logs: logEntries,
      activity,
      meta,
      errors24h,
      sessionsToday: sessionMetrics.sessionsToday,
      turnsToday: sessionMetrics.turnsToday,
      activeWorkspacesToday: sessionMetrics.activeWorkspaceIds.size,
      dayDeltaPercent: sessionMetrics.dayDeltaPercent,
      weekDeltaPercent: sessionMetrics.weekDeltaPercent,
      multiDayActiveUsers: sessionMetrics.multiDayActiveUsers,
      lowActivityTeams: sessionMetrics.lowActivityTeams(workspaceMap),
      activeTeams: activeTeams.length,
      repeatedUsageTeams: repeatedUsageTeams.length,
      highIntensityWorkspaces,
      authGapCount,
      configMismatchCount,
      recommendationsHighCount,
      primaryHotspotLabel,
      topWorkspaceLabel,
      biggestBlocker,
    };
  }

  private computeSessionMetrics(sessions: Session[], now: number) {
    const usageBuckets = buildUsageBuckets(sessions, now);
    const todayBucket = usageBuckets.at(-1);
    const yesterdayBucket = usageBuckets.at(-2);
    const currentWindow = usageBuckets.slice(-7);
    const previousWindow = usageBuckets.slice(0, Math.max(usageBuckets.length - 7, 0));
    const workspaceFrequency = new Map<string, number>();
    const workspaceIntensity = new Map<string, number>();
    const proxyDayMap = new Map<string, Set<string>>();

    for (const session of sessions) {
      const workspaceId = session.workspaceId;
      const activityAt = sessionActivityAt(session);
      const timestamp = toTimestamp(activityAt);

      if (workspaceId && isWithinDays(activityAt, 7, now)) {
        workspaceFrequency.set(workspaceId, (workspaceFrequency.get(workspaceId) ?? 0) + 1);
        workspaceIntensity.set(workspaceId, (workspaceIntensity.get(workspaceId) ?? 0) + (session.messageCount ?? 0));
      }

      if (typeof timestamp === "number" && now - timestamp <= 7 * DAY_MS) {
        const proxy = session.workspaceId ?? session.agentId ?? session.bindingId ?? session.channel;
        const dayKey = new Date(timestamp).toISOString().slice(0, 10);
        const days = proxyDayMap.get(proxy) ?? new Set<string>();
        days.add(dayKey);
        proxyDayMap.set(proxy, days);
      }
    }

    const repeatWorkspaceIds = new Set(
      [...workspaceFrequency.entries()].filter(([, count]) => count >= 2).map(([workspaceId]) => workspaceId),
    );
    const highIntensityWorkspaceIds = new Set(
      [...workspaceIntensity.entries()].filter(([, turns]) => turns >= 12).map(([workspaceId]) => workspaceId),
    );
    const multiDayActiveUsers = [...proxyDayMap.values()].filter((days) => days.size >= 2).length;

    return {
      sessionsToday: todayBucket?.sessions ?? 0,
      turnsToday: todayBucket?.turns ?? 0,
      activeWorkspaceIds: new Set(
        sessions
          .filter((session) => isWithinDays(sessionActivityAt(session), 1, now) && Boolean(session.workspaceId))
          .map((session) => session.workspaceId)
          .filter((workspaceId): workspaceId is string => typeof workspaceId === "string"),
      ),
      dayDeltaPercent: percentageDelta(todayBucket?.sessions ?? 0, yesterdayBucket?.sessions ?? 0),
      weekDeltaPercent: percentageDelta(
        currentWindow.reduce((sum, bucket) => sum + bucket.sessions, 0),
        previousWindow.reduce((sum, bucket) => sum + bucket.sessions, 0),
      ),
      repeatWorkspaceIds,
      highIntensityWorkspaceIds,
      multiDayActiveUsers,
      lowActivityTeams: (workspaceMap: Map<string, Workspace>) =>
        unique(
          [...workspaceFrequency.entries()]
            .filter(([, count]) => count <= 1)
            .map(([workspaceId]) => teamForWorkspace(workspaceMap.get(workspaceId) ?? { id: workspaceId, name: workspaceId, status: "unknown" })),
        ).slice(0, 3),
    };
  }

  private computeHealthScore(context: Awaited<ReturnType<DashboardService["collectContext"]>>): number {
    let score = 100;

    score -= Math.min(24, context.errors24h * 6);
    score -= Math.min(20, context.runtime.data.nodes.stale * 10);
    score -= Math.min(16, context.runtime.data.cron.overdue * 8);
    score -= Math.min(18, context.risks.data.bySeverity.critical * 6);
    score -= Math.min(12, context.configMismatchCount * 4);

    if (context.runtime.data.gateway.connectionState !== "connected") {
      score -= 10;
    }

    return Math.max(18, score);
  }

  private computeActiveUsersProxy(sessions: Session[], now: number): number {
    return unique(
      sessions
        .filter((session) => isWithinDays(sessionActivityAt(session), 1, now))
        .map((session) => session.workspaceId ?? session.agentId ?? session.bindingId ?? session.channel),
    ).length;
  }

  private computeRepeatUsageRatio(sessions: Session[], now: number): number {
    const recentSessions = sessions.filter((session) => isWithinDays(sessionActivityAt(session), 7, now));
    const workspaceCounts = new Map<string, number>();

    for (const session of recentSessions) {
      const workspaceId = session.workspaceId ?? session.agentId ?? session.channel;
      workspaceCounts.set(workspaceId, (workspaceCounts.get(workspaceId) ?? 0) + 1);
    }

    const total = workspaceCounts.size;
    const repeating = [...workspaceCounts.values()].filter((count) => count >= 2).length;

    return total === 0 ? 0 : round((repeating / total) * 100, 1);
  }

  private buildOperationsTrend(context: Awaited<ReturnType<DashboardService["collectContext"]>>) {
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const end = context.now - (5 - index) * 4 * 60 * 60 * 1000;
      const start = end - 4 * 60 * 60 * 1000;
      const label = new Date(end).toLocaleTimeString("en-US", { hour: "numeric" });

      return {
        label,
        start,
        end,
        errors: 0,
        warnings: 0,
      };
    });

    for (const entry of context.logs) {
      const timestamp = toTimestamp(entry.ts);
      if (typeof timestamp !== "number") {
        continue;
      }

      const bucket = buckets.find((candidate) => timestamp > candidate.start && timestamp <= candidate.end);
      if (!bucket) {
        continue;
      }

      if (entry.level === "error") {
        bucket.errors += 1;
      }

      if (entry.level === "warn") {
        bucket.warnings += 1;
      }
    }

    return buckets.map(({ label, errors, warnings }) => ({
      label,
      errors,
      warnings,
      staleNodes: context.runtime.data.nodes.stale,
      overdueCron: context.runtime.data.cron.overdue,
    }));
  }

  private buildHotspots(context: Awaited<ReturnType<DashboardService["collectContext"]>>) {
    const hotspots = new Map<string, { id: string; label: string; type: "workspace" | "node" | "agent" | "error-type"; count: number; summary: string; detailLink: DashboardDrilldownLink }>();

    for (const workspace of context.workspaces) {
      const workspaceSessions = context.sessions.filter((session) => session.workspaceId === workspace.id);
      const turns = workspaceSessions.reduce((sum, session) => sum + (session.messageCount ?? 0), 0);

      if (workspaceSessions.length > 0) {
        hotspots.set(`workspace-${workspace.id}`, {
          id: `workspace-${workspace.id}`,
          label: workspace.name,
          type: "workspace",
          count: workspaceSessions.length,
          summary: `${workspaceSessions.length} sessions and ${turns} turns are clustering around this workspace.`,
          detailLink: buildLink("View details", "/workspaces"),
        });
      }
    }

    for (const node of context.nodes.filter((item) => !item.connected && item.paired)) {
      hotspots.set(`node-${node.id}`, {
        id: `node-${node.id}`,
        label: safeLabel(node.name, node.id),
        type: "node",
        count: 1,
        summary: "This node is paired but disconnected, so runtime coverage is likely stale.",
        detailLink: buildLink("View details", "/nodes"),
      });
    }

    for (const entry of context.logs.filter((item) => item.level === "error" || item.level === "warn")) {
      const label = safeLabel(entry.subsystem, "runtime");
      const key = `error-type-${label}`;
      const existing = hotspots.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        hotspots.set(key, {
          id: key,
          label,
          type: "error-type",
          count: 1,
          summary: "This subsystem is over-indexing on warnings and log errors in the latest snapshot.",
          detailLink: buildLink("View details", "/logs"),
        });
      }
    }

    return [...hotspots.values()].sort((left, right) => right.count - left.count).slice(0, 6);
  }

  private buildTopWorkspaceUsage(context: {
    sessions: Session[];
    workspaces: Workspace[];
  }): TopWorkspaceUsage[] {
    const sessionGroups = new Map<string, Session[]>();

    for (const session of context.sessions) {
      if (!session.workspaceId) {
        continue;
      }

      const group = sessionGroups.get(session.workspaceId) ?? [];
      group.push(session);
      sessionGroups.set(session.workspaceId, group);
    }

    return [...sessionGroups.entries()]
      .map(([workspaceId, sessions]) => {
        const workspace = context.workspaces.find((item) => item.id === workspaceId);
        const lastActivityAt = [...sessions]
          .map((session) => sessionActivityAt(session))
          .filter((value): value is string => typeof value === "string")
          .sort((left, right) => (toTimestamp(right) ?? 0) - (toTimestamp(left) ?? 0))[0];

        return {
          workspaceId,
          workspaceName: workspace?.name ?? workspaceId,
          sessions: sessions.length,
          turns: sessions.reduce((sum, session) => sum + (session.messageCount ?? 0), 0),
          avgSessionDurationMinutes: round(average(sessions.map(sessionDurationMinutes)), 1),
          ...(lastActivityAt ? { lastActivityAt } : {}),
          detailLink: buildLink("View details", "/workspaces"),
        };
      })
      .sort((left, right) => right.turns - left.turns || right.sessions - left.sessions)
      .slice(0, 5);
  }

  private buildTopAgentUsage(context: {
    sessions: Session[];
    agents: Array<{ id: string; name: string }>;
  }): TopAgentUsage[] {
    const sessionGroups = new Map<string, Session[]>();

    for (const session of context.sessions) {
      if (!session.agentId) {
        continue;
      }

      const group = sessionGroups.get(session.agentId) ?? [];
      group.push(session);
      sessionGroups.set(session.agentId, group);
    }

    return [...sessionGroups.entries()]
      .map(([agentId, sessions]) => {
        const agent = context.agents.find((item) => item.id === agentId);
        return {
          agentId,
          agentName: agent?.name ?? agentId,
          sessions: sessions.length,
          turns: sessions.reduce((sum, session) => sum + (session.messageCount ?? 0), 0),
          activeWorkspaces: unique(
            sessions.map((session) => session.workspaceId).filter((workspaceId): workspaceId is string => typeof workspaceId === "string"),
          ).length,
          detailLink: buildLink("View details", "/agents"),
        };
      })
      .sort((left, right) => right.turns - left.turns || right.sessions - left.sessions)
      .slice(0, 5);
  }

  private buildTeamCoverage(context: Awaited<ReturnType<DashboardService["collectContext"]>>): TeamCoverageSummary[] {
    const workspaceGroups = new Map<string, Workspace[]>();

    for (const workspace of context.workspaces) {
      const team = teamForWorkspace(workspace);
      const group = workspaceGroups.get(team) ?? [];
      group.push(workspace);
      workspaceGroups.set(team, group);
    }

    return [...workspaceGroups.entries()]
      .map(([team, workspaces]) => {
        const workspaceIds = workspaces.map((workspace) => workspace.id);
        const activeWorkspaces = workspaceIds.filter((workspaceId) =>
          context.sessions.some((session) => session.workspaceId === workspaceId && isWithinDays(sessionActivityAt(session), 7, context.now)),
        ).length;
        const repeatUsageWorkspaces = workspaceIds.filter((workspaceId) =>
          context.sessions.filter((session) => session.workspaceId === workspaceId).length >= 2,
        ).length;
        const riskCount = context.findings.filter(
          (finding) => finding.subjectType === "workspace" && workspaceIds.includes(finding.subjectId),
        ).length;
        const adoptionScore = Math.max(10, activeWorkspaces * 25 + repeatUsageWorkspaces * 15 - riskCount * 10);

        return {
          team,
          activeWorkspaces,
          repeatUsageWorkspaces,
          riskCount,
          adoptionScore,
          detailLink: buildLink("View details", "/workspaces"),
        };
      })
      .sort((left, right) => right.adoptionScore - left.adoptionScore)
      .slice(0, 5);
  }
}
