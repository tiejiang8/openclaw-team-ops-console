import type { NextFunction, Request, Response } from "express";

import type { OverlayService } from "../services/overlay-service.js";

export function getNodesController(service: OverlayService) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json(
        await service.getNodeSummaries({
          ...(typeof request.query.q === "string" ? { q: request.query.q } : {}),
          ...(typeof request.query.status === "string" ? { status: request.query.status } : {}),
        }),
      );
    } catch (error) {
      next(error);
    }
  };
}
