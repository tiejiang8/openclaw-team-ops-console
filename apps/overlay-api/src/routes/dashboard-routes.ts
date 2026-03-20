import { Router } from "express";

import { DashboardService } from "../services/dashboard-service.js";

export function createDashboardRouter(dashboardService: DashboardService): Router {
  const router = Router();

  router.get("/overview", async (_request, response, next) => {
    try {
      response.json(await dashboardService.getOverview());
    } catch (error) {
      next(error);
    }
  });

  router.get("/operations", async (_request, response, next) => {
    try {
      response.json(await dashboardService.getOperations());
    } catch (error) {
      next(error);
    }
  });

  router.get("/adoption", async (_request, response, next) => {
    try {
      response.json(await dashboardService.getAdoption());
    } catch (error) {
      next(error);
    }
  });

  router.get("/outcomes", async (_request, response, next) => {
    try {
      response.json(await dashboardService.getOutcomes());
    } catch (error) {
      next(error);
    }
  });

  router.get("/governance", async (_request, response, next) => {
    try {
      response.json(await dashboardService.getGovernance());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
