import type { Request, Response } from "express";
import { ActivityService, type ActivityQuery } from "../services/activity-service.js";
import type { ActivityEventType, ActivityEventSeverity } from "@openclaw-team-ops/shared";

export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  async getActivity(req: Request, res: Response) {
    const query: ActivityQuery = {
      type: req.query.type as ActivityEventType || undefined,
      severity: req.query.severity as ActivityEventSeverity || undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const activity = await this.activityService.getActivity(query);
    res.json(activity);
  }
}
