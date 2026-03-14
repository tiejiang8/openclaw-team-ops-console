import { createHash } from "node:crypto";

import type {
  BindingRoute,
  CollectionFreshness,
  CollectionMetadata,
  CollectionName,
  Evidence,
  EvidenceKind,
  EvidenceSource,
  EvidenceSubjectType,
  Finding,
  FindingSeverity,
  Recommendation,
  RecommendationPriority,
  RecommendationType,
  RisksSummary,
  RuntimeStatus,
  Session,
  SnapshotWarning,
  Target,
  TargetSnapshotSummary,
  Workspace,
} from "@openclaw-team-ops/shared";

interface GovernanceDataset {
  evidences: Evidence[];
  findings: Finding[];
  recommendations: Recommendation[];
  risksSummary: RisksSummary;
}

function stableId(prefix: string, parts: Array<string | number | undefined>): string {
  const seed = parts.map((part) => String(part ?? "")).join("|");
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 10);
  return `${prefix}-${hash}`;
}

function targetSourceToEvidenceSource(target: Target): EvidenceSource {
  return target.sourceKind === "filesystem" ? "filesystem" : target.sourceKind === "mock" ? "mock" : "overlay-api";
}

function severityRank(severity: FindingSeverity): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function scoreForSeverity(severity: FindingSeverity): number {
  switch (severity) {
    case "critical":
      return 90;
    case "high":
      return 70;
    case "medium":
      return 50;
    default:
      return 20;
  }
}

function findingPriority(severity: FindingSeverity): RecommendationPriority {
  switch (severity) {
    case "critical":
    case "high":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

function entityPathHint(target: Target, subjectType: EvidenceSubjectType, subjectId: string): string | undefined {
  switch (subjectType) {
    case "target":
      return target.connection.runtimeRoot ?? target.connection.configFile;
    case "workspace":
      return target.connection.workspaceGlob ?? target.connection.runtimeRoot;
    case "binding":
      return target.connection.configFile;
    case "session":
    case "agent":
    case "auth-profile":
      return target.connection.runtimeRoot;
    case "collection":
      return target.connection.runtimeRoot ?? target.connection.configFile;
    default:
      return subjectId;
  }
}

function resourceLinkForSubject(targetId: string, subjectType: EvidenceSubjectType, subjectId: string): string {
  switch (subjectType) {
    case "target":
      return `/targets/${encodeURIComponent(targetId)}`;
    case "workspace":
      return `/workspaces?q=${encodeURIComponent(subjectId)}`;
    case "agent":
      return `/agents?q=${encodeURIComponent(subjectId)}`;
    case "session":
      return `/sessions?q=${encodeURIComponent(subjectId)}`;
    case "binding":
      return `/bindings?q=${encodeURIComponent(subjectId)}`;
    case "auth-profile":
      return `/auth-profiles?q=${encodeURIComponent(subjectId)}`;
    default:
      return `/targets/${encodeURIComponent(targetId)}`;
  }
}

function inferWarningKind(warning: SnapshotWarning): EvidenceKind {
  if (warning.code.includes("CONFIG")) {
    return warning.code.includes("INCLUDE") ? "config-include" : "config-parse";
  }

  if (warning.code.includes("INCLUDE")) {
    return "config-include";
  }

  if (warning.code.includes("PARSE")) {
    return "config-parse";
  }

  if (warning.code.includes("MISSING")) {
    return "file-missing";
  }

  if (warning.collection === "sessions") {
    return "session-store";
  }

  if (warning.collection === "bindings") {
    return "binding-parse";
  }

  if (warning.collection === "authProfiles") {
    return "auth-profile-scan";
  }

  if (warning.collection === "workspaces") {
    return "workspace-scan";
  }

  if (warning.collection === "runtimeStatuses") {
    return "runtime-health";
  }

  return "coverage-gap";
}

function collectionLabel(collection: CollectionName): string {
  switch (collection) {
    case "authProfiles":
      return "Auth Profiles";
    case "runtimeStatuses":
      return "Runtime Status";
    default:
      return collection.charAt(0).toUpperCase() + collection.slice(1);
  }
}

function addEvidence(store: Map<string, Evidence>, evidence: Evidence) {
  if (!store.has(evidence.id)) {
    store.set(evidence.id, evidence);
  }
}

function buildWarningEvidence(store: Map<string, Evidence>, targetSummary: TargetSnapshotSummary) {
  const { target, warnings, collections, summary } = targetSummary;

  for (const warning of warnings) {
    const observedAt = target.lastCollectedAt ?? summary.generatedAt;
    const collection = warning.collection;
    const freshness = collection ? collections[collection].freshness : target.freshness;
    const subjectType: EvidenceSubjectType = collection ? "collection" : "target";
    const subjectId = collection ? `${target.id}:${collection}` : target.id;
    const subjectLabel = collection ? collectionLabel(collection) : target.name;
    const pathHint = collection
      ? entityPathHint(
          target,
          collection === "workspaces"
            ? "workspace"
            : collection === "bindings"
              ? "binding"
              : collection === "sessions"
                ? "session"
                : collection === "authProfiles"
                  ? "auth-profile"
                  : "target",
          subjectId,
        )
      : entityPathHint(target, "target", target.id);

    addEvidence(store, {
      id: stableId("ev", [target.id, warning.code, warning.collection, warning.message]),
      targetId: target.id,
      targetName: target.name,
      kind: inferWarningKind(warning),
      source: targetSourceToEvidenceSource(target),
      subjectType,
      subjectId,
      subjectLabel,
      severity: warning.severity,
      message: warning.message,
      details: {
        code: warning.code,
        collection: warning.collection ?? null,
        sourceId: warning.sourceId ?? null,
      },
      observedAt,
      freshness,
      ...(pathHint ? { pathRefs: [pathHint] } : {}),
      ...(collection ? { fieldRefs: [collection] } : {}),
    });
  }
}

function buildCollectionEvidence(store: Map<string, Evidence>, targetSummary: TargetSnapshotSummary) {
  const { target, collections } = targetSummary;

  for (const collection of Object.values(collections)) {
    if (collection.status !== "complete") {
      addEvidence(store, {
        id: stableId("ev", [target.id, "coverage-gap", collection.collection, collection.status]),
        targetId: target.id,
        targetName: target.name,
        kind: "coverage-gap",
        source: "overlay-api",
        subjectType: "collection",
        subjectId: `${target.id}:${collection.collection}`,
        subjectLabel: collectionLabel(collection.collection),
        severity: collection.status === "unavailable" ? "error" : "warn",
        message:
          collection.status === "unavailable"
            ? `${collectionLabel(collection.collection)} collection is unavailable for this target.`
            : `${collectionLabel(collection.collection)} collection is partial for this target.`,
        details: {
          collection: collection.collection,
          status: collection.status,
          recordCount: collection.recordCount ?? 0,
        },
        observedAt: collection.collectedAt ?? targetSummary.summary.generatedAt,
        freshness: collection.freshness,
        ...(entityPathHint(target, "collection", collection.collection)
          ? { pathRefs: [entityPathHint(target, "collection", collection.collection)!] }
          : {}),
        fieldRefs: [collection.collection],
      });
    }

    if (collection.freshness !== "fresh") {
      addEvidence(store, {
        id: stableId("ev", [target.id, "snapshot-freshness", collection.collection, collection.freshness]),
        targetId: target.id,
        targetName: target.name,
        kind: "snapshot-freshness",
        source: "overlay-api",
        subjectType: "collection",
        subjectId: `${target.id}:${collection.collection}:freshness`,
        subjectLabel: `${collectionLabel(collection.collection)} freshness`,
        severity: collection.freshness === "stale" ? "error" : "warn",
        message: `${collectionLabel(collection.collection)} freshness is ${collection.freshness}.`,
        details: {
          collection: collection.collection,
          freshness: collection.freshness,
          status: collection.status,
        },
        observedAt: collection.collectedAt ?? targetSummary.summary.generatedAt,
        freshness: collection.freshness,
        fieldRefs: [collection.collection, "freshness"],
      });
    }
  }

  if (target.freshness !== "fresh") {
    addEvidence(store, {
      id: stableId("ev", [target.id, "snapshot-freshness", "target", target.freshness]),
      targetId: target.id,
      targetName: target.name,
      kind: "snapshot-freshness",
      source: "overlay-api",
      subjectType: "target",
      subjectId: target.id,
      subjectLabel: target.name,
      severity: target.freshness === "stale" ? "error" : "warn",
      message: `Target freshness is ${target.freshness}.`,
      details: {
        freshness: target.freshness,
        status: target.status,
      },
      observedAt: target.lastCollectedAt ?? targetSummary.summary.generatedAt,
      freshness: target.freshness,
      ...(entityPathHint(target, "target", target.id) ? { pathRefs: [entityPathHint(target, "target", target.id)!] } : {}),
    });
  }
}

function buildRuntimeEvidence(store: Map<string, Evidence>, targetSummary: TargetSnapshotSummary) {
  const { target, runtimeStatuses } = targetSummary;

  for (const runtimeStatus of runtimeStatuses) {
    if (runtimeStatus.status === "healthy") {
      continue;
    }

    addEvidence(store, {
      id: stableId("ev", [target.id, "runtime-health", runtimeStatus.componentId, runtimeStatus.status]),
      targetId: target.id,
      targetName: target.name,
      kind: "runtime-health",
      source: "overlay-api",
      subjectType: "target",
      subjectId: target.id,
      subjectLabel: runtimeStatus.componentId,
      severity: runtimeStatus.status === "offline" ? "error" : "warn",
      message: `Runtime component ${runtimeStatus.componentId} is ${runtimeStatus.status}.`,
      details: {
        componentId: runtimeStatus.componentId,
        componentType: runtimeStatus.componentType,
        status: runtimeStatus.status,
      },
      observedAt: runtimeStatus.observedAt,
      freshness: target.freshness,
      ...(entityPathHint(target, "target", target.id) ? { pathRefs: [entityPathHint(target, "target", target.id)!] } : {}),
      fieldRefs: ["runtimeStatuses", runtimeStatus.componentId],
    });
  }
}

function buildSessionEvidence(store: Map<string, Evidence>, targetSummary: TargetSnapshotSummary) {
  const { target, sessions, agents, workspaces, summary } = targetSummary;
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));

  for (const session of sessions) {
    const issues: Array<{ issue: string; severity: SnapshotWarning["severity"] }> = [];

    if (!session.agentId) {
      issues.push({ issue: "missing-agent", severity: "error" });
    } else if (!agentsById.has(session.agentId)) {
      issues.push({ issue: "unknown-agent", severity: "error" });
    }

    if (!session.workspaceId) {
      issues.push({ issue: "missing-workspace", severity: "error" });
    } else if (!workspaceIds.has(session.workspaceId)) {
      issues.push({ issue: "unknown-workspace", severity: "error" });
    }

    if (session.agentId && session.workspaceId) {
      const agent = agentsById.get(session.agentId);
      if (agent?.workspaceId && agent.workspaceId !== session.workspaceId) {
        issues.push({ issue: "workspace-mismatch", severity: "warn" });
      }
    }

    for (const issue of issues) {
      addEvidence(store, {
        id: stableId("ev", [target.id, "session-store", session.id, issue.issue]),
        targetId: target.id,
        targetName: target.name,
        kind: "session-store",
        source: "derived-rule",
        subjectType: "session",
        subjectId: session.id,
        subjectLabel: session.id,
        severity: issue.severity,
        message: `Session ${session.id} has a ${issue.issue.replace(/-/g, " ")} condition.`,
        details: {
          issue: issue.issue,
          agentId: session.agentId ?? null,
          workspaceId: session.workspaceId ?? null,
          bindingId: session.bindingId ?? null,
        },
        observedAt: session.lastActivityAt ?? session.startedAt ?? target.lastCollectedAt ?? summary.generatedAt,
        freshness: target.freshness,
        ...(entityPathHint(target, "session", session.id) ? { pathRefs: [entityPathHint(target, "session", session.id)!] } : {}),
        fieldRefs: ["sessions", session.id],
      });
    }
  }
}

function buildBindingEvidence(store: Map<string, Evidence>, targetSummary: TargetSnapshotSummary) {
  const { target, bindings, agents, workspaces, summary } = targetSummary;
  const agentIds = new Set(agents.map((agent) => agent.id));
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));

  for (const binding of bindings) {
    const issues: Array<{ issue: string; severity: SnapshotWarning["severity"] }> = [];

    if (!binding.targetAgentId) {
      issues.push({ issue: "missing-target-agent", severity: "error" });
    } else if (!agentIds.has(binding.targetAgentId)) {
      issues.push({ issue: "unknown-target-agent", severity: "error" });
    }

    if (binding.workspaceId && !workspaceIds.has(binding.workspaceId)) {
      issues.push({ issue: "unknown-workspace", severity: "warn" });
    }

    for (const issue of issues) {
      addEvidence(store, {
        id: stableId("ev", [target.id, "binding-parse", binding.id, issue.issue]),
        targetId: target.id,
        targetName: target.name,
        kind: "binding-parse",
        source: "derived-rule",
        subjectType: "binding",
        subjectId: binding.id,
        subjectLabel: binding.id,
        severity: issue.severity,
        message: `Binding ${binding.id} has a ${issue.issue.replace(/-/g, " ")} condition.`,
        details: {
          issue: issue.issue,
          targetAgentId: binding.targetAgentId ?? null,
          workspaceId: binding.workspaceId ?? null,
          routeType: binding.routeType,
        },
        observedAt: binding.updatedAt ?? binding.createdAt ?? target.lastCollectedAt ?? summary.generatedAt,
        freshness: target.freshness,
        ...(entityPathHint(target, "binding", binding.id) ? { pathRefs: [entityPathHint(target, "binding", binding.id)!] } : {}),
        fieldRefs: ["bindings", binding.id],
      });
    }
  }
}

function buildWorkspaceEvidence(store: Map<string, Evidence>, targetSummary: TargetSnapshotSummary) {
  const { target, workspaces, summary } = targetSummary;

  for (const workspace of workspaces) {
    const documentCount = workspace.coreMarkdownFiles?.length ?? 0;
    const isDrifted = workspace.status !== "healthy" || documentCount < 5;

    if (!isDrifted) {
      continue;
    }

    addEvidence(store, {
      id: stableId("ev", [target.id, "workspace-scan", workspace.id, workspace.status, documentCount]),
      targetId: target.id,
      targetName: target.name,
      kind: "workspace-scan",
      source: "derived-rule",
      subjectType: "workspace",
      subjectId: workspace.id,
      subjectLabel: workspace.name,
      severity: workspace.status === "offline" ? "error" : "warn",
      message:
        workspace.status === "offline"
          ? `Workspace ${workspace.name} is missing or offline.`
          : `Workspace ${workspace.name} is showing structural drift or incomplete bootstrap coverage.`,
      details: {
        status: workspace.status,
        coreMarkdownFileCount: documentCount,
        environment: workspace.environment ?? null,
      },
      observedAt: workspace.updatedAt ?? target.lastCollectedAt ?? summary.generatedAt,
      freshness: target.freshness,
      ...(entityPathHint(target, "workspace", workspace.id) ? { pathRefs: [entityPathHint(target, "workspace", workspace.id)!] } : {}),
      fieldRefs: ["workspaces", workspace.id],
    });
  }
}

function evidenceRefsForSubject(
  evidences: Evidence[],
  targetId: string,
  subjectType: EvidenceSubjectType,
  subjectId: string,
  kinds?: Evidence["kind"][],
): string[] {
  return evidences
    .filter(
      (evidence) =>
        evidence.targetId === targetId &&
        evidence.subjectType === subjectType &&
        evidence.subjectId === subjectId &&
        (!kinds || kinds.includes(evidence.kind)),
    )
    .map((evidence) => evidence.id);
}

function buildFinding(
  target: Target,
  type: Finding["type"],
  severity: FindingSeverity,
  summary: string,
  subjectType: EvidenceSubjectType,
  subjectId: string,
  subjectLabel: string | undefined,
  evidenceRefs: string[],
  observedAt: string,
): Finding {
  return {
    id: stableId("finding", [target.id, type, subjectId, summary]),
    type,
    severity,
    status: "open",
    summary,
    targetId: target.id,
    targetName: target.name,
    subjectType,
    subjectId,
    ...(subjectLabel ? { subjectLabel } : {}),
    evidenceRefs,
    recommendationIds: [],
    observedAt,
    score: scoreForSeverity(severity),
  };
}

function buildFindings(evidences: Evidence[], targetSummaries: TargetSnapshotSummary[]): Finding[] {
  const findings: Finding[] = [];

  for (const targetSummary of targetSummaries) {
    const { target, sessions, bindings, workspaces, collections, summary } = targetSummary;
    const agentsById = new Map(targetSummary.agents.map((agent) => [agent.id, agent]));
    const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));

    for (const session of sessions) {
      const issues: string[] = [];

      if (!session.agentId || !agentsById.has(session.agentId)) {
        issues.push("agent");
      }

      if (!session.workspaceId || !workspaceIds.has(session.workspaceId)) {
        issues.push("workspace");
      }

      if (session.agentId && session.workspaceId) {
        const agent = agentsById.get(session.agentId);
        if (agent?.workspaceId && agent.workspaceId !== session.workspaceId) {
          issues.push("workspace-mismatch");
        }
      }

      if (issues.length > 0) {
        findings.push(
          buildFinding(
            target,
            "orphan-session",
            issues.includes("agent") && issues.includes("workspace") ? "critical" : "high",
            `Session ${session.id} is orphaned from its expected owning resources.`,
            "session",
            session.id,
            session.id,
            evidenceRefsForSubject(evidences, target.id, "session", session.id, ["session-store"]),
            session.lastActivityAt ?? session.startedAt ?? target.lastCollectedAt ?? summary.generatedAt,
          ),
        );
      }
    }

    for (const binding of bindings) {
      const hasMissingTarget = !binding.targetAgentId || !agentsById.has(binding.targetAgentId);
      const hasUnknownWorkspace = Boolean(binding.workspaceId) && !workspaceIds.has(binding.workspaceId!);

      if (hasMissingTarget || hasUnknownWorkspace) {
        findings.push(
          buildFinding(
            target,
            "dangling-binding",
            hasMissingTarget ? "high" : "medium",
            `Binding ${binding.id} points at resources that are missing or unresolved.`,
            "binding",
            binding.id,
            binding.id,
            evidenceRefsForSubject(evidences, target.id, "binding", binding.id, ["binding-parse"]),
            binding.updatedAt ?? binding.createdAt ?? target.lastCollectedAt ?? summary.generatedAt,
          ),
        );
      }
    }

    const configEvidenceRefs = evidences
      .filter(
        (evidence) =>
          evidence.targetId === target.id &&
          evidence.subjectType === "collection" &&
          (evidence.kind === "config-parse" || evidence.kind === "config-include"),
      )
      .map((evidence) => evidence.id);

    if (configEvidenceRefs.length > 0) {
      findings.push(
        buildFinding(
          target,
          "config-include-anomaly",
          "high",
          `Config parsing or include resolution is degraded for target ${target.name}.`,
          "target",
          target.id,
          target.name,
          configEvidenceRefs,
          target.lastCollectedAt ?? summary.generatedAt,
        ),
      );
    }

    for (const workspace of workspaces) {
      const evidenceRefs = evidenceRefsForSubject(evidences, target.id, "workspace", workspace.id, ["workspace-scan"]);

      if (evidenceRefs.length > 0) {
        findings.push(
          buildFinding(
            target,
            "workspace-drift",
            workspace.status === "offline" ? "high" : "medium",
            `Workspace ${workspace.name} is drifting from the expected bootstrap structure.`,
            "workspace",
            workspace.id,
            workspace.name,
            evidenceRefs,
            workspace.updatedAt ?? target.lastCollectedAt ?? summary.generatedAt,
          ),
        );
      }
    }

    const freshnessEvidenceRefs = evidences
      .filter((evidence) => evidence.targetId === target.id && evidence.kind === "snapshot-freshness")
      .map((evidence) => evidence.id);

    if (freshnessEvidenceRefs.length > 0 || target.freshness !== "fresh" || Object.values(collections).some((collection) => collection.freshness !== "fresh")) {
      findings.push(
        buildFinding(
          target,
          "snapshot-freshness-degradation",
          target.freshness === "stale" ? "high" : "medium",
          `Snapshot freshness has degraded for target ${target.name}.`,
          "target",
          target.id,
          target.name,
          freshnessEvidenceRefs,
          target.lastCollectedAt ?? summary.generatedAt,
        ),
      );
    }
  }

  return findings.map((finding) => ({
    ...finding,
    recommendationIds: [
      stableId("rec", [finding.id, "primary"]),
      stableId("rec", [finding.id, "secondary"]),
    ],
  }));
}

function recommendationForFinding(finding: Finding, target: Target): Recommendation[] {
  const basePathHint = entityPathHint(target, finding.subjectType, finding.subjectId);
  const priority = findingPriority(finding.severity);
  const resourceLink = resourceLinkForSubject(finding.targetId, finding.subjectType, finding.subjectId);

  switch (finding.type) {
    case "orphan-session":
      return [
        {
          id: stableId("rec", [finding.id, "primary"]),
          findingId: finding.id,
          type: "inspect-file",
          title: "Inspect session ownership fields",
          body: "Check whether the session record still points to a valid agent and workspace in the current runtime snapshot.",
          priority,
          requiresHuman: true,
          commandTemplate: "jq '.' <session-store-path>",
          ...(basePathHint ? { pathHint: basePathHint } : {}),
          docLink: resourceLink,
          safetyLevel: "safe-read-only",
        },
        {
          id: stableId("rec", [finding.id, "secondary"]),
          findingId: finding.id,
          type: "collect-fresh-snapshot",
          title: "Collect a fresh snapshot",
          body: "Re-check the runtime snapshot to confirm this orphaned session is not caused by stale or partial source data.",
          priority: "medium",
          requiresHuman: true,
          docLink: "/targets",
          safetyLevel: "requires-human-review",
        },
      ];
    case "dangling-binding":
      return [
        {
          id: stableId("rec", [finding.id, "primary"]),
          findingId: finding.id,
          type: "compare-config",
          title: "Review binding target references",
          body: "Compare the binding definition against the discovered agent inventory to confirm whether the configured target still exists.",
          priority,
          requiresHuman: true,
          commandTemplate: "cat <openclaw-config-file>",
          ...(target.connection.configFile ? { pathHint: target.connection.configFile } : basePathHint ? { pathHint: basePathHint } : {}),
          docLink: resourceLink,
          safetyLevel: "safe-read-only",
        },
        {
          id: stableId("rec", [finding.id, "secondary"]),
          findingId: finding.id,
          type: "verify-workspace",
          title: "Validate workspace linkage",
          body: "Confirm the binding still belongs to a discovered workspace and that the route target is intentional.",
          priority: "medium",
          requiresHuman: true,
          docLink: "/bindings",
          safetyLevel: "requires-human-review",
        },
      ];
    case "config-include-anomaly":
      return [
        {
          id: stableId("rec", [finding.id, "primary"]),
          findingId: finding.id,
          type: "inspect-file",
          title: "Inspect config include paths",
          body: "Verify that referenced config include files still exist and parse cleanly with the current runtime root.",
          priority,
          requiresHuman: true,
          commandTemplate: "cat <openclaw-config-file>",
          ...(target.connection.configFile ? { pathHint: target.connection.configFile } : {}),
          docLink: "docs/local-path-integration.md",
          safetyLevel: "safe-read-only",
        },
        {
          id: stableId("rec", [finding.id, "secondary"]),
          findingId: finding.id,
          type: "compare-config",
          title: "Compare included config fragments",
          body: "Compare included config fragments with the merged runtime shape to spot missing agents or bindings before taking any manual action.",
          priority: "medium",
          requiresHuman: true,
          commandTemplate: "jq '.' <openclaw-config-file>",
          docLink: "docs/external-data-sources.md",
          safetyLevel: "requires-human-review",
        },
      ];
    case "workspace-drift":
      return [
        {
          id: stableId("rec", [finding.id, "primary"]),
          findingId: finding.id,
          type: "inspect-directory",
          title: "Review workspace bootstrap files",
          body: "Check whether the workspace still contains the expected markdown bootstrap files and optional directories for this environment.",
          priority,
          requiresHuman: true,
          commandTemplate: "ls -la <workspace-path>",
          ...(basePathHint ? { pathHint: basePathHint } : {}),
          docLink: resourceLink,
          safetyLevel: "safe-read-only",
        },
        {
          id: stableId("rec", [finding.id, "secondary"]),
          findingId: finding.id,
          type: "verify-workspace",
          title: "Compare workspace structure",
          body: "Compare this workspace against a known-good peer in the same environment to confirm whether the drift is intentional.",
          priority: "medium",
          requiresHuman: true,
          docLink: "/workspaces",
          safetyLevel: "requires-human-review",
        },
      ];
    case "snapshot-freshness-degradation":
      return [
        {
          id: stableId("rec", [finding.id, "primary"]),
          findingId: finding.id,
          type: "collect-fresh-snapshot",
          title: "Re-collect the target snapshot",
          body: "Refresh the target snapshot and compare collection freshness before relying on this inventory for operations decisions.",
          priority,
          requiresHuman: true,
          docLink: `/targets/${encodeURIComponent(finding.targetId)}`,
          safetyLevel: "requires-human-review",
        },
        {
          id: stableId("rec", [finding.id, "secondary"]),
          findingId: finding.id,
          type: "run-cli",
          title: "Inspect upstream runtime availability",
          body: "Use approved read-only runtime checks to confirm that the underlying data source is reachable and current.",
          priority: "medium",
          requiresHuman: true,
          commandTemplate: "curl -s <gateway-health-url>",
          ...(target.connection.gatewayUrl ? { pathHint: target.connection.gatewayUrl } : {}),
          docLink: "docs/real-adapter-plan.md",
          safetyLevel: "safe-read-only",
        },
      ];
  }
}

function buildRecommendations(findings: Finding[], targets: Target[]): Recommendation[] {
  const targetById = new Map(targets.map((target) => [target.id, target]));
  return findings.flatMap((finding) => {
    const target = targetById.get(finding.targetId);
    if (!target) {
      return [];
    }

    return recommendationForFinding(finding, target);
  });
}

function buildRisksSummary(findings: Finding[], targets: Target[]): RisksSummary {
  const bySeverity: RisksSummary["bySeverity"] = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const byType: Record<string, number> = {};

  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
    byType[finding.type] = (byType[finding.type] ?? 0) + 1;
  }

  const targetBreakdown = targets
    .map((target) => {
      const targetFindings = findings.filter((finding) => finding.targetId === target.id);
      const highestFinding = targetFindings.reduce<Finding | undefined>(
        (current, finding) =>
          !current || severityRank(finding.severity) > severityRank(current.severity) ? finding : current,
        undefined,
      );

      return {
        targetId: target.id,
        targetName: target.name,
        openFindings: targetFindings.length,
        highestScore: Math.max(target.riskScore, ...targetFindings.map((finding) => finding.score), 0),
        ...(highestFinding ? { highestSeverity: highestFinding.severity } : {}),
      };
    })
    .sort((left, right) => right.highestScore - left.highestScore || right.openFindings - left.openFindings);

  return {
    generatedAt: new Date().toISOString(),
    openFindings: findings.length,
    bySeverity,
    byType,
    staleTargets: targets.filter((target) => target.freshness === "stale").length,
    coverageGaps: findings.filter(
      (finding) => finding.type === "config-include-anomaly" || finding.type === "workspace-drift",
    ).length,
    highestRiskScore: Math.max(...targets.map((target) => target.riskScore), ...findings.map((finding) => finding.score), 0),
    targetBreakdown,
  };
}

export function buildGovernanceDataset(targetSummaries: TargetSnapshotSummary[]): GovernanceDataset {
  const evidenceStore = new Map<string, Evidence>();

  for (const targetSummary of targetSummaries) {
    buildWarningEvidence(evidenceStore, targetSummary);
    buildCollectionEvidence(evidenceStore, targetSummary);
    buildRuntimeEvidence(evidenceStore, targetSummary);
    buildSessionEvidence(evidenceStore, targetSummary);
    buildBindingEvidence(evidenceStore, targetSummary);
    buildWorkspaceEvidence(evidenceStore, targetSummary);
  }

  const evidences = Array.from(evidenceStore.values()).sort(
    (left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt) || left.id.localeCompare(right.id),
  );
  const findings = buildFindings(evidences, targetSummaries).sort(
    (left, right) =>
      severityRank(right.severity) - severityRank(left.severity) ||
      right.score - left.score ||
      Date.parse(right.observedAt) - Date.parse(left.observedAt),
  );
  const recommendations = buildRecommendations(findings, targetSummaries.map((targetSummary) => targetSummary.target));
  const risksSummary = buildRisksSummary(findings, targetSummaries.map((targetSummary) => targetSummary.target));

  return {
    evidences,
    findings,
    recommendations,
    risksSummary,
  };
}
