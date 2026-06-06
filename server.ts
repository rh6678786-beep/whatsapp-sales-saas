import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { createServer } from "http";

import { env } from "./backend/lib/env.js";
import { connectRedis, disconnectRedis } from "./backend/lib/redis.js";
import { logger, createChildLogger } from "./backend/lib/logger.js";
import { defaultRateLimiter, webhookRateLimiter } from "./backend/lib/rateLimiter.js";
import { setupWebSocket } from "./backend/config/websocket.js";
import { setupQueues, isQueuesEnabled, startAiRetryProcessor } from "./backend/queues/index.js";
import { setupDatabase } from "./backend/lib/database.js";
import { errorHandler } from "./backend/middleware/errorHandler.js";
import { requestLogger } from "./backend/middleware/requestLogger.js";
import { correlationId } from "./backend/middleware/correlationId.js";
import { csrfProtection, cleanupExpiredTokens } from "./backend/middleware/csrf.js";
import { processAllAdmins } from "./backend/services/proactiveEngine.js";
import { prisma } from "./backend/services/dbService.js";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";

import * as Sentry from "@sentry/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = createChildLogger("server");

// Initialize Sentry if DSN is configured
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 0.5,
    integrations: [Sentry.requestDataIntegration()],
  });
  log.info("Sentry error tracking initialized");
}

/**
 * Validate required environment variables on startup
 */
function validateEnvironment() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'GEMINI_API_KEY', 'ENCRYPTION_KEY'];
  const missing = required.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Check JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  // Check production requirements
  if (env.NODE_ENV === 'production') {
    if (!env.APP_URL) {
      throw new Error('APP_URL is required in production');
    }
    if (!env.APP_URL.startsWith('https://')) {
      throw new Error('APP_URL must use HTTPS in production');
    }
  }
  
  log.info('Environment validation passed');
}

async function startServer() {
  // Validate environment variables
  validateEnvironment();
  
  const app = express();
  const httpServer = createServer(app);

  // ===========================================================================
  // STANDARD MIDDLEWARE
  // ===========================================================================
  // Raw body is captured via express.json verify callback for Stripe webhook
  // Helper to match paths across API versions (/api/* and /api/v1/*)
  const matchesApiPath = (url: string, path: string): boolean => {
    return url === path || url === path.replace('/api', '/api/v1');
  };

  app.use(express.json({
    limit: "1mb",
    verify: (req: any, _res, buf: Buffer) => {
      if (req.originalUrl && matchesApiPath(req.originalUrl, "/api/billing/webhook")) {
        req.rawBody = buf;
      }
    },
  }));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use(compression());

  // Helmet with strict CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // CORS — strict in production
  app.use(cors({
    origin: env.NODE_ENV === "production"
      ? env.APP_URL
        ? [env.APP_URL]
        : false
      : "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-correlation-id", "x-csrf-token"],
    exposedHeaders: ["x-correlation-id", "x-csrf-token"],
  }));

  // HTTPS enforcement in production
  if (env.NODE_ENV === "production") {
    app.use((req: any, res, next) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        return res.redirect(301, `https://${req.header('host')}${req.url}`);
      }
      next();
    });
  }

  // Observability middleware
  app.use(correlationId);
  app.use(requestLogger);

  // Rate limiting — skip for webhook and health endpoints (supports /api and /api/v1)
  app.use((req, res, next) => {
    const path = req.path;
    if (matchesApiPath(path, "/api/billing/webhook") || matchesApiPath(path, "/api/health")) {
      next();
    } else {
      defaultRateLimiter(req, res, next);
    }
  });

  // CSRF Protection — skip for:
  // 1. Webhooks & health
  // 2. JWT-authenticated API calls (SPA sends Bearer token, not cookies, so CSRF is mitigated)
  // 3. Unauthenticated auth routes (no JWT yet, e.g. login, signup)
  // Supports both /api and /api/v1 prefixes
  app.use((req, res, next) => {
    const path = req.path;
    const skipPaths = ["/api/billing/webhook", "/api/health", "/api/whatsapp/webhook"];
    if (skipPaths.some(p => matchesApiPath(path, p))) return next();
    // JWT-authenticated requests are safe from CSRF (browser can't auto-send Authorization header)
    if (req.headers.authorization?.startsWith('Bearer ')) return next();
    // Unauthenticated auth routes (no JWT available)
    if (path.startsWith('/api/auth/') || path.startsWith('/api/v1/auth/') ||
        path.startsWith('/api/team/') || path.startsWith('/api/v1/team/')) return next();
    csrfProtection(req, res, next);
  });

  // Cleanup expired CSRF tokens periodically
  cleanupExpiredTokens();

  // ===========================================================================
  // WEBSOCKET
  // ===========================================================================
  const ws = setupWebSocket(httpServer);
  (global as any).__io = ws;

  // ===========================================================================
  // REDIS + QUEUES
  // ===========================================================================
  await connectRedis();
  await setupQueues();

  // ===========================================================================
  // DATABASE SETUP
  // ===========================================================================
  try {
    await setupDatabase();
  } catch (err) {
    log.error({ err }, "Database setup failed — server will start but some features may not work");
  }

  // ===========================================================================
  // ROUTES — Import all route modules
  // ===========================================================================
  const { default: authRoutes } = await import("./backend/routes/auth.js");
  const { default: igOauthRoutes } = await import("./backend/routes/igOauth.js");
  const { default: whatsappRoutes } = await import("./backend/routes/whatsapp.js");
  const { default: sessionsRoutes } = await import("./backend/routes/sessions.js");
  const { default: productsRoutes } = await import("./backend/routes/products.js");
  const { default: settingsRoutes } = await import("./backend/routes/settings.js");
  const { default: billingRoutes } = await import("./backend/routes/billing.js");
  const { default: analyticsRoutes } = await import("./backend/routes/analytics.js");
  const { default: campaignsRoutes } = await import("./backend/routes/campaigns.js");
  const { default: supervisorRoutes } = await import("./backend/routes/supervisor.js");
  const { default: publishRoutes } = await import("./backend/routes/publish.js");
  const { default: telegramRoutes } = await import("./backend/routes/telegram.js");
  const { default: reEngagementRoutes } = await import("./backend/routes/reEngagement.js");
  const { default: proactiveRoutes } = await import("./backend/routes/proactive.js");
  const { default: dealsRoutes } = await import("./backend/routes/deals.js");
  const { default: broadcastRoutes } = await import("./backend/routes/broadcast.js");
  const { default: uploadRoutes } = await import("./backend/routes/upload.js");
  const { default: healthRoutes } = await import("./backend/routes/health.js");
  const { default: superAdminRoutes } = await import("./backend/routes/superAdmin.js");
  const { default: emailReportRoutes } = await import("./backend/routes/emailReport.js");
  const { default: paymentRoutes } = await import("./backend/routes/payment.js");
  const { default: orderTrackingRoutes } = await import("./backend/routes/orderTracking.js");
  const { default: reportRoutes } = await import("./backend/routes/report.js");
  const { default: seedRoutes } = await import("./backend/routes/seed.js");
  const { default: teamRoutes } = await import("./backend/routes/team.js");
  const { default: teamAuthRoutes } = await import("./backend/routes/teamAuth.js");
  const { default: auditRoutes } = await import("./backend/routes/audit.js");
  const { default: bulkImportRoutes } = await import("./backend/routes/bulkImport.js");
  const { default: activityRoutes } = await import("./backend/routes/activity.js");
  const { default: twoFactorRoutes } = await import("./backend/routes/twoFactor.js");
  const { default: statsRoutes } = await import("./backend/routes/stats.js");
  const { default: monitoringRoutes } = await import("./backend/routes/monitoring.js");
  const { default: purchaseRoutes } = await import("./backend/routes/purchases.js");

  // Collect all route modules for dual mounting
  const routeModules = [
    authRoutes, igOauthRoutes, whatsappRoutes, sessionsRoutes,
    productsRoutes, settingsRoutes, billingRoutes, analyticsRoutes,
    campaignsRoutes, supervisorRoutes, publishRoutes, telegramRoutes,
    reEngagementRoutes, proactiveRoutes, dealsRoutes, broadcastRoutes,
    uploadRoutes, healthRoutes, superAdminRoutes, emailReportRoutes,
    paymentRoutes, orderTrackingRoutes, reportRoutes, seedRoutes,
    teamRoutes, teamAuthRoutes, auditRoutes, bulkImportRoutes,
    activityRoutes, twoFactorRoutes, statsRoutes, monitoringRoutes,
    purchaseRoutes,
  ];

  const API_PREFIXES = ["/api", "/api/v1"];
  for (const prefix of API_PREFIXES) {
    for (const mod of routeModules) {
      app.use(prefix, mod);
    }
  }

  // ===========================================================================
  // 404 HANDLER — Unknown API routes (for both /api and /api/v1)
  // ===========================================================================
  for (const prefix of ["/api", "/api/v1"]) {
    app.use(prefix, (_req, res) => {
      res.status(404).json({
        error: "Route not found",
        code: "NOT_FOUND",
      });
    });
  }

  // ===========================================================================
  // VITE / SPA
  // ===========================================================================
  if (env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  // ===========================================================================
  // ERROR HANDLER (must be last)
  // ===========================================================================
  // Sentry error handler wraps our error handler when DSN is configured
  // The order matters: Sentry catches the error, then our handler formats the response
  if (env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }
  app.use(errorHandler);

  // ===========================================================================
  // BACKGROUND JOBS
  // ===========================================================================
  if (env.NODE_ENV !== "test" && !process.env.VITEST) {
    if (!isQueuesEnabled()) {
      startAiRetryProcessor();

      cron.schedule("*/15 * * * *", () => {
        processAllAdmins().catch((e) =>
          log.error({ err: e }, "processAllAdmins cron error")
        );
      });
      log.info("Proactive engine scheduled every 15 minutes");
    }
  }

  // ===========================================================================
  // START
  // ===========================================================================
  const PORT = env.PORT;
  httpServer.listen(PORT, () => {
    log.info({ port: PORT, nodeEnv: env.NODE_ENV }, `Server started on port ${PORT}`);
  });

  // ===========================================================================
  // GRACEFUL SHUTDOWN
  // ===========================================================================
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.info({ signal }, "Graceful shutdown initiated");

    // Stop accepting new connections
    httpServer.close(async () => {
      log.info("HTTP server closed");

      // Disconnect Redis
      await disconnectRedis();

      // Disconnect Prisma (database)
      await prisma.$disconnect();

      log.info("Shutdown complete");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      log.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer().catch((err) => {
  log.error({ err }, "Server failed to start");
  process.exit(1);
});
