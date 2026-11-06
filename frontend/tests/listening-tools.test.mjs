import test from 'node:test';
import assert from 'node:assert/strict';
import { exportFavorites, parseFavoritesFile, previewFavoritesImport, mergeFavorites, FAVORITES_FILE_LIMIT } from '../utils/favorites-transfer.mjs';
import { shareStation, stationShareUrl, stationReportUrl } from '../utils/station-sharing.mjs';
import { playbackHealth } from '../utils/playback-health.mjs';
import { filterQueueStations } from '../utils/station-search.mjs';

const a = { url: '/asia/viet-nam/a', title: 'old title', image: '/old.png' };
const b = { url: '/asia/viet-nam/b', title: 'B', image: '/b.png' };
const catalog = [a, b].map(item => ({ url: item.url, station_name: `Current ${item.title}`, station_image: '/current.png', station_country: 'world.asia.viet_nam' }));

test('favorites transfer round-trips identities without exporting streams or playback history', () => {
  const json = exportFavorites([{ ...a, stream: 'secret', lastState: 'play' }, a, b]);
  assert.deepEqual(parseFavoritesFile(json), [a.url, b.url]);
  assert.doesNotMatch(json, /secret|lastState|old title|old.png/);
});

test('invalid versions, remote paths, malformed records, oversized files and lists are rejected', () => {
  const pack = stations => JSON.stringify({ format: 'eplus-onair-favorites', version: 1, stations });
  for (const text of ['{', '{}', pack(['https://evil.test/a/b/c']), pack(['//evil.test/a/b']), pack(['/a/../b']), pack([null]), pack([{}]), pack(Array(201).fill(a.url)), JSON.stringify({ format: 'eplus-onair-favorites', version: 2, stations: [] }), ' '.repeat(FAVORITES_FILE_LIMIT + 1)]) {
    assert.throws(() => parseFavoritesFile(text));
  }
});

test('preview uses current catalog metadata and counts duplicates, missing and capacity overflow', () => {
  const preview = previewFavoritesImport([a.url, a.url, b.url, '/asia/viet-nam/missing'], catalog, [b]);
  assert.deepEqual(preview, { additions: [{ url: a.url, title: 'Current old title', image: '/current.png', countryKey: 'world.asia.viet_nam' }], duplicates: 1, missing: 1, overflow: 0 });
  const full = Array.from({ length: 200 }, (_, i) => ({ ...a, url: `/a/b/station-${i}` }));
  assert.deepEqual(previewFavoritesImport([a.url], catalog, full), { additions: [], duplicates: 0, missing: 0, overflow: 1 });
  assert.equal(mergeFavorites(full, [a]).length, 200);
  assert.deepEqual(mergeFavorites([b], [...preview.additions, b]).map(x => x.url), [b.url, a.url]);
  assert.equal(full.length, 200);
});

test('queue favorites filtering preserves original order and accent-insensitive search', () => {
  const stations = [{ ...a, title: 'Đài Việt' }, { ...b, title: 'Nhạc Việt' }, { ...a, url: '/asia/viet-nam/c', title: 'Việt' }];
  assert.deepEqual(filterQueueStations(stations, 'viet', [b.url, a.url], true).map(x => x.url), [a.url, b.url]);
  assert.deepEqual(filterQueueStations(stations, '', [], true), []);
  assert.deepEqual(filterQueueStations(stations, '', [], false), stations);
});

test('offline wins over stale errors; buffering is not a terminal failure', () => {
  assert.equal(playbackHealth({ online: false, error: true, unsupported: true }), 'offline');
  assert.equal(playbackHealth({ online: true, waiting: true }), 'connecting');
  assert.equal(playbackHealth({ online: true, error: true, unsupported: true }), 'unsupported');
  assert.equal(playbackHealth({ online: true, error: true }), 'exhausted');
  assert.equal(playbackHealth({ online: true }), '');
});

test('sharing uses a canonical station page and report drafts contain only selected public fields', () => {
  assert.equal(stationShareUrl(a.url), `https://radio.eplus.dev${a.url}`);
  assert.equal(stationShareUrl('//evil.test/a/b'), '');
  assert.equal(stationShareUrl('/a/b/c?autoplay=1'), '');
  const report = new URL(stationReportUrl(a.url, 'Test & station', 'exhausted'));
  assert.equal(report.origin, 'https://github.com');
  assert.equal(report.searchParams.get('title'), 'Station playback problem: Test & station');
  assert.match(report.searchParams.get('body'), /https:\/\/radio.eplus.dev\/asia\/viet-nam\/a/);
  assert.doesNotMatch(report.searchParams.get('body'), /stream=|cookie|history=/);
});

test('native share, cancellation, copy fallback and denied clipboard all produce honest feedback', async () => {
  const payload = { url: stationShareUrl(a.url), title: a.title };
  let copied = '';
  assert.equal(await shareStation(payload, { share: async value => assert.deepEqual(value, payload) }), 'shared');
  assert.equal(await shareStation(payload, { share: async () => { throw { name: 'AbortError' }; }, clipboard: { writeText: async () => assert.fail('cancel must not copy') } }), 'cancelled');
  assert.equal(await shareStation(payload, { share: async () => { throw new Error(); }, clipboard: { writeText: async text => { copied = text; } } }), 'copied');
  assert.equal(copied, payload.url);
  assert.equal(await shareStation(payload, {}), 'manual');
  assert.equal(await shareStation(payload, { clipboard: { writeText: async () => { throw new Error('denied'); } } }), 'manual');
});
