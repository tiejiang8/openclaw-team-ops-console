import type { Request, Response } from "express";
import { StreamingService } from "../services/streaming-service.js";
import { randomUUID } from "node:crypto";

export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  handleStream = (req: Request, res: Response) => {
    const clientId = randomUUID();

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // For NGINX
    });

    this.streamingService.addClient(clientId, res);

    // Handle client disconnect
    req.on("close", () => {
      this.streamingService.removeClient(clientId);
    });
  };
}
