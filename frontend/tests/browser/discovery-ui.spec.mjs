import { test, expect } from '@playwright/test';

test('320px homepage featured carousel scrolls without page overflow or header overlay', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const featured = page.locator('#featured-radio');
  const gallery = featured.locator('.radio-scrollbar');
  await expect(featured.locator('a[href="/asia/viet-nam/vov-gt-hcm"]')).toBeVisible();
  await expect(featured.locator('a[href="/asia/viet-nam/rap-viet-radio-zing-mp3"]')).toHaveCount(1);
  expect(await gallery.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const headBottom = await page.locator('header').evaluate(el => el.getBoundingClientRect().bottom);
  const heroTop = await page.locator('.radio-hero').evaluate(el => el.getBoundingClientRect().top);
  expect(heroTop).toBeGreaterThanOrEqual(headBottom);
});

test('country cards are compact and station links still navigate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const card = page.locator('#explore-radio a[href="/asia/viet-nam"]');
  await expect(card).toBeVisible();
  const box = await card.locator('.radio-themed-artwork').boundingBox();
  expect(box).toBeTruthy();
  expect(box.height).toBeLessThan(box.width);
  await card.click();
  await expect(page).toHaveURL(/\/asia\/viet-nam$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('local search works when Algolia is not configured, including diacritics', async ({ page }) => {
  await page.goto('/');
  await page.locator('header').getByRole('button', { name: 'Search...', exact: true }).click();
  const input = page.getByRole('searchbox', { name: 'Search...', exact: true });
  await expect(input).toBeVisible();
  await input.fill('rap viet');
  const hit = page.getByRole('dialog').locator('a[href="/asia/viet-nam/rap-viet-radio-zing-mp3"]');
  await expect(hit).toBeVisible();
  await expect(hit).toContainText(/Rap Việt/);
  await hit.click();
  await expect(page).toHaveURL(/\/asia\/viet-nam\/rap-viet-radio-zing-mp3$/);
});
