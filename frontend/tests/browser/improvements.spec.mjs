import { test, expect } from '@playwright/test';

test('region renders counts without downloading every country catalog', async ({ page }) => {
  const catalogs = [];
  page.on('request', request => {
    if (/\/radio\/europe\/[^/]+\.json/.test(request.url())) catalogs.push(request.url());
  });
  await page.goto('/europe');
  const country = page.locator('main a[href="/europe/belgium"]');
  await expect(country).toBeVisible();
  await expect(country.locator('.radio-themed-artwork span')).toHaveText(/\d+/);
  await expect(page.locator('.radio-player-dock')).toBeVisible();
  expect(catalogs).toEqual([]);
});

test('search reuses its catalog across opens and fits a short mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 420 });
  let loads = 0;
  page.on('request', request => { if (request.url().endsWith('/search/stations.json')) loads++; });
  await page.goto('/');
  const open = page.locator('header').getByRole('button', { name: 'Search...', exact: true });
  for (let i = 0; i < 2; i++) {
    await open.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox').fill('rap viet');
    await expect(dialog.locator('a[href="/asia/viet-nam/rap-viet-radio-zing-mp3"]')).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(420);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  expect(loads).toBe(1);
});

test('sleep timer survives navigation, expires and leaves playback paused', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new Event('playing')); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.load = function () {};
  });
  await page.route(/api\.webrad\.io/, route => route.fulfill({ json: { success: false } }));
  await page.goto('/europe/belgium/studio-brussel');
  const dock = page.locator('.radio-player-dock');
  await dock.getByRole('button', { name: 'Play radio', exact: true }).click();
  await dock.getByRole('button', { name: 'Sleep timer', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Stop after 15 minutes', exact: true }).click();
  await expect(dock).toContainText('Stops in 15 min');
  await page.locator('header a[href="/"]').first().click();
  await expect(dock).toContainText('Stops in 15 min');
  await page.clock.fastForward(15 * 60_000);
  await expect(dock.getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  await expect(dock).not.toContainText('Stops in');
});

test('320px player has 44px transport targets and mobile timer cancellation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/europe/belgium/studio-brussel');
  const dock = page.locator('.radio-player-dock');
  for (const name of [/^Previous station:/, /^Next station:/, /^Channels & schedule$/]) {
    const box = await dock.getByRole('button', { name }).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dock.getByRole('button', { name: 'Channels & schedule', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Sleep timer', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Stop after 30 minutes', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sleep timer', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cancel sleep timer', exact: true }).click();
  await expect(dock).not.toContainText('Stops in');
});
