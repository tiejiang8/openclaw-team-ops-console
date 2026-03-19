import type {
  FleetMapDto,
  FleetMapNode,
  FleetMapEdge,
  Target,
  TargetSnapshotSummary,
  CronJobSummaryDto,
  Finding,
} from "@openclaw-team-ops/shared";
import { SidecarClient } from "../clients/sidecar-client.js";
import { buildGovernanceDataset } from "./governance-engine.js";

export class FleetMapService {
  constructor(private readonly sidecarClient: SidecarClient) {}

  async getFleetMap(): Promise<FleetMapDto> {
    const targetsResponse = await this.sidecarClient.getTargets();
    const targets = targetsResponse.data;

    const targetSummaries = (
      await Promise.all(
        targets.map(async (target) => {
          try {
            const response = await this.sidecarClient.getTargetSummary(target.id);
            return response?.data;
          } catch {
            return null;
          }
        }),
      )
    ).filter((summary): summary is TargetSnapshotSummary => Boolean(summary));

    const cronJobsResponse = await this.sidecarClient.getCronJobs();
    const cronJobs = cronJobsResponse.data;

    const governance = buildGovernanceDataset(targetSummaries);
    const findings = governance.findings;

    const nodes: FleetMapNode[] = [];
    const edges: FleetMapEdge[] = [];

    // 1. Add Target nodes
    for (const target of targets) {
      nodes.push({
        id: `target:${target.id}`,
        nodeType: "target",
        label: target.name,
        status: target.status,
        targetId: target.id,
      });
    }

    // 2. Add Entities from target summaries
    for (const summary of targetSummaries) {
      const targetId = summary.target.id;

      // Workspaces
      for (const workspace of summary.workspaces) {
        nodes.push({
          id: `workspace:${workspace.id}`,
          nodeType: "workspace",
          label: workspace.name,
          status: workspace.status,
          targetId,
        });
        edges.push({
          fromType: "target",
          fromId: `target:${targetId}`,
          toType: "workspace",
          toId: `workspace:${workspace.id}`,
          relation: "contains",
        });
      }

      // Agents
      for (const agent of summary.agents) {
        nodes.push({
          id: `agent:${agent.id}`,
          nodeType: "agent",
          label: agent.name,
          status: agent.status,
          targetId,
        });
        edges.push({
          fromType: "target",
          fromId: `target:${targetId}`,
          toType: "agent",
          toId: `agent:${agent.id}`,
          relation: "contains",
        });
      }

      // Sessions
      for (const session of summary.sessions) {
        nodes.push({
          id: `session:${session.id}`,
          nodeType: "session",
          label: session.channel,
          status: session.status,
          targetId,
        });
        if (session.agentId) {
          edges.push({
            fromType: "agent",
            fromId: `agent:${session.agentId}`,
            toType: "session",
            toId: `session:${session.id}`,
            relation: "has-session",
          });
        }
      }

      // Bindings
      for (const binding of summary.bindings) {
        nodes.push({
          id: `binding:${binding.id}`,
          nodeType: "binding",
          label: binding.source,
          status: binding.status,
          targetId,
        });
        if (binding.targetAgentId) {
          edges.push({
            fromType: "binding",
            fromId: `binding:${binding.id}`,
            toType: "agent",
            toId: `agent:${binding.targetAgentId}`,
            relation: "links-to",
          });
        }
      }

      // Auth Profiles
      for (const auth of summary.authProfiles) {
        nodes.push({
          id: `auth-profile:${auth.id}`,
          nodeType: "auth-profile",
          label: auth.name,
          status: auth.status,
          targetId,
        });
        edges.push({
          fromType: "target",
          fromId: `target:${targetId}`,
          toType: "auth-profile",
          toId: `auth-profile:${auth.id}`,
          relation: "contains",
        });
      }
    }

    // 3. Add Cron Jobs
    for (const cron of cronJobs) {
      nodes.push({
        id: `cron-job:${cron.id}`,
        nodeType: "cron-job",
        label: cron.name,
        status: cron.enabled ? "healthy" : "offline",
      });
      // Try to link cron to targets if possible (e.g. by name or metadata)
      // For now, if it references a targetId in metadata
      if (cron.sessionTarget) {
        // Find if targetId is in sessionTarget
        const target = targets.find(t => cron.sessionTarget?.includes(t.id));
        if (target) {
            edges.push({
                fromType: "target",
                fromId: `target:${target.id}`,
                toType: "cron-job",
                toId: `cron-job:${cron.id}`,
                relation: "scheduled-on",
            });
        }
      }
    }

    // 4. Add Findings
    for (const finding of findings) {
       // Only add findings that have subjectIds in our current node set
       const subjectNodeId = `${finding.subjectType}:${finding.subjectId}`;
       const exists = nodes.some(n => n.id === subjectNodeId);
       
       if (exists) {
          nodes.push({
             id: `finding:${finding.id}`,
             nodeType: "finding",
             label: finding.type,
             status: finding.status === "open" ? "degraded" : "healthy",
             severity: finding.severity,
          });
          edges.push({
             fromType: "finding",
             fromId: `finding:${finding.id}`,
             toType: finding.subjectType as any,
             toId: subjectNodeId,
             relation: "observes",
          });
          
          // Also tag the subject node with severity if it's the highest
          const subjectNode = nodes.find(n => n.id === subjectNodeId);
          if (subjectNode) {
              // Simple severity comparison would be better but let's just set it for now
              subjectNode.severity = finding.status === "open" ? finding.severity : undefined;
          }
       }
    }

    return {
      generatedAt: new Date().toISOString(),
      nodes,
      edges,
    };
  }
}
