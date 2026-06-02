import { Request, Response, NextFunction } from "express";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("http");

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const correlationId = req.headers["x-correlation-id"] as string || "";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    log[level](
      {
        method: req.method,
        url: req.originalUrl?.split("?")[0], // Strip query params
        statusCode: res.statusCode,
        durationMs: duration,
        contentLength: res.getHeader("content-length") || 0,
        correlationId,
      },
      `${req.method} ${req.originalUrl?.split("?")[0]} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}
