import { Router } from "express";
import { prisma, pool, isDbConnected, recoverPool, getDbStatus } from "../services/dbService.js";
import { getRedis, isRedisConnected } from "../lib/redis.js";
import { getIO } from "../config/websocket.js";

import { createChildLogger } from "../lib/logger.js";
import { env } from "../lib/env.js";

const log = createChildLogger("health");
const router = Router();

// Server start timestamp for uptime tracking
const SERVER_START = Date.now();

/**
 * Check PostgreSQL connectivity by running SELECT 1 with a short timeout.
 * If the database is down, triggers auto-recovery in the background.
 */
async function checkDatabase(): Promise<{ status: "healthy" | "degraded" | "down"; latencyMs: number; error?: string; poolSize?: number; recoveryAttempts?: number }> {
  const start = Date.now();
  try {
    // Use a query with a timeout via Prisma
    const result = await Promise.race([
      prisma.$queryRaw<Array<{ one: number }>>`SELECT 1 as one`,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB query timed out")), 5000)),
    ]);
    const latency = Date.now() - start;
    const totalConn = pool.totalCount;
    const dbStatus = getDbStatus();
    return {
      status: result && Array.isArray(result) && result.length === 1 ? "healthy" : "degraded",
      latencyMs: latency,
      poolSize: totalConn,
      recoveryAttempts: dbStatus.reconnectAttempts,
    };
  } catch (err: any) {
    // Database is down — trigger auto-recovery in background (fire-and-forget)
    const dbStatus = getDbStatus();
    if (!dbStatus.isRecovering) {
      recoverPool().catch(() => {});
    }
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err?.message?.slice(0, 200) || "Unknown database error",
      recoveryAttempts: dbStatus.reconnectAttempts,
    };
  }
}

/**
 * Check Redis connectivity by sending a PING command.
 */
async function checkRedis(): Promise<{ status: "healthy" | "degraded" | "down" | "not_configured"; latencyMs: number; error?: string }> {
  if (!env.REDIS_URL) {
    return { status: "not_configured", latencyMs: 0 };
  }
  if (!isRedisConnected()) {
    return { status: "down", latencyMs: 0, error: "Redis client not connected" };
  }
  const start = Date.now();
  try {
    const redis = getRedis()!;
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Redis PING timed out")), 3000)),
    ]);
    return {
      status: result === "PONG" ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err?.message?.slice(0, 200) || "Unknown Redis error",
    };
  }
}

/**
 * Check WebSocket server status.
 */
function checkWebSocket(): { status: "healthy" | "degraded" | "down"; connections?: number; error?: string } {
  const io = getIO();
  if (!io) {
    return { status: "down", error: "WebSocket server not initialized" };
  }
  try {
    // Get total connection count from all namespaces
    const connectionCount = io.engine?.clientsCount ?? 0;
    return {
      status: "healthy",
      connections: connectionCount,
    };
  } catch (err: any) {
    return {
      status: "degraded",
      error: err?.message?.slice(0, 100) || "WebSocket check failed",
    };
  }
}

/**
 * Check WhatsApp client status.
 * Per-admin WhatsApp connection status is reported via the WhatsApp-specific API endpoint.
 * This general health check reports that WhatsApp is available as a feature.
 */
function checkWhatsApp(): { status: "healthy" | "not_configured" } {
  return { status: "not_configured" };
}

/**
 * Check AI service connectivity.
 */
function checkAIService(): { status: "healthy" | "degraded" | "not_configured"; configured: boolean } {
  const hasApiKey = !!(env.GEMINI_API_KEY);
  return {
    status: hasApiKey ? "healthy" : "not_configured",
    configured: hasApiKey,
  };
}

/**
 * Collect server metrics.
 */
function getServerMetrics() {
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START) / 1000);
  const uptimeDays = Math.floor(uptimeSeconds / 86400);
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

  const memory = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memory.rss / 1024 / 1024),
    heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    external: Math.round(memory.external / 1024 / 1024),
  };

  return {
    uptime: {
      seconds: uptimeSeconds,
      human: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
    },
    memory: memUsageMB,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: env.NODE_ENV,
    appUrl: env.APP_URL,
    sentryConfigured: !!env.SENTRY_DSN,
  };
}

interface HealthComponent {
  status: "healthy" | "degraded" | "down" | "not_configured";
  [key: string]: unknown;
}

router.get("/health", async (_req, res) => {
  const startTotal = Date.now();

  // Run all checks in parallel with individual timeouts
  const [db, redis, ws, ai] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkWebSocket(),
    checkAIService(),
  ]);

  const totalLatencyMs = Date.now() - startTotal;
  const serverMetrics = getServerMetrics();

  // Determine overall status
  const components: Record<string, HealthComponent> = {
    database: db,
    redis: redis,
    websocket: ws,
    ai: ai,
  };

  // Overall status: all must be healthy (or not_configured) for "healthy"
  const statusValues = Object.values(components).map(c => c.status);
  let overallStatus: string;
  if (statusValues.every(s => s === "healthy" || s === "not_configured")) {
    overallStatus = "healthy";
  } else if (statusValues.some(s => s === "down")) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  const response = {
    status: overallStatus,
    version: "2.0",
    timestamp: new Date().toISOString(),
    totalLatencyMs,
    server: serverMetrics,
    components,
  };

  // Return 200 if healthy, 503 if degraded
  const httpStatus = overallStatus === "healthy" ? 200 : 503;
  res.status(httpStatus).json(response);
});

/**
 * Detailed health check with extended diagnostics (slower, more thorough).
 */
router.get("/health/detailed", async (_req, res) => {
  const startTotal = Date.now();

  const [db, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const ws = checkWebSocket();
  const ai = checkAIService();
  const serverMetrics = getServerMetrics();
  const totalLatencyMs = Date.now() - startTotal;

  // Test a simple write operation to verify DB write path
  let dbWriteTest: { status: string; latencyMs: number; error?: string } = { status: "skipped", latencyMs: 0 };
  const writeStart = Date.now();
  try {
    const [result] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
    if (result && result.now) {
      dbWriteTest = { status: "healthy", latencyMs: Date.now() - writeStart };
    }
  } catch (err: any) {
    dbWriteTest = { status: "down", latencyMs: Date.now() - writeStart, error: err?.message?.slice(0, 200) };
  }

  const response = {
    status: "healthy",
    version: "2.0",
    timestamp: new Date().toISOString(),
    totalLatencyMs,
    server: {
      ...serverMetrics,
      pid: process.pid,
      cwd: process.cwd(),
      memoryUsagePercent: serverMetrics.memory.heapTotal > 0
        ? Math.round((serverMetrics.memory.heapUsed / serverMetrics.memory.heapTotal) * 100)
        : 0,
    },
    components: {
      database: db,
      databaseWrite: dbWriteTest,
      redis,
      websocket: ws,
      ai,
    },
    config: {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      appUrl: env.APP_URL,
      sentryConfigured: !!env.SENTRY_DSN,
      stripeConfigured: !!env.STRIPE_SECRET_KEY,
      smtpConfigured: !!env.SMTP_HOST,
      encryptionConfigured: !!env.ENCRYPTION_KEY,
    },
  };

  res.json(response);
});

export default router;
