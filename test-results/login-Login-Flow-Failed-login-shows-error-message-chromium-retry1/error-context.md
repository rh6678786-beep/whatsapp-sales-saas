# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Login Flow >> Failed login shows error message
- Location: e2e\login.spec.ts:52:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /login/i }).first()

```

# Page snapshot

```yaml
- generic [ref=e2]: "{\"error\":\"Too many requests. Please try again later.\"}"
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { setupApiMocks, TEST_ADMIN_ID, TEST_STORE_NAME, setLoggedInState } from "./helpers";
  3   | 
  4   | test.describe("Login Flow", () => {
  5   |   test.beforeEach(async ({ page }) => {
  6   |     await setupApiMocks(page);
  7   |   });
  8   | 
  9   |   test("Landing page loads and shows hero section", async ({ page }) => {
  10  |     await page.goto("/");
  11  | 
  12  |     // Verify landing page renders
  13  |     await expect(page.locator("text=AI Sales Agent")).toBeVisible();
  14  |     await expect(page.locator("text=Start Free Trial")).toBeVisible();
  15  |     await expect(page.locator("text=Login")).toBeVisible();
  16  |     await expect(page.locator("text=Team Login")).toBeVisible();
  17  |   });
  18  | 
  19  |   test("Login button opens sign-in form", async ({ page }) => {
  20  |     await page.goto("/");
  21  | 
  22  |     // Click the Login button
  23  |     await page.getByRole("button", { name: /login/i }).first().click();
  24  |     await page.waitForTimeout(500);
  25  | 
  26  |     // Verify the sign-in form is displayed
  27  |     await expect(page.locator('input[placeholder*="Store ID"]')).toBeVisible();
  28  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  29  |     await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  30  |   });
  31  | 
  32  |   test("Successful login redirects to dashboard with store name", async ({ page }) => {
  33  |     await page.goto("/");
  34  | 
  35  |     // Click Login
  36  |     await page.getByRole("button", { name: /login/i }).first().click();
  37  |     await page.waitForTimeout(500);
  38  | 
  39  |     // Fill in credentials
  40  |     await page.fill('input[placeholder*="Store ID"]', TEST_ADMIN_ID);
  41  |     await page.fill('input[type="password"]', "Test@123");
  42  | 
  43  |     // Click sign in
  44  |     await page.getByRole("button", { name: /sign in/i }).click();
  45  |     await page.waitForTimeout(1500);
  46  | 
  47  |     // After login, should see the dashboard with store name
  48  |     await expect(page.locator(`text=${TEST_STORE_NAME}`)).toBeVisible();
  49  |     await expect(page.locator("text=AI Agent")).toBeVisible();
  50  |   });
  51  | 
  52  |   test("Failed login shows error message", async ({ page }) => {
  53  |     await page.goto("/");
  54  | 
  55  |     // Click Login
> 56  |     await page.getByRole("button", { name: /login/i }).first().click();
      |                                                                ^ Error: locator.click: Test timeout of 60000ms exceeded.
  57  |     await page.waitForTimeout(500);
  58  | 
  59  |     // Fill in WRONG credentials
  60  |     await page.fill('input[placeholder*="Store ID"]', TEST_ADMIN_ID);
  61  |     await page.fill('input[type="password"]', "WrongPassword1");
  62  | 
  63  |     // Click sign in
  64  |     await page.getByRole("button", { name: /sign in/i }).click();
  65  |     await page.waitForTimeout(1500);
  66  | 
  67  |     // Should see error message
  68  |     await expect(page.locator("text=Invalid credentials")).toBeVisible();
  69  |   });
  70  | 
  71  |   test("Sign up link navigates to registration form", async ({ page }) => {
  72  |     await page.goto("/");
  73  | 
  74  |     // Click Login
  75  |     await page.getByRole("button", { name: /login/i }).first().click();
  76  |     await page.waitForTimeout(500);
  77  | 
  78  |     // Click sign up link
  79  |     await page.getByText(/sign up/i).click();
  80  |     await page.waitForTimeout(500);
  81  | 
  82  |     // Should see the registration form heading
  83  |     await expect(page.locator("text=Create Account")).toBeVisible();
  84  |   });
  85  | 
  86  |   test("App can render dashboard when already logged in", async ({ page }) => {
  87  |     // Set logged-in state before navigation
  88  |     await setLoggedInState(page);
  89  |     await setupApiMocks(page);
  90  | 
  91  |     await page.goto("/");
  92  | 
  93  |     // Should see the dashboard with sidebar
  94  |     await expect(page.locator("text=Sales Dashboard")).toBeVisible();
  95  |     await expect(page.locator("text=Total Revenue")).toBeVisible();
  96  |     await expect(page.locator("text=Revenue Growth")).toBeVisible();
  97  |   });
  98  | 
  99  |   test("Dashboard shows stats cards when logged in", async ({ page }) => {
  100 |     await setLoggedInState(page);
  101 |     await setupApiMocks(page);
  102 | 
  103 |     await page.goto("/");
  104 | 
  105 |     // Verify key stats are displayed
  106 |     await expect(page.locator("text=Rs. 249,000")).toBeVisible(); // totalSales
  107 |     await expect(page.locator("text=Pending Verification")).toBeVisible();
  108 |     await expect(page.locator("text=Confirmed Orders")).toBeVisible();
  109 |     await expect(page.locator("text=Today's Profit")).toBeVisible();
  110 | 
  111 |     // Verify conversion funnel section
  112 |     await expect(page.locator("text=Conversion Funnel")).toBeVisible();
  113 | 
  114 |     // Verify activity feed
  115 |     await expect(page.locator("text=Activity Feed")).toBeVisible();
  116 |   });
  117 | 
  118 |   test("Logout button clears session and returns to landing", async ({ page }) => {
  119 |     await setLoggedInState(page);
  120 |     await setupApiMocks(page);
  121 | 
  122 |     await page.goto("/");
  123 |     await page.waitForTimeout(500);
  124 | 
  125 |     // Click logout button (has the LogOut icon)
  126 |     await page.locator('button[title="Logout"]').click();
  127 |     await page.waitForTimeout(500);
  128 | 
  129 |     // Should return to landing page — use first() because 'AI Sales Agent' appears in multiple sections
  130 |     await expect(page.locator("text=AI Sales Agent").first()).toBeVisible();
  131 |     await expect(page.locator("text=Start Free Trial")).toBeVisible();
  132 |   });
  133 | });
  134 | 
```