import { PrismaClient } from "../../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import { env } from "../lib/env.js";
import { createChildLogger } from "../lib/logger.js";
import { getRedis, isRedisConnected } from "../lib/redis.js";
import { encrypt, decrypt, isEncrypted } from "../lib/encryption.js";

const log = createChildLogger("db");

// Connection configuration
const DATABASE_URL = env.DATABASE_URL;
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || "10", 10);

// SSL configuration — use env setting, never silently disable
const sslConfig = env.DB_SSL_REJECT_UNAUTHORIZED
  ? { rejectUnauthorized: true }
  : false;

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: sslConfig,
  max: POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("connect", () => log.info("PostgreSQL pool connected"));
pool.on("error", (err) => log.warn({ err }, "PostgreSQL pool error (non-fatal)"));
pool.on("remove", () => { /* pool client removed */ });

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

async function dbNow(): Promise<Date> {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
  return rows[0].now;
}

// Keep-alive to prevent idle connection termination
const keepAliveInterval = setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    log.warn({ err }, "Keep-alive ping failed");
  }
}, 60000);

// Cleanup on process exit
process.on("SIGTERM", () => {
  clearInterval(keepAliveInterval);
  pool.end();
});
process.on("SIGINT", () => {
  clearInterval(keepAliveInterval);
  pool.end();
});

// ---- Error classification ----

function isConnectionError(e: unknown): boolean {
  const msg = ((e as any)?.message || "").toLowerCase();
  const code = (e as any)?.code || "";
  return (
    msg.includes("connection terminated") ||
    msg.includes("connection refused") ||
    msg.includes("connection reset") ||
    msg.includes("connection closed") ||
    msg.includes("eof") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("socket closed") ||
    msg.includes("client has encountered a connection error") ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "08000" ||
    code === "08001" ||
    code === "08003" ||
    code === "08004" ||
    code === "08006"
  );
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const isLast = i === retries - 1;
      const isConnErr = isConnectionError(e);
      if (!isConnErr || isLast) throw e;
      const delayMs = 1000 * (i + 1);
      log.warn({ attempt: i + 1, retries, err: (e as Error).message }, "DB connection error, retrying");
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Unreachable");
}

// ---- Redis cache helpers ----

async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisConnected()) return null;
  try {
    const redis = getRedis()!;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    const redis = getRedis()!;
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Non-critical
  }
}

async function cacheDel(key: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    const redis = getRedis()!;
    await redis.del(key);
  } catch {
    // Non-critical
  }
}

function cacheKey(prefix: string, ...parts: string[]): string {
  return `db:${prefix}:${parts.join(":")}`;
}

// ---- Data mappers (unchanged from original) ----

import { Session, Message, Product, Order, Deal, SalesState, DripCampaign, SessionMetadata } from "../../src/types";
import type { Prisma } from "../../generated/client";

type PrismaSession = Prisma.SessionGetPayload<{}>;
type PrismaMessage = Prisma.MessageGetPayload<{}>;
type PrismaOrder = Prisma.OrderGetPayload<{}>;

function toSession(record: PrismaSession): Session {
  return {
    id: record.id,
    userId: record.userId,
    state: record.state as SalesState,
    selectedProductId: record.selectedProductId ?? undefined,
    lastMessageAt: record.lastMessageAt instanceof Date ? record.lastMessageAt.toISOString() : record.lastMessageAt,
    remindersCount: record.remindersCount,
    lastReminderAt: record.lastReminderAt instanceof Date ? record.lastReminderAt.toISOString() : record.lastReminderAt ?? undefined,
    isBlocked: record.isBlocked ?? undefined,
    metadata: (record.metadata as SessionMetadata) ?? undefined,
  };
}

function toMessage(record: PrismaMessage): Message {
  return {
    id: record.id,
    sessionId: record.sessionId,
    role: record.role as "user" | "model" | "human",
    text: record.text,
    timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp,
    imageUrl: record.imageUrl ?? undefined,
    videoUrl: record.videoUrl ?? undefined,
  };
}

function toOrder(record: PrismaOrder): Order {
  return {
    id: record.id,
    userId: record.userId,
    productId: record.productId,
    status: record.status as "VERIFIED" | "DELIVERED" | "PENDING" | "REJECTED" | "SHIPPED",
    paymentScreenshotUrl: record.paymentScreenshotUrl ?? undefined,
    shippingAddress: record.shippingAddress ?? undefined,
    customerName: record.customerName ?? undefined,
    customerPhone: record.customerPhone ?? undefined,
    amount: record.amount,
    costPrice: record.costPrice,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    trackingId: record.trackingId ?? undefined,
    courier: record.courier ?? undefined,
  };
}

const SETTINGS_FIELDS = [
  "geminiApiKey", "geminiModel", "storeName", "jazzCashNumber",
  "advanceAmount", "businessLogo", "email", "phone", "address",
  "onboardingComplete", "notificationEmail", "smtpHost", "smtpPort",
  "smtpUser", "smtpPass", "emailReportsEnabled", "language",
  "verifiedEmail",
] as const;

// Sensitive fields that should be encrypted at rest
const ENCRYPTED_FIELDS = ["geminiApiKey", "smtpPass"] as const;

const SETTINGS_JSON_FIELDS = [
  "paymentConfig", "reEngagement", "facebook", "instagram",
  "telegram", "subscription", "aiLearningPatterns", "memoryConfig",
  "proactiveConfig", "teamMembers",
] as const;

const defaultSettings = {
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash",
  storeName: "SalesForce AI",
  jazzCashNumber: "0300-1234567",
  advanceAmount: 300,
  businessLogo: "",
  email: "",
  phone: "",
  address: "",
  onboardingComplete: true,
  language: "ur",
  reEngagement: null,
  facebook: null,
  instagram: null,
  telegram: null,
  notificationEmail: "",
  paymentConfig: null,
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
  emailReportsEnabled: true,
  subscription: null,
  aiLearningPatterns: null,
  memoryConfig: { enabled: true, summarizationThreshold: 20, embeddingEnabled: true },
  proactiveConfig: {
    enabled: false,
    maxPerDay: 5,
    maxPerRun: 50,
    quietStartHour: 21,
    quietEndHour: 9,
    abandonedCart: { enabled: true, hours: 24 },
    reEngagement: { enabled: true, inactiveDays: 7 },
    priceDrop: { enabled: true },
    birthday: { enabled: true },
  },
};

// ---- Encryption helpers for sensitive fields ----

/**
 * Encrypt sensitive fields in settings before storage
 */
function encryptSettings(settings: any): any {
  const encrypted = { ...settings };
  for (const field of ENCRYPTED_FIELDS) {
    if (encrypted[field] && typeof encrypted[field] === "string" && encrypted[field].length > 0) {
      try {
        // Skip if already encrypted
        if (!isEncrypted(encrypted[field])) {
          encrypted[field] = encrypt(encrypted[field]);
        }
      } catch (err) {
        log.warn({ err, field }, "Failed to encrypt sensitive field");
        // Don't fail - just keep as-is
      }
    }
  }
  return encrypted;
}

/**
 * Decrypt sensitive fields in settings after retrieval
 */
function decryptSettings(settings: any): any {
  const decrypted = { ...settings };
  for (const field of ENCRYPTED_FIELDS) {
    if (decrypted[field] && typeof decrypted[field] === "string") {
      try {
        // Check if it looks like encrypted data (hex:hex:hex format)
        if (isEncrypted(decrypted[field])) {
          decrypted[field] = decrypt(decrypted[field]);
        }
      } catch (err) {
        log.warn({ err, field }, "Failed to decrypt sensitive field - may not be encrypted");
        // Don't fail - return as-is (could be unencrypted old data)
      }
    }
  }
  return decrypted;
}

// ---- Exported service ----

export const dbService = {
  async getSettings(adminId: string) {
    const admin = await withRetry(() =>
      prisma.admin.findUnique({ where: { adminId } })
    );
    if (!admin) return { ...defaultSettings };
    const settings: any = { ...defaultSettings };
    for (const field of SETTINGS_FIELDS) {
      const val = (admin as any)[field];
      settings[field] = val ?? (defaultSettings as any)[field];
    }
    for (const field of SETTINGS_JSON_FIELDS) {
      settings[field] = (admin as any)[field] ?? null;
    }
    // Decrypt sensitive fields before returning
    return decryptSettings(settings);
  },

  async updateSettings(adminId: string, newSettings: any) {
    // Encrypt sensitive fields before storing
    const toStore = encryptSettings(newSettings);
    
    const scalar: any = {};
    const json: any = {};
    for (const [key, value] of Object.entries(toStore)) {
      if ((SETTINGS_FIELDS as readonly string[]).includes(key)) {
        scalar[key] = value;
      } else {
        json[key] = value;
      }
    }
    await withRetry(() =>
      prisma.admin.upsert({
        where: { adminId },
        create: { adminId, ...scalar, ...json },
        update: { ...scalar, ...json },
      })
    );
    await cacheDel(cacheKey("settings", adminId));
    return this.getSettings(adminId);
  },

  async getSession(adminId: string, userId: string): Promise<Session | null> {
    try {
      const record = await withRetry(() =>
        prisma.session.findUnique({
          where: { adminId_id: { adminId, id: userId } },
        })
      );
      return record ? toSession(record) : null;
    } catch {
      return null;
    }
  },

  async createSession(adminId: string, userId: string): Promise<Session> {
    const now = await dbNow();
    const session: any = {
      adminId,
      id: userId,
      userId,
      state: SalesState.NEW,
      lastMessageAt: now,
      remindersCount: 0,
      metadata: {
        leadScore: 0,
        leadStatus: "COLD",
        messageCount: 0,
        lastCustomerMessage: "",
        urgencyLevel: "Normal",
        customerPhone: userId.includes(":") ? userId.split(":")[1] : userId,
      },
    };
    await withRetry(() => prisma.session.create({ data: session }));
    return toSession(session);
  },

  async updateSession(adminId: string, userId: string, data: Partial<Session>) {
    const updateData: any = { ...data };
    // Only update lastMessageAt to now if state or metadata changed but no explicit lastMessageAt was provided
    if (!data.lastMessageAt && (data.state || data.metadata)) {
      updateData.lastMessageAt = await dbNow();
    }
    delete updateData.id;
    delete updateData.userId;
    if (updateData.lastReminderAt && typeof updateData.lastReminderAt === "string" && updateData.lastReminderAt.trim().length > 0) {
      updateData.lastReminderAt = new Date(updateData.lastReminderAt);
    } else if (updateData.lastReminderAt) {
      delete updateData.lastReminderAt;
    }
    await withRetry(() =>
      prisma.session.update({
        where: { adminId_id: { adminId, id: userId } },
        data: updateData,
      })
    );
  },

  async addMessage(adminId: string, sessionId: string, message: Message) {
    await withRetry(() =>
      prisma.message.create({
        data: {
          adminId,
          sessionId,
          role: message.role,
          text: message.text,
          timestamp: new Date(),
          imageUrl: message.imageUrl ?? null,
          videoUrl: message.videoUrl ?? null,
        },
      })
    );
  },

  async getMessages(adminId: string, sessionId: string): Promise<Message[]> {
    const records = await withRetry(() =>
      prisma.message.findMany({
        where: { adminId, sessionId },
        orderBy: { timestamp: "asc" },
      })
    );
    return records.map(toMessage);
  },

  async getProductCount(adminId: string): Promise<number> {
    return withRetry(() => prisma.product.count({ where: { adminId, deleted: false } }));
  },

  async getAllProducts(adminId: string): Promise<Product[]> {
    const ck = cacheKey("products", adminId);
    const cached = await cacheGet<Product[]>(ck);
    if (cached) return cached;

    try {
      const records = await withRetry(() =>
        prisma.product.findMany({ where: { adminId, deleted: false } })
      );
      const result = records.map((r: any) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        costPrice: r.costPrice,
        features: r.features,
        images: r.images,
        videos: r.videos,
        stock: r.stock ?? 10,
      }));
      await cacheSet(ck, result, 30);
      log.info({ adminId, count: result.length }, "Fetched products");
      return result;
    } catch (err: any) {
      log.error({ err, adminId }, "getAllProducts error");
      return [];
    }
  },

  async getProductsPaginated(adminId: string, page: number, limit: number): Promise<{ products: Product[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [records, total] = await withRetry(() =>
      Promise.all([
        prisma.product.findMany({
          where: { adminId, deleted: false },
          skip,
          take: limit,
          orderBy: { id: "asc" },
        }),
        prisma.product.count({ where: { adminId, deleted: false } }),
      ])
    );
    return {
      products: records.map((r: any) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        costPrice: r.costPrice,
        features: r.features,
        images: r.images,
        videos: r.videos,
        stock: r.stock ?? 10,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async addProduct(adminId: string, product: Omit<Product, "id">): Promise<Product> {
    const record = await withRetry(() =>
      prisma.product.create({
        data: {
          adminId,
          name: product.name,
          price: product.price,
          costPrice: product.costPrice,
          features: product.features || [],
          images: product.images || [],
          videos: product.videos || [],
          stock: (product as any).stock ?? 10,
        },
      })
    );
    await cacheDel(cacheKey("products", adminId));
    return { id: record.id, ...product, stock: (product as any).stock ?? 10 };
  },

  async updateProduct(adminId: string, id: string, data: Partial<Product>) {
    await withRetry(() =>
      prisma.product.updateMany({
        where: { id, adminId },
        data,
      })
    );
    await cacheDel(cacheKey("products", adminId));
  },

  async softDeleteProduct(adminId: string, id: string) {
    await withRetry(() =>
      prisma.product.updateMany({
        where: { id, adminId },
        data: { deleted: true, deletedAt: new Date() },
      })
    );
    await cacheDel(cacheKey("products", adminId));
  },

  async restoreProduct(adminId: string, id: string) {
    await withRetry(() =>
      prisma.product.updateMany({
        where: { id, adminId },
        data: { deleted: false, deletedAt: null },
      })
    );
    await cacheDel(cacheKey("products", adminId));
  },

  async permanentDeleteProduct(adminId: string, id: string) {
    await withRetry(() =>
      prisma.product.deleteMany({
        where: { id, adminId },
      })
    );
    await cacheDel(cacheKey("products", adminId));
  },

  async getAllDeals(adminId: string): Promise<Deal[]> {
    const records = await withRetry(() =>
      prisma.deal.findMany({
        where: { adminId, deleted: false },
        orderBy: { createdAt: "desc" },
      })
    );
    return records.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      productIds: r.productIds,
      discountPrice: r.discountPrice,
      image: r.image,
      startDate: r.startDate instanceof Date ? r.startDate.toISOString() : r.startDate,
      endDate: r.endDate instanceof Date ? r.endDate.toISOString() : r.endDate,
      isActive: r.isActive,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }));
  },

  async addDeal(adminId: string, deal: Omit<Deal, "id" | "createdAt">): Promise<Deal> {
    const record = await withRetry(() =>
      prisma.deal.create({
        data: {
          adminId,
          title: deal.title,
          description: deal.description || "",
          productIds: deal.productIds || [],
          discountPrice: deal.discountPrice ?? null,
          image: deal.image || "",
          startDate: deal.startDate ? new Date(deal.startDate) : null,
          endDate: deal.endDate ? new Date(deal.endDate) : null,
          isActive: deal.isActive ?? true,
        },
      })
    );
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      productIds: record.productIds,
      discountPrice: record.discountPrice,
      image: record.image,
      startDate: record.startDate instanceof Date ? record.startDate.toISOString() : record.startDate,
      endDate: record.endDate instanceof Date ? record.endDate.toISOString() : record.endDate,
      isActive: record.isActive,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    };
  },

  async updateDeal(adminId: string, id: string, data: Partial<Deal>) {
    const updateData: any = { ...data };
    const hasStart = data.hasOwnProperty('startDate');
    const hasEnd = data.hasOwnProperty('endDate');
    if (hasStart && data.startDate) updateData.startDate = new Date(data.startDate);
    if (hasStart && !data.startDate) updateData.startDate = null;
    if (hasEnd && data.endDate) updateData.endDate = new Date(data.endDate);
    if (hasEnd && !data.endDate) updateData.endDate = null;
    if (data.hasOwnProperty('createdAt')) delete updateData.createdAt;
    if (data.hasOwnProperty('id')) delete updateData.id;
    await withRetry(() =>
      prisma.deal.updateMany({
        where: { id, adminId },
        data: updateData,
      })
    );
  },

  async softDeleteDeal(adminId: string, id: string) {
    await withRetry(() =>
      prisma.deal.updateMany({
        where: { id, adminId },
        data: { deleted: true, deletedAt: new Date() },
      })
    );
  },

  async restoreDeal(adminId: string, id: string) {
    await withRetry(() =>
      prisma.deal.updateMany({
        where: { id, adminId },
        data: { deleted: false, deletedAt: null },
      })
    );
  },

  async permanentDeleteDeal(adminId: string, id: string) {
    await withRetry(() =>
      prisma.deal.deleteMany({
        where: { id, adminId },
      })
    );
  },

  async getOrdersPaginated(adminId: string, page: number, pageSize: number): Promise<{ orders: Order[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const [records, total] = await withRetry(() =>
      Promise.all([
        prisma.order.findMany({
          where: { adminId },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.order.count({ where: { adminId } }),
      ])
    );
    return { orders: records.map(toOrder), total };
  },

  async getMessagesPaginated(adminId: string, sessionId: string, page: number, pageSize: number): Promise<{ messages: Message[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const [records, total] = await withRetry(() =>
      Promise.all([
        prisma.message.findMany({
          where: { adminId, sessionId },
          orderBy: { timestamp: "asc" },
          skip,
          take: pageSize,
        }),
        prisma.message.count({ where: { adminId, sessionId } }),
      ])
    );
    return { messages: records.map(toMessage), total };
  },

  async getAllOrders(adminId: string): Promise<Order[]> {
    const records = await withRetry(() =>
      prisma.order.findMany({ where: { adminId } })
    );
    return records.map(toOrder);
  },

  async getTodayOrders(adminId: string): Promise<Order[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const records = await withRetry(() =>
      prisma.order.findMany({
        where: { adminId, createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
      })
    );
    return records.map(toOrder);
  },

  async createOrder(adminId: string, order: Order) {
    await withRetry(() =>
      prisma.order.upsert({
        where: { adminId_id: { adminId, id: order.id } },
        create: {
          adminId,
          id: order.id,
          userId: order.userId,
          productId: order.productId,
          status: order.status,
          amount: order.amount,
          costPrice: order.costPrice,
          paymentScreenshotUrl: order.paymentScreenshotUrl ?? null,
          shippingAddress: order.shippingAddress ?? null,
          customerName: order.customerName ?? null,
          customerPhone: order.customerPhone ?? null,
          trackingId: order.trackingId ?? null,
          courier: order.courier ?? null,
          createdAt: new Date(),
        },
        update: {
          userId: order.userId,
          productId: order.productId,
          status: order.status,
          amount: order.amount,
          costPrice: order.costPrice,
          paymentScreenshotUrl: order.paymentScreenshotUrl ?? null,
          shippingAddress: order.shippingAddress ?? null,
          customerName: order.customerName ?? null,
          customerPhone: order.customerPhone ?? null,
          trackingId: order.trackingId ?? null,
          courier: order.courier ?? null,
        },
      })
    );
  },

  async getStats(adminId: string) {
    const [confirmedCount, pendingCount, activeUserCount, productCount, recentSessions] = await withRetry(() =>
      Promise.all([
        prisma.session.count({ where: { adminId, state: { in: [SalesState.ORDER_CONFIRMED, SalesState.DELIVERED] } } }),
        prisma.session.count({ where: { adminId, state: { in: [SalesState.PAYMENT_SENT, SalesState.PAYMENT_AWAITING] } } }),
        prisma.session.count({ where: { adminId, isBlocked: false } }),
        prisma.product.count({ where: { adminId } }),
        prisma.session.findMany({
          where: { adminId, state: { in: [SalesState.ORDER_CONFIRMED, SalesState.DELIVERED] } },
          select: { selectedProductId: true, metadata: true },
          take: 200,
          orderBy: { lastMessageAt: 'desc' },
        }),
      ])
    );

    const productIds = [...new Set(recentSessions.map(s => s.selectedProductId).filter(Boolean))] as string[];
    const products = productIds.length > 0
      ? await withRetry(() => prisma.product.findMany({ where: { id: { in: productIds }, adminId }, select: { id: true, price: true, costPrice: true } }))
      : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    let totalSales = 0;
    let totalProfit = 0;

    for (const s of recentSessions) {
      const p = s.selectedProductId ? productMap.get(s.selectedProductId) : null;
      const meta = s.metadata as any;
      const negotiated = meta?.negotiationState?.currentOfferedPrice;
      const price = negotiated ?? p?.price;
      if (price == null) continue;
      const cost = p?.costPrice ?? 0;
      totalSales += price;
      totalProfit += price - cost;
    }

    const daysInMonth = new Date(Date.now()).getDate();
    return {
      activeUsers: activeUserCount,
      productCount,
      totalOrders: confirmedCount,
      pendingPayments: pendingCount,
      totalSales,
      totalProfit,
      todayProfit: daysInMonth > 0 ? Math.round(totalProfit / daysInMonth) : 0,
      stats: {
        today: { count: daysInMonth > 0 ? Math.round(confirmedCount / daysInMonth) || (confirmedCount > 0 ? 1 : 0) : 0, value: daysInMonth > 0 ? Math.round(totalSales / daysInMonth) : 0 },
        week: { count: Math.ceil(confirmedCount / 4) || 0, value: Math.ceil(totalSales / 4) || 0 },
        month: { count: confirmedCount, value: totalSales },
        year: { count: confirmedCount * 12, value: totalSales * 12 },
      },
    };
  },

  async getSessionsPaginated(adminId: string, page: number, pageSize: number, state?: string): Promise<{ sessions: Session[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const where: any = { adminId };
    if (state) {
      where.state = state;
    }
    const [records, total] = await withRetry(() =>
      Promise.all([
        prisma.session.findMany({
          where,
          orderBy: { lastMessageAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.session.count({ where }),
      ])
    );
    return { sessions: records.map(toSession), total };
  },

  async getRecentSessions(adminId: string, limit: number): Promise<Session[]> {
    const records = await withRetry(() =>
      prisma.session.findMany({
        where: { adminId },
        orderBy: { lastMessageAt: "desc" },
        take: limit,
      })
    );
    return records.map(toSession);
  },

  async getInactiveSessions(adminId: string, inactiveDays: number): Promise<Session[]> {
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
    const records = await withRetry(() =>
      prisma.session.findMany({
        where: {
          adminId,
          lastMessageAt: { lt: cutoff },
          state: { notIn: [SalesState.DELIVERED, SalesState.ORDER_CONFIRMED] },
          isBlocked: false,
        },
      })
    );
    return records.map(toSession);
  },

  async getSessionsByState(adminId: string, states: SalesState[], excludeBlocked = true): Promise<Session[]> {
    try {
      const records = await withRetry(() =>
        prisma.session.findMany({
          where: {
            adminId,
            state: { in: states },
            ...(excludeBlocked ? { isBlocked: false } : {}),
          },
          orderBy: { lastMessageAt: "desc" },
        })
      );
      return records.map(toSession);
    } catch { return []; }
  },

  async getCustomersWithBirthdays(adminId: string): Promise<Session[]> {
    try {
      const today = new Date();
      const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const result = await withRetry(() =>
        prisma.$queryRaw<PrismaSession[]>`
          SELECT * FROM "Session"
          WHERE "adminId" = ${adminId}
            AND "isBlocked" = false
            AND "metadata"->>'birthday' LIKE ${'%' + mmdd + '%'}
        `
      );
      return (result || []).map(toSession);
    } catch { return []; }
  },

  async getCustomerOrderedProductIds(adminId: string, userId: string): Promise<string[]> {
    try {
      const orders = await withRetry(() =>
        prisma.order.findMany({
          where: {
            adminId,
            userId,
            status: { in: ["VERIFIED", "DELIVERED"] },
          },
          select: { productId: true },
        })
      );
      return orders.map(o => o.productId);
    } catch { return []; }
  },

  async getSessionsForDripCampaign(adminId: string, trigger: string): Promise<Session[]> {
    const statesMap: Record<string, SalesState[]> = {
      abandoned_cart: [SalesState.PRODUCT_SELECTED, SalesState.NEGOTIATING],
      new_session: [SalesState.NEW],
      post_purchase: [SalesState.ORDER_CONFIRMED, SalesState.DELIVERED],
      manual: [],
    };
    const targetStates = statesMap[trigger] || [];
    if (targetStates.length === 0) return [];
    return this.getSessionsByState(adminId, targetStates);
  },

  async getCampaigns(adminId: string): Promise<DripCampaign[]> {
    try {
      const records = await withRetry(() =>
        prisma.dripCampaign.findMany({
          where: { adminId },
          orderBy: { createdAt: "desc" },
        })
      );
      return records.map((r: any) => ({
        id: r.id,
        name: r.name,
        trigger: r.trigger,
        enabled: r.enabled,
        steps: r.steps as any[],
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      }));
    } catch { return []; }
  },

  async addCampaign(adminId: string, data: Omit<DripCampaign, "id" | "createdAt">): Promise<DripCampaign> {
    const record = await withRetry(() =>
      prisma.dripCampaign.create({
        data: {
          adminId,
          name: data.name,
          trigger: data.trigger,
          enabled: data.enabled ?? true,
          steps: data.steps as any || [],
        },
      })
    );
    return {
      id: record.id,
      name: record.name,
      trigger: record.trigger as DripCampaign["trigger"],
      enabled: record.enabled,
      steps: record.steps as any[],
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    };
  },

  async updateCampaign(adminId: string, id: string, data: Partial<DripCampaign>) {
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.createdAt;
    await withRetry(() =>
      prisma.dripCampaign.updateMany({
        where: { id, adminId },
        data: updateData,
      })
    );
  },

  async deleteCampaign(adminId: string, id: string) {
    await withRetry(() =>
      prisma.dripCampaign.deleteMany({
        where: { id, adminId },
      })
    );
  },

  async getCrossSellProductIds(adminId: string, productId: string, limit = 3): Promise<string[]> {
    try {
      const result = await withRetry(() =>
        prisma.$queryRaw<Array<{ productId: string }>>`
          SELECT o2."productId", COUNT(*) as frequency
          FROM "Order" o1
          JOIN "Order" o2 ON o1."userId" = o2."userId" AND o1."productId" != o2."productId"
          WHERE o1."productId" = ${productId} AND o1."adminId" = ${adminId} AND o2."adminId" = ${adminId}
            AND o1."status" IN ('VERIFIED', 'DELIVERED')
          GROUP BY o2."productId"
          ORDER BY frequency DESC
          LIMIT ${limit}
        `
      );
      return result.map(r => r.productId);
    } catch { return []; }
  },

  async getDailyProactiveCount(adminId: string, userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    try {
      const result = await withRetry(() =>
        prisma.session.findUnique({
          where: { adminId_id: { adminId, id: userId } },
          select: { lastReminderAt: true, remindersCount: true },
        })
      );
      if (!result || !result.lastReminderAt) return 0;
      if (result.lastReminderAt >= todayStart) {
        return result.remindersCount || 0;
      }
      return 0;
    } catch { return 0; }
  },

  // AUTH: Admin Credential Storage
  async registerAdmin(adminId: string, passwordHash: string) {
    await withRetry(() =>
      prisma.admin.upsert({
        where: { adminId },
        create: { adminId, passwordHash },
        update: { passwordHash },
      })
    );
  },

  async getAdminPasswordHash(adminId: string): Promise<string | null> {
    try {
      const admin = await withRetry(() =>
        prisma.admin.findUnique({ where: { adminId } })
      );
      return admin?.passwordHash ?? null;
    } catch {
      return null;
    }
  },

  async getSubscription(adminId: string): Promise<any | null> {
    try {
      const admin = await withRetry(() =>
        prisma.admin.findUnique({ where: { adminId } })
      );
      return (admin as any)?.subscription ?? null;
    } catch {
      return null;
    }
  },

  async updateSubscription(adminId: string, subscription: any) {
    await withRetry(() =>
      prisma.admin.upsert({
        where: { adminId },
        create: { adminId, subscription },
        update: { subscription },
      })
    );
  },

  async getUsageCounts(adminId: string): Promise<{ sessionsThisMonth: number; broadcastsThisMonth: number; productCount: number }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    try {
      const [sessionCount, productCount] = await withRetry(() =>
        Promise.all([
          prisma.session.count({
            where: { adminId, lastMessageAt: { gte: startOfMonth } },
          }),
          prisma.product.count({ where: { adminId } }),
        ])
      );
      return { sessionsThisMonth: sessionCount, broadcastsThisMonth: 0, productCount };
    } catch {
      return { sessionsThisMonth: 0, broadcastsThisMonth: 0, productCount: 0 };
    }
  },

  async adminExistsByEmail(email: string): Promise<boolean> {
    try {
      const count = await withRetry(() =>
        prisma.admin.count({ where: { verifiedEmail: email } })
      );
      return count > 0;
    } catch {
      return false;
    }
  },

  async adminExists(adminId: string): Promise<boolean> {
    try {
      const count = await withRetry(() =>
        prisma.admin.count({ where: { adminId } })
      );
      return count > 0;
    } catch {
      return false;
    }
  },

  async findAdminByEmail(email: string): Promise<any | null> {
    try {
      return await withRetry(() =>
        prisma.admin.findFirst({ where: { verifiedEmail: email } })
      );
    } catch {
      return null;
    }
  },

  async storePasswordReset(adminId: string, tokenHash: string, expiresAt: Date) {
    try {
      // Create a temporary record - for production, add PasswordReset table to schema
      // For now, store in a Redis-like structure or add to schema
      const key = `password_reset:${tokenHash}`;
      const redis = getRedis();
      if (redis && isRedisConnected()) {
        await redis.set(key, JSON.stringify({ adminId, expiresAt }), 'EX', 3600);
      }
    } catch (err) {
      log.warn({ err }, "Failed to store password reset token");
    }
  },

  async getPasswordReset(tokenHash: string): Promise<{ adminId: string; expiresAt: Date } | null> {
    try {
      const key = `password_reset:${tokenHash}`;
      const redis = getRedis();
      if (redis && isRedisConnected()) {
        const data = await redis.get(key);
        if (data) {
          return JSON.parse(data);
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async deletePasswordReset(tokenHash: string) {
    try {
      const key = `password_reset:${tokenHash}`;
      const redis = getRedis();
      if (redis && isRedisConnected()) {
        await redis.del(key);
      }
    } catch (err) {
      log.warn({ err }, "Failed to delete password reset token");
    }
  },

  async saveOtp(email: string, otp: string, adminId: string, password: string, storeName: string | null, expiresAt: Date, phone?: string | null) {
    await withRetry(() =>
      prisma.otpStore.upsert({
        where: { email },
        create: { email, otp, adminId, password, storeName, phone, expiresAt },
        update: { otp, adminId, password, storeName, phone, expiresAt },
      })
    );
  },

  async getOtp(email: string) {
    try {
      return await withRetry(() => prisma.otpStore.findUnique({ where: { email } }));
    } catch {
      return null;
    }
  },

  async deleteOtp(email: string) {
    try {
      await withRetry(() => prisma.otpStore.delete({ where: { email } }));
    } catch {
      log.warn({ email }, "OTP deletion failed (may already be deleted)");
    }
  },

  async fixPhantomAdmins(): Promise<number> {
    return 0;
  },

  async getAllAdminIds(): Promise<string[]> {
    try {
      const admins = await withRetry(() =>
        prisma.admin.findMany({ select: { adminId: true } })
      );
      return admins.map(a => a.adminId);
    } catch {
      return [];
    }
  },

  // ---- AI Cost Tracking ----

  async logAiCost(adminId: string, model: string, inputTokens: number, outputTokens: number, cost: number) {
    await withRetry(() =>
      prisma.$executeRaw`INSERT INTO ai_cost_log (admin_id, model, input_tokens, output_tokens, cost) VALUES (${adminId}, ${model}, ${inputTokens}, ${outputTokens}, ${cost})`
    );
  },

  async getAdminDailyCost(adminId: string): Promise<number> {
    try {
      const result = await withRetry(() =>
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COALESCE(SUM(cost), 0) AS total
          FROM ai_cost_log
          WHERE admin_id = ${adminId} AND created_at >= date_trunc('day', NOW())
        `
      );
      return Number(result[0]?.total || 0);
    } catch {
      return 0;
    }
  },

  async getAdminMonthlyCost(adminId: string): Promise<number> {
    try {
      const result = await withRetry(() =>
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COALESCE(SUM(cost), 0) AS total
          FROM ai_cost_log
          WHERE admin_id = ${adminId} AND created_at >= date_trunc('month', NOW())
        `
      );
      return Number(result[0]?.total || 0);
    } catch {
      return 0;
    }
  },
};
