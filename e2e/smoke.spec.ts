import { test, expect } from "@playwright/test";

test("demo page loads and renders content", async ({ page }) => {
  // /p/demo is outside AuthGuard — works without DB setup
  await page.goto("/p/demo");
  await expect(page.locator("h1")).toHaveText("Dashboard Kit Demo", {
    timeout: 15_000,
  });
});
