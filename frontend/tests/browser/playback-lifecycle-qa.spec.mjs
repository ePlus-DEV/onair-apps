import { test, expect } from '@playwright/test';

// Synthetic Chromium checks complement (not replace) real Safari/Android QA.
// Only explicit user gestures are allowed to request playback.
async function setUpMockAudio(page) {
  await page.addInitScript(() => {
    window.radioQaCalls = { play: 0, pause: 0, load: 0 };
    window.radioQaOnline = true;
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => window.radioQaOnline,
    });
    HTMLMediaElement.prototype.play = function () {
      window.radioQaCalls.play += 1;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.radioQaCalls.pause += 1;
      this.dispatchEvent(new Event('pause'));
    };
    HTMLMediaElement.prototype.load = function () {
      window.radioQaCalls.load += 1;
    };
  });
  await page.route(/api\.webrad\.io/, route => route.fulfill({ json: { success: false } }));
  await page.route(/api\.iconify\.design/, route => route.abort());
}

const dock = page => page.locator('.radio-player-dock');

async function ready(page, path) {
  await page.goto(path);
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await expect(dock(page)).toBeVisible();
}

test('reloading after explicit Play never autoplays restored station', async ({ page }) => {
  await setUpMockAudio(page);
  await ready(page, '/europe/belgium/studio-brussel');
  const play = dock(page).getByRole('button', { name: 'Play radio', exact: true });
  await expect(play).toBeVisible();
  expect(await page.evaluate(() => window.radioQaCalls.play)).toBe(0);

  await play.click();
  await expect.poll(() => page.evaluate(() => window.radioQaCalls.play)).toBe(1);
  await expect(dock(page).getByRole('button', { name: 'Pause radio', exact: true })).toBeVisible();

  await page.reload();
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await expect(dock(page).getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  // Give the store's async restoration a chance to settle after hydration.
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.radioQaCalls.play)).toBe(0);
  expect(await page.locator('audio').count()).toBe(1);

  await dock(page).getByRole('button', { name: 'Play radio', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.radioQaCalls.play)).toBe(1);
});

test('offline-to-online events do not override an intentional Pause or duplicate the player', async ({ page }) => {
  await setUpMockAudio(page);
  await ready(page, '/europe/belgium/studio-brussel');
  await dock(page).getByRole('button', { name: 'Play radio', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.radioQaCalls.play)).toBe(1);

  await dock(page).getByRole('button', { name: 'Pause radio', exact: true }).click();
  await expect(dock(page).getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  const playBefore = await page.evaluate(() => window.radioQaCalls.play);
  const audioBefore = await page.locator('audio').evaluate(audio => {
    window.radioQaAudio = audio;
    return audio.currentSrc || audio.src;
  });

  // Simulate browser connectivity notifications without sending real requests.
  await page.evaluate(() => {
    window.radioQaOnline = false;
    window.dispatchEvent(new Event('offline'));
    window.radioQaOnline = true;
    window.dispatchEvent(new Event('online'));
  });
  await page.locator('header a[href="/"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(dock(page).getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();

  expect(await page.evaluate(() => window.radioQaCalls.play)).toBe(playBefore);
  expect(await page.locator('audio').count()).toBe(1);
  expect(await page.evaluate(() => document.querySelector('audio') === window.radioQaAudio)).toBe(true);
  expect(await page.locator('audio').evaluate(audio => audio.currentSrc || audio.src)).toBe(audioBefore);
});
