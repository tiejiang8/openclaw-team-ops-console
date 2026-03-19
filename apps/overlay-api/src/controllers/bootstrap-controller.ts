import type { Request, Response } from "express";
import type { BootstrapService } from "../services/bootstrap-service.js";

export class BootstrapController {
  constructor(private readonly service: BootstrapService) {}

  async getStatus(_req: Request, res: Response) {
    try {
      const status = await this.service.getStatus();
      res.json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      res.status(502).json({
        error: {
          code: "UPSTREAM_ERROR",
          message,
        },
      });
    }
  }
}
