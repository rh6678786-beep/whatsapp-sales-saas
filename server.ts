import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import multer from "multer";
import axios from "axios";
import { randomUUID } from "crypto";

import { dbService } from "./backend/services/dbService.js";
import { generateToken, verifyToken, hashPassword, comparePassword, validatePassword } from "./backend/services/authService.js";
import { SUBSCRIPTION_PLANS, getPlanById, createCheckoutSession, createBillingPortalSession, getSubscriptionStatus, handleWebhook, checkLimit, startTrial, getAdminFeatures } from "./backend/services/stripeService.js";
import { sendOtp, verifyOtp } from "./backend/services/otpService.js";
import { 
  initializeWhatsAppClient, 
  getWhatsAppStatus, 
  logoutWhatsApp, 
  sendWhatsAppMessage,
  isWhatsAppReady
} from "./backend/lib/whatsappClient.js";
import { testInstagramConnection } from "./backend/services/instagramService.js";
import { testTelegramConnection } from "./backend/services/telegramService.js";
import { analyzePaymentScreenshot } from "./backend/services/paymentService.js";
import { processReEngagement, previewReEngagement, findInactiveCustomers } from "./backend/services/reEngagementService.js";
import { testFacebookConnection } from "./backend/services/facebookService.js";
import { sendDailyReportToAllAdmins, sendTestEmail } from "./backend/services/emailService.js";
import { Order } from "./src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use("/uploads", express.static(UPLOADS_DIR));
  app.use((req: any, _res, next) => {
    if (req.originalUrl === "/api/billing/webhook") {
      let data = "";
      req.on("data", (chunk: string) => { data += chunk; });
      req.on("end", () => { req.rawBody = data; });
    }
    next();
  });

  // Verify database connection
  try {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL?.replace(/[?&]sslmode=[^&]*/g, "").replace(/[?&]$/, ""),
      ssl: { rejectUnauthorized: false },
    });
    const client = await pool.connect();
    const res = await client.query("SELECT 1 as ok");
    console.log(`[DB] Connected to PostgreSQL at ${process.env.DATABASE_URL?.split("@")[1]?.split("?")[0] || "unknown"}`);

    // Check if tables exist before releasing client
    let tablesExist = false;
    try {
      const tableCheck = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Admin')");
      tablesExist = tableCheck.rows[0].exists;
    } catch (_) {}

    client.release();
    await pool.end();

    // Only push schema if tables don't exist
    if (!tablesExist) {
      try {
        console.log("[DB] Tables not found, pushing schema...");
        const { execSync } = await import("child_process");
        execSync("npx prisma db push --accept-data-loss", {
          stdio: "inherit",
          cwd: __dirname,
        });
        console.log("[DB] Schema synced with database");
      } catch (schemaErr: any) {
        console.warn("[DB] Schema push skipped:", schemaErr.message?.slice(0, 100));
      }
    } else {
      console.log("[DB] Tables already exist, skipping schema push");
    }

    // Auto-seed products if table is empty
    try {
      const { seedDatabase } = await import("./backend/lib/seed.js");
      await seedDatabase();
    } catch (seedErr: any) {
      console.warn("[DB] Seed warning:", seedErr.message);
    }
  } catch (e: any) {
    console.error("[DB] Connection failed:", e.message);
  }

  // ==========================================
  // MULTI-TENANT MIDDLEWARE
  // ==========================================
  const getAdminId = (req: express.Request): string => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const payload = verifyToken(authHeader.slice(7));
      if (payload) return payload.adminId;
      throw new Error("Invalid or expired token");
    }
    const headerId = req.headers["x-admin-id"] as string | undefined;
    if (headerId) {
      const payload = verifyToken(headerId);
      if (payload) return payload.adminId;
    }
    throw new Error("Authentication required");
  };

  // ==========================================
  // AUTH ROUTES
  // ==========================================
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email, adminId, password, storeName } = req.body;

      if (!email || !adminId || !password) {
        return res.status(400).json({ error: "email, adminId, and password are required" });
      }
      if (!email.toLowerCase().endsWith('@gmail.com')) {
        return res.status(400).json({ error: "For security reasons, only Gmail accounts are accepted for registration." });
      }
      const pwCheck = validatePassword(password);
      if (!pwCheck.valid) {
        return res.status(400).json({ error: pwCheck.error });
      }

      const emailExists = await dbService.adminExistsByEmail(email);
      if (emailExists) {
        return res.status(409).json({ error: "This email is already registered. Use a different email or login." });
      }

      const idExists = await dbService.adminExists(adminId);
      if (idExists) {
        return res.status(409).json({ error: "This Store ID already exists." });
      }

      const result = await sendOtp(email, { adminId, password, storeName });

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to send OTP" });
      }

      res.json({ success: true, message: "OTP sent to your email" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ error: "email and otp are required" });
      }

      const verification = await verifyOtp(email, otp);

      if (!verification.valid) {
        return res.status(400).json({ error: verification.error || "Verification failed" });
      }

      const { adminId, password, storeName } = verification.data!;

      const emailExists = await dbService.adminExistsByEmail(email);
      if (emailExists) {
        return res.status(409).json({ error: "This email is already registered." });
      }

      const idExists = await dbService.adminExists(adminId);
      if (idExists) {
        return res.status(409).json({ error: "This Store ID already exists." });
      }

      const passwordHash = await hashPassword(password);
      await dbService.registerAdmin(adminId, passwordHash);

      await dbService.updateSettings(adminId, { verifiedEmail: email });

      const trial = startTrial();
      await dbService.updateSubscription(adminId, trial);

      if (storeName) {
        await dbService.updateSettings(adminId, { storeName });
      }

      const token = generateToken(adminId);
      res.json({ success: true, token, adminId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { adminId, password, storeName } = req.body;
      if (!adminId || !password) {
        return res.status(400).json({ error: "adminId and password required" });
      }
      const pwCheck = validatePassword(password);
      if (!pwCheck.valid) {
        return res.status(400).json({ error: pwCheck.error });
      }

      const exists = await dbService.adminExists(adminId);
      if (exists) {
        return res.status(409).json({ error: "Admin ID already exists" });
      }

      const passwordHash = await hashPassword(password);
      await dbService.registerAdmin(adminId, passwordHash);

      // Start 7-day free trial
      const trial = startTrial();
      await dbService.updateSubscription(adminId, trial);

      if (storeName) {
        await dbService.updateSettings(adminId, { storeName });
      }

      const token = generateToken(adminId);
      res.json({ success: true, token, adminId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { adminId, password } = req.body;
      if (!adminId || !password) {
        return res.status(400).json({ error: "adminId and password required" });
      }

      const hash = await dbService.getAdminPasswordHash(adminId);
      const envPassword = process.env.ADMIN_PASSWORD || '';

      if (!hash) {
        // Admin exists but has no password set — accept and store the hash
        if (envPassword && password !== envPassword) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
        const newHash = await hashPassword(password);
        await dbService.registerAdmin(adminId, newHash);
        const token = generateToken(adminId);
        const settings = await dbService.getSettings(adminId);
        return res.json({ success: true, token, adminId, storeName: settings.storeName });
      }

      // Try password hash first, then env ADMIN_PASSWORD as master fallback
      let valid = await comparePassword(password, hash);
      if (!valid && envPassword) {
        valid = password === envPassword;
        if (valid) {
          // Update hash to match the env password for future logins
          const newHash = await hashPassword(password);
          await dbService.registerAdmin(adminId, newHash);
        }
      }
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken(adminId);
      const settings = await dbService.getSettings(adminId);
      res.json({ success: true, token, adminId, storeName: settings.storeName });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // DASHBOARD API (MULTI-TENANT)
  // ==========================================

  app.get("/api/stats", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const stats = await dbService.getStats(adminId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await dbService.getProductsPaginated(adminId, page, limit);
      res.json(result);
    } catch (error: any) {
      console.error(`[PRODUCTS_GET_ERROR]`, error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      console.log(`[PRODUCTS_POST] Request received:`, JSON.stringify(req.body).slice(0, 200));
      const adminId = getAdminId(req);
      console.log(`[PRODUCTS_POST] adminId: ${adminId}`);
      const existingSub = await dbService.getSubscription(adminId);
      console.log(`[PRODUCTS_POST] subscription:`, existingSub);
      const count = await dbService.getProductCount(adminId);
      console.log(`[PRODUCTS_POST] product count: ${count}`);
      const limitCheck = await checkLimit(adminId, "maxProducts", count, existingSub);
      console.log(`[PRODUCTS_POST] limitCheck:`, limitCheck);
      if (!limitCheck.allowed) {
        console.log(`[PRODUCTS_POST] BLOCKED by limit: ${limitCheck.reason}`);
        return res.status(403).json({ error: limitCheck.reason });
      }
      console.log(`[PRODUCTS_POST] Adding product...`);
      const product = await dbService.addProduct(adminId, req.body);
      console.log(`[PRODUCTS_POST] Product added:`, product.id);
      res.json(product);
    } catch (error: any) {
      console.error(`[PRODUCTS_POST_ERROR]`, error?.stack || error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to add product" });
    }
  });

  // Manual seed endpoint
  app.post("/api/seed", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { seedDatabase } = await import("./backend/lib/seed.js");
      await seedDatabase(adminId);
      const products = await dbService.getAllProducts(adminId);
      res.json({ success: true, productCount: products.length, products });
    } catch (error: any) {
      console.error(`[SEED_ERROR]`, error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to seed database" });
    }
  });

  app.get("/api/sessions", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const sessions = await dbService.getRecentSessions(adminId, 50);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:id/messages", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const messages = await dbService.getMessages(adminId, req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const settings = await dbService.getSettings(adminId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const body = { ...req.body };

      console.log(`[SETTINGS][${adminId}] Settings change requested. Keys updating: ${Object.keys(body).join(', ')}`);

      // Route password changes to credential store instead of settings
      if (body.adminPassword) {
        console.log(`[SETTINGS][${adminId}] Password modification requested. Securing hash...`);
        const hashed = await hashPassword(body.adminPassword);
        await dbService.registerAdmin(adminId, hashed);
        delete body.adminPassword;
      }

      const settings = await dbService.updateSettings(adminId, body);
      console.log(`[SETTINGS][${adminId}] Configuration changes merged and saved successfully.`);
      res.json(settings);
    } catch (error: any) {
      const safeId = req.headers["x-admin-id"] as string || "unknown";
      console.error(`[SETTINGS_ERROR][${safeId}] Failed to write configurations:`, error.message);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.get("/api/settings/profile", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const settings = await dbService.getSettings(adminId);
      res.json({
        adminId,
        storeName: settings.storeName || '',
        businessLogo: settings.businessLogo || '',
        email: settings.email || '',
        phone: settings.phone || '',
        address: settings.address || '',
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.put("/api/settings/profile", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const allowed = ['storeName', 'businessLogo', 'email', 'phone', 'address'];
      const updates: any = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      await dbService.updateSettings(adminId, updates);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ==========================================
  // WHATSAPP (MULTI-TENANT)
  // ==========================================
  app.get("/api/whatsapp/status", (req, res) => {
    try {
      const adminId = getAdminId(req);
      res.json(getWhatsAppStatus(adminId));
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  });

  app.post("/api/whatsapp/init", (req, res) => {
    try {
      const adminId = getAdminId(req);
      initializeWhatsAppClient(adminId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  });

  app.post("/api/whatsapp/logout", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const result = await logoutWhatsApp(adminId);
      res.json(result);
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  });

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================
  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const sessionId = req.params.id;
      await dbService.updateSession(adminId, sessionId, req.body);

      // If the state is updated to ORDER_CONFIRMED or DELIVERED, sync/create the order in the orders collection
      if (req.body.state === "ORDER_CONFIRMED" || req.body.state === "DELIVERED") {
        const session = await dbService.getSession(adminId, sessionId);
        if (session) {
          const products = await dbService.getAllProducts(adminId);
          const product = products.find(p => p.id === session.selectedProductId);
          const price = session.metadata?.negotiationState?.currentOfferedPrice ?? product?.price ?? 0;
          const cost = product?.costPrice ?? 0;

          // Extract customer phone from userId
          let customerPhone = "";
          const rawUserId = session.userId || "";
          if (rawUserId.includes(":")) {
            customerPhone = rawUserId.split(":").slice(1).join(":");
          } else {
            customerPhone = rawUserId;
          }
          if (/^92\d{9,10}$/.test(customerPhone) && !customerPhone.startsWith("+")) {
            customerPhone = "+" + customerPhone;
          }

          const newOrder: Order = {
            id: sessionId,
            userId: session.userId,
            productId: session.selectedProductId || "",
            status: req.body.state === "DELIVERED" ? "DELIVERED" : "VERIFIED",
            paymentScreenshotUrl: session.metadata?.paymentScreenshot || "",
            shippingAddress: session.metadata?.negotiationState?.shippingAddress || "Not provided",
            customerName: session.metadata?.customerName || "",
            customerPhone: customerPhone,
            amount: price,
            costPrice: cost,
            createdAt: new Date().toISOString()
          };

          await dbService.createOrder(adminId, newOrder);
          console.log(`[DB][${adminId}] Successfully synchronized and created order: ${sessionId}`);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      const safeId = req.headers["x-admin-id"] as string || "unknown";
      console.error(`[SESSION_PATCH_ERROR][${safeId}]`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // PRODUCT CRUD
  // ==========================================
  app.patch("/api/products/:id", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      await dbService.updateProduct(adminId, req.params.id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      await dbService.deleteProduct(adminId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // DEAL CRUD
  // ==========================================
  app.get("/api/deals", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const deals = await dbService.getAllDeals(adminId);
      res.json(deals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/deals", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const deal = await dbService.addDeal(adminId, req.body);
      res.json(deal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      await dbService.updateDeal(adminId, req.params.id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/deals/:id", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      await dbService.deleteDeal(adminId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/upload", upload.array("files", 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      const urls = files.map((f) => `/uploads/${f.filename}`);
      res.json({ urls });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // WHATSAPP SIMULATOR (BOT TESTER)
  // ==========================================
  app.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { From, Body } = req.body;
      const { processIncomingMessage } = await import("./backend/services/messageHandler.js");
      const result = await processIncomingMessage(adminId, From, Body || "", undefined, undefined, undefined, undefined, "simulator");
      res.json({ response: result.text, images: result.images, videos: result.videos });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // BROADCAST
  // ==========================================
  app.post("/api/broadcast", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      console.log(`[BROADCAST][${adminId}] Starting marketing campaign with message: "${message.slice(0, 50)}..."`);
      const sessions = await dbService.getRecentSessions(adminId, 1000);
      const active = sessions.filter(s => !s.isBlocked);
      console.log(`[BROADCAST][${adminId}] Found ${active.length} active contacts eligible for broadcast.`);
      
      let sent = 0;
      let failed = 0;

      for (let i = 0; i < active.length; i++) {
        const session = active[i];
        console.log(`[BROADCAST][${adminId}] [Progress: ${Math.round((i / active.length) * 100)}%] Attempting to dispatch to ${session.userId}...`);
        
        try {
          if (isWhatsAppReady(adminId)) {
            await sendWhatsAppMessage(adminId, session.userId, message);
            sent++;
            console.log(`[BROADCAST][${adminId}] ✅ Successfully sent to ${session.userId}.`);
          } else {
            failed++;
            console.error(`[BROADCAST_ERROR][${adminId}] ❌ WhatsApp client is not active/ready for broadcast.`);
          }
        } catch (e: any) {
          failed++;
          console.error(`[BROADCAST_ERROR][${adminId}] ❌ Failed to dispatch to ${session.userId}:`, e.message);
        }

        // Add 1.5 second delay between dispatch attempts to mimic human typing rhythm and bypass Meta ban thresholds
        if (i < active.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      console.log(`[BROADCAST][${adminId}] Campaign finished. Success: ${sent}, Failed: ${failed}.`);
      res.json({ success: true, message: `Broadcast sent to ${sent}/${active.length} customers`, sent, total: active.length });
    } catch (error: any) {
      const safeId = req.headers["x-admin-id"] as string || "unknown";
      console.error(`[BROADCAST_CRITICAL][${safeId}]`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // RE-ENGAGEMENT
  // ==========================================
  app.get("/api/re-engagement/customers", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const customers = await findInactiveCustomers(adminId);
      res.json({ customers, total: customers.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/re-engagement/send-all", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const result = await processReEngagement(adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/re-engagement/send-one", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { userId } = req.body;
      const { generateReEngagementMessage } = await import("./backend/services/reEngagementService.js");
      const msg = await generateReEngagementMessage(adminId, userId);
      if (msg && isWhatsAppReady(adminId)) {
        await sendWhatsAppMessage(adminId, userId, msg);
      }
      res.json({ success: true, message: msg });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/re-engagement/preview", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { userId } = req.body;
      const result = await previewReEngagement(adminId, userId);
      res.json(result || { message: "No preview available" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/re-engagement/schedule", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      await dbService.updateSettings(adminId, { reEngagement: req.body });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // REPORTS
  // ==========================================
  app.get("/api/stats/report", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { from, to } = req.query;
      if (!from || !to) {
        return res.status(400).json({ error: "from and to query parameters are required" });
      }
      const fromDate = new Date(from as string).getTime();
      const toDate = new Date(to as string).getTime();
      if (isNaN(fromDate) || isNaN(toDate)) {
        return res.status(400).json({ error: "Invalid date format. Use ISO date strings." });
      }

      const sessions = await dbService.getRecentSessions(adminId, 1000);
      const products = await dbService.getAllProducts(adminId);

      const filtered = sessions.filter(s => {
        const t = new Date(s.lastMessageAt).getTime();
        return t >= fromDate && t <= toDate && (s.state === 'ORDER_CONFIRMED' || s.state === 'DELIVERED');
      });

      const productMap = products.reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});
      let revenue = 0, cost = 0;

      filtered.forEach(s => {
        const p = s.selectedProductId ? productMap[s.selectedProductId] : null;
        revenue += p?.price || 0;
        cost += p?.costPrice || 0;
      });

      res.json({
        revenue,
        cost,
        profit: revenue - cost,
        orderCount: filtered.length,
        from: from as string,
        to: to as string
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // PAYMENT CONFIG & SCREENSHOT ANALYSIS
  // ==========================================
  app.get("/api/payment/config", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const settings = await dbService.getSettings(adminId);
      res.json(settings.paymentConfig || {
        jazzCash: { merchantId: '', merchantPassword: '', isActive: false },
        easyPaisa: { merchantId: '', merchantPassword: '', isActive: false },
        bankTransfer: { accountTitle: '', accountNumber: '', bankName: '', branchCode: '', isActive: false }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payment/config", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      await dbService.updateSettings(adminId, { paymentConfig: req.body });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payment/analyze-screenshot", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { imageBase64 } = req.body;
      const result = await analyzePaymentScreenshot(imageBase64, undefined, adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // ORDER TRACKING
  // ==========================================
  app.post("/api/orders/:id/tracking", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { trackingId, courier, userId } = req.body;
      if (isWhatsAppReady(adminId) && userId) {
        const msg = `🚚 *Tracking Update*\n\nCourier: ${courier}\nTracking ID: ${trackingId}\n\nAapka order dispach ho gaya hai! Delivery 2-4 working days mein ho jaye gi.`;
        await sendWhatsAppMessage(adminId, userId, msg);
      }

      // Also update the order status and tracking info
      try {
        const session = await dbService.getSession(adminId, req.params.id);
        const products = await dbService.getAllProducts(adminId);
        const product = products.find(p => p.id === session?.selectedProductId);
        
        const existingOrder: Order = {
          id: req.params.id,
          userId: userId || session?.userId || req.params.id,
          productId: session?.selectedProductId || "",
          status: 'SHIPPED',
          paymentScreenshotUrl: session?.metadata?.paymentScreenshot || "",
          shippingAddress: session?.metadata?.negotiationState?.shippingAddress || "Not provided",
          customerName: session?.metadata?.customerName || "",
          customerPhone: "",
          amount: session?.metadata?.negotiationState?.currentOfferedPrice || product?.price || 0,
          costPrice: product?.costPrice || 0,
          createdAt: new Date().toISOString(),
          trackingId,
          courier
        };

        await dbService.createOrder(adminId, existingOrder);
        console.log(`[DB][${adminId}] Successfully created/updated order with tracking: ${req.params.id}`);
      } catch (orderErr: any) {
        console.warn(`[DB_WARNING][${adminId}] Could not sync order tracking:`, orderErr.message);
      }

      res.json({ success: true });
    } catch (error: any) {
      const safeId = req.headers["x-admin-id"] as string || "unknown";
      console.error(`[ORDER_TRACKING_ERROR][${safeId}]`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // SUPER ADMIN
  // ==========================================
  app.get("/api/super/clients", async (req, res) => {
    try {
      const adminIds = await dbService.getAllAdminIds();
      const clients = await Promise.all(adminIds.map(async (id) => {
        const settings = await dbService.getSettings(id);
        const stats = await dbService.getStats(id);
        return {
          id,
          storeName: settings.storeName || 'Unnamed Store',
          verifiedEmail: settings.email || '',
          phone: settings.phone || '',
          stats: {
            products: stats.productCount || 0,
            sessions: stats.activeUsers + (stats.totalOrders || 0) + (stats.pendingPayments || 0),
            orders: stats.totalOrders,
            totalSales: stats.totalSales
          }
        };
      }));
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/super/migrate-phantom", async (req, res) => {
    try {
      const fixed = await dbService.fixPhantomAdmins();
      res.json({ success: true, fixed });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // SETTINGS - PASSWORD VERIFY
  // ==========================================
  app.post("/api/settings/verify-password", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { password } = req.body;
      const hash = await dbService.getAdminPasswordHash(adminId);
      if (!hash) {
        const envPassword = process.env.ADMIN_PASSWORD || '';
        if (!envPassword) return res.status(500).json({ error: "No admin configured. Set ADMIN_PASSWORD in .env" });
        return res.json({ success: password === envPassword });
      }
      const valid = await comparePassword(password, hash);
      res.json({ success: valid });
    } catch {
      res.json({ success: false });
    }
  });

  app.put("/api/auth/change-password", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: "oldPassword and newPassword required" });
      }
      const pwCheck = validatePassword(newPassword);
      if (!pwCheck.valid) {
        return res.status(400).json({ error: pwCheck.error });
      }

      const hash = await dbService.getAdminPasswordHash(adminId);
      if (hash) {
        const valid = await comparePassword(oldPassword, hash);
        if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
      } else {
        const envPassword = process.env.ADMIN_PASSWORD || '';
        if (!envPassword) return res.status(500).json({ error: "No admin configured. Set ADMIN_PASSWORD in .env" });
        if (oldPassword !== envPassword) return res.status(401).json({ error: "Current password is incorrect" });
      }

      const newHash = await hashPassword(newPassword);
      await dbService.registerAdmin(adminId, newHash);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // BILLING & SUBSCRIPTIONS
  // ==========================================
  app.get("/api/billing/plans", (_req, res) => {
    res.json(SUBSCRIPTION_PLANS);
  });

  app.get("/api/billing/subscription", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const existingSub = await dbService.getSubscription(adminId);
      const status = await getSubscriptionStatus(adminId, existingSub);
      const usage = await dbService.getUsageCounts(adminId);
      res.json({ ...status, usage });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/billing/features", async (req, res) => {
    try {
      const adminId = getAdminId(req);
      const existingSub = await dbService.getSubscription(adminId);
      const capabilities = await getAdminFeatures(adminId, existingSub);
      res.json(capabilities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const dbUrl = process.env.DATABASE_URL || "";
      const isSupabase = dbUrl.includes("supabase");
      const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
      let dbName = "Not connected";
      if (dbUrl) {
        if (isSupabase) dbName = "PostgreSQL (Supabase)";
        else if (isLocal) dbName = "PostgreSQL (Local)";
        else dbName = "PostgreSQL";
      }
      res.json({ status: "ok", database: dbName, connected: !!dbUrl });
    } catch {
      res.json({ status: "error", database: "Not connected", connected: false });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
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

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Multi-Tenant SaaS Server running on http://localhost:${PORT}`);
  });
}

startServer();
