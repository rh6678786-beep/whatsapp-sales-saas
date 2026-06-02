import pino from "pino";
import { env } from "./env.js";

const level = process.env.LOG_LEVEL || (env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  transport: env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss Z" } }
    : undefined,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url?.split("?")[0], // Strip query params to avoid logging PII
      headers: { "x-correlation-id": req.headers?.["x-correlation-id"] },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-admin-id']",
      "body.password",
      "body.otp",
      "body.token",
      "body.secret",
      "body.apiKey",
      "body.smtpPass",
      "body.merchantPassword",
      "body.clientSecret",
      "*.password",
      "*.token",
      "*.secret",
      "*.apiKey",
      "*.merchantPassword",
    ],
    censor: "[REDACTED]",
  },
});

export function createChildLogger(component: string) {
  return logger.child({ component });
}
