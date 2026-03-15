import type { NextFunction, Request, Response } from "express";

import type { OverlayService } from "../services/overlay-service.js";

export function getRuntimeStatusController(service: OverlayService) {
  return async (_request: Request, response: Response, next: NextFunction) => {
    try {
      response.json(await service.getRuntimeStatus());
    } catch (error) {
      next(error);
    }
  };
}
