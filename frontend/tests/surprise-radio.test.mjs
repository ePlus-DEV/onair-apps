import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  pickRandomStation, randomStationCandidates, randomStationFacets,
} from '../utils/surprise-radio.mjs';
import { buildStationSearchIndex } from '../scripts/build-station-search-index.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const sample = [
  { url: '/asia/viet-nam/a', station_name: 'A', station_country: 'world.asia.viet_nam', station_category: 'News', station_language: 'vi' },
  { url: '/asia/viet-nam/b', station_name: 'B', station_country: 'world.asia.viet_nam', station_category: 'Music', station_language: 'vi' },
  { url: '/europe/france/c', station_name: 'C', station_country: 'world.europe.france', station_category: 'Music', station_language: 'fr' },
];

test('uniform range selection with deterministic boundaries, no repeats for multiple candidates', () => {
  assert.equal(pickRandomStation(sample, {}, () => 0).url, '/asia/viet-nam/a');
  assert.equal(pickRandomStation(sample, {}, () => 0.999999).url, '/europe/france/c');
  assert.equal(pickRandomStation(sample, {}, () => 1).url, '/europe/france/c');
  assert.equal(pickRandomStation(sample, { previousUrl: '/asia/viet-nam/a' }, () => 0).url, '/asia/viet-nam/b');
  assert.equal(pickRandomStation(sample.slice(0, 1), { previousUrl: '/asia/viet-nam/a' }).url, '/asia/viet-nam/a');
  assert.equal(pickRandomStation([], {}, () => 0), null);
});

test('optional country, genre and language filters use only actual metadata', () => {
  assert.deepEqual(randomStationCandidates(sample, { country: 'world.asia.viet_nam' }).map(s => s.station_name), ['A', 'B']);
  assert.deepEqual(randomStationCandidates(sample, { genre: 'Music', language: 'fr' }).map(s => s.station_name), ['C']);
  assert.equal(pickRandomStation(sample, { language: 'en' }), null);
  assert.deepEqual(randomStationFacets(sample, 'station_category', { country: 'world.asia.viet_nam' }), ['Music', 'News']);
  assert.deepEqual(randomStationFacets(sample, 'station_language', { genre: 'Music' }), ['fr', 'vi']);
});

test('invalid paths, duplicate station records and empty titles are discarded without mutating input', () => {
  const source = [...sample, sample[0], { ...sample[0], url: 'javascript:alert(1)' }, { ...sample[0], station_name: '' }];
  assert.equal(randomStationCandidates(source).length, 3);
  assert.equal(source.length, 6);
});

test('build index emits only real, optional display facets and excludes disabled/unsafe primary sources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'surprise-stations-'));
  try {
    const radioDir = join(root, 'radio', 'asia');
    const output = join(root, 'search', 'stations.json');
    await mkdir(radioDir, { recursive: true });
    await writeFile(join(radioDir, 'viet-nam.json'), JSON.stringify({
      jazz: { title: 'Jazz VN', stream: 'https://audio.example/live.mp3?secret=private', category: 'Jazz', language: 'vi' },
      news: { title: 'News VN', stream: 'https://audio.example/news', category: ['incorrect'], language: null },
      disabled: { title: 'Inactive', stream: 'https://audio.example/d', disabled: true },
      invalid: { title: 'No audio', stream: 'javascript:alert(1)' },
    }));
    const built = await buildStationSearchIndex({ radioRoot: join(root, 'radio'), outputFile: output });
    assert.equal(built.length, 2);
    const jazz = built.find(item => item.url === '/asia/viet-nam/jazz');
    assert.equal(jazz.station_category, 'Jazz');
    assert.equal(jazz.station_language, 'vi');
    const news = built.find(item => item.url === '/asia/viet-nam/news');
    assert.equal(news.station_category, '');
    assert.equal(news.station_language, '');
    assert.doesNotMatch(await readFile(output, 'utf8'), /audio\.example|secret=private/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('homepage only mounts random discovery on client and preserves original SEO text', async () => {
  const [page, panel, store] = await Promise.all([
    read('pages/index.vue'),
    read('components/panel/SurpriseRadio.vue'),
    read('stores/playback.ts'),
  ]);
  assert.match(page, /<ClientOnly><PanelSurpriseRadio \/><\/ClientOnly>/);
  assert.match(page, /\$t\('home\.title'\)/);
  assert.match(panel, /useStationSearchIndex\(\)/);
  assert.match(panel, /const toggleFilters = \(\) =>/);
  assert.match(panel, /if \(filtersOpen\.value\) void load\(\)/);
  assert.match(panel, /const surprise = async \(\) =>/);
  assert.match(panel, /playback\.activate\(createPlaybackStation/);
  assert.match(panel, /\{ autoplay: true \}/);
  assert.match(panel, /request !== generation \|\| route\.fullPath !== snapshot\.path/);
  assert.match(panel, /playback\.playRequest !== snapshot\.playRequest/);
  assert.match(panel, /randomStationCandidates/);
  assert.match(panel, /type="|<select/);
  assert.doesNotMatch(panel, /onMounted\(/, 'catalog must not load or play merely on mount');
  assert.match(store, /if \(options\.autoplay \|\| this\.requestedStationUrl === station\.url\) this\.playRequest \+= 1/);
});

test('all seven translations include honest random discovery labels', async () => {
  for (const locale of ['en-US', 'vi-VN', 'fr-FR', 'ja-JP', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const d = JSON.parse(await read('lang/' + locale + '.json'));
    for (const key of [
      'title', 'heading', 'description', 'filters', 'action', 'loading', 'unavailable',
      'country', 'any_country', 'genre', 'any_genre', 'language', 'any_language',
      'available_count', 'empty', 'selected',
    ]) assert.ok(typeof d.surprise[key] === 'string' && d.surprise[key].trim(), locale + ': ' + key);
    assert.match(d.surprise.available_count, /\{count\}/);
  }
});
