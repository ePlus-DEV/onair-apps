import { test, expect } from '@playwright/test';

const history = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('radio_listening_library_v1');
  return raw ? JSON.parse(raw) : null;
});

const mockAudio = async (page) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      this.dispatchEvent(new Event('pause'));
    };
    HTMLMediaElement.prototype.load = function () {};
  });
};

const ready = async (page, path) => {
  await page.goto(path);
  await expect(page.locator('.radio-player-dock')).toBeVisible();
};

test('recent station is persisted only after playing and is not resurrected by late events', async ({ page }) => {
  await mockAudio(page);
  await ready(page, '/europe/belgium/studio-brussel');

  // Visiting a detail page is not a listen and must not add recent history.
  expect((await history(page))?.recent || []).toEqual([]);
  const dock = page.locator('.radio-player-dock');
  await dock.getByRole('button', { name: 'Play radio', exact: true }).click();
  await expect.poll(async () => (await history(page))?.recent?.[0]?.url)
    .toBe('/europe/belgium/studio-brussel');
  await dock.getByRole('button', { name: 'Pause radio', exact: true }).click();
  await expect.poll(async () => (await history(page))?.lastState).toBe('pause');

  // The browser can deliver a queued playing event after an explicit pause.
  await page.locator('audio').first().evaluate((audio) => audio.dispatchEvent(new Event('playing')));
  expect((await history(page)).lastState).toBe('pause');
  await expect(dock.getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();

  await page.goto('/');
  await page.reload();
  await expect(page.locator('.radio-player-dock').getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  expect((await history(page)).recent[0].title).toBe('Studio Brussel');
  await page.goto('/library#recent');
  await expect(page.locator('section[aria-label="Recently played"]')).toContainText('Studio Brussel');
});

test('listening history updates an already-open library tab', async ({ page, context }) => {
  await mockAudio(page);
  const libraryTab = await context.newPage();
  await ready(libraryTab, '/library#recent');
  await ready(page, '/europe/belgium/studio-brussel');
  await page.locator('.radio-player-dock').getByRole('button', { name: 'Play radio', exact: true }).click();
  await expect.poll(async () => (await history(page))?.recent?.length).toBe(1);
  await expect(libraryTab.locator('section[aria-label="Recently played"]')).toContainText('Studio Brussel');
  await libraryTab.close();
});

test('delete one history entry from library without affecting favorites, playback preference or other stations', async ({ page }) => {
  await ready(page, '/');
  await page.evaluate(() => {
    const first = { url: '/europe/belgium/studio-brussel', title: 'Studio Brussel', image: '/brand/onair-mark.svg' };
    const second = { url: '/europe/belgium/mnm', title: 'MNM', image: '/brand/onair-mark.svg' };
    localStorage.setItem('radio_listening_library_v1', JSON.stringify({
      recent: [first, second], favorites: [first], lastStation: first, lastState: 'pause',
    }));
  });
  await page.goto('/library#recent');
  const recent = page.locator('section[aria-label="Recently played"]');
  await expect(recent).toContainText('Studio Brussel');
  await expect(recent).toContainText('MNM');
  await recent.getByRole('button', { name: 'Remove from history: Studio Brussel' }).click();
  await expect(recent).not.toContainText('Studio Brussel');
  await expect(recent).toContainText('MNM');
  await expect(page).toHaveURL(/\/library#recent$/);
  const saved = await history(page);
  expect(saved.recent.map(item => item.title)).toEqual(['MNM']);
  expect(saved.favorites.map(item => item.title)).toEqual(['Studio Brussel']);
  expect(saved.lastStation.title).toBe('Studio Brussel');
  expect(saved.lastState).toBe('pause');
  await page.reload();
  await expect(page.locator('section[aria-label="Recently played"]')).toContainText('MNM');
  await expect(page.locator('section[aria-label="Recently played"]')).not.toContainText('Studio Brussel');
});

test('home reload restores Heart UK rather than the first featured VOV station', async ({ page }) => {
  await page.addInitScript(() => {
    const heart = { url: '/europe/united-kingdom/heart-uk', title: 'Heart UK', image: '/brand/onair-mark.svg' };
    localStorage.setItem('radio_listening_library_v1', JSON.stringify({
      recent: [heart], favorites: [], lastStation: heart, lastState: 'pause',
    }));
  });
  await ready(page, '/');
  const dock = page.locator('.radio-player-dock');
  await expect(dock.getByRole('link', { name: /Heart UK/ })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  expect((await history(page)).lastStation.url).toBe('/europe/united-kingdom/heart-uk');

  await page.reload();
  await expect(dock.getByRole('link', { name: /Heart UK/ })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  expect((await history(page)).lastStation.url).toBe('/europe/united-kingdom/heart-uk');
});

test('explicit Heart UK selection survives home reload even before stream starts', async ({ page }) => {
  await page.addInitScript(() => {
    // Audio stays pending: selection must persist without a successful "playing" event.
    HTMLMediaElement.prototype.play = () => new Promise(() => {});
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.load = () => {};
  });
  await ready(page, '/');
  const dock = page.locator('.radio-player-dock');
  await page.locator('#featured-radio').getByRole('button', { name: 'Play radio: Heart UK' }).click();

  await expect.poll(async () => (await history(page))?.lastStation?.url)
    .toBe('/europe/united-kingdom/heart-uk');
  expect((await history(page)).recent).toEqual([]);

  await page.reload();
  await expect(dock.getByRole('link', { name: /Heart UK/ })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  expect((await history(page)).lastStation.url).toBe('/europe/united-kingdom/heart-uk');
});

test('saved station also outranks country fallback on reload', async ({ page }) => {
  await page.addInitScript(() => {
    const heart = { url: '/europe/united-kingdom/heart-uk', title: 'Heart UK', image: '/brand/onair-mark.svg' };
    localStorage.setItem('radio_listening_library_v1', JSON.stringify({
      recent: [heart], favorites: [], lastStation: heart, lastState: 'pause',
    }));
  });
  await ready(page, '/asia/viet-nam');
  await expect(page.locator('.radio-player-dock').getByRole('link', { name: /Heart UK/ })).toBeVisible();
  await expect(page.locator('.radio-player-dock').getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
});

test('clear all listening history requires Yes/No confirmation and keeps duration statistics', async ({ page }) => {
  await ready(page, '/');
  await page.evaluate(() => {
    const heart = { url: '/europe/united-kingdom/heart-uk', title: 'Heart UK', image: '/brand/onair-mark.svg' };
    localStorage.setItem('radio_listening_library_v1', JSON.stringify({
      recent: [heart], favorites: [heart], lastStation: heart, lastState: 'pause',
    }));
    localStorage.setItem('radio_listening_duration_v1', JSON.stringify({
      totalMs: 90_000, todayKey: '2026-10-14', todayMs: 90_000,
      byStation: { [heart.url]: { title: heart.title, ms: 90_000 } },
    }));
  });
  await page.goto('/library#recent');
  const recent = page.locator('section[aria-label="Recently played"]');
  const clear = page.getByRole('button', { name: 'Clear recent history' });
  await expect(recent).toContainText('Heart UK');
  await clear.click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Clear listening history?');
  expect((await history(page)).recent).toHaveLength(1);
  await modal.getByRole('button', { name: 'No, keep it' }).click();
  await expect(recent).toContainText('Heart UK');

  await clear.click();
  await modal.getByRole('button', { name: 'Yes, clear history' }).click();
  await expect(recent).not.toContainText('Heart UK');
  const saved = await history(page);
  expect(saved.recent).toEqual([]);
  expect(saved.favorites).toHaveLength(1);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('radio_listening_duration_v1'))).totalMs).toBe(90_000);
});

test('listening time tab shows stored lifetime, today and per-station durations', async ({ page }) => {
  await ready(page, '/');
  await page.evaluate(() => {
    const heart = '/europe/united-kingdom/heart-uk';
    localStorage.setItem('radio_listening_duration_v1', JSON.stringify({
      totalMs: 2 * 60 * 60 * 1000 + 30 * 60 * 1000,
      todayKey: [new Date().getFullYear(), String(new Date().getMonth() + 1).padStart(2, '0'), String(new Date().getDate()).padStart(2, '0')].join('-'),
      todayMs: 45 * 60 * 1000,
      byStation: { [heart]: { title: 'Heart UK', ms: 30 * 60 * 1000 } },
    }));
  });
  await page.goto('/library#stats');
  const stats = page.locator('section[aria-label="Listening time"]');
  await expect(stats).toContainText('Total listening time');
  await expect(stats).toContainText('Today');
  await expect(stats).toContainText('Heart UK');
  await expect(stats).toContainText('2h 30m');
  await expect(stats).toContainText('45m');
  await page.reload();
  await expect(page.locator('section[aria-label="Listening time"]')).toContainText('Heart UK');
});

test('listening time dashboard ticks each second during actual playback and freezes on pause', async ({ page }) => {
  await mockAudio(page);
  await ready(page, '/europe/belgium/studio-brussel');
  const dock = page.locator('.radio-player-dock');
  await dock.getByRole('button', { name: 'Play radio', exact: true }).click();
  await page.locator('aside.radio-desktop-sidebar a[href="/library#stats"]').click();

  const stats = page.locator('section[aria-label="Listening time"]');
  await expect(stats).toContainText('Counting listening time live');
  const total = stats.locator('.grid .radio-surface').first().locator('p').nth(1);
  const displayedSeconds = async () => {
    const value = (await total.innerText()).trim();
    const match = /^(\d+)s$/.exec(value);
    return match ? Number(match[1]) : null;
  };

  // No reload required: reactive preview updates before the 5s storage checkpoint.
  await expect.poll(displayedSeconds, { timeout: 8_000 }).toBeGreaterThanOrEqual(2);
  await dock.getByRole('button', { name: 'Pause radio', exact: true }).click();
  await expect(stats).not.toContainText('Counting listening time live');
  const pausedSeconds = await displayedSeconds();
  await page.waitForTimeout(1_600);
  expect(await displayedSeconds()).toBe(pausedSeconds);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('radio_listening_duration_v1'))).totalMs)
    .toBeGreaterThanOrEqual(2_000);
});

test('successful media play starts duration when the playing event is delayed or missing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      configurable: true, get() { return this.__testPaused !== false; },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true, get() { return HTMLMediaElement.HAVE_FUTURE_DATA; },
    });
    HTMLMediaElement.prototype.play = function () {
      this.__testPaused = false;
      return Promise.resolve(); // No 'playing' event.
    };
    HTMLMediaElement.prototype.pause = function () {
      this.__testPaused = true;
      this.dispatchEvent(new Event('pause'));
    };
    HTMLMediaElement.prototype.load = function () {};
  });
  await ready(page, '/europe/belgium/studio-brussel');
  const dock = page.locator('.radio-player-dock');
  await dock.getByRole('button', { name: 'Play radio', exact: true }).click();
  await page.locator('aside.radio-desktop-sidebar a[href="/library#stats"]').click();
  const stats = page.locator('section[aria-label="Listening time"]');
  await expect(stats).toContainText('Counting listening time live');
  await expect.poll(async () => {
    const text = (await stats.locator('.grid .radio-surface').first().locator('p').nth(1).innerText()).trim();
    const match = /^(\d+)s$/.exec(text);
    return match ? Number(match[1]) : 0;
  }, { timeout: 8_000 }).toBeGreaterThanOrEqual(2);
});

test('daily listening chart switches 7/30/90-day views and survives reload', async ({ page }) => {
  await ready(page, '/');
  await page.evaluate(() => {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const key = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    const heart = '/europe/united-kingdom/heart-uk';
    localStorage.setItem('radio_listening_duration_v1', JSON.stringify({
      totalMs: 135_000, todayKey: key(today), todayMs: 45_000,
      byStation: { [heart]: { title: 'Heart UK', ms: 135_000 } },
      byDay: { [key(yesterday)]: 90_000, [key(today)]: 45_000 },
    }));
  });
  await page.goto('/library#stats');
  const chart = page.locator('figure[aria-label="Listening time by day"]');
  await expect(chart).toContainText('Listening time by day');
  await expect(chart).toContainText('2m 15s');
  await expect(chart.locator('button[title]')).toHaveCount(7);
  await chart.locator('button[title]').nth(5).click(); // Yesterday.
  await expect(chart.locator('figcaption')).toContainText('1m 30s');
  await chart.getByRole('button', { name: '30 days' }).click();
  await expect(chart.locator('button[title]')).toHaveCount(30);
  await chart.getByRole('button', { name: '90 days' }).click();
  await expect(chart.locator('button[title]')).toHaveCount(90);
  await page.reload();
  await expect(page.locator('figure[aria-label="Listening time by day"]')).toContainText('2m 15s');
});

test('personal listening-time tracking can be disabled without stopping radio and persists after reload', async ({ page }) => {
  await mockAudio(page);
  await ready(page, '/europe/belgium/studio-brussel');
  const dock = page.locator('.radio-player-dock');
  await dock.getByRole('button', { name: 'Play radio', exact: true }).click();
  await page.goto('/library#stats');
  const stats = page.locator('section[aria-label="Listening time"]');
  const tracking = stats.getByRole('switch', { name: 'Track listening time' });
  await expect(tracking).toHaveAttribute('aria-checked', 'true');
  await expect(stats).toContainText('Counting listening time live');
  await tracking.click();
  await expect(tracking).toHaveAttribute('aria-checked', 'false');
  await expect(stats).not.toContainText('Counting listening time live');
  await expect(dock.getByRole('button', { name: 'Pause radio', exact: true })).toBeVisible();

  const storedBefore = await page.evaluate(() => localStorage.getItem('radio_listening_duration_v1'));
  await page.waitForTimeout(1_700);
  expect(await page.evaluate(() => localStorage.getItem('radio_listening_duration_v1'))).toBe(storedBefore);
  expect(await page.evaluate(() => localStorage.getItem('radio_listening_tracking_enabled_v1'))).toBe('0');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Track listening time' })).toHaveAttribute('aria-checked', 'false');

  // Playback remains manual after reload; a new Play must not count when disabled.
  await dock.getByRole('button', { name: 'Play radio', exact: true }).click();
  await expect(dock.getByRole('button', { name: 'Pause radio', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('radio_listening_duration_v1'));
  await page.waitForTimeout(1_500);
  expect(await page.evaluate(() => localStorage.getItem('radio_listening_duration_v1'))).toBe(saved);
  await page.getByRole('switch', { name: 'Track listening time' }).click();
  await expect(stats).toContainText('Counting listening time live');
});

test('clear listening statistics requires confirmation and does not erase favorites or recent stations', async ({ page }) => {
  await ready(page, '/');
  await page.evaluate(() => {
    const heart = { url: '/europe/united-kingdom/heart-uk', title: 'Heart UK', image: '/brand/onair-mark.svg' };
    const today = new Date();
    const key = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    localStorage.setItem('radio_listening_library_v1', JSON.stringify({
      recent: [heart], favorites: [heart], lastStation: heart, lastState: 'pause',
    }));
    localStorage.setItem('radio_listening_duration_v1', JSON.stringify({
      totalMs: 120_000, todayKey: key, todayMs: 120_000, byDay: { [key]: 120_000 },
      byStation: { [heart.url]: { title: heart.title, ms: 120_000 } },
    }));
  });
  await page.goto('/library#stats');
  const stats = page.locator('section[aria-label="Listening time"]');
  await expect(stats).toContainText('2m 0s');
  const clear = stats.getByRole('button', { name: 'Delete listening statistics' });
  await clear.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Delete all listening statistics?');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('radio_listening_duration_v1'))).totalMs).toBe(120_000);

  await clear.click();
  await dialog.getByRole('button', { name: 'Yes, delete statistics' }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('radio_listening_duration_v1'))).toBeNull();
  await expect(stats).toContainText('No daily listening time recorded yet.');
  const lib = await history(page);
  expect(lib.recent).toHaveLength(1);
  expect(lib.favorites).toHaveLength(1);
  expect(lib.lastStation.title).toBe('Heart UK');
  await page.reload();
  await expect(page.locator('section[aria-label="Listening time"]')).toContainText('0s');
});
