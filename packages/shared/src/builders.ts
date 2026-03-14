import type {
  Agent,
  AuthProfile,
  BindingRoute,
  InventorySummary,
  RuntimeStatus,
  Session,
  TopologyEdge,
  TopologyNode,
  TopologyView,
  Workspace,
} from "./domain.js";

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
      workspaceId: agent.workspaceId,
    })),
    ...sessions.map((session) => ({
      id: session.id,
      nodeType: "session" as const,
      label: session.id,
      status: session.status,
      workspaceId: session.workspaceId,
    })),
    ...bindings.map((binding) => ({
      id: binding.id,
      nodeType: "binding" as const,
      label: binding.id,
      status: binding.status,
      workspaceId: binding.workspaceId,
    })),
    ...authProfiles.map((authProfile) => ({
      id: authProfile.id,
      nodeType: "auth-profile" as const,
      label: authProfile.name,
      status: authProfile.status,
    })),
  ];

  const edges: TopologyEdge[] = [];

  for (const agent of agents) {
    edges.push({
      fromType: "workspace",
      fromId: agent.workspaceId,
      toType: "agent",
      toId: agent.id,
      relation: "contains-agent",
    });

    edges.push({
      fromType: "auth-profile",
      fromId: agent.authProfileId,
      toType: "agent",
      toId: agent.id,
      relation: "authenticates-agent",
    });
  }

  for (const session of sessions) {
    edges.push({
      fromType: "workspace",
      fromId: session.workspaceId,
      toType: "session",
      toId: session.id,
      relation: "contains-session",
    });

    edges.push({
      fromType: "agent",
      fromId: session.agentId,
      toType: "session",
      toId: session.id,
      relation: "owns-session",
    });

    edges.push({
      fromType: "binding",
      fromId: session.bindingId,
      toType: "session",
      toId: session.id,
      relation: "feeds-session",
    });
  }

  for (const binding of bindings) {
    edges.push({
      fromType: "workspace",
      fromId: binding.workspaceId,
      toType: "binding",
      toId: binding.id,
      relation: "contains-binding",
    });

    edges.push({
      fromType: "binding",
      fromId: binding.id,
      toType: "agent",
      toId: binding.targetAgentId,
      relation: "targets-agent",
    });
  }

  for (const authProfile of authProfiles) {
    for (const workspaceId of authProfile.workspaceIds) {
      edges.push({
        fromType: "auth-profile",
        fromId: authProfile.id,
        toType: "workspace",
        toId: workspaceId,
        relation: "scoped-to-workspace",
      });
    }
  }

  return {
    generatedAt,
    nodes,
    edges,
  };
}

export function createResponseMeta(generatedAt: string, source: "mock" | "openclaw" | "mixed") {
  return {
    generatedAt,
    source,
    readOnly: true as const,
  };
}
