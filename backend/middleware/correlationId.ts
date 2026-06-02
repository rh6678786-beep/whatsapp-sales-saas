import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Regex to validate correlation ID format (alphanumeric + hyphens/underscores/dots, max 64 chars)
const VALID_CORRELATION_ID = /^[a-zA-Z0-9\-_.]{1,64}$/;

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  // Only accept valid correlation IDs from upstream; reject malicious ones
  const incomingId = req.headers["x-correlation-id"] as string | undefined;
  const isValidIncoming = incomingId && VALID_CORRELATION_ID.test(incomingId);

  const id = isValidIncoming ? incomingId! : crypto.randomUUID();

  req.headers["x-correlation-id"] = id;
  res.setHeader("x-correlation-id", id);

  next();
}
