import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";
import { getRedis, isRedisConnected } from "../lib/redis.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("audit");

const AUDIT_QUEUE_KEY = "audit_log_queue";
const SENSITIVE_PATHS = ["/api/auth", "/api/settings", "/api/payment/config"];

// Audit levels
type AuditLevel = "info" | "warning" | "critical";

interface AuditEntry {
  adminId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  ip: string;
  userAgent: string;
  level: AuditLevel;
  timestamp: string;
}

export function auditLog(
  action: string,
  resource: string,
  level: AuditLevel = "info",
  details?: Record<string, unknown>
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    const adminId = req.adminId || "anonymous";

    res.json = function (body: any) {
      // Only audit after response is sent
      const duration = Date.now() - start;

      // Sanitize sensitive paths — don't log full body
      const sanitizedDetails: Record<string, unknown> = {
        ...details,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
      };

      if (!SENSITIVE_PATHS.some((p) => req.path.startsWith(p))) {
        // Only log response body for non-sensitive endpoints
        if (body && typeof body === "object" && !Array.isArray(body)) {
          const safe = { ...body };
          delete safe.password;
          delete safe.token;
          delete safe.otp;
          delete safe.secret;
          delete safe.apiKey;
          delete safe.smtpPass;
          delete safe.merchantPassword;
          sanitizedDetails.responsePreview = safe;
        }
      }

      // Enqueue audit entry
      const entry: AuditEntry = {
        adminId,
        action,
        resource,
        details: sanitizedDetails,
        ip: req.ip || req.socket.remoteAddress || "unknown",
        userAgent: (req.headers["user-agent"] || "unknown") as string,
        level,
        timestamp: new Date().toISOString(),
      };

      if (isRedisConnected()) {
        const redis = getRedis()!;
        redis
          .lpush(AUDIT_QUEUE_KEY, JSON.stringify(entry))
          .catch((err) => log.warn({ err }, "Audit queue push failed"));
      } else {
        // Fallback: log to console
        log.info({ audit: entry }, `[AUDIT] ${action} ${resource}`);
      }

      return originalJson(body);
    };

    next();
  };
}
