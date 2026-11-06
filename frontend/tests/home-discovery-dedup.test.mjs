import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Home does not duplicate station discovery while keeping useful features', async () => {
  const home = await read('pages/index.vue');
  assert.doesNotMatch(home, /PanelStationDiscovery/);
  assert.match(home, /<PanelSurpriseRadio\s*\/>/);
  assert.match(home, /<PanelForYou\s*\/>/);
  assert.match(home, /<PanelRadio compact\s*\/>/);
  assert.match(home, /<PanelFeaturedStations\s/);
  assert.match(home, /home\.title/);
  assert.match(home, /ogDescription:\s*\(\)\s*=>\s*seoDescription\.value/);
});

test('deleted duplicate panel and helper cannot accidentally reappear via imports', async () => {
  for (const path of [
    'components/panel/StationDiscovery.vue',
    'utils/station-discovery.mjs',
    'tests/station-discovery.test.mjs',
  ]) {
    await assert.rejects(() => access(new URL('../' + path, import.meta.url)), { code: 'ENOENT' });
  }
});

test('all seven locales keep For You and Surprise Me without unused discovery strings', async () => {
  for (const locale of ['en-US', 'vi-VN', 'fr-FR', 'ja-JP', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const text = await read('lang/' + locale + '.json');
    const data = JSON.parse(text);
    assert.equal(Object.hasOwn(data, 'discovery'), false, locale + ' leftover UI section');
    assert.ok(data.for_you?.title, locale + ' For You missing');
    assert.ok(data.surprise?.title, locale + ' Surprise Me missing');
    assert.ok(data.home?.title, locale + ' SEO homepage title missing');
  }
});

test('UI roadmap records de-scoping without removing other feature sections', async () => {
  const doc = await read('docs/UI_ROADMAP.md');
  assert.match(doc, /Advanced Discovery panel removed/);
  assert.doesNotMatch(doc, /## Faceted Browse — #342 \(initial implementation\)/);
  assert.match(doc, /## Surprise Me — #344/);
  assert.match(doc, /## On-device For You — #343/);
});
