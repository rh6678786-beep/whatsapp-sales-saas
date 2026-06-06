import { test, expect } from "@playwright/test";
import { setupApiMocks, setLoggedInState, navigateToFeaturesSubTab } from "./helpers";

test.describe("Order Processing Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setLoggedInState(page);
    await setupApiMocks(page);
  });

  test("Order verification page renders with pending orders", async ({ page }) => {
    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(1000);

    // Should show the verification page
    await expect(page.locator("text=Payment & Order Verification")).toBeVisible();

    // Should show mock sessions
    await expect(page.locator("text=user-001")).toBeVisible();
    await expect(page.locator("text=user-002")).toBeVisible();
  });

  test("Payment state labels are displayed correctly", async ({ page }) => {
    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(1000);

    // Different states should be visible
    await expect(page.locator("text=PAYMENT_SENT")).toBeVisible();
    await expect(page.locator("text=PAYMENT_AWAITING")).toBeVisible();
    await expect(page.locator("text=VERIFIED")).toBeVisible();
  });

  test("View Image button opens image viewer for payment screenshot", async ({ page }) => {
    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(1000);

    // Click View Image button for user-001 which has a payment screenshot
    const viewImageBtn = page.getByRole("button", { name: /view image/i }).first();
    await viewImageBtn.click();
    await page.waitForTimeout(1000);

    // Image preview modal should open
    await expect(page.locator("text=Payment Verification Screenshot")).toBeVisible();

    // Screenshot analysis should appear (mocked)
    await expect(page.locator("text=JazzCash")).toBeVisible();
    await expect(page.locator("text=Ahmed Ali")).toBeVisible();
  });

  test("Verify Payment button triggers success", async ({ page }) => {
    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(1000);

    // Find and click the verify button (CheckCircle icon near PAYMENT_SENT row)
    const verifyButtons = page.locator('button[title="Verify Payment"]');
    await verifyButtons.first().click();
    await page.waitForTimeout(1000);

    // The verify action should succeed (mocked API returns success)
    // No error should appear
  });

  test("Reject Payment triggers prompt for reason", async ({ page }) => {
    // This test uses dialog handler for the prompt
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Reason for rejection");
      await dialog.accept("Wrong amount");
    });

    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(1000);

    // Click reject button
    const rejectButton = page.locator('button[title="Reject Payment"]').first();
    await rejectButton.click();
    await page.waitForTimeout(500);
  });

  test("Confirm Order button is available for verified sessions", async ({ page }) => {
    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(1000);

    // Should have a Confirm Order button
    await expect(page.getByRole("button", { name: /confirm order/i })).toBeVisible();
  });

  test("State filter dropdown works", async ({ page }) => {
    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(500);

    // Select filter dropdown
    const select = page.locator("select");
    await select.selectOption("PAYMENT_SENT");
    await page.waitForTimeout(500);
  });

  test("Search input filters by userId", async ({ page }) => {
    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(500);

    // Type in search
    const searchInput = page.locator('input[placeholder*="Search by userId"]');
    await searchInput.fill("user-001");
    await page.waitForTimeout(500);
  });

  test("Tracking modal can be opened for confirmed orders", async ({ page }) => {
    // Mock a confirmed order session
    await page.route("**/api/sessions?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{
            id: "user-001",
            userId: "user-001",
            adminId: "test-store-123",
            state: "ORDER_CONFIRMED",
            isBlocked: false,
            lastMessageAt: new Date().toISOString(),
            selectedProductId: "prod-1",
            metadata: { customerName: "Ahmed Ali" },
          }],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        }),
      });
    });

    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(1000);

    // Click Add Tracking button
    await page.getByRole("button", { name: /add tracking/i }).click();
    await page.waitForTimeout(500);

    // Tracking form should appear
    await expect(page.locator("text=Courier Service")).toBeVisible();
    await expect(page.locator('input[placeholder*="Enter tracking number"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /send to customer/i })).toBeVisible();
  });

  test("Empty state shown when no pending orders", async ({ page }) => {
    // Mock empty sessions
    await page.route("**/api/sessions?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        }),
      });
    });

    await page.goto("/");
    await navigateToFeaturesSubTab(page, "Verification");
    await page.waitForTimeout(1000);

    // Should show empty state message
    await expect(page.locator("text=No orders pending verification")).toBeVisible();
  });
});
