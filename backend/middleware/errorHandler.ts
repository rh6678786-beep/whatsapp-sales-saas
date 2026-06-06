import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { createChildLogger } from "../lib/logger.js";
import { recoverPool, isDbConnected } from "../services/dbService.js";

const log = createChildLogger("error-handler");

/**
 * Check if an error is a database connection error.
 */
function isDbConnectionError(err: Error): boolean {
  const msg = err.message?.toLowerCase() || "";
  const name = err.name || "";
  return (
    name.includes("PrismaClient") && (
      msg.includes("can't reach database") ||
      msg.includes("connection terminated") ||
      msg.includes("connection refused") ||
      msg.includes("connection reset") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("etimedout") ||
      msg.includes("timed out") ||
      msg.includes("server closed the connection") ||
      msg.includes("socket closed") ||
      msg.includes("client has encountered a connection error") ||
      msg.includes("could not connect")
    )
  );
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle known application errors
  if (err instanceof AppError) {
    const body: any = { error: err.message, code: err.code };
    if (err.constructor.name === "ValidationError" && (err as any).fields) {
      body.fields = (err as any).fields;
    }

    if (err.statusCode >= 500) {
      log.error({ err, path: req.path }, err.message);
    } else {
      log.warn({ err, path: req.path }, err.message);
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    res.status(401).json({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
    return;
  }

  // Prisma connection errors — auto-recover without server restart
  if (isDbConnectionError(err)) {
    log.warn({ err, path: req.path }, "Database connection error — triggering auto-recovery");
    // Fire-and-forget pool recovery
    recoverPool().catch(() => {});
    res.status(503).json({
      error: "Database temporarily unavailable. Retrying connection automatically. Please try your request again.",
      code: "DB_CONNECTION_ERROR",
      retryable: true,
    });
    return;
  }

  // Other Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    log.warn({ err }, "Prisma request error");
    res.status(400).json({ error: "Database operation failed", code: "DB_ERROR" });
    return;
  }

  if (err.name === "PrismaClientValidationError") {
    log.warn({ err }, "Prisma validation error");
    res.status(400).json({ error: "Invalid database query", code: "DB_VALIDATION_ERROR" });
    return;
  }

  // Unknown errors — never leak details in production
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    log.error({ err, path: req.path }, "Unhandled error");
    res.status(500).json({
      error: "An unexpected error occurred. Please try again later.",
      code: "INTERNAL_ERROR",
    });
  } else {
    log.error({ err, path: req.path }, "Unhandled error");
    res.status(500).json({
      error: err.message || "Internal server error",
      code: "INTERNAL_ERROR",
      stack: err.stack?.split("\n").slice(0, 5).join("\n"),
    });
  }
}

// Catch unhandled rejections and uncaught exceptions
process.on("unhandledRejection", (reason: unknown) => {
  log.error({ err: reason }, "Unhandled Promise rejection");
});

process.on("uncaughtException", (err: Error) => {
  log.error({ err }, "Uncaught exception");
  // Allow process to exit gracefully
  setTimeout(() => process.exit(1), 2000);
});
