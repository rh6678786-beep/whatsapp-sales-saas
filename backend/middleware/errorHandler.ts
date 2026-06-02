import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("error-handler");

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

  // Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    log.warn({ err }, "Prisma request error");
    res.status(400).json({ error: "Database operation failed", code: "DB_ERROR" });
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
