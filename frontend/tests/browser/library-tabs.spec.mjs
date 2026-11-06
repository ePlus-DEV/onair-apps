import { test, expect } from '@playwright/test';

const links = page => page.locator('nav.radio-library-tabs');
const selected = page => links(page).locator('a[aria-current="location"]');

test('Library tabs keep URL, active panel, reload and browser Back/Forward synchronized', async ({ page }) => {
  await page.goto('/library#recent');
  await expect(selected(page)).toHaveAttribute('href', '/library#recent');
  await expect(page.locator('section[aria-label="Recently played"]')).toBeVisible();

  await links(page).locator('a[href="/library#favorites"]').click();
  await expect(page).toHaveURL(/\/library#favorites$/);
  await expect(selected(page)).toHaveAttribute('href', '/library#favorites');
  await expect(page.locator('section[aria-label="Favorites"]')).toBeVisible();
  await expect(page.locator('section[aria-label="Recently played"]')).toHaveCount(0);

  // A real link makes a browser-history entry; replacing the URL breaks Back.
  await links(page).locator('a[href="/library#stats"]').click();
  await expect(page).toHaveURL(/\/library#stats$/);
  await expect(selected(page)).toHaveAttribute('href', '/library#stats');
  await expect(page.locator('section[aria-label="Listening time"]')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/library#favorites$/);
  await expect(selected(page)).toHaveAttribute('href', '/library#favorites');
  await expect(page.locator('section[aria-label="Favorites"]')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/library#stats$/);
  await expect(selected(page)).toHaveAttribute('href', '/library#stats');
  await expect(page.locator('section[aria-label="Listening time"]')).toBeVisible();

  await page.reload();
  await expect(selected(page)).toHaveAttribute('href', '/library#stats');
  await expect(page.locator('section[aria-label="Listening time"]')).toBeVisible();

  await links(page).locator('a[href="/library"]').click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(selected(page)).toHaveAttribute('href', '/library');
  await expect(page.locator('section[aria-label="Favorites"]')).toBeVisible();
  await expect(page.locator('section[aria-label="Recently played"]')).toBeVisible();

  await page.goto('/library#unknown');
  await expect(selected(page)).toHaveAttribute('href', '/library');
});

test('Library navigation shows two readable rows on mobile with touch and keyboard support', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/library#recent');
  const nav = links(page);
  await expect(nav.locator('a')).toHaveCount(4);
  expect(await nav.evaluate(element => {
    const grid = element.firstElementChild;
    return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  })).toBe(2);
  expect(await nav.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const tabMetrics = await nav.locator('a').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { height: box.height, left: box.left, right: box.right, viewport: window.innerWidth };
  }));
  for (const tab of tabMetrics) {
    expect(tab.height).toBeGreaterThanOrEqual(44);
    expect(tab.left).toBeGreaterThanOrEqual(0);
    expect(tab.right).toBeLessThanOrEqual(tab.viewport);
  }

  const stats = nav.locator('a[href="/library#stats"]');
  await stats.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/library#stats$/);
  await expect(stats).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('section[aria-label="Listening time"]')).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await nav.evaluate(element => getComputedStyle(element.firstElementChild).gridTemplateColumns.split(' ').length)).toBe(4);
});
