import pino from "pino";
import { env } from "./env.js";

const level = process.env.LOG_LEVEL || (env.NODE_ENV === "production" ? "info" : "debug");

function scrub(val: any): any {
  if (typeof val === "string") {
    return val
      .replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, "[GEMINI_API_KEY_REDACTED]")
      .replace(/sk_(?:live|test)_[a-zA-Z0-9]{24,}/g, "[STRIPE_SECRET_KEY_REDACTED]");
  }
  if (val && typeof val === "object") {
    if (val instanceof Error) {
      const errClone = new Error(scrub(val.message));
      errClone.name = val.name;
      if (val.stack) {
        errClone.stack = scrub(val.stack);
      }
      return errClone;
    }
    const res: any = Array.isArray(val) ? [] : {};
    for (const key of Object.keys(val)) {
      res[key] = scrub(val[key]);
    }
    return res;
  }
  return val;
}

export const logger = pino({
  level,
  transport: env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss Z" } }
    : undefined,
  hooks: {
    logMethod(inputArgs, method) {
      return method.apply(this, inputArgs.map(arg => scrub(arg)) as [string, ...any[]]);
    }
  },
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
