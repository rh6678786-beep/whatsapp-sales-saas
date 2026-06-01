import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export function correlationId(req: Request, _res: Response, next: NextFunction): void {
  const id = (req.headers["x-correlation-id"] as string) || randomUUID();
  req.headers["x-correlation-id"] = id;
  (req as any).correlationId = id;
  next();
}

export function getCorrelationId(req: Request): string {
  return (req as any).correlationId || (req.headers["x-correlation-id"] as string) || "unknown";
}
