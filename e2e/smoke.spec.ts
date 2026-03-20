import { test, expect } from "@playwright/test";

test("top page loads and renders React app", async ({ page }) => {
  await page.goto("/");
  // Wait for React to mount inside #root (not just the empty shell)
  const root = page.locator("#root");
  await expect(root).toBeVisible();
  await expect(root.locator(":first-child")).toBeAttached({ timeout: 10_000 });
});
