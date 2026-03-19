import type { Response } from "express";
import type { StreamingEventDto, StreamingEventType } from "@openclaw-team-ops/shared";
import { SidecarClient } from "../clients/sidecar-client.js";
import { ActivityService } from "./activity-service.js";

interface SSEClient {
  id: string;
  res: Response;
}

export class StreamingService {
  private clients: SSEClient[] = [];
  private lastStates: Record<string, string> = {};
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly sidecarClient: SidecarClient,
    private readonly activityService: ActivityService
  ) {}

  addClient(id: string, res: Response) {
    this.clients.push({ id, res });
    
    // Send initial heartbeat
    this.sendEventToClient(res, {
      type: "heartbeat",
      timestamp: new Date().toISOString(),
      data: { connected: true }
    });

    if (!this.interval) {
      this.startPolling();
    }
  }

  removeClient(id: string) {
    this.clients = this.clients.filter(c => c.id !== id);
    if (this.clients.length === 0 && this.interval) {
      this.stopPolling();
    }
  }

  private startPolling() {
    // Initial state capture
    this.checkForUpdates();
    
    this.interval = setInterval(() => {
      this.checkForUpdates();
    }, 5000); // Poll sidecar every 5 seconds
  }

  private stopPolling() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async checkForUpdates() {
    try {
      const [bootstrap, cron, nodes, activity] = await Promise.all([
        this.sidecarClient.getBootstrapStatus().catch(() => null),
        this.sidecarClient.getCronJobs().catch(() => null),
        this.sidecarClient.getNodes().catch(() => null),
        this.activityService.getActivity({ limit: 10 }).catch(() => null)
      ]);

      if (bootstrap) this.diffAndBroadcast("bootstrap_status", bootstrap);
      if (cron) this.diffAndBroadcast("cron_job", cron.data);
      if (nodes) this.diffAndBroadcast("node_status", nodes.data);
      if (activity) this.diffAndBroadcast("activity", activity.data);

    } catch (error) {
      console.error("Error in streaming poll:", error);
    }
  }

  private diffAndBroadcast(type: StreamingEventType, data: any) {
    const serialized = JSON.stringify(data);
    if (this.lastStates[type] !== serialized) {
      this.lastStates[type] = serialized;
      this.broadcast({
        type,
        timestamp: new Date().toISOString(),
        data
      });
    }
  }

  private broadcast(event: StreamingEventDto) {
    this.clients.forEach(client => {
      this.sendEventToClient(client.res, event);
    });
  }

  private sendEventToClient(res: Response, event: StreamingEventDto) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
