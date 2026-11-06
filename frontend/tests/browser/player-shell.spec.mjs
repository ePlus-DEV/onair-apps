import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const dock = page => page.locator('.radio-player-dock');
async function ready(page, path) {
  await page.goto(path);
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await expect(dock(page)).toBeVisible();
}
async function mockMedia(page) {
  await page.addInitScript(() => {
    window.radioMediaCalls = { play: 0, load: 0 };
    HTMLMediaElement.prototype.play = function () {
      window.radioMediaCalls.play += 1;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.load = function () { window.radioMediaCalls.load += 1; };
  });
  await page.route(/api\.webrad\.io/, route => route.fulfill({ json: { success: false } }));
  await page.route(/api\.iconify\.design/, route => route.abort());
}

test('audio, volume and selected station survive home/region/country navigation; pause stays paused', async ({ page }) => {
  await mockMedia(page);
  await ready(page, '/europe/belgium/studio-brussel');
  // Client-only controls must render from the static bundle without an icon API.
  await expect.poll(() => dock(page).locator('.iconify').evaluateAll(icons =>
    icons.length >= 5 && icons.every(icon => getComputedStyle(icon).maskImage !== 'none'),
  )).toBe(true);
  await dock(page).getByRole('button', { name: 'Play radio', exact: true }).click();
  await expect(dock(page).getByRole('button', { name: 'Pause radio', exact: true })).toBeVisible();
  await page.evaluate(() => { window.radioSavedAudio = document.querySelector('audio'); });
  await dock(page).getByRole('slider', { name: 'Volume', exact: true }).first().evaluate(input => { input.value = '0.37'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const before = await page.evaluate(() => ({ ...window.radioMediaCalls }));
  await page.locator('header a[href="/"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('main a[href="/asia"]').first().click();
  await expect(page).toHaveURL(/\/asia$/);
  await page.locator('main a[href="/asia/viet-nam"]').first().click();
  await expect(page).toHaveURL(/\/asia\/viet-nam$/);
  expect(await page.evaluate(() => document.querySelector('audio') === window.radioSavedAudio)).toBe(true);
  expect(await page.locator('audio').evaluate(audio => audio.volume)).toBeCloseTo(0.37);
  expect(await page.evaluate(() => window.radioMediaCalls)).toEqual(before);
  await expect(dock(page).getByRole('link')).toContainText('Studio Brussel');
  await dock(page).getByRole('button', { name: 'Pause radio', exact: true }).click();
  await page.locator('header a[href="/"]').first().click();
  await expect(dock(page).getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.radioMediaCalls.play)).toBe(before.play);
  await dock(page).getByRole('button', { name: /^Next station:/ }).click();
  await expect(page).toHaveURL(/\/europe\/belgium\/mnm$/);
  await expect(dock(page).getByRole('link')).toContainText('MNM');
  await expect(dock(page).getByRole('button', { name: 'Pause radio', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('audio') === window.radioSavedAudio)).toBe(true);
});

test('Media Session publishes station artwork and switches stations with headset Next/Previous', async ({ page }) => {
  await page.addInitScript(() => {
    window.radioMediaSession = { callbacks: {}, metadata: null, playbackState: 'none' };
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: {
        setActionHandler(name, handler) { window.radioMediaSession.callbacks[name] = handler; },
        set metadata(value) { window.radioMediaSession.metadata = value; },
        get metadata() { return window.radioMediaSession.metadata; },
        set playbackState(value) { window.radioMediaSession.playbackState = value; },
        get playbackState() { return window.radioMediaSession.playbackState; },
      },
    });
    window.MediaMetadata = class { constructor(data) { Object.assign(this, data); } };
  });
  await mockMedia(page);
  await ready(page, '/europe/belgium/studio-brussel');
  await expect.poll(() => page.evaluate(() => window.radioMediaSession.metadata?.album)).toBe('Studio Brussel');
  const image = await page.evaluate(() => window.radioMediaSession.metadata?.artwork?.[0]?.src);
  expect(image).toMatch(/^https?:\/\//);
  expect(image).toContain('/img/');
  const supported = await page.evaluate(() => Object.keys(window.radioMediaSession.callbacks));
  expect(supported).toEqual(expect.arrayContaining(['play', 'pause', 'nexttrack', 'previoustrack']));
  expect(await page.evaluate(() => typeof window.radioMediaSession.callbacks.seekforward)).toBe('function');
  expect(await page.evaluate(() => typeof window.radioMediaSession.callbacks.seekbackward)).toBe('function');

  await page.evaluate(() => window.radioMediaSession.callbacks.nexttrack());
  await expect(page).toHaveURL(/\/europe\/belgium\/mnm$/);
  await expect.poll(() => page.evaluate(() => window.radioMediaSession.metadata?.album)).toBe('MNM');
  await page.evaluate(() => window.radioMediaSession.callbacks.previoustrack());
  await expect(page).toHaveURL(/\/europe\/belgium\/studio-brussel$/);
  await expect.poll(() => page.evaluate(() => window.radioMediaSession.metadata?.album)).toBe('Studio Brussel');
  // iOS frequently shows ±10s controls instead of track buttons; those
  // should still change the live radio STATION, not attempt to skip a song.
  await page.evaluate(() => window.radioMediaSession.callbacks.seekforward());
  await expect(page).toHaveURL(/\/europe\/belgium\/mnm$/);
  await page.evaluate(() => window.radioMediaSession.callbacks.seekbackward());
  await expect(page).toHaveURL(/\/europe\/belgium\/studio-brussel$/);
});

test('station detail links never start audio; Play starts it and browsing preserves the active station', async ({ page }) => {
  await mockMedia(page);
  await ready(page, '/europe/belgium');
  const initial = await page.evaluate(() => ({
    calls: window.radioMediaCalls.play,
    station: document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('playback').station?.url,
  }));
  await page.locator('main a[href="/europe/belgium/mnm"]').click();
  await expect(page).toHaveURL(/\/europe\/belgium\/mnm$/);
  expect(await page.evaluate(() => window.radioMediaCalls.play)).toBe(initial.calls);
  expect(await page.evaluate(() => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('playback').station?.url)).toBe(initial.station);

  // The detail action is the explicit Play gesture; opening details is not.
  await page.locator('main .radio-station-detail-action').click();
  await expect.poll(() => page.evaluate(() => window.radioMediaCalls.play)).toBe(initial.calls + 1);
  await expect(dock(page).getByRole('link')).toContainText('MNM');
  await page.locator('main a[href="/europe/belgium/studio-brussel"]').first().click();
  await expect(page).toHaveURL(/\/europe\/belgium\/studio-brussel$/);
  await expect(dock(page).getByRole('link')).toContainText('MNM');
  expect(await page.evaluate(() => window.radioMediaCalls.play)).toBe(initial.calls + 1);
  await expect(dock(page).getByRole('button', { name: 'Pause radio', exact: true })).toBeVisible();
});

test('direct station URL remains silent until its Play button is clicked', async ({ page }) => {
  await mockMedia(page);
  await ready(page, '/europe/belgium/studio-brussel');
  expect(await page.evaluate(() => window.radioMediaCalls.play)).toBe(0);
  await expect(dock(page).getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
  await page.locator('main .radio-station-detail-action').click();
  await expect.poll(() => page.evaluate(() => window.radioMediaCalls.play)).toBe(1);
});

test('desktop queue stays beside the catalog while scrolling and stops before the footer', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 920 });
  await mockMedia(page);
  await page.route(/zing\.eplus\.dev\/api\//, route => route.fulfill({
    json: { err: 0, data: { items: [{ title: 'EDM schedule fixture', startTime: 1791446400, endTime: 1791450000 }] } },
    headers: { 'access-control-allow-origin': '*' },
  }));
  await ready(page, '/asia/viet-nam/edm-radio-zing-mp3');
  const panel = page.locator('.radio-right-panel');
  const footer = page.locator('footer');
  await expect(panel).toBeHidden();
  await dock(page).getByRole('button', { name: 'Channels & schedule', exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('tab', { name: /Schedule/ })).toBeVisible();
  await page.locator('header a[href="/"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 500);
  });
  await expect.poll(async () => (await panel.boundingBox()).y).toBeCloseTo(96, 0);

  for (const [theme, tab] of [['Light', /Schedule/], ['Dark', /All channels/]]) {
    await panel.getByRole('tab', { name: tab }).click();
    await page.locator('header').getByRole('button', { name: /^(System|Light|Dark)$/ }).click();
    await page.getByRole('menuitemcheckbox', { name: theme, exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(async () => {
      const panelBounds = await panel.boundingBox();
      const footerBounds = await footer.boundingBox();
      return panelBounds.y + panelBounds.height <= footerBounds.y;
    }).toBe(true);
    const footerLink = footer.locator('nav a').first();
    await expect(footerLink).toBeInViewport();
    expect(await footerLink.evaluate(link => {
      const bounds = link.getBoundingClientRect();
      const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      return link.contains(target);
    })).toBe(true);
  }

  await dock(page).getByRole('button', { name: 'Channels & schedule', exact: true }).click();
  await expect(panel).toBeHidden();
  await dock(page).getByRole('button', { name: 'Channels & schedule', exact: true }).click();
  await expect(panel).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const panelBounds = await panel.boundingBox();
  const footerBounds = await footer.boundingBox();
  expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(footerBounds.y);
  await page.locator('header a[href="/"]').first().click();
  await page.locator('main a[href="/europe"]').first().click();
  await expect(page).toHaveURL(/\/europe$/);
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(async () => {
    const panelBounds = await panel.boundingBox();
    const footerBounds = await footer.boundingBox();
    return panelBounds.y + panelBounds.height <= footerBounds.y;
  }).toBe(true);
});

test('pausing during a pending play request ignores its late completion', async ({ page }) => {
  await mockMedia(page);
  await ready(page, '/europe/belgium/studio-brussel');
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = function () {
      return new Promise(resolve => { window.radioResolvePlay = resolve; });
    };
  });
  await dock(page).getByRole('button', { name: 'Play radio', exact: true }).click();
  await dock(page).getByRole('button', { name: 'Pause radio', exact: true }).click();
  await page.evaluate(() => window.radioResolvePlay());
  await expect(dock(page).getByRole('button', { name: 'Play radio', exact: true })).toBeVisible();
});

test('Nuxt UI language/theme menus close on selection and Escape; search traps and restores focus', async ({ page }) => {
  await mockMedia(page);
  await ready(page, '/europe/belgium');
  const language = page.getByRole('button', { name: 'Language:', exact: true });
  await language.click();
  await page.getByRole('menuitemcheckbox', { name: /Tiếng Việt/ }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  const vietnameseLanguage = page.getByRole('button', { name: 'Ngôn ngữ:', exact: true });
  await vietnameseLanguage.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(vietnameseLanguage).toBeFocused();
  await vietnameseLanguage.click();
  await page.getByRole('menuitemcheckbox', { name: /English/ }).click();
  const theme = page.locator('header').getByRole('button', { name: /^(System|Light|Dark)$/ });
  await theme.click();
  await page.getByRole('menuitemcheckbox', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('menu')).toHaveCount(0);
  const searchTrigger = page.locator('header').getByRole('button', { name: 'Search...', exact: true });
  await searchTrigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#search-input')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.getByRole('dialog').evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(searchTrigger).toBeFocused();
});

test('320px mobile dock and drawer stay inside the viewport, including long RTL metadata', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockMedia(page);
  await ready(page, '/europe/belgium/studio-brussel');
  await page.evaluate(() => {
    document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('playback').station.title = 'محطة راديو بعنوان طويل جداً '.repeat(12);
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dock(page).getByRole('button', { name: 'Channels & schedule', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(async () => {
    const bounds = await dialog.boundingBox();
    return bounds.x + bounds.width;
  }).toBeLessThanOrEqual(321);
  await expect(dialog.getByRole('slider', { name: 'Volume', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(dock(page).getByRole('button', { name: 'Channels & schedule', exact: true })).toBeFocused();
});

test('mobile web-volume slider has a usable touch target and changes volume', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockMedia(page);
  await ready(page, '/europe/belgium/studio-brussel');
  await dock(page).getByRole('button', { name: 'Channels & schedule', exact: true }).click();
  const slider = page.getByRole('dialog').getByRole('slider', { name: 'Volume', exact: true });
  await expect(slider).toBeVisible();
  const bounds = await slider.boundingBox();
  expect(bounds.height).toBeGreaterThanOrEqual(40);
  expect(bounds.width).toBeGreaterThanOrEqual(64);
  await page.mouse.click(bounds.x + bounds.width * 0.25, bounds.y + bounds.height / 2);
  await expect.poll(() => page.locator('audio').evaluate(media => media.volume)).toBeLessThan(0.8);
});

test('iOS volume controls show hardware instructions rather than an inoperative slider', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  try {
    const page = await context.newPage();
    await mockMedia(page);
    await ready(page, '/europe/belgium/studio-brussel');
    await dock(page).getByRole('button', { name: 'Channels & schedule', exact: true }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('slider', { name: 'Volume', exact: true })).toHaveCount(0);
    await expect(drawer.getByRole('note')).toContainText("On iPhone or iPad");
  } finally {
    await context.close();
  }
});

test('real hls.js playback waits for a local manifest, continues across pages and keeps one audio element', async ({ page }) => {
  const manifest = await readFile(new URL('./fixtures/live.m3u8', import.meta.url), 'utf8');
  const segment = await readFile(new URL('./fixtures/radio-fixture-0.ts', import.meta.url));
  await page.route(/\.m3u8(?:$|[?])/, route => route.fulfill({ body: manifest, contentType: 'application/vnd.apple.mpegurl', headers: { 'access-control-allow-origin': '*' } }));
  await page.route('**/radio-fixture-0.ts', route => route.fulfill({ body: segment, contentType: 'video/mp2t', headers: { 'access-control-allow-origin': '*' } }));
  await page.route(/zing\.eplus\.dev\/api\//, route => route.fulfill({ json: { err: 0, data: { items: [] } }, headers: { 'access-control-allow-origin': '*' } }));
  await ready(page, '/asia/viet-nam/edm-radio-zing-mp3');
  await dock(page).getByRole('button', { name: 'Play radio', exact: true }).click();
  await expect(dock(page).getByRole('button', { name: 'Pause radio', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.readyState)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await page.evaluate(() => { window.radioSavedAudio = document.querySelector('audio'); });
  await page.locator('header a[href="/"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => document.querySelector('audio') === window.radioSavedAudio)).toBe(true);
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(false);
  await expect(dock(page).getByRole('link')).toContainText('EDM');
});


test('mobile dock keeps station text clear of Play and Playlist at 320–390px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockMedia(page);
  await ready(page, '/europe/belgium/studio-brussel');
  await page.evaluate(() => {
    document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('playback').station.title =
      'Very long station title across different countries '.repeat(5);
  });

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 740 });
    const boxes = await dock(page).evaluate(element => {
      const consoleRow = element.querySelector('.radio-player-console');
      const info = consoleRow.children[0].getBoundingClientRect();
      const title = consoleRow.querySelector('.radio-player-title').getBoundingClientRect();
      const play = consoleRow.querySelector('.radio-player-main-action').getBoundingClientRect();
      const playlist = consoleRow.children[2].querySelector('button').getBoundingClientRect();
      return {
        infoRight: info.right,
        titleRight: title.right,
        playLeft: play.left,
        playRight: play.right,
        playlistLeft: playlist.left,
        playlistRight: playlist.right,
        viewport: innerWidth,
      };
    });
    expect(boxes.playLeft, `Play must not cover metadata at ${width}px`).toBeGreaterThanOrEqual(boxes.infoRight);
    expect(boxes.titleRight, `Title must stay in info column at ${width}px`).toBeLessThanOrEqual(boxes.infoRight + 1);
    expect(boxes.playlistLeft, `Playlist must not overlap Play at ${width}px`).toBeGreaterThanOrEqual(boxes.playRight);
    expect(boxes.playlistRight, `Playlist must fit viewport at ${width}px`).toBeLessThanOrEqual(boxes.viewport);
  }

  const playlistButton = dock(page).getByRole('button', { name: 'Channels & schedule', exact: true });
  await expect(playlistButton).toBeVisible();
  await playlistButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});


test('country marquee keeps two mobile columns without wrapping long names', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockMedia(page);
  await ready(page, '/');
  const africa = page.locator('#explore-radio .radio-country-compact').first();
  await expect(africa).toBeVisible();
  const cards = africa.locator('.radio-station-card');
  await expect(cards.nth(1)).toBeVisible();

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 740 });
    const bounds = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
    expect(bounds[0]).toBeTruthy();
    expect(bounds[1]).toBeTruthy();
    expect(Math.abs(bounds[0].y - bounds[1].y), `Two country columns at ${width}px`).toBeLessThan(2);
    expect(bounds[1].x, `Second country card is alongside first at ${width}px`).toBeGreaterThan(bounds[0].x);
    expect(bounds[1].x + bounds[1].width).toBeLessThanOrEqual(width + 1);
    const titleHeights = await africa.locator('.country-marquee-viewport').evaluateAll(items =>
      items.map(item => ({ visible: item.clientHeight, line: Number.parseFloat(getComputedStyle(item).lineHeight) || 20 })),
    );
    expect(titleHeights.length).toBeGreaterThan(0);
    expect(titleHeights.every(item => item.visible <= item.line + 2), `Every country name stays on one line at ${width}px`).toBe(true);
  }

  await expect.poll(() => africa.locator('.country-marquee-content--overflow').count()).toBeGreaterThan(0);
  const longName = africa.locator('.country-marquee-content--overflow').first();
  await expect(longName).toBeVisible();
  expect(await longName.evaluate(el => getComputedStyle(el).animationName)).toMatch(/^country-marquee-slide/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => longName.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});


test('mobile country station cards show Play/Pause and marquee titles without covering controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockMedia(page);
  await ready(page, '/africa/south-africa');
  const cards = page.locator('main .radio-station-card');
  await expect(cards.first()).toBeVisible();
  await expect(cards.nth(1)).toBeVisible();

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 740 });
    const card = cards.nth(1);
    const title = card.locator('.country-marquee-viewport');
    const play = card.getByRole('button', { name: /^Play/ });
    await expect(title).toBeVisible();
    await expect(play).toBeVisible();
    const geometry = await card.evaluate(element => {
      const text = element.querySelector('.country-marquee-viewport');
      const control = element.querySelector('button');
      const textRect = text.getBoundingClientRect();
      const playRect = control.getBoundingClientRect();
      return {
        textRight: textRect.right,
        playLeft: playRect.left,
        titleHeight: text.clientHeight,
        lineHeight: Number.parseFloat(getComputedStyle(text).lineHeight) || 20,
        opacity: getComputedStyle(control).opacity,
        playWidth: playRect.width,
      };
    });
    expect(geometry.titleHeight, 'Station name stays on one line').toBeLessThanOrEqual(geometry.lineHeight + 2);
    expect(geometry.textRight, 'Play does not cover station name').toBeLessThanOrEqual(geometry.playLeft + 1);
    expect(geometry.opacity).toBe('1');
    expect(geometry.playWidth).toBeGreaterThanOrEqual(44);
  }

  const firstCard = cards.first();
  await firstCard.getByRole('button', { name: /^Play/ }).click();
  await expect(firstCard.getByRole('button', { name: /^Pause/ })).toBeVisible();
  await expect(dock(page).getByRole('button', { name: 'Pause radio', exact: true })).toBeVisible();
  await firstCard.getByRole('button', { name: /^Pause/ }).click();
  await expect(firstCard.getByRole('button', { name: /^Play/ })).toBeVisible();
});


test('Featured cards marquee long titles on a single line without covering Play', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockMedia(page);
  await ready(page, '/');
  const cards = page.locator('.radio-featured-card');
  await expect(cards.nth(1)).toBeVisible();

  const longCard = cards.first();
  const shortCard = cards.nth(1);
  const label = longCard.locator('.country-marquee-viewport');
  const play = longCard.getByRole('button', { name: /^Play/ });
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 740 });
    await expect(label).toBeVisible();
    await expect(play).toBeVisible();

    const layout = await longCard.evaluate(card => {
      const viewport = card.querySelector('.country-marquee-viewport');
      const button = card.querySelector('button');
      const text = viewport.getBoundingClientRect();
      const action = button.getBoundingClientRect();
      return {
        titleHeight: viewport.clientHeight,
        lineHeight: parseFloat(getComputedStyle(viewport).lineHeight) || 20,
        textRight: text.right,
        playLeft: action.left,
        buttonOpacity: getComputedStyle(button).opacity,
      };
    });
    expect(layout.titleHeight, 'Featured title remains on one line').toBeLessThanOrEqual(layout.lineHeight + 2);
    expect(layout.textRight, 'Featured title does not overlap Play').toBeLessThanOrEqual(layout.playLeft + 1);
    expect(layout.buttonOpacity).toBe('1');
  }

  const scrolling = longCard.locator('.country-marquee-content--overflow');
  await expect(scrolling).toBeVisible();
  expect(await scrolling.evaluate(el => getComputedStyle(el).animationName)).toMatch(/^country-marquee-slide/);
  await expect(shortCard.locator('.country-marquee-content--overflow')).toHaveCount(0);

  await play.click();
  await expect(longCard.getByRole('button', { name: /^Pause/ })).toBeVisible();
});

test('dark station detail Play/Pause label and icon stay white', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMedia(page);
  await ready(page, '/europe/belgium/studio-brussel');
  await page.evaluate(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  });

  const button = page.locator('main .radio-station-detail-action');
  await expect(button).toBeVisible();
  const foreground = () => button.evaluate(el => ({
    text: getComputedStyle(el).color,
    icon: getComputedStyle(el.querySelector('.iconify') || el).color,
  }));
  await expect.poll(async () => (await foreground()).text).toBe('rgb(255, 255, 255)');
  await expect.poll(async () => (await foreground()).icon).toBe('rgb(255, 255, 255)');

  await button.click();
  await expect(button).toContainText('Pause');
  await expect.poll(async () => (await foreground()).text).toBe('rgb(255, 255, 255)');
  await expect.poll(async () => (await foreground()).icon).toBe('rgb(255, 255, 255)');
});
