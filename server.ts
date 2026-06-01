import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { createServer } from "http";

import { dbService } from "./backend/services/dbService.js";
import { env } from "./backend/config/env.js";
import { connectRedis } from "./backend/config/redis.js";
import { setupWebSocket, emitToAdmin } from "./backend/config/websocket.js";
import { setupQueues, isQueuesEnabled, startAiRetryProcessor } from "./backend/queues/index.js";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import { errorHandler } from "./backend/middleware/errorHandler.js";
import { rateLimitDefault } from "./backend/middleware/rateLimit.js";
import { requestLogger } from "./backend/middleware/requestLogger.js";
import { correlationId } from "./backend/middleware/correlationId.js";
import { processAllAdmins } from "./backend/services/proactiveEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Raw body capture for Stripe webhook (must be BEFORE express.json)
  app.use((req: any, _res, next) => {
    if (req.originalUrl === "/api/billing/webhook") {
      let data = "";
      req.on("data", (chunk: string) => { data += chunk; });
      req.on("end", () => { req.rawBody = data; });
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use(compression());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }));
  app.use(cors({
    origin: env.NODE_ENV === "production" ? false : "*",
    credentials: true,
  }));
  app.use(correlationId);
  app.use(requestLogger);
  app.use(rateLimitDefault);

  const ws = setupWebSocket(httpServer);
  (global as any).__io = ws;

  await connectRedis();
  await setupQueues();

  // Database setup & schema sync
  {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({
      connectionString: env.DATABASE_URL?.replace(/[?&]sslmode=[^&]*/g, "").replace(/[?&]$/, ""),
      ssl: { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED },
    });
    const client = await pool.connect();
    const res = await client.query("SELECT 1 as ok");
    console.log(`[DB] Connected to PostgreSQL`);

    let tablesExist = false;
    try {
      const tableCheck = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Admin')");
      tablesExist = tableCheck.rows[0].exists;
    } catch (_) {}

    client.release();
    await pool.end();

    try {
      const { execSync } = await import("child_process");
      execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", cwd: __dirname });
      console.log("[DB] Schema synced with database");
    } catch (schemaErr: any) {
      console.warn("[DB] Schema push skipped:", schemaErr.message?.slice(0, 100));
    }

    try {
      const { seedDatabase } = await import("./backend/lib/seed.js");
      await seedDatabase();
    } catch (seedErr: any) {
      console.warn("[DB] Seed warning:", (seedErr as Error).message);
    }
  }

  // Routes
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

  // Vite / SPA
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

  app.use(errorHandler);

  // Process-level handlers
  process.on("unhandledRejection", (reason) => {
    console.error("[FATAL] Unhandled Rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[FATAL] Uncaught Exception:", err);
  });
  process.removeAllListeners("SIGTERM");
  process.removeAllListeners("SIGINT");
  process.on("SIGTERM", () => { console.log("[SERVER] SIGTERM received, ignoring"); });
  process.on("SIGINT", () => { console.log("[SERVER] SIGINT received, ignoring"); });
  process.on("exit", (code) => {
    console.log(`[SERVER] Process exiting with code ${code}`);
    console.log(new Error("Stack trace").stack);
  });

  const PORT = env.PORT;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Multi-Tenant SaaS Server running on http://localhost:${PORT}`);

    if (!isQueuesEnabled()) {
      startAiRetryProcessor();

      cron.schedule("*/15 * * * *", () => {
        processAllAdmins().catch(e => console.error("[CRON] processAllAdmins error:", e.message));
      });
      console.log("[CRON] Proactive engine scheduled every 15 minutes");
    }
  });

  setInterval(() => {}, 60000);
}

startServer().catch((err) => {
  console.error("[FATAL] Server failed to start:", err);
  process.exit(1);
});
