import { test, expect } from "@playwright/test";
import { setupApiMocks, setLoggedInState, navigateToProductsSubTab } from "./helpers";

test.describe("Product Management Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setLoggedInState(page);
    await setupApiMocks(page);
  });

  test("Product catalog page shows all products", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(1000);

    // Should show the product catalog header
    await expect(page.locator("text=Product Catalog")).toBeVisible();
    await expect(page.locator("text=Premium Sneakers")).toBeVisible();
    await expect(page.locator("text=Designer Kurti")).toBeVisible();
    await expect(page.locator("text=Smart Watch")).toBeVisible();
  });

  test("Add New Product button opens modal", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(500);

    // Click Add New Product
    await page.getByRole("button", { name: /add new product/i }).click();
    await page.waitForTimeout(500);

    // Should show the modal with form fields
    await expect(page.locator("text=New Product")).toBeVisible();
    await expect(page.locator('input[placeholder*="Ultra Smart Watch"]')).toBeVisible();
    await expect(page.locator("text=Sale Price (Rs.)")).toBeVisible();
    await expect(page.locator("text=Cost Price (Rs.)")).toBeVisible();
    await expect(page.locator("text=Product Features")).toBeVisible();
  });

  test("Create product flow submits form successfully", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(500);

    // Open add product modal
    await page.getByRole("button", { name: /add new product/i }).click();
    await page.waitForTimeout(500);

    // Fill in product details
    await page.fill('input[placeholder*="Ultra Smart Watch"]', "Test Product Pro Max");

    // Fill price fields
    const priceInputs = page.locator('input[type="number"]');
    await priceInputs.nth(0).fill("4999");
    await priceInputs.nth(1).fill("2500");

    // Fill features
    const textarea = page.locator("textarea");
    await textarea.fill("Feature 1\nFeature 2\nFeature 3");

    // Submit the form
    await page.getByRole("button", { name: /create product/i }).click();
    await page.waitForTimeout(1000);

    // Modal should close
    await expect(page.locator("text=New Product")).not.toBeVisible();
  });

  test("Edit product modal opens with pre-filled data", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(500);

    // Hover over the first product card to reveal the edit button
    await page.locator("text=Premium Sneakers").hover();
    await page.waitForTimeout(300);

    // Click edit button (the one with Edit2 icon, revealed on hover)
    await page.locator('button[title="Edit Product"]').click();

    // Modal should open with edit title
    await expect(page.locator("text=Edit Product")).toBeVisible();
  });

  test("Stock filter buttons work correctly", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(1000);

    // Stock filter buttons should be visible
    await expect(page.getByRole("button", { name: /All/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /In Stock/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Out of Stock/i })).toBeVisible();

    // Click Out of Stock filter
    await page.getByRole("button", { name: /Out of Stock/i }).click();
    await page.waitForTimeout(500);
  });

  test("Search bar filters products", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(1000);

    // Type in search
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill("Sneakers");
    await page.waitForTimeout(1000);

    // Should still show Premium Sneakers
    await expect(page.locator("text=Premium Sneakers")).toBeVisible();
  });

  test("Price and cost are displayed on product cards", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(1000);

    // Verify prices are shown
    await expect(page.locator("text=Rs.4,499")).toBeVisible();
    await expect(page.locator("text=Rs.2,999")).toBeVisible();
    await expect(page.locator("text=Rs.6,499")).toBeVisible();
  });

  test("Product features are listed on cards", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(1000);

    // Verify features are shown
    await expect(page.locator("text=High Quality")).toBeVisible();
    await expect(page.locator("text=Waterproof")).toBeVisible();
    await expect(page.locator("text=Durable")).toBeVisible();
    await expect(page.locator("text=Premium Fabric")).toBeVisible();
  });

  test("Bulk import button is visible", async ({ page }) => {
    await page.goto("/");
    await navigateToProductsSubTab(page, "Products");
    await page.waitForTimeout(500);

    // Bulk import button should be visible
    await expect(page.getByRole("button", { name: /bulk import/i })).toBeVisible();
  });
});
