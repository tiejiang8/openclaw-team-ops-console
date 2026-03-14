export function resourcePathForSubject(targetId: string, subjectType: string, subjectId: string): string {
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

export function formatDetailEntries(details: Record<string, string | number | boolean | null>): string[] {
  return Object.entries(details).map(([key, value]) => `${key}: ${String(value)}`);
}
