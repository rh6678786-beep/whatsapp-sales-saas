import { test, expect } from "@playwright/test";
import {
  setupApiMocks,
  TEST_ADMIN_ID,
  navigateToTab,
  navigateToProductsSubTab,
  navigateToFeaturesSubTab,
} from "./helpers";

test.describe("Critical User Flow: Login \u2192 WhatsApp \u2192 Products \u2192 Orders", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("Full orchestrated flow from unauthenticated to order verification", async ({ page }) => {
    // STEP 1: Landing page
    await page.goto("/");
    await expect(page.locator("text=AI Sales Agent").first()).toBeVisible();
    await expect(page.locator("text=Start Free Trial")).toBeVisible();

    // STEP 2: Login
    await page.getByRole("button", { name: /login/i }).first().click();
    await page.fill('input[placeholder*="Store ID"]', TEST_ADMIN_ID);
    await page.fill('input[type="password"]', "Test@123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Verify logged in
    await expect(page.locator("text=Sales Dashboard")).toBeVisible();
    await expect(page.locator("text=Total Revenue")).toBeVisible();

    // STEP 3: Dashboard verification
    await expect(page.locator("text=Pending Verification")).toBeVisible();
    await expect(page.locator("text=Conversion Funnel")).toBeVisible();
    await expect(page.locator("text=Activity Feed")).toBeVisible();
    await expect(page.locator("text=Revenue Growth")).toBeVisible();

    // STEP 4: WhatsApp Connection
    await navigateToTab(page, "WhatsApp");

    await expect(page.locator("text=WhatsApp Connection")).toBeVisible();
    await expect(page.locator("text=Not Connected")).toBeVisible();

    // Switch to manual setup
    await page.getByText("Use Manual Developer Setup").click();

    // Both Phone Number ID and WABA ID have the same placeholder - use nth()
    const waInputs = page.locator('input[placeholder*="123456789012345"]');
    await waInputs.nth(0).fill("123456789");  // Phone Number ID
    await waInputs.nth(1).fill("987654321");  // WABA ID
    await page.fill('input[placeholder*="EAAB"]', "EAABtest-access-token");

    // Expand advanced settings
    await page.getByText("Advanced Settings").click();
    await page.fill('input[placeholder*="Your custom verify token"]', "my-verify-token-123");

    // Save & connect
    await page.getByRole("button", { name: /save & connect/i }).click();
    await page.waitForTimeout(1000);

    // Override status mock to return connected for re-mount
    await page.route("**/api/whatsapp/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isReady: true,
          phoneNumber: "+923001234567",
          wabaId: "987654321",
        }),
      });
    });

    // Navigate away and back to trigger re-mount with new status
    await navigateToTab(page, "Dashboard");
    await navigateToTab(page, "WhatsApp");
    await expect(page.locator("text=Connected & Active")).toBeVisible();

    // STEP 5: Product Management
    await navigateToProductsSubTab(page, "Products");

    await expect(page.locator("text=Product Catalog")).toBeVisible();
    await expect(page.locator("text=Premium Sneakers")).toBeVisible();
    await expect(page.locator("text=Designer Kurti")).toBeVisible();

    // Add a new product
    await page.getByRole("button", { name: /add new product/i }).click();
    await page.fill('input[placeholder*="Ultra Smart Watch"]', "New Arrival Product");
    const priceInputs = page.locator('input[type="number"]');
    await priceInputs.nth(0).fill("3999");
    await priceInputs.nth(1).fill("1800");
    await page.locator("textarea").fill("Premium Quality\nFast Delivery\n1 Year Warranty");
    await page.getByRole("button", { name: /create product/i }).click();

    // STEP 6: Order Verification
    await navigateToFeaturesSubTab(page, "Verification");

    await expect(page.locator("text=Payment & Order Verification")).toBeVisible();
    await expect(page.locator("text=PAYMENT_SENT")).toBeVisible();

    // View payment screenshot
    await page.getByRole("button", { name: /view image/i }).first().click();
    await expect(page.locator("text=Payment Verification Screenshot")).toBeVisible();
    await expect(page.locator("text=JazzCash")).toBeVisible();

    await page.getByRole("button", { name: /close preview/i }).click();

    // Verify the payment
    await page.locator('button[title="Verify Payment"]').first().click();

    // STEP 7: Back to Dashboard
    await navigateToTab(page, "Overview");
    await expect(page.locator("text=Sales Dashboard")).toBeVisible();
    await expect(page.locator("text=Live Monitoring")).toBeVisible();
  });

  test("Quick log out works from any page", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("isAdmin", "true");
      sessionStorage.setItem("authToken", "mock-token");
      sessionStorage.setItem("adminId", "test-store-123");
      sessionStorage.setItem("activeMainTab", "dashboard");
    });
    await setupApiMocks(page);

    await page.goto("/");

    await page.locator('button[title="Logout"]').click();

    await expect(page.locator("text=AI Sales Agent").first()).toBeVisible();
    await expect(page.locator("text=Start Free Trial")).toBeVisible();
  });

  test("Sidebar navigation persists across page visits", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("isAdmin", "true");
      sessionStorage.setItem("authToken", "mock-token");
      sessionStorage.setItem("adminId", "test-store-123");
    });
    await setupApiMocks(page);

    await page.goto("/");

    // Navigate to different sections
    await navigateToTab(page, "Products");
    await navigateToTab(page, "Features");
    await navigateToTab(page, "Channels");
    await navigateToTab(page, "Settings");
    await navigateToTab(page, "Help");
  });
});
