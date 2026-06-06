import { Page } from "@playwright/test";

// ============================
// Mock Data
// ============================

export const TEST_ADMIN_ID = "test-store-123";
export const TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXN0b3JlLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.test-token";
export const TEST_STORE_NAME = "Test Store";

/**
 * Example product used across tests.
 */
export const MOCK_PRODUCT = {
  id: "prod-1",
  name: "Premium Sneakers",
  price: 4499,
  costPrice: 2500,
  images: [],
  videos: [],
  features: ["High Quality", "Waterproof", "Durable"],
  stock: 10,
  createdAt: new Date().toISOString(),
};

export const MOCK_PRODUCTS = [
  MOCK_PRODUCT,
  {
    id: "prod-2",
    name: "Designer Kurti",
    price: 2999,
    costPrice: 1200,
    images: [],
    videos: [],
    features: ["Premium Fabric", "Hand Embroidered"],
    stock: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod-3",
    name: "Smart Watch",
    price: 6499,
    costPrice: 3500,
    images: ["https://example.com/watch.jpg"],
    videos: [],
    features: ["Heart Rate Monitor", "GPS", "7-Day Battery"],
    stock: 0,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Mock session data for order verification flow.
 */
export const MOCK_SESSIONS = [
  {
    id: "user-001",
    userId: "user-001",
    adminId: TEST_ADMIN_ID,
    state: "PAYMENT_SENT",
    isBlocked: false,
    lastMessageAt: new Date().toISOString(),
    selectedProductId: "prod-1",
    metadata: {
      paymentScreenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      customerName: "Ahmed Ali",
      negotiationState: {
        currentOfferedPrice: 4499,
        shippingAddress: "Lahore, Pakistan",
      },
    },
  },
  {
    id: "user-002",
    userId: "user-002",
    adminId: TEST_ADMIN_ID,
    state: "PAYMENT_AWAITING",
    isBlocked: false,
    lastMessageAt: new Date().toISOString(),
    selectedProductId: "prod-2",
    metadata: {
      customerName: "Sana Khan",
      negotiationState: {
        currentOfferedPrice: 2999,
      },
    },
  },
  {
    id: "user-003",
    userId: "user-003",
    adminId: TEST_ADMIN_ID,
    state: "VERIFIED",
    isBlocked: false,
    lastMessageAt: new Date().toISOString(),
    selectedProductId: "prod-3",
    metadata: {
      customerName: "Usman R.",
      negotiationState: {
        currentOfferedPrice: 6499,
      },
    },
  },
];

/**
 * Dashboard stats mock data.
 */
export const MOCK_DASHBOARD_STATS = {
  activeUsers: 12,
  totalOrders: 45,
  pendingPayments: 3,
  totalSales: 249000,
  totalProfit: 124500,
  todayProfit: 15000,
  stats: {
    today: { count: 5, value: 24000 },
    week: { count: 28, value: 145000 },
    month: { count: 112, value: 580000 },
    year: { count: 450, value: 2490000 },
  },
};

// ============================
// API Mock Setup
// ============================

/**
 * Set up API route mocks so the frontend works without a real backend.
 * Call this in each test's beforeEach hook.
 */
export async function setupApiMocks(page: Page) {
  // === Auth Routes ===
  await page.route("**/api/auth/login", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.adminId === TEST_ADMIN_ID && body.password === "Test@123") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          token: TEST_TOKEN,
          adminId: TEST_ADMIN_ID,
          storeName: TEST_STORE_NAME,
        }),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid credentials" }),
      });
    }
  });

  // === Settings Route ===
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          storeName: TEST_STORE_NAME,
          businessLogo: "",
          onboardingComplete: true,
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
  });

  // === WhatsApp Routes ===
  await page.route("**/api/whatsapp/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isReady: false }),
    });
  });

  await page.route("**/api/whatsapp/configure", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Credentials saved" }),
    });
  });

  await page.route("**/api/whatsapp/test", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/whatsapp/logout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/whatsapp/config", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }
  });

  // === Products Routes ===
  await page.route("**/api/products?*", async (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get("search") || "";
    let filtered = MOCK_PRODUCTS;
    if (search) {
      filtered = MOCK_PRODUCTS.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: filtered,
        pagination: {
          page: 1,
          pageSize: 20,
          total: filtered.length,
          totalPages: 1,
        },
      }),
    });
  });

  await page.route("**/api/products", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: MOCK_PRODUCTS,
          pagination: { page: 1, pageSize: 20, total: MOCK_PRODUCTS.length, totalPages: 1 },
        }),
      });
    } else if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: `prod-${Date.now()}`,
          ...body,
          createdAt: new Date().toISOString(),
        }),
      });
    }
  });

  await page.route("**/api/products/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_PRODUCTS),
    });
  });

  await page.route("**/api/products/batch", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, deleted: 1 }),
    });
  });

  await page.route("**/api/products/*", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, deletedAt: Date.now() }),
      });
    }
  });

  // === Orders Routes ===
  await page.route("**/api/orders?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }),
    });
  });

  await page.route("**/api/orders/*/tracking", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // === Sessions Routes ===
  await page.route("**/api/sessions?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: MOCK_SESSIONS,
        pagination: { page: 1, pageSize: 20, total: MOCK_SESSIONS.length, totalPages: 1 },
      }),
    });
  });

  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: MOCK_SESSIONS,
        pagination: { page: 1, pageSize: 20, total: MOCK_SESSIONS.length, totalPages: 1 },
      }),
    });
  });

  await page.route("**/api/sessions/*/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { role: "user", content: "Hi, I want to buy sneakers", timestamp: new Date().toISOString() },
        { role: "assistant", content: "Sure! We have Premium Sneakers at Rs. 4,499", timestamp: new Date().toISOString() },
      ]),
    });
  });

  await page.route("**/api/sessions/*", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }
  });

  await page.route("**/api/sessions/blocked", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], total: 0 }),
    });
  });

  // === Stats / Dashboard Routes ===
  await page.route("**/api/stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DASHBOARD_STATS),
    });
  });

  await page.route("**/api/analytics/funnel", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        funnel: [
          { state: "NEW", count: 120, dropOff: 0 },
          { state: "INTERESTED", count: 85, dropOff: 29 },
          { state: "PRODUCT_SELECTED", count: 60, dropOff: 29 },
          { state: "NEGOTIATING", count: 45, dropOff: 25 },
          { state: "PAYMENT_AWAITING", count: 30, dropOff: 33 },
          { state: "VERIFIED", count: 22, dropOff: 27 },
          { state: "ORDER_CONFIRMED", count: 18, dropOff: 18 },
        ],
        totalSessions: 120,
      }),
    });
  });

  await page.route("**/api/activity", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        activities: [
          { type: "order", description: "New order confirmed — Premium Sneakers", time: "2 min ago", icon: "🛒", color: "emerald" },
          { type: "message", description: "Customer asked about delivery timeline", time: "5 min ago", icon: "💬", color: "blue" },
          { type: "payment", description: "Payment screenshot received from user-001", time: "8 min ago", icon: "📸", color: "amber" },
        ],
        summary: { sessionsToday: 24, ordersToday: 7 },
      }),
    });
  });

  // === Broadcast Route ===
  await page.route("**/api/broadcast", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Broadcast sent to 5/10 customers", sent: 5, total: 10 }),
    });
  });

  // === Campaigns Routes ===
  await page.route("**/api/campaigns", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    } else if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "camp-1", ...JSON.parse(route.request().postData() || "{}") }),
      });
    }
  });

  await page.route("**/api/campaigns/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // === Upload Route ===
  await page.route("**/api/upload", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ urls: ["https://example.com/uploaded.jpg"] }),
    });
  });

  // === Catch-all: prevent any unmocked API requests from reaching the server (rate limiter) ===
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // === Payment Screenshot Analysis ===
  await page.route("**/api/payment/analyze-screenshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2025-06-04",
        amount: "4,499",
        method: "JazzCash",
        sender: "Ahmed Ali",
        notes: "Payment confirmed",
      }),
    });
  });

  // === Deals Route ===
  await page.route("**/api/deals", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/deals/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // === Re-engagement Route ===
  await page.route("**/api/re-engage", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, sent: 3, total: 5 }),
    });
  });
}

// ============================
// Auth Helpers
// ============================

/**
 * Simulate a logged-in state by setting sessionStorage before navigation.
 */
export async function setLoggedInState(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("isAdmin", "true");
    sessionStorage.setItem("authToken", "mock-token");
    sessionStorage.setItem("adminId", "test-store-123");
    sessionStorage.setItem("activeMainTab", "dashboard");
  });
}

/**
 * Perform a real login flow through the UI (fill form, submit).
 */
export async function performLogin(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /login/i }).first().click();
  await page.waitForTimeout(500);
  // The login form is in the Signin component rendered via showLogin state
  await page.fill('input[placeholder*="Store ID"]', TEST_ADMIN_ID);
  await page.fill('input[type="password"]', "Test@123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(1000);
}

// ============================
// Navigation Helpers
// ============================

/**
 * Navigate to a specific tab by clicking its sidebar button.
 */
export async function navigateToTab(page: Page, tabLabel: string) {
  await page.getByRole("button", { name: new RegExp(tabLabel, "i") }).first().click();
  await page.waitForTimeout(500);
}

/**
 * Navigate to WhatsApp sub-tab (Connection or Live Chat).
 */
export async function navigateToWhatsAppSubTab(page: Page, subTab: "Connection" | "Live Chat") {
  // First ensure we're on the WhatsApp section
  await navigateToTab(page, "WhatsApp");
  // Click the sub-tab
  await page.getByRole("button", { name: new RegExp(subTab, "i") }).click();
  await page.waitForTimeout(500);
}

/**
 * Navigate to Products sub-tab (Products or Deals).
 */
export async function navigateToProductsSubTab(page: Page, subTab: "Products" | "Deals") {
  await navigateToTab(page, "Products");
  // Click the sub-tab — use first() to avoid matching both sidebar main tab and sub-tab
  await page.getByRole("button", { name: new RegExp(subTab, "i") }).first().click();
  await page.waitForTimeout(500);
}

/**
 * Navigate to Features sub-tab.
 */
export async function navigateToFeaturesSubTab(page: Page, subTab: "Broadcast" | "Re-Engage" | "AI Publisher" | "Simulator" | "Verification") {
  await navigateToTab(page, "Features");
  await page.getByRole("button", { name: new RegExp(subTab, "i") }).click();
  await page.waitForTimeout(500);
}
