// Preview-only browser probe. Never output signed URLs, tokens, audio, provider responses or full exceptions.
import test from 'node:test';
import { chromium } from '@playwright/test';

const enabled = process.env.ONAIR_PR_PREVIEW === 'true' &&
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_HEAD_REF === 'feat/tunein-apple-radio-song-history-20261105';

test('diagnostic only: preview Apple Music Play in real Chromium', {
  skip: !enabled, timeout: 55000,
}, async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  } catch {
    console.log('APPLE_PREVIEW_BROWSER_PROBE', JSON.stringify({ result: 'chrome_unavailable' }));
    return;
  }
  try {
    const page = await browser.newPage({ locale: 'en-US' });
    const responses = { proxy: [], master: [], playlist: [], audio: [] };
    const failed = { proxy: 0, apple: 0 };
    let jsErrors = 0;
    page.on('pageerror', () => { jsErrors++; });
    page.on('response', response => {
      let uri;
      try { uri = new URL(response.url()); } catch { return; }
      if (uri.hostname.endsWith('.herokuapp.com') && uri.pathname.includes('Tune.ashx')) {
        if (responses.proxy.length < 4) responses.proxy.push(response.status());
      }
      if (uri.hostname === 'itsliveradio.apple.com') {
        const kind = uri.pathname.endsWith('.m3u8')
          ? (uri.pathname.includes('index-') ? 'master' : 'playlist') : 'audio';
        if (responses[kind].length < 6) responses[kind].push(response.status());
      }
    });
    page.on('requestfailed', request => {
      let uri;
      try { uri = new URL(request.url()); } catch { return; }
      if (uri.hostname.endsWith('.herokuapp.com')) failed.proxy++;
      if (uri.hostname === 'itsliveradio.apple.com') failed.apple++;
    });
    try {
      await page.goto('https://preview.radio.eplus.dev/pr-preview/pr-375/global-radio/apple-music/',
        { waitUntil: 'domcontentloaded', timeout: 20000 });
      const play = page.getByRole('button', { name: 'Play on ePlus: Apple Music 1' });
      await play.waitFor({ timeout: 8000 });
      const disabled = await play.isDisabled();
      if (!disabled) await play.click({ timeout: 6000 });
      if (!disabled) await page.waitForTimeout(11000);
      const media = await page.evaluate(() => {
        const a = document.querySelector('audio');
        return a ? {
          exists: true, paused: a.paused, readyState: a.readyState,
          networkState: a.networkState, errorCode: a.error?.code || null,
          progressing: a.currentTime > 0,
        } : { exists: false };
      });
      console.log('APPLE_PREVIEW_BROWSER_PROBE', JSON.stringify({
        result: 'observed', disabled, media, responses, failed, jsErrors,
      }));
    } catch {
      console.log('APPLE_PREVIEW_BROWSER_PROBE', JSON.stringify({
        result: 'navigation_or_click_failed', responses, failed, jsErrors,
      }));
    }
  } finally {
    await browser.close();
  }
});
