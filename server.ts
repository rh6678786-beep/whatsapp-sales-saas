import "dotenv/config";
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
import { processAllAdmins } from "./backend/services/proactiveEngine.js";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = createChildLogger("server");

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // ===========================================================================
  // STANDARD MIDDLEWARE
  // ===========================================================================
  // Raw body is captured via express.json verify callback for Stripe webhook
  app.use(express.json({
    limit: "10mb",
    verify: (req: any, _res, buf: Buffer) => {
      if (req.originalUrl === "/api/billing/webhook") {
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
    allowedHeaders: ["Content-Type", "Authorization", "x-correlation-id"],
    exposedHeaders: ["x-correlation-id"],
  }));

  // Observability middleware
  app.use(correlationId);
  app.use(requestLogger);

  // Rate limiting — skip for webhook and health endpoints
  app.use((req, res, next) => {
    if (req.path === "/api/billing/webhook" || req.path === "/api/health") {
      next();
    } else {
      defaultRateLimiter(req, res, next);
    }
  });

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
  // ROUTES
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

  app.use("/api", authRoutes);
  app.use("/api", igOauthRoutes);
  app.use("/api", whatsappRoutes);
  app.use("/api", sessionsRoutes);
  app.use("/api", productsRoutes);
  app.use("/api", settingsRoutes);
  app.use("/api", billingRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api", campaignsRoutes);
  app.use("/api", supervisorRoutes);
  app.use("/api", publishRoutes);
  app.use("/api", telegramRoutes);
  app.use("/api", reEngagementRoutes);
  app.use("/api", proactiveRoutes);
  app.use("/api", dealsRoutes);
  app.use("/api", broadcastRoutes);
  app.use("/api", uploadRoutes);
  app.use("/api", healthRoutes);
  app.use("/api", superAdminRoutes);
  app.use("/api", emailReportRoutes);
  app.use("/api", paymentRoutes);
  app.use("/api", orderTrackingRoutes);
  app.use("/api", reportRoutes);
  app.use("/api", seedRoutes);
  app.use("/api", teamRoutes);
  app.use("/api", teamAuthRoutes);
  app.use("/api", auditRoutes);
  app.use("/api", bulkImportRoutes);
  app.use("/api", activityRoutes);
  app.use("/api", twoFactorRoutes);
  app.use("/api", statsRoutes);

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
