import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { Session, Message, Product, Order, Deal, SalesState, DripCampaign } from "../../src/types";

let connectionString = process.env.DATABASE_URL || "";
connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, "").replace(/[?&]$/, "");
// Use transaction mode (port 6543) instead of session mode (5432) to avoid
// PgBouncer connection slot exhaustion (pool_size: 15 limit)
connectionString = connectionString.replace(":5432", ":6543");
export const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" },
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});
pool.on("connect", () => console.log("[DB] PostgreSQL pool connected"));
pool.on("error", (err) => {
  console.warn("[DB] PostgreSQL pool error (non-fatal):", err.message);
});
pool.on("remove", () => {});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Keep-alive: ping Supabase every 60s to prevent idle connection termination
setInterval(async () => {
  try {
    await pool.query("SELECT 1");
  } catch (err: any) {
    console.warn("[DB] Keep-alive ping failed:", err.message);
  }
}, 60000);

function isConnectionError(e: any): boolean {
  const msg = (e?.message || "").toLowerCase();
  const code = e?.code || "";
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
    code === "57P01" ||   // admin_shutdown
    code === "57P02" ||   // crash_shutdown
    code === "57P03" ||   // cannot_connect_now
    code === "08000" ||   // connection_exception
    code === "08001" ||   // sqlclient_unable_to_establish_sqlconnection
    code === "08003" ||   // connection_does_not_exist
    code === "08004" ||   // sqlserver_rejected_establishment_of_sqlconnection
    code === "08006"     // connection_failure
  );
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isLast = i === retries - 1;
      const isConnErr = isConnectionError(e);
      if (!isConnErr || isLast) throw e;
      const delayMs = 1000 * (i + 1);
      console.warn(`[DB_RETRY] Connection error (attempt ${i + 1}/${retries}): ${e.message}. Reconnecting in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error("Unreachable");
}

const defaultSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY || "",
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

function toSession(record: any): Session {
  return {
    id: record.id,
    userId: record.userId,
    state: record.state as SalesState,
    selectedProductId: record.selectedProductId ?? undefined,
    lastMessageAt: record.lastMessageAt instanceof Date ? record.lastMessageAt.toISOString() : record.lastMessageAt,
    remindersCount: record.remindersCount,
    lastReminderAt: record.lastReminderAt instanceof Date ? record.lastReminderAt.toISOString() : record.lastReminderAt ?? undefined,
    isBlocked: record.isBlocked ?? undefined,
    metadata: record.metadata ?? undefined,
  };
}

function toMessage(record: any): Message {
  return {
    id: record.id,
    sessionId: record.sessionId,
    role: record.role,
    text: record.text,
    timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp,
    imageUrl: record.imageUrl ?? undefined,
    videoUrl: record.videoUrl ?? undefined,
  };
}

function toOrder(record: any): Order {
  return {
    id: record.id,
    userId: record.userId,
    productId: record.productId,
    status: record.status,
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

const SETTINGS_JSON_FIELDS = [
  "paymentConfig", "reEngagement", "facebook", "instagram",
  "telegram", "subscription", "aiLearningPatterns", "memoryConfig",
  "proactiveConfig", "teamMembers",
] as const;

// In-memory cache for products (valid for 1 second)
const productCache: Map<string, { data: Product[]; ts: number }> = new Map();

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
    return settings;
  },

  async updateSettings(adminId: string, newSettings: any) {
    const scalar: any = {};
    const json: any = {};
    for (const [key, value] of Object.entries(newSettings)) {
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
    const session: any = {
      adminId,
      id: userId,
      userId,
      state: SalesState.NEW,
      lastMessageAt: new Date(),
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
    if (data.lastMessageAt || data.state || data.metadata) {
      updateData.lastMessageAt = new Date();
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
    const cache = productCache.get(adminId);
    const now = Date.now();
    if (cache && now - cache.ts < 30000) {
      // Return cached data if fetched within the last second
      return cache.data;
    }
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
      // Store in cache
      productCache.set(adminId, { data: result, ts: now });
      console.log(`[DB][${adminId}] Fetched ${result.length} products`);
      return result;
    } catch (err: any) {
      console.error(`[DB][${adminId}] getAllProducts error:`, err.message);
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
    // Invalidate cache after insertion
    productCache.delete(adminId);
    return { id: record.id, ...product, stock: (product as any).stock ?? 10 };
  },

  async updateProduct(adminId: string, id: string, data: Partial<Product>) {
    await withRetry(() =>
      prisma.product.updateMany({
        where: { id, adminId },
        data,
      })
    );
    // Invalidate cache after update
    productCache.delete(adminId);
  },

  async softDeleteProduct(adminId: string, id: string) {
    await withRetry(() =>
      prisma.product.updateMany({
        where: { id, adminId },
        data: { deleted: true, deletedAt: new Date() },
      })
    );
    productCache.delete(adminId);
  },

  async restoreProduct(adminId: string, id: string) {
    await withRetry(() =>
      prisma.product.updateMany({
        where: { id, adminId },
        data: { deleted: false, deletedAt: null },
      })
    );
    productCache.delete(adminId);
  },

  async permanentDeleteProduct(adminId: string, id: string) {
    await withRetry(() =>
      prisma.product.deleteMany({
        where: { id, adminId },
      })
    );
    productCache.delete(adminId);
  },

  // ==========================================
  // DEAL CRUD
  // ==========================================
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
    const offset = (page - 1) * pageSize;
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "Order" WHERE "adminId" = $1`,
      [adminId]
    );
    const total = parseInt(countResult.rows[0].count, 10) || 0;
    const dataResult = await pool.query(
      `SELECT * FROM "Order" WHERE "adminId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`,
      [adminId, pageSize, offset]
    );
    return { orders: dataResult.rows.map(toOrder), total };
  },

  async getMessagesPaginated(adminId: string, sessionId: string, page: number, pageSize: number): Promise<{ messages: Message[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "Message" WHERE "adminId" = $1 AND "sessionId" = $2`,
      [adminId, sessionId]
    );
    const total = parseInt(countResult.rows[0].count, 10) || 0;
    const dataResult = await pool.query(
      `SELECT * FROM "Message" WHERE "adminId" = $1 AND "sessionId" = $2 ORDER BY "timestamp" ASC LIMIT $3 OFFSET $4`,
      [adminId, sessionId, pageSize, offset]
    );
    return { messages: dataResult.rows.map(toMessage), total };
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
      const price = meta?.negotiationState?.currentOfferedPrice ?? p?.price ?? 0;
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
    const offset = (page - 1) * pageSize;
    let whereClause = `"adminId" = $1`;
    const params: any[] = [adminId];
    if (state) {
      whereClause += ` AND "state" = $2`;
      params.push(state);
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "Session" WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10) || 0;
    params.push(pageSize, offset);
    const dataResult = await pool.query(
      `SELECT * FROM "Session" WHERE ${whereClause} ORDER BY "lastMessageAt" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { sessions: dataResult.rows.map(toSession), total };
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

  // ==========================================
  // PROACTIVE ENGINE HELPERS
  // ==========================================
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
      const result = await pool.query(
        `SELECT * FROM "Session" WHERE "adminId" = $1 AND "isBlocked" = false AND "metadata"->>'birthday' LIKE $2`,
        [adminId, `%${mmdd}%`]
      );
      return (result.rows || []).map(toSession);
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

  // ==========================================
  // DRIP CAMPAIGN CRUD
  // ==========================================
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

  // ==========================================
  // RECOMMENDATION HELPERS
  // ==========================================
  async getCrossSellProductIds(adminId: string, productId: string, limit = 3): Promise<string[]> {
    try {
      const result = await pool.query(
        `SELECT o2."productId", COUNT(*) as frequency
         FROM "Order" o1
         JOIN "Order" o2 ON o1."userId" = o2."userId" AND o1."productId" != o2."productId"
         WHERE o1."productId" = $1 AND o1."adminId" = $2 AND o2."adminId" = $2
           AND o1."status" IN ('VERIFIED', 'DELIVERED')
         GROUP BY o2."productId"
         ORDER BY frequency DESC
         LIMIT $3`,
        [productId, adminId, limit]
      );
      return result.rows.map(r => r.productId);
    } catch { return []; }
  },

  async getCustomerOrderedProductIds(adminId: string, userId: string): Promise<string[]> {
    try {
      const result = await pool.query(
        `SELECT "productId" FROM "Order" WHERE "adminId" = $1 AND "userId" = $2 AND "status" IN ('VERIFIED', 'DELIVERED')`,
        [adminId, userId]
      );
      return result.rows.map(r => r.productId);
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

  // ==========================================
  // AUTH: Admin Credential Storage
  // ==========================================
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

  // ==========================================
  // SUBSCRIPTION STORAGE
  // ==========================================
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

  // ==========================================
  // USAGE COUNTERS
  // ==========================================
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

  // ==========================================
  // OTP STORAGE (reuses the same PrismaClient)
  // ==========================================
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
    await withRetry(() => prisma.otpStore.delete({ where: { email } }).catch(() => {}));
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
};
