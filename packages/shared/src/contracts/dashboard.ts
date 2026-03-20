import type { ActivityEventDto } from "./activity.js";
import type { RuntimeStatusDto } from "./runtime-plane.js";
import type { FindingSeverity, SnapshotWarningSeverity } from "../domain.js";
import type { SourceKind } from "../observability.js";

export type DashboardSignal = "healthy" | "attention" | "risk" | "neutral";

export interface DashboardDrilldownLink {
  label: string;
  to: string;
  description?: string;
  badge?: string;
}

export interface EvidenceReference {
  id: string;
  label: string;
  to: string;
  severity: SnapshotWarningSeverity;
  kind: string;
  subjectLabel?: string;
  observedAt: string;
}

export interface SourceTraceSummary {
  generatedAt: string;
  snapshotAt?: string;
  sourceMode: RuntimeStatusDto["sourceMode"];
  sourceKinds: SourceKind[];
  readOnly: true;
  notes: string[];
}

export interface ExecutiveKpiGroup {
  id: string;
  label: string;
  value: string | number;
  summary: string;
  signal: DashboardSignal;
  trendLabel?: string;
  detailLink: DashboardDrilldownLink;
  evidenceLink?: DashboardDrilldownLink;
  relatedFindingsLink?: DashboardDrilldownLink;
  evidenceRefs: EvidenceReference[];
}

export interface AttentionItem {
  id: string;
  title: string;
  summary: string;
  severity: ActivityEventDto["severity"];
  trendLabel?: string;
  detailLink: DashboardDrilldownLink;
  evidenceLink?: DashboardDrilldownLink;
  relatedFindingsLink?: DashboardDrilldownLink;
}

export interface RoleEntrySummary {
  id: string;
  label: string;
  audience: string;
  value: string;
  summary: string;
  trendLabel?: string;
  signal: DashboardSignal;
  detailLink: DashboardDrilldownLink;
  evidenceLink?: DashboardDrilldownLink;
}

export interface RiskTargetSummary {
  targetId: string;
  targetName: string;
  openFindings: number;
  highestScore: number;
  highestSeverity?: FindingSeverity;
  to: string;
}

export interface TargetSnapshotCard {
  id: string;
  label: string;
  status: string;
  sourceKind: string;
  freshness: string;
  warningCount: number;
  riskScore: number;
  to: string;
}

export interface CoverageHighlight {
  complete: number;
  partial: number;
  unavailable: number;
  warnings: number;
  detailLink: DashboardDrilldownLink;
}

export interface RoleOverviewSummary {
  heroKpis: ExecutiveKpiGroup[];
  attentionItems: AttentionItem[];
  roleEntries: RoleEntrySummary[];
  recentActivity: ActivityEventDto[];
  topRisks: RiskTargetSummary[];
  targetSnapshot: TargetSnapshotCard[];
  coverageHighlight: CoverageHighlight;
  runtime: RuntimeStatusDto;
  sourceTrace: SourceTraceSummary;
}

export interface OpsTrendPoint {
  label: string;
  errors: number;
  warnings: number;
  staleNodes: number;
  overdueCron: number;
}

export interface OpsIncidentHotspot {
  id: string;
  label: string;
  type: "workspace" | "node" | "agent" | "error-type";
  count: number;
  summary: string;
  detailLink: DashboardDrilldownLink;
}

export interface ConfigHealthSummary {
  mismatchCount: number;
  authCoverageGapCount: number;
  staleTargets: number;
  coverageGapCount: number;
  summary: string;
  detailLinks: DashboardDrilldownLink[];
}

export interface OperationsDashboard {
  healthScore: number;
  errors24h: number;
  staleNodes: number;
  overdueCron: number;
  connectionState: RuntimeStatusDto["gateway"]["connectionState"];
  summary: string;
  trendPoints: OpsTrendPoint[];
  hotspots: OpsIncidentHotspot[];
  configHealth: ConfigHealthSummary;
  impactSummary: string;
  recentActivity: ActivityEventDto[];
  quickLinks: DashboardDrilldownLink[];
  sourceTrace: SourceTraceSummary;
  evidenceRefs: EvidenceReference[];
}

export interface UsageTrendPoint {
  label: string;
  sessions: number;
  turns: number;
  activeUsersProxy: number;
}

export interface TopWorkspaceUsage {
  workspaceId: string;
  workspaceName: string;
  sessions: number;
  turns: number;
  avgSessionDurationMinutes: number;
  lastActivityAt?: string;
  detailLink: DashboardDrilldownLink;
}

export interface TopAgentUsage {
  agentId: string;
  agentName: string;
  sessions: number;
  turns: number;
  activeWorkspaces: number;
  detailLink: DashboardDrilldownLink;
}

export interface RetentionProxySummary {
  repeatUsageRatio: number;
  multiDayActiveUsers: number;
  summary: string;
  lowActivityTeams: string[];
}

export interface HourlyUsageBucket {
  hour: number;
  sessions: number;
  turns: number;
}

export interface AdoptionDashboard {
  activeUsersProxy: number;
  sessionsToday: number;
  turnsToday: number;
  avgSessionDurationMinutes: number;
  activeWorkspaces: number;
  dayDeltaPercent: number;
  weekDeltaPercent: number;
  trendPoints: UsageTrendPoint[];
  topWorkspaces: TopWorkspaceUsage[];
  topAgents: TopAgentUsage[];
  hourlyHeatmap: HourlyUsageBucket[];
  retention: RetentionProxySummary;
  quickLinks: DashboardDrilldownLink[];
  sourceTrace: SourceTraceSummary;
  evidenceRefs: EvidenceReference[];
}

export interface TeamCoverageSummary {
  team: string;
  activeWorkspaces: number;
  repeatUsageWorkspaces: number;
  riskCount: number;
  adoptionScore: number;
  detailLink: DashboardDrilldownLink;
}

export interface ValueSignalSummary {
  label: string;
  value: string | number;
  summary: string;
  signal: DashboardSignal;
  detailLink: DashboardDrilldownLink;
}

export interface OutcomesDashboard {
  activeTeams: number;
  repeatedUsageTeams: number;
  highIntensityWorkspaces: number;
  biggestBlocker: string;
  executiveSummary: string;
  teamCoverage: TeamCoverageSummary[];
  valueSignals: ValueSignalSummary[];
  blockers: string[];
  recommendedFocus: DashboardDrilldownLink;
  quickLinks: DashboardDrilldownLink[];
  sourceTrace: SourceTraceSummary;
  evidenceRefs: EvidenceReference[];
}

export interface RiskPostureSummary {
  openRisks: number;
  criticalFindings: number;
  configMismatchCount: number;
  authCoverageGapCount: number;
  summary: string;
  severityBreakdown: Array<{ severity: FindingSeverity; count: number }>;
  typeBreakdown: Array<{ type: string; count: number }>;
}

export interface ComplianceGapSummary {
  label: string;
  count: number;
  summary: string;
  detailLink: DashboardDrilldownLink;
}

export interface FindingsBriefItem {
  id: string;
  summary: string;
  severity: FindingSeverity;
  targetName?: string;
  evidenceCount: number;
  detailLink: DashboardDrilldownLink;
}

export interface RecommendationPriorityItem {
  priority: "high" | "medium" | "low";
  count: number;
  summary: string;
  detailLink: DashboardDrilldownLink;
}

export interface GovernanceDashboard {
  riskPosture: RiskPostureSummary;
  complianceGaps: ComplianceGapSummary[];
  findingsBrief: FindingsBriefItem[];
  recommendationPriorities: RecommendationPriorityItem[];
  evidenceLinks: DashboardDrilldownLink[];
  sourceTrace: SourceTraceSummary;
  evidenceRefs: EvidenceReference[];
}
