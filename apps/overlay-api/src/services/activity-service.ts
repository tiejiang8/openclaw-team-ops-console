import type {
  ActivityEventDto,
  ActivityResponse,
  ActivityEventType,
  ActivityEventSeverity,
  CronJobSummaryDto,
  NodeSummaryDto,
  Session,
  LogEntry,
} from "@openclaw-team-ops/shared";
import { SidecarClient } from "../clients/sidecar-client.js";
import { buildApiMeta } from "./api-meta.js";

export interface ActivityQuery {
  type?: ActivityEventType;
  severity?: ActivityEventSeverity;
  limit?: number;
}

export class ActivityService {
  constructor(private readonly sidecarClient: SidecarClient) {}

  async getActivity(query: ActivityQuery = {}): Promise<ActivityResponse> {
    const limit = query.limit ?? 50;

    // Aggregate data from multiple sources
    const [cronJobs, nodes, sessions, logs] = await Promise.all([
      this.sidecarClient.getCronJobs().catch(() => ({ data: [] })),
      this.sidecarClient.getNodes().catch(() => ({ data: [] })),
      this.sidecarClient.getSessions().catch(() => ({ data: [] })),
      this.sidecarClient.getLogEntries({ limit: 100 }).catch(() => ({ data: { items: [] } })),
    ]);

    const events: ActivityEventDto[] = [];

    // 1. Cron Events
    (cronJobs.data as CronJobSummaryDto[]).forEach((job) => {
      if (job.lastRunState === "error") {
        events.push({
          id: `cron-fail-${job.id}-${job.lastRunAt}`,
          timestamp: job.lastRunAt || new Date().toISOString(),
          type: "cron",
          severity: "error",
          message: `Cron job "${job.name}" failed on last run`,
          subjectId: job.id,
          subjectType: "cron-job",
        });
      }
      if (job.overdue) {
        events.push({
          id: `cron-overdue-${job.id}`,
          timestamp: new Date().toISOString(), // Current status
          type: "cron",
          severity: "warn",
          message: `Cron job "${job.name}" is overdue`,
          subjectId: job.id,
          subjectType: "cron-job",
        });
      }
    });

    // 2. Node Events
    (nodes.data as NodeSummaryDto[]).forEach((node) => {
      if (!node.connected && node.paired) {
        events.push({
          id: `node-offline-${node.id}`,
          timestamp: new Date().toISOString(),
          type: "node",
          severity: "warn",
          message: `Node "${node.name || node.id}" is disconnected`,
          subjectId: node.id,
          subjectType: "node",
        });
      }
    });

    // 3. Session Events (Recent)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    (sessions.data as Session[]).forEach((session) => {
      const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : 0;
      if (startedAt > twentyFourHoursAgo) {
        events.push({
          id: `session-start-${session.id}`,
          timestamp: session.startedAt!,
          type: "session",
          severity: "info",
          message: `New session started on channel "${session.channel}"`,
          subjectId: session.id,
          subjectType: "session",
        });
      }
    });

    // 4. Log Events (Errors/Warnings)
    (logs.data.items as LogEntry[]).forEach((log) => {
      if (log.level === "error" || log.level === "warn") {
        events.push({
          id: `log-${log.id}`,
          timestamp: log.ts || new Date().toISOString(),
          type: "log",
          severity: log.level === "error" ? "error" : "warn",
          message: log.message,
          subjectId: log.refs?.sessionId || log.refs?.jobId,
          subjectType: log.refs?.sessionId ? "session" : log.refs?.jobId ? "cron-job" : "system",
          details: {
            subsystem: log.subsystem || "unknown",
          },
        });
      }
    });

    // Filter by type and severity if requested
    let filteredEvents = events.filter((e) => {
      if (query.type && e.type !== query.type) return false;
      if (query.severity && e.severity !== query.severity) return false;
      return true;
    });

    // Sort by timestamp descending
    filteredEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    const finalEvents = filteredEvents.slice(0, limit);

    return {
      data: finalEvents,
      meta: {
        generatedAt: new Date().toISOString(),
        total: filteredEvents.length,
        filters: {
          type: query.type,
          severity: query.severity,
        },
      },
    };
  }
}
