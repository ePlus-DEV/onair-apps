import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const source = () => read('public/catalog/providers/apple-music.json').then(JSON.parse);


const isCanonicalTuneInDirectory = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'tunein.com'
      && url.pathname === '/radio/music/'
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
};

test('Apple Music provider stays separate from country-based audio catalog', async () => {
  const [index, provider, routes, searchIndex] = await Promise.all([
    read('public/catalog/providers/index.json').then(JSON.parse),
    source(),
    read('build/globalRadioRoutes.ts'),
    read('scripts/build-station-search-index.mjs'),
  ]);
  assert.equal(index.providers.length, 1);
  assert.equal(index.providers[0].catalog, '/catalog/providers/apple-music.json');
  assert.equal(index.providers[0].href, '/global-radio/apple-music');
  assert.equal(index.providers[0].playback, 'external');
  assert.equal(provider.id, 'apple-music');
  assert.equal(provider.coverage, 'global');
  assert.equal(provider.origin_country, 'US');
  assert.equal(provider.playback, 'external');
  assert.match(routes, /getGlobalRadioRoutes/);
  assert.match(routes, /station\.tunein_url/);
  assert.match(searchIndex, /public\/radio/);
  assert.doesNotMatch(searchIndex, /catalog\/providers/, 'external-only cards must not appear in HTMLAudio search');
});

test('seven verified TuneIn Apple Music pages with unique IDs and no audio stream', async () => {
  const provider = await source();
  assert.equal(provider.schema_version, 1);
  assert.equal(provider.stations.length, 7);
  assert.equal(new Set(provider.stations.map(x => x.id)).size, 7);
  assert.ok(provider.discovery_sources.some(isCanonicalTuneInDirectory), 'must link to the canonical HTTPS TuneIn music directory');
  assert.match(provider.metadata_checked_on, /^\d{4}-\d{2}-\d{2}$/);
  const expected = new Map([
    ['apple-music-1', 's345732'],
    ['apple-music-hits', 's345724'],
    ['apple-music-country', 's345725'],
    ['apple-music-club', 's345726'],
    ['apple-musica-uno', 's345727'],
    ['apple-music-chill', 's345733'],
    ['apple-music-holiday-hits', 's363737'],
  ]);
  for (const station of provider.stations) {
    assert.match(station.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(station.title && station.genre && station.language && station.description);
    const tunein = new URL(station.tunein_url);
    assert.equal(tunein.protocol, 'https:');
    assert.equal(tunein.hostname, 'tunein.com');
    assert.ok(tunein.pathname.endsWith(expected.get(station.id) + '/'), station.id + ' source mismatch');
    const apple = new URL(station.listen_url);
    assert.equal(apple.hostname, 'music.apple.com');
    assert.match(apple.pathname, /\/station\//);
    for (const forbidden of ['stream', 'streams', 'stream_alternative', 'url', 'features', 'favorite']) {
      assert.equal(Object.hasOwn(station, forbidden), false, 'not an internal playback station: ' + forbidden);
    }
  }
});


test('TuneIn discovery source rejects host spoofing and unsafe URL variants', () => {
  const invalid = [
    'https://tunein.com.evil.example/radio/music/',
    'https://evil.example/path/https://tunein.com/radio/music/',
    'https://tunein.com@evil.example/radio/music/',
    'http://tunein.com/radio/music/',
    'https://tunein.com/radio/music/?redirect=evil',
    'not-a-url',
  ];
  for (const url of invalid) {
    assert.equal(isCanonicalTuneInDirectory(url), false, url);
  }
  assert.equal(isCanonicalTuneInDirectory('https://tunein.com/radio/music/'), true);
});

test('seasonal Holiday Hits is a distinct verified TuneIn listing, not a duplicate of Apple Music Hits', async () => {
  const provider = await source();
  const holiday = provider.stations.find(x => x.id === 'apple-music-holiday-hits');
  const hits = provider.stations.find(x => x.id === 'apple-music-hits');
  assert.ok(holiday);
  assert.equal(holiday.seasonal, true);
  assert.equal(holiday.genre, 'Holiday');
  assert.equal(holiday.tunein_url, 'https://tunein.com/radio/Apple-Music-Holiday-Hits-s363737/');
  assert.equal(holiday.listen_url, 'https://music.apple.com/us/station/holiday-hits/ra.6825447412');
  assert.notEqual(holiday.listen_url, hits.listen_url);
  assert.notEqual(holiday.tunein_url, hits.tunein_url);
});

test('new public provider routes are prerendered and indexed only on production', async () => {
  const [nuxt, generator, home, sidebar, detail] = await Promise.all([
    read('nuxt.config.ts'),
    read('build/globalRadioRoutes.ts'),
    read('pages/index.vue'),
    read('components/AppSidebar.vue'),
    read('pages/global-radio/apple-music/[station].vue'),
  ]);
  assert.match(nuxt, /getGlobalRadioRoutes/);
  assert.match(nuxt, /\.\.\.getGlobalRadioRoutes\(\)/);
  assert.match(nuxt, /\.\.\.staticSeoRoutes\.map\(\(route\) => route\.loc\)/);
  assert.match(nuxt, /urls: noIndex \? \[\] : \[/);
  assert.match(generator, /entry\.href \+ '\/' \+ station\.id/);
  assert.match(home, /to="\/global-radio"/);
  assert.match(sidebar, /to="\/global-radio"/);
  assert.match(detail, /useStaticPageSeo/);
  assert.match(detail, /v-if="station\?\.tunein_url"/);
  assert.doesNotMatch(detail, /playback\.(?:activate|requestStation|play)\s*\(/);
});

test('seven translations have external / seasonal labels', async () => {
  for (const locale of ['en-US', 'vi-VN', 'ja-JP', 'fr-FR', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const dict = JSON.parse(await read('lang/' + locale + '.json'));
    for (const key of [
      'title', 'apple_description', 'listen_on_apple', 'listen_on_tunein',
      'seasonal', 'seasonal_note', 'external_note', 'apple_access', 'by_country',
    ]) {
      assert.ok(typeof dict.global_radio?.[key] === 'string' && dict.global_radio[key].trim(), locale + ': missing ' + key);
    }
  }
});
