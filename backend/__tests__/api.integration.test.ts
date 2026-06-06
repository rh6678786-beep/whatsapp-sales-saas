import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { generateToken } from "../services/authService.js";

// ---- Mock dbService ----
const mockDbService = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getSession: vi.fn(),
  getSessionsPaginated: vi.fn(),
  getMessages: vi.fn(),
  getAllProducts: vi.fn(),
  getProductsPaginated: vi.fn(),
  getProductCount: vi.fn(),
  getAdminPasswordHash: vi.fn(),
  getSubscription: vi.fn(),
  getUsageCounts: vi.fn(),
  getAllAdminIds: vi.fn(),
  updateSession: vi.fn(),
  updateSettings: vi.fn(),
  registerAdmin: vi.fn(),
  getCrossSellProductIds: vi.fn(),
  getCustomerOrderedProductIds: vi.fn(),
  adminExists: vi.fn(),
  adminExistsByEmail: vi.fn(),
  findAdminByEmail: vi.fn(),
  storePasswordReset: vi.fn(),
  getPasswordReset: vi.fn(),
  deletePasswordReset: vi.fn(),
}));

const mockPrisma = {
  $queryRaw: vi.fn().mockRejectedValue(new Error("Test: DB not available")),
  $executeRaw: vi.fn(),
  admin: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  message: { findMany: vi.fn(), create: vi.fn() },
  product: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  order: {
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  deal: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  dripCampaign: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  otpStore: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
};

const mockPool = {
  connect: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  totalCount: 5,
  idleCount: 3,
  waitingCount: 0,
};

vi.mock("../services/dbService.js", () => ({
  dbService: mockDbService,
  prisma: mockPrisma,
  pool: mockPool,
  isDbConnected: vi.fn(() => false),
  recoverPool: vi.fn(() => Promise.resolve(false)),
  getDbStatus: vi.fn(() => ({ connected: false, reconnectAttempts: 0, isRecovering: false })),
}));
vi.mock("../services/stripeService.js", () => ({
  getSubscriptionStatus: vi.fn(() => ({
    plan: { limits: { maxSessionsPerMonth: 9999, maxProducts: 100 } },
    subscription: { planId: "free", status: "free" },
  })),
  startTrial: vi.fn(() => ({ planId: "free", status: "trialing", trialEnd: new Date(Date.now() + 7 * 86400000).toISOString() })),
  getPlanById: vi.fn(() => ({ limits: { maxSessionsPerMonth: 9999, maxProducts: 100 } })),
}));

vi.mock("../lib/rateLimiter.js", () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
  defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
  apiRateLimiter: (_req: any, _res: any, next: any) => next(),
  webhookRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/logger.js", () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("../lib/env.js", () => ({
  env: {
    NODE_ENV: "test",
    GEMINI_API_KEY: "test-key",
    PORT: 3000,
    APP_URL: "http://localhost:3000",
    JWT_SECRET: "test-jwt-secret-for-testing-only",
    ENCRYPTION_KEY: "test-encryption-key-32-chars-long!!",
    DATABASE_URL: "postgresql://localhost:5432/test",
    REDIS_URL: "",
    ADMIN_PASSWORD: "admin",
    STRIPE_SECRET_KEY: "",
    SMTP_HOST: "",
    SMTP_PORT: 587,
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "",
    FACEBOOK_CLIENT_ID: "",
    FACEBOOK_CLIENT_SECRET: "",
    SENTRY_DSN: "",
    AI_MONTHLY_BUDGET: 100,
    DB_SSL_REJECT_UNAUTHORIZED: false,
    STRIPE_STARTER_PRICE_ID: "",
    STRIPE_PROFESSIONAL_PRICE_ID: "",
    STRIPE_ENTERPRISE_PRICE_ID: "",
    STRIPE_WEBHOOK_SECRET: "",
  },
}));

vi.mock("../services/auditLogService.js", () => ({
  logAction: vi.fn(() => Promise.resolve()),
}));

vi.mock("../services/otpService.js", () => ({
  sendOtp: vi.fn(() => Promise.resolve({ success: true, message: "OTP sent" })),
  verifyOtp: vi.fn(() => Promise.resolve({
    valid: true,
    data: { adminId: "test-admin", password: "Test@123!", storeName: "Test Store", phone: "+921234567890" },
  })),
}));

const TEST_ADMIN_ID = "default-admin";
const testToken = generateToken(TEST_ADMIN_ID);

function createApp() {
  const app = express();
  app.use(express.json());

  // Simulate auth middleware: extract adminId from token
  app.use((req: any, _res: any, next: any) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      try {
        const { verifyToken } = require("../services/authService.js");
        const payload = verifyToken(token);
        if (payload) {
          req.adminId = payload.adminId;
        }
      } catch {}
    }
    next();
  });

  return app;
}

async function loadRoutes(app: express.Express) {
  const { default: authRoutes } = await import("../routes/auth.js");
  const { default: sessionsRoutes } = await import("../routes/sessions.js");
  const { default: productsRoutes } = await import("../routes/products.js");
  const { default: settingsRoutes } = await import("../routes/settings.js");
  const { default: healthRoutes } = await import("../routes/health.js");
  app.use("/api", authRoutes);
  app.use("/api", sessionsRoutes);
  app.use("/api", productsRoutes);
  app.use("/api", settingsRoutes);
  app.use("/api", healthRoutes);
}

// ===========================================================================
// Tests
// ===========================================================================

describe("API Integration: Health", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = createApp();
    await loadRoutes(app);
  });

  it("GET /api/health should return health status with component info", async () => {
    const res = await request(app).get("/api/health");
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("components");
    expect(res.body.components).toHaveProperty("database");
    expect(res.body.components).toHaveProperty("ai");
  });

  it("GET /api/health/detailed should return detailed diagnostics", async () => {
    const res = await request(app).get("/api/health/detailed");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("config");
    expect(res.body.config).toHaveProperty("nodeEnv");
    expect(res.body.config).toHaveProperty("sentryConfigured");
  });
});

describe("API Integration: Auth", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = createApp();
    await loadRoutes(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbService.getAdminPasswordHash.mockResolvedValue(null);
  });

  it("POST /api/auth/login should return token for valid env admin", async () => {
    process.env.ADMIN_PASSWORD = "test-password";
    mockDbService.getAdminPasswordHash.mockResolvedValue(null);
    mockDbService.registerAdmin.mockResolvedValue(undefined);
    mockDbService.getSettings.mockResolvedValue({ storeName: "Test Store" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ adminId: "test", password: "test-password" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("adminId", "test");
  });

  it("POST /api/auth/login should reject invalid credentials", async () => {
    process.env.ADMIN_PASSWORD = "real-password";
    mockDbService.getAdminPasswordHash.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ adminId: "test", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/auth/login should require adminId and password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});

describe("API Integration: Sessions", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = createApp();
    await loadRoutes(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbService.getSessionsPaginated.mockResolvedValue({
      sessions: [
        { id: "user-1", userId: "user-1", state: "NEW", lastMessageAt: new Date().toISOString(), remindersCount: 0 },
        { id: "user-2", userId: "user-2", state: "PAYMENT_AWAITING", lastMessageAt: new Date().toISOString(), remindersCount: 1 },
      ],
      total: 2,
    });
  });

  it("GET /api/sessions should return paginated sessions", async () => {
    const res = await request(app)
      .get("/api/sessions")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toHaveProperty("total");
  });

  it("GET /api/sessions should handle missing auth gracefully", async () => {
    const res = await request(app).get("/api/sessions");
    expect([401, 500]).toContain(res.status);
  });

  it("GET /api/sessions/:id/messages should return messages", async () => {
    mockDbService.getMessages.mockResolvedValue([
      { sessionId: "user-1", role: "user", text: "Hello", timestamp: new Date().toISOString() },
    ]);

    const res = await request(app)
      .get("/api/sessions/user-1/messages")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("API Integration: Products", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = createApp();
    await loadRoutes(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbService.getProductsPaginated.mockResolvedValue({
      products: [
        { id: "p1", name: "Product 1", price: 1000, costPrice: 500, features: ["A"], images: [], stock: 10 },
        { id: "p2", name: "Product 2", price: 2000, costPrice: 1000, features: ["B"], images: [], stock: 5 },
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it("GET /api/products should return paginated products", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.data).toHaveLength(2);
  });

  it("GET /api/products should handle missing auth gracefully", async () => {
    const res = await request(app).get("/api/products");
    expect([401, 500]).toContain(res.status);
  });

  it("GET /api/products/search should return results", async () => {
    mockDbService.getAllProducts.mockResolvedValue([
      { id: "p1", name: "Product 1", price: 1000, costPrice: 500, features: [], images: [], stock: 10 },
    ]);

    const res = await request(app)
      .get("/api/products/search?q=test")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("API Integration: Settings", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = createApp();
    await loadRoutes(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbService.getSettings.mockResolvedValue({
      storeName: "Test Store",
      geminiApiKey: "test-key",
      language: "ur",
      memoryConfig: { enabled: true },
      paymentConfig: null,
    });
    mockDbService.updateSettings.mockImplementation(async (adminId: string, data: any) => {
      return { ...data, storeName: "Test Store" };
    });
  });

  it("GET /api/settings should return settings", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("storeName");
    expect(res.body).toHaveProperty("language");
    expect(res.body).toHaveProperty("memoryConfig");
  });

  it("GET /api/settings should handle missing auth gracefully", async () => {
    const res = await request(app).get("/api/settings");
    expect([401, 500]).toContain(res.status);
  });

  it("POST /api/settings should update settings", async () => {
    mockDbService.getAdminPasswordHash.mockResolvedValue("$2b$12$testhash");

    const res = await request(app)
      .post("/api/settings")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ storeName: "Updated Store", language: "en" });

    expect(res.status).toBe(200);
  });
});
