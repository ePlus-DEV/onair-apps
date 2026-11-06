import { test, expect } from "@playwright/test";

test("country navigation shows a matching skeleton only while loading and leaves the dock intact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/europe");
  await page.route("**/radio/europe/belgium.json", async route => {
    await new Promise(resolve => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.locator('main a[href="/europe/belgium"]').first().click();
  const skeleton = page.locator(".radio-page-skeleton");
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveAttribute("role", "status");
  await expect(page.locator(".radio-player-dock")).toBeVisible();
  await expect(page).toHaveURL(/\/europe\/belgium$/);
  await expect(skeleton).toBeHidden({ timeout: 15000 });
  await expect(page.locator("main .radio-station-card").first()).toBeVisible();
});

test("direct SSR landing renders real content without a skeleton flash", async ({ page }) => {
  await page.goto("/asia/viet-nam/vov-gt-hcm");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator(".radio-page-skeleton")).toHaveCount(0);
  await expect(page.locator(".radio-player-dock")).toBeVisible();
});
