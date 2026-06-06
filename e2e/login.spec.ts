import { test, expect } from "@playwright/test";
import { setupApiMocks, TEST_ADMIN_ID, TEST_STORE_NAME, setLoggedInState } from "./helpers";

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("Landing page loads and shows hero section", async ({ page }) => {
    await page.goto("/");

    // Verify landing page renders
    await expect(page.locator("text=AI Sales Agent")).toBeVisible();
    await expect(page.locator("text=Start Free Trial")).toBeVisible();
    await expect(page.locator("text=Login")).toBeVisible();
    await expect(page.locator("text=Team Login")).toBeVisible();
  });

  test("Login button opens sign-in form", async ({ page }) => {
    await page.goto("/");

    // Click the Login button
    await page.getByRole("button", { name: /login/i }).first().click();
    await page.waitForTimeout(500);

    // Verify the sign-in form is displayed
    await expect(page.locator('input[placeholder*="Store ID"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("Successful login redirects to dashboard with store name", async ({ page }) => {
    await page.goto("/");

    // Click Login
    await page.getByRole("button", { name: /login/i }).first().click();
    await page.waitForTimeout(500);

    // Fill in credentials
    await page.fill('input[placeholder*="Store ID"]', TEST_ADMIN_ID);
    await page.fill('input[type="password"]', "Test@123");

    // Click sign in
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(1500);

    // After login, should see the dashboard with store name
    await expect(page.locator(`text=${TEST_STORE_NAME}`)).toBeVisible();
    await expect(page.locator("text=AI Agent")).toBeVisible();
  });

  test("Failed login shows error message", async ({ page }) => {
    await page.goto("/");

    // Click Login
    await page.getByRole("button", { name: /login/i }).first().click();
    await page.waitForTimeout(500);

    // Fill in WRONG credentials
    await page.fill('input[placeholder*="Store ID"]', TEST_ADMIN_ID);
    await page.fill('input[type="password"]', "WrongPassword1");

    // Click sign in
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(1500);

    // Should see error message
    await expect(page.locator("text=Invalid credentials")).toBeVisible();
  });

  test("Sign up link navigates to registration form", async ({ page }) => {
    await page.goto("/");

    // Click Login
    await page.getByRole("button", { name: /login/i }).first().click();
    await page.waitForTimeout(500);

    // Click sign up link
    await page.getByText(/sign up/i).click();
    await page.waitForTimeout(500);

    // Should see the registration form heading
    await expect(page.locator("text=Create Account")).toBeVisible();
  });

  test("App can render dashboard when already logged in", async ({ page }) => {
    // Set logged-in state before navigation
    await setLoggedInState(page);
    await setupApiMocks(page);

    await page.goto("/");

    // Should see the dashboard with sidebar
    await expect(page.locator("text=Sales Dashboard")).toBeVisible();
    await expect(page.locator("text=Total Revenue")).toBeVisible();
    await expect(page.locator("text=Revenue Growth")).toBeVisible();
  });

  test("Dashboard shows stats cards when logged in", async ({ page }) => {
    await setLoggedInState(page);
    await setupApiMocks(page);

    await page.goto("/");

    // Verify key stats are displayed
    await expect(page.locator("text=Rs. 249,000")).toBeVisible(); // totalSales
    await expect(page.locator("text=Pending Verification")).toBeVisible();
    await expect(page.locator("text=Confirmed Orders")).toBeVisible();
    await expect(page.locator("text=Today's Profit")).toBeVisible();

    // Verify conversion funnel section
    await expect(page.locator("text=Conversion Funnel")).toBeVisible();

    // Verify activity feed
    await expect(page.locator("text=Activity Feed")).toBeVisible();
  });

  test("Logout button clears session and returns to landing", async ({ page }) => {
    await setLoggedInState(page);
    await setupApiMocks(page);

    await page.goto("/");
    await page.waitForTimeout(500);

    // Click logout button (has the LogOut icon)
    await page.locator('button[title="Logout"]').click();
    await page.waitForTimeout(500);

    // Should return to landing page — use first() because 'AI Sales Agent' appears in multiple sections
    await expect(page.locator("text=AI Sales Agent").first()).toBeVisible();
    await expect(page.locator("text=Start Free Trial")).toBeVisible();
  });
});
