import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recommendPersonalStations } from '../utils/personal-radio.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const station = (id, category, language, country, featured = false, featured_rank = 0) => ({
  url: `/asia/${country}/${id}`, station_name: id, station_country: 'world.asia.' + country,
  station_category: category, station_language: language, featured, featured_rank,
});
const catalog = [
  station('source', 'Jazz', 'vi', 'viet-nam'),
  station('similar-jazz', 'Jazz', 'vi', 'viet-nam'),
  station('country-only', 'News', 'en', 'viet-nam'),
  station('other-country', 'Jazz', 'en', 'singapore'),
  station('featured', 'Rock', 'en', 'singapore', true, 1),
  station('featured-second', 'Pop', 'fr', 'singapore', true, 2),
];

test('favorite-derived recommendations use real genre, language, country affinity and exclude existing library records', () => {
  const library = { favorites: [{ url: catalog[0].url }], recent: [{ url: catalog[2].url }] };
  const first = recommendPersonalStations(catalog, library);
  assert.equal(first.mode, 'personal');
  assert.equal(first.items[0].station.url, catalog[1].url);
  assert.equal(first.items[0].reason, 'genre');
  assert.ok(first.items.every(x => ![catalog[0].url, catalog[2].url].includes(x.station.url)));
  assert.ok(first.items.every(x => x.score > 0));
});

test('disabling listening-based personalization ignores history affinity but never repeats recently played records', () => {
  const library = { favorites: [], recent: [{ url: catalog[0].url }] };
  const r = recommendPersonalStations(catalog, library, { includeRecent: false });
  assert.equal(r.mode, 'curated');
  assert.equal(r.items[0].station.url, catalog[4].url);
  assert.ok(r.items.every(x => x.reason === 'featured'));
  assert.ok(r.items.every(x => x.station.url !== catalog[0].url));
});

test('no personal history has honest curated fallback with no fabricated popularity', () => {
  const output = recommendPersonalStations(catalog, { favorites: [], recent: [] }, { limit: 12 });
  assert.equal(output.mode, 'curated');
  assert.deepEqual(output.items.map(x => x.station.url), [catalog[4].url, catalog[5].url]);
  assert.deepEqual(recommendPersonalStations([station('plain','', '', 'viet-nam')], {}).items, []);
});

test('0/1/many station records and hidden suggestions remain bounded and deterministic', () => {
  assert.deepEqual(recommendPersonalStations(null, {}).items, []);
  assert.deepEqual(recommendPersonalStations([catalog[0]], { favorites: [{ url: catalog[0].url }] }).items, []);
  const many = Array.from({ length: 250 }, (_, i) => station(`jazz-${i}`, 'Jazz', 'vi', 'viet-nam'));
  const input = [catalog[0], ...many];
  const library = { favorites: [{ url: catalog[0].url }], recent: [] };
  const out = recommendPersonalStations(input, library);
  assert.equal(out.mode, 'personal');
  assert.equal(out.items.length, 4);
  assert.equal(out.items[0].station.url, many[0].url);
  const hidden = recommendPersonalStations(input, library, { excludedUrls: [many[0].url] });
  assert.equal(hidden.items[0].station.url, many[1].url);
  assert.equal(recommendPersonalStations(input, library, { limit: 999 }).items.length, 12);
  assert.equal(input.length, 251, 'source catalog remains unchanged');
});

test('missing metadata cannot create fake genre/language inference; canonical paths only', () => {
  const unknown = station('unknown', '', '', 'viet-nam');
  const other = station('other', '', '', 'viet-nam');
  const bad = { ...unknown, url: 'javascript:bad' };
  const r = recommendPersonalStations([unknown, other, bad], { favorites: [{ url: unknown.url }] });
  assert.equal(r.mode, 'personal');
  assert.equal(r.items[0].reason, 'country');
  const r2 = recommendPersonalStations([unknown, other, bad], { favorites: [{ url: '/asia/viet-nam/not-in-catalog' }] });
  assert.equal(r2.mode, 'empty');
});

test('client UI loads lazily, supports dismissal and preserves SEO, playback and privacy', async () => {
  const [panel, home, loader, store] = await Promise.all([
    read('components/panel/ForYou.vue'), read('pages/index.vue'),
    read('composables/useStationSearchIndex.ts'), read('stores/listening.ts'),
  ]);
  assert.match(home, /<PanelForYou \/>/);
  assert.match(home, /\$t\('home\.title'\)/);
  assert.match(panel, /const toggleOpen = \(\) =>/);
  assert.match(panel, /if \(open\.value\) void load\(\)/);
  assert.match(panel, /listening\.hydrate\(\)/);
  assert.match(panel, /listeningDuration\.enabled/);
  assert.match(panel, /const dismiss = \(url: string\) =>/);
  assert.match(panel, /excludedUrls\.value = \[\.\.\.excludedUrls\.value, url\]/);
  assert.match(panel, /recommendPersonalStations\(index\.value, listening\.library/);
  assert.match(panel, /:to="result\.station\.url"/);
  assert.doesNotMatch(panel, /onMounted\(|playback\.activate|localStorage\.setItem|fetch\(/);
  assert.match(loader, /Never fetch a multi-station catalog simply because the global header mounts/);
  assert.match(store, /this\.library = parseListeningLibrary/);
});

test('For You UI has translations in all 7 locales', async () => {
  for (const lang of ['en-US', 'vi-VN', 'fr-FR', 'ja-JP', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const d = JSON.parse(await read('lang/' + lang + '.json'));
    for (const key of [
      'title','description','show','hide_panel','loading','unavailable','retry','based_on_your_library',
      'curated_intro','reason_genre','reason_language','reason_country','reason_featured','dismiss','empty','privacy_note',
    ]) assert.ok(typeof d.for_you[key] === 'string' && d.for_you[key].trim(), lang + ': ' + key);
  }
});
