export type RoleId = "overview" | "operations" | "adoption" | "outcomes" | "governance" | "evidence";

export interface RoleNavLink {
  to: string;
  labelKey: string;
  descriptionKey?: string;
}

export interface RoleNavItem {
  id: RoleId;
  to: string;
  labelKey: string;
  audienceKey: string;
  items: RoleNavLink[];
}

const roleNavigation: RoleNavItem[] = [
  {
    id: "overview",
    to: "/",
    labelKey: "nav.overview",
    audienceKey: "role.management",
    items: [
      { to: "/operations", labelKey: "nav.operations", descriptionKey: "role.ops" },
      { to: "/adoption", labelKey: "nav.adoption", descriptionKey: "role.adoption" },
      { to: "/outcomes", labelKey: "nav.outcomes", descriptionKey: "role.management" },
      { to: "/governance", labelKey: "nav.governance", descriptionKey: "role.governance" },
      { to: "/evidence", labelKey: "nav.evidence", descriptionKey: "role.engineering" },
    ],
  },
  {
    id: "operations",
    to: "/operations",
    labelKey: "nav.operations",
    audienceKey: "role.ops",
    items: [
      { to: "/operations", labelKey: "nav.operations", descriptionKey: "operations.description" },
      { to: "/nodes", labelKey: "nav.nodes", descriptionKey: "nodes.description" },
      { to: "/cron", labelKey: "nav.cron", descriptionKey: "cron.description" },
      { to: "/activity", labelKey: "nav.activity", descriptionKey: "activity.description" },
      { to: "/coverage", labelKey: "nav.coverage", descriptionKey: "coverage.description" },
      { to: "/logs", labelKey: "nav.logs", descriptionKey: "logs.description" },
    ],
  },
  {
    id: "adoption",
    to: "/adoption",
    labelKey: "nav.adoption",
    audienceKey: "role.adoption",
    items: [
      { to: "/adoption", labelKey: "nav.adoption", descriptionKey: "adoption.description" },
      { to: "/sessions", labelKey: "nav.sessions", descriptionKey: "sessions.description" },
      { to: "/agents", labelKey: "nav.agents", descriptionKey: "agents.description" },
      { to: "/workspaces", labelKey: "nav.workspaces", descriptionKey: "workspaces.description" },
      { to: "/fleet-map", labelKey: "nav.fleetMap", descriptionKey: "fleet-map.description" },
    ],
  },
  {
    id: "outcomes",
    to: "/outcomes",
    labelKey: "nav.outcomes",
    audienceKey: "role.management",
    items: [
      { to: "/outcomes", labelKey: "nav.outcomes", descriptionKey: "outcomes.description" },
      { to: "/", labelKey: "nav.overview", descriptionKey: "overview.description" },
      { to: "/fleet-map", labelKey: "nav.fleetMap", descriptionKey: "fleet-map.description" },
      { to: "/workspaces", labelKey: "nav.workspaces", descriptionKey: "workspaces.description" },
      { to: "/sessions", labelKey: "nav.sessions", descriptionKey: "sessions.description" },
    ],
  },
  {
    id: "governance",
    to: "/governance",
    labelKey: "nav.governance",
    audienceKey: "role.governance",
    items: [
      { to: "/governance", labelKey: "nav.governance", descriptionKey: "governance.description" },
      { to: "/risks", labelKey: "nav.risks", descriptionKey: "risks.description" },
      { to: "/findings", labelKey: "nav.findings", descriptionKey: "findings.description" },
      { to: "/recommendations", labelKey: "nav.recommendations", descriptionKey: "recommendations.description" },
      { to: "/auth-profiles", labelKey: "nav.authProfiles", descriptionKey: "authProfiles.description" },
      { to: "/bindings", labelKey: "nav.bindings", descriptionKey: "bindings.description" },
    ],
  },
  {
    id: "evidence",
    to: "/evidence",
    labelKey: "nav.evidence",
    audienceKey: "role.engineering",
    items: [
      { to: "/evidence", labelKey: "nav.evidence", descriptionKey: "evidence.description" },
      { to: "/logs", labelKey: "nav.logs", descriptionKey: "logs.description" },
      { to: "/topology", labelKey: "nav.topology", descriptionKey: "topology.description" },
      { to: "/targets", labelKey: "nav.targets", descriptionKey: "targets.description" },
    ],
  },
];

export function isRoleNavPathActive(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

export function getRoleNavigation() {
  return roleNavigation;
}

export function getRoleNavigationItem(roleId: RoleId) {
  return roleNavigation.find((role) => role.id === roleId);
}

export function getStoredRoleId() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const stored = window.localStorage.getItem("openclaw-role-lens");

  return stored && roleNavigation.some((role) => role.id === stored) ? (stored as RoleId) : undefined;
}

export function persistRoleId(roleId: RoleId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("openclaw-role-lens", roleId);
}

export function resolveRoleId(pathname: string, preferredRoleId?: RoleId) {
  if (pathname === "/") {
    return "overview";
  }

  const directRole = roleNavigation.find((role) => role.to !== "/" && isRoleNavPathActive(pathname, role.to));
  if (directRole) {
    return directRole.id;
  }

  const matchingRoles = roleNavigation.filter((role) => role.items.some((item) => isRoleNavPathActive(pathname, item.to)));

  if (matchingRoles.length === 0) {
    return "overview";
  }

  if (preferredRoleId && matchingRoles.some((role) => role.id === preferredRoleId)) {
    return preferredRoleId;
  }

  return matchingRoles[0]?.id ?? "overview";
}
