# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: orders.spec.ts >> Order Processing Flow >> View Image button opens image viewer for payment screenshot
- Location: e2e\orders.spec.ts:34:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Features/i }).first()

```

# Page snapshot

```yaml
- generic [ref=e2]: "{\"error\":\"Too many requests. Please try again later.\"}"
```

# Test source

```ts
  443 |   });
  444 | 
  445 |   // === Upload Route ===
  446 |   await page.route("**/api/upload", async (route) => {
  447 |     await route.fulfill({
  448 |       status: 200,
  449 |       contentType: "application/json",
  450 |       body: JSON.stringify({ urls: ["https://example.com/uploaded.jpg"] }),
  451 |     });
  452 |   });
  453 | 
  454 |   // === Catch-all: prevent any unmocked API requests from reaching the server (rate limiter) ===
  455 |   await page.route("**/api/**", async (route) => {
  456 |     await route.fulfill({
  457 |       status: 200,
  458 |       contentType: "application/json",
  459 |       body: JSON.stringify({ success: true }),
  460 |     });
  461 |   });
  462 | 
  463 |   // === Payment Screenshot Analysis ===
  464 |   await page.route("**/api/payment/analyze-screenshot", async (route) => {
  465 |     await route.fulfill({
  466 |       status: 200,
  467 |       contentType: "application/json",
  468 |       body: JSON.stringify({
  469 |         date: "2025-06-04",
  470 |         amount: "4,499",
  471 |         method: "JazzCash",
  472 |         sender: "Ahmed Ali",
  473 |         notes: "Payment confirmed",
  474 |       }),
  475 |     });
  476 |   });
  477 | 
  478 |   // === Deals Route ===
  479 |   await page.route("**/api/deals", async (route) => {
  480 |     await route.fulfill({
  481 |       status: 200,
  482 |       contentType: "application/json",
  483 |       body: JSON.stringify([]),
  484 |     });
  485 |   });
  486 | 
  487 |   await page.route("**/api/deals/*", async (route) => {
  488 |     await route.fulfill({
  489 |       status: 200,
  490 |       contentType: "application/json",
  491 |       body: JSON.stringify({ success: true }),
  492 |     });
  493 |   });
  494 | 
  495 |   // === Re-engagement Route ===
  496 |   await page.route("**/api/re-engage", async (route) => {
  497 |     await route.fulfill({
  498 |       status: 200,
  499 |       contentType: "application/json",
  500 |       body: JSON.stringify({ success: true, sent: 3, total: 5 }),
  501 |     });
  502 |   });
  503 | }
  504 | 
  505 | // ============================
  506 | // Auth Helpers
  507 | // ============================
  508 | 
  509 | /**
  510 |  * Simulate a logged-in state by setting sessionStorage before navigation.
  511 |  */
  512 | export async function setLoggedInState(page: Page) {
  513 |   await page.addInitScript(() => {
  514 |     sessionStorage.setItem("isAdmin", "true");
  515 |     sessionStorage.setItem("authToken", "mock-token");
  516 |     sessionStorage.setItem("adminId", "test-store-123");
  517 |     sessionStorage.setItem("activeMainTab", "dashboard");
  518 |   });
  519 | }
  520 | 
  521 | /**
  522 |  * Perform a real login flow through the UI (fill form, submit).
  523 |  */
  524 | export async function performLogin(page: Page) {
  525 |   await page.goto("/");
  526 |   await page.getByRole("button", { name: /login/i }).first().click();
  527 |   await page.waitForTimeout(500);
  528 |   // The login form is in the Signin component rendered via showLogin state
  529 |   await page.fill('input[placeholder*="Store ID"]', TEST_ADMIN_ID);
  530 |   await page.fill('input[type="password"]', "Test@123");
  531 |   await page.getByRole("button", { name: /sign in/i }).click();
  532 |   await page.waitForTimeout(1000);
  533 | }
  534 | 
  535 | // ============================
  536 | // Navigation Helpers
  537 | // ============================
  538 | 
  539 | /**
  540 |  * Navigate to a specific tab by clicking its sidebar button.
  541 |  */
  542 | export async function navigateToTab(page: Page, tabLabel: string) {
> 543 |   await page.getByRole("button", { name: new RegExp(tabLabel, "i") }).first().click();
      |                                                                               ^ Error: locator.click: Test timeout of 60000ms exceeded.
  544 |   await page.waitForTimeout(500);
  545 | }
  546 | 
  547 | /**
  548 |  * Navigate to WhatsApp sub-tab (Connection or Live Chat).
  549 |  */
  550 | export async function navigateToWhatsAppSubTab(page: Page, subTab: "Connection" | "Live Chat") {
  551 |   // First ensure we're on the WhatsApp section
  552 |   await navigateToTab(page, "WhatsApp");
  553 |   // Click the sub-tab
  554 |   await page.getByRole("button", { name: new RegExp(subTab, "i") }).click();
  555 |   await page.waitForTimeout(500);
  556 | }
  557 | 
  558 | /**
  559 |  * Navigate to Products sub-tab (Products or Deals).
  560 |  */
  561 | export async function navigateToProductsSubTab(page: Page, subTab: "Products" | "Deals") {
  562 |   await navigateToTab(page, "Products");
  563 |   // Click the sub-tab — use first() to avoid matching both sidebar main tab and sub-tab
  564 |   await page.getByRole("button", { name: new RegExp(subTab, "i") }).first().click();
  565 |   await page.waitForTimeout(500);
  566 | }
  567 | 
  568 | /**
  569 |  * Navigate to Features sub-tab.
  570 |  */
  571 | export async function navigateToFeaturesSubTab(page: Page, subTab: "Broadcast" | "Re-Engage" | "AI Publisher" | "Simulator" | "Verification") {
  572 |   await navigateToTab(page, "Features");
  573 |   await page.getByRole("button", { name: new RegExp(subTab, "i") }).click();
  574 |   await page.waitForTimeout(500);
  575 | }
  576 | 
```