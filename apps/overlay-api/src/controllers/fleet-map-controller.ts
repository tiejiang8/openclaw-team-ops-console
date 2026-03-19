import type { Request, Response } from "express";
import { createResponseMeta } from "@openclaw-team-ops/shared";
import { FleetMapService } from "../services/fleet-map-service.js";

export class FleetMapController {
  constructor(private readonly fleetMapService: FleetMapService) {}

  async getFleetMap(req: Request, res: Response) {
    const data = await this.fleetMapService.getFleetMap();
    res.json({
      data,
      meta: createResponseMeta(new Date().toISOString(), "mixed"),
    });
  }
}
