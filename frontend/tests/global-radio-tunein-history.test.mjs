import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PUBLIC_APPLE_TUNEIN_STATIONS } from '../utils/global-radio-public-tunein.mjs';

const CORS_SERVER = 'https://configured-proxy.example/';
import {
  appleTuneInStationId, appleTuneInMetadataMarker, stationIdFromTuneInMetadataMarker,
  buildPublicTuneInMetadataRequest, parseTuneInStationMetadata, fetchPublicTuneInMetadata,
  addTuneInSessionTrack,
} from '../utils/global-radio-tunein-metadata.mjs';

test('only seven verified Apple TuneIn station IDs may request Describe metadata', () => {
  assert.equal(Object.keys(PUBLIC_APPLE_TUNEIN_STATIONS).length, 7);
  for (const [id, station] of Object.entries(PUBLIC_APPLE_TUNEIN_STATIONS)) {
    const entry = { id, url: '/global-radio/apple-music/' + id };
    assert.equal(appleTuneInStationId(entry), id);
    assert.equal(stationIdFromTuneInMetadataMarker(appleTuneInMetadataMarker(entry)), id);
    const url = buildPublicTuneInMetadataRequest(id, CORS_SERVER);
    assert.ok(url.startsWith('https://configured-proxy.example/https://opml.radiotime.com/Describe.ashx?'));
    assert.equal(new URL(url).searchParams.get('id'), station.tunein);
    assert.equal(new URL(url).searchParams.get('render'), 'json');
    assert.ok(!url.includes('Browse.ashx') && !url.includes('Playing.ashx'));
    for (const forbidden of ['partnerId', 'partnerKey', 'accessKey', 'itemToken', 'paln'])
      assert.equal(new URL(url).searchParams.has(forbidden), false);
  }
  assert.equal(buildPublicTuneInMetadataRequest('../evil', CORS_SERVER), null);
  assert.equal(buildPublicTuneInMetadataRequest('apple-music-1'), null);
  assert.equal(buildPublicTuneInMetadataRequest('apple-music-1', ''), null);
  assert.equal(buildPublicTuneInMetadataRequest('apple-music-1', 'http://insecure.example/'), null);
  assert.equal(buildPublicTuneInMetadataRequest('apple-music-1', 'https://proxy.example/path'), null);
  assert.equal(buildPublicTuneInMetadataRequest('apple-music-1', 'https://user:pass@proxy.example/'), null);
  assert.equal(appleTuneInMetadataMarker({ id: 'apple-music-1', url: '/asia/vietnam/apple-music-1' }), '');
  assert.equal(stationIdFromTuneInMetadataMarker('tunein-apple-metadata:../../wrong'), '');
});

test('uses only explicit current_song and current_artist fields', () => {
  assert.deepEqual(parseTuneInStationMetadata({
    head: { status: '200' },
    body: [{ element: 'outline', type: 'object', text: 'Apple Music 1', children: [
      { element: 'station', guide_id: 's345732', name: 'Apple Music 1',
        current_song: 'A Real Song', current_artist: 'A Real Artist', current_album: 'Album',
        publish_song: 'true' },
    ] }],
  }, 'apple-music-1'), { title: 'A Real Song', artist: 'A Real Artist' });
});

test('rejects show titles, station labels, incomplete fields, commercials and wrong station', () => {
  const validStation = 'apple-music-1';
  for (const row of [
    { element: 'station', name: 'Apple Music 1', playing: 'DJ - The Dotty Show' },
    { element: 'station', current_song: 'Song only' },
    { element: 'station', current_artist: 'Artist only' },
    { element: 'station', current_song: 'Song', current_artist: 'Song' },
    { element: 'station', guide_id: 's345724', current_song: 'Other song', current_artist: 'Other artist' },
    { element: 'station', current_song: 'Song', current_artist: 'Artist', commercial: 'true' },
    { element: 'station', current_song: 'Song', current_artist: 'Artist', has_song: 'false' },
    { element: 'station', current_song: 'Song', current_artist: 'Artist', publish_song: false },
    { element: 'show', current_song: 'Show', current_artist: 'DJ' },
  ]) {
    assert.equal(parseTuneInStationMetadata({ body: [row] }, validStation), null);
  }
  assert.throws(() => parseTuneInStationMetadata({ head: { status: 403 }, body: [] }, validStation), /unavailable/);
  assert.throws(() => parseTuneInStationMetadata({ body: [] }, 'invalid'), /invalid_station/);
  assert.equal(parseTuneInStationMetadata(null, validStation), null);
});

test('session playlist records only distinct observed songs, without a fake broadcast timestamp', () => {
  const first = { title: 'Song One', artist: 'Artist One' };
  const second = { title: 'Song Two', artist: 'Artist Two' };
  let playlist = addTuneInSessionTrack([], null);
  assert.deepEqual(playlist, []);
  playlist = addTuneInSessionTrack(playlist, first);
  playlist = addTuneInSessionTrack(playlist, first);
  assert.equal(playlist.length, 1);
  playlist = addTuneInSessionTrack(playlist, second);
  assert.deepEqual(playlist.map(song => song.track_title), ['Song Two', 'Song One']);
  assert.equal(playlist[0].track_artist, 'Artist Two');
  assert.equal(playlist[0].track_played, 0);
  assert.deepEqual(addTuneInSessionTrack(playlist, null), playlist);
  playlist = addTuneInSessionTrack(playlist, first);
  assert.deepEqual(playlist.map(song => song.track_title), ['Song One', 'Song Two', 'Song One']);
  for (let i = 0; i < 100; i++) playlist = addTuneInSessionTrack(playlist, { title: String(i), artist: 'Singer' });
  assert.equal(playlist.length, 30);
});

test('read-only Describe request has no credentials and supports cancellation', async () => {
  const stationId = 'apple-music-1';
  const controller = new AbortController();
  let capturedSignal;
  const result = await fetchPublicTuneInMetadata({
    stationId, corsServer: CORS_SERVER, signal: controller.signal,
    fetcher: async (url, opts) => {
      assert.equal(opts.method, 'GET');
      assert.equal(opts.cache, 'no-store');
      assert.equal(opts.credentials, 'omit');
      assert.ok(url.includes('/Describe.ashx?'));
      capturedSignal = opts.signal;
      return { ok: true, json: async () => ({ head: { status: 200 }, body: [
        { element: 'station', current_song: 'Hello', current_artist: 'World' },
      ] }) };
    },
  });
  assert.deepEqual(result, { title: 'Hello', artist: 'World' });
  assert.equal(capturedSignal.aborted, false);
  await assert.rejects(fetchPublicTuneInMetadata({ stationId: 'invalid', corsServer: CORS_SERVER, fetcher: async () => {
    assert.fail('must not call unknown stations');
  } }), /invalid_station/);
  const pending = new AbortController();
  const promise = fetchPublicTuneInMetadata({
    stationId, corsServer: CORS_SERVER, signal: pending.signal,
    fetcher: async (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  });
  pending.abort();
  await assert.rejects(promise, /aborted/);
});

test('existing player receives song and artist via shared live track and playlist', async () => {
  const realtime = await readFile(new URL('../composables/useStationRealtime.ts', import.meta.url), 'utf8');
  const player = await readFile(new URL('../components/player/Player.vue', import.meta.url), 'utf8');
  const queue = await readFile(new URL('../components/player/Queue.vue', import.meta.url), 'utf8');
  const session = await readFile(new URL('../components/player/Session.vue', import.meta.url), 'utf8');
  assert.match(realtime, /fetchPublicTuneInMetadata/);
  assert.match(realtime, /addTuneInSessionTrack/);
  assert.match(realtime, /polling\.start\(appleTuneInMetadataMarker/);
  assert.match(realtime, /value\.isTuneInMetadata \? \(value\.nowPlaying \|\| null\)/);
  assert.match(player, /props.stationUrl\?\.startsWith\('\/global-radio\/apple-music\/'\)/);
  assert.match(player, /const reported = playback\.liveTrack/);
  assert.match(player, /return reported\?\.stationUrl === props\.stationUrl/);
  assert.match(queue, /hasTuneInHistory/);
  assert.match(queue, /isLivePlaylistTrack\(item, index\)/);
  assert.match(session, /:playlist="playlist"/);
  assert.doesNotMatch(realtime, /Playing\.ashx|accessKey|\.play\(/);
});

test('the playlist UI imports the surviving TuneIn metadata module (Nuxt build regression)', async () => {
  const queue = await readFile(new URL('../components/player/Queue.vue', import.meta.url), 'utf8');
  const moduleSource = await readFile(new URL('../utils/global-radio-tunein-metadata.mjs', import.meta.url), 'utf8');
  assert.ok(queue.includes("from '~/utils/global-radio-tunein-metadata.mjs'"));
  assert.ok(!queue.includes("global-radio-tunein-history.mjs"));
  assert.ok(moduleSource.includes("export function appleTuneInStationId("));
});


test('global TuneIn Describe uses configured Nuxt CORS value, never removed static proxy export', async () => {
  const moduleSource = await readFile(new URL('../utils/global-radio-tunein-metadata.mjs', import.meta.url), 'utf8');
  const realtime = await readFile(new URL('../composables/useStationRealtime.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(moduleSource, /TUNEIN_CORS_PROXY|cors-eplus-bba6d8ad0ca6/);
  assert.match(moduleSource, /buildPublicTuneInMetadataRequest\(stationId, corsServer\)/);
  assert.match(realtime, /corsServer: String\(config\.public\.corsServer \|\| ''\)/);
});
