import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PUBLIC_APPLE_TUNEIN_STATIONS,
  buildPublicTuneInRequest, inspectPublicAppleStream, resolvePublicTuneInStream,
} from '../utils/global-radio-public-tunein.mjs';

const CORS_SERVER = 'https://configured-cors.example/';
const now = Date.UTC(2026, 10, 5, 12);
const expiry = Math.floor(now / 1000) + 600;
const key = expiry + '_' + 'a'.repeat(32) + '_QUJDREVGRw==';
const signed = path => 'https://itsliveradio.apple.com/3p-tune-in/tune_in/' + path
  + '?accessKey=' + encodeURIComponent(key);

test('every catalogued Apple Music station maps to its own TuneIn station ID', async () => {
  const provider = JSON.parse(await readFile(new URL('../public/catalog/providers/apple-music.json', import.meta.url)));
  assert.equal(Object.keys(PUBLIC_APPLE_TUNEIN_STATIONS).length, 7);
  for (const station of provider.stations) {
    const entry = PUBLIC_APPLE_TUNEIN_STATIONS[station.id];
    assert.ok(entry, station.id);
    assert.ok(station.tunein_url.includes('-' + entry.tunein + '/'));
    assert.ok(station.listen_url.endsWith('/ra.' + entry.apple));
    const request = buildPublicTuneInRequest(station.id, CORS_SERVER);
    const proxy = new URL(request);
    assert.equal(proxy.origin, 'https://configured-cors.example');
    assert.ok(proxy.pathname.startsWith('/https://opml.radiotime.com/Tune.ashx'));
    assert.equal(proxy.searchParams.get('id'), entry.tunein);
    assert.equal(proxy.searchParams.get('render'), 'json');
    assert.equal(proxy.searchParams.get('formats'), 'aac,hls,mp3');
    assert.equal(proxy.searchParams.has('partnerId'), false);
    assert.equal(proxy.searchParams.has('itemToken'), false);
    assert.equal(proxy.searchParams.has('paln'), false);
  }
  assert.equal(buildPublicTuneInRequest('../evil', CORS_SERVER), null);
  assert.equal(buildPublicTuneInRequest('apple-music-1'), null);
  assert.equal(buildPublicTuneInRequest('apple-music-1', ''), null);
  assert.equal(buildPublicTuneInRequest('apple-music-1', 'http://insecure.example/'), null);
  assert.equal(buildPublicTuneInRequest('apple-music-1', 'https://user:pass@proxy.example/'), null);
  assert.equal(buildPublicTuneInRequest('apple-music-1', 'https://proxy.example/?redirect=1'), null);
  assert.equal(buildPublicTuneInRequest('apple-music-1', 'https://proxy.example/other-path'), null);
  const alternate = buildPublicTuneInRequest('apple-music-1', 'https://another-proxy.example/');
  assert.equal(new URL(alternate).origin, 'https://another-proxy.example');
});

test('fresh signed MPEG-TS masters for all 7 Apple stations pass station-bound validation', () => {
  for (const [id, entry] of Object.entries(PUBLIC_APPLE_TUNEIN_STATIONS)) {
    const path = id === 'apple-music-holiday-hits'
      ? 'ppa-ts/index-ts.m3u8' : entry.apple + '-ts/index-ts.m3u8';
    const url = signed(path);
    assert.deepEqual(inspectPublicAppleStream(url, id, now), {
      ok: true, streamUrl: url, expiresAt: expiry * 1000,
    });
  }
});

test('CMAF masters are accepted for all seven stations with strict station association', () => {
  for (const [id, entry] of Object.entries(PUBLIC_APPLE_TUNEIN_STATIONS)) {
    const path = id === 'apple-music-holiday-hits'
      ? 'ppa/index-cmaf.m3u8' : entry.apple + '/index-cmaf.m3u8';
    const url = signed(path);
    assert.deepEqual(inspectPublicAppleStream(url, id, now), {
      ok: true, streamUrl: url, expiresAt: expiry * 1000,
    }, id);
    if (id !== 'apple-music-holiday-hits') {
      assert.equal(inspectPublicAppleStream(url, 'apple-music-holiday-hits', now), null);
      assert.equal(inspectPublicAppleStream(signed(entry.apple + '/index-cmaf.mp4'), id, now), null);
    }
  }
  assert.equal(inspectPublicAppleStream(signed('ppa/index-cmaf.m3u8'), 'apple-music-1', now), null);
});

test('prefers the verified CMAF master over MPEG-TS, but falls back to TS when absent', async () => {
  const cmaf = signed('978194965/index-cmaf.m3u8');
  const ts = signed('978194965-ts/index-ts.m3u8');
  const originalDate = Date.now;
  Date.now = () => now;
  try {
    for (const [available, expected] of [
      [[ts, cmaf], cmaf],
      [[ts], ts],
    ]) {
      const resolved = await resolvePublicTuneInStream({
        station: { id: 'apple-music-1' },
        corsServer: CORS_SERVER,
        fetcher: async () => ({
          ok: true,
          json: async () => ({ head: { status: 200 }, body: available.map(url => ({ url })) }),
        }),
      });
      assert.equal(resolved.streamUrl, expected);
      assert.equal(resolved.expiresAt, expiry * 1000);
    }
  } finally {
    Date.now = originalDate;
  }
});

test('reject host swapping, stale tokens, wrong station, duplicate query and unsafe path', () => {
  const src = signed('978194965-ts/index-ts.m3u8');
  const bad = [
    src.replace('itsliveradio.apple.com', 'itsliveradio.apple.com.attacker.invalid'),
    src.replace('https://', 'http://'),
    src.replace('978194965-ts', '1498155548-ts'),
    src + '&extra=1',
    src + '&accessKey=duplicate',
    src.replace('accessKey=', 'other='),
    src.replace('index-ts.m3u8', 'index-ts.mp3'),
    src.replace('/3p-tune-in/', '/unsafe/'),
  ];
  for (const url of bad) assert.equal(inspectPublicAppleStream(url, 'apple-music-1', now), null);
  assert.equal(inspectPublicAppleStream(src, 'apple-music-1', expiry * 1000), null);
  assert.equal(inspectPublicAppleStream(signed('ppa-ts/index-ts.m3u8'), 'apple-music-1', now), null);
  const cmaf = signed('978194965/index-cmaf.m3u8');
  for (const other of [
    cmaf.replace('978194965/index-cmaf', '1498155548/index-cmaf'),
    cmaf.replace('index-cmaf.m3u8', 'index-cmaf.m4s'),
    cmaf + '&accessKey=duplicate',
    cmaf.replace('itsliveradio.apple.com', 'liveradio.music.apple.com'),
    cmaf.replace('accessKey=', 'key='),
  ]) assert.equal(inspectPublicAppleStream(other, 'apple-music-1', now), null);
});

test('one-click resolver fetches public TuneIn JSON via own CORS server and returns ephemeral HLS', async () => {
  const url = signed('ppa-ts/index-ts.m3u8');
  let called = 0;
  const originalDate = Date.now;
  Date.now = () => now;
  try {
    const result = await resolvePublicTuneInStream({
      station: { id: 'apple-music-holiday-hits' },
      corsServer: CORS_SERVER,
      signal: new AbortController().signal,
      fetcher: async (request, options) => {
        called++;
        assert.match(request, /^https:\/\/configured-cors\.example\/https:\/\/opml\.radiotime\.com\/Tune\.ashx\?/);
        assert.equal(options.method, 'GET');
        assert.equal(options.cache, 'no-store');
        assert.equal(options.credentials, 'omit');
        return {
          ok: true,
          json: async () => ({ head: { status: 200 }, body: [{ url }] }),
        };
      },
    });
    assert.equal(called, 1);
    assert.deepEqual(result, { ok: true, streamUrl: url, expiresAt: expiry * 1000 });
  } finally {
    Date.now = originalDate;
  }
});

test('failure cases never fall back to an arbitrary URL or expired Apple token', async () => {
  const badResponses = [
    { head: { status: 403 }, body: [{ url: signed('ppa-ts/index-ts.m3u8') }] },
    { head: { status: 200 }, body: [{ url: 'https://evil.invalid/live.m3u8' }] },
    { body: [] },
  ];
  for (const payload of badResponses) {
    await assert.rejects(resolvePublicTuneInStream({
      station: { id: 'apple-music-holiday-hits' },
      corsServer: CORS_SERVER,
      fetcher: async () => ({ ok: true, json: async () => payload }),
    }), /unavailable/);
  }
  await assert.rejects(resolvePublicTuneInStream({
    station: { id: 'not-a-real-station' },
    corsServer: CORS_SERVER,
    fetcher: async () => { throw Error('must not call'); },
  }), /invalid_station/);
});

test('the provider Play action and its renewal use the public resolver, not a required partner API', async () => {
  const play = await readFile(new URL('../composables/useAuthorizedGlobalRadioPlayback.ts', import.meta.url), 'utf8');
  const renew = await readFile(new URL('../plugins/global-radio-renew.client.ts', import.meta.url), 'utf8');
  assert.match(play, /resolvePublicTuneInStream/);
  assert.match(play, /buildPublicTuneInRequest/);
  assert.match(play, /activateGlobalRadio/);
  assert.match(renew, /resolvePublicTuneInStream/);
  assert.match(renew, /refreshGlobalRadioStream/);
});


test('missing CORS env fails closed and never sends a network request', async () => {
  await assert.rejects(resolvePublicTuneInStream({
    station: { id: 'apple-music-1' },
    fetcher: async () => { throw Error('must not fetch without env'); },
  }), /invalid_station/);
});

test('Nuxt runtimeConfig and GitHub Pages deployment forward the same CORS env', async () => {
  const config = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8');
  const deploy = await readFile(new URL('../.github/workflows/deploy-github-pages.yml', import.meta.url), 'utf8');
  const source = await readFile(new URL('../utils/global-radio-public-tunein.mjs', import.meta.url), 'utf8');
  const play = await readFile(new URL('../composables/useAuthorizedGlobalRadioPlayback.ts', import.meta.url), 'utf8');
  const renew = await readFile(new URL('../plugins/global-radio-renew.client.ts', import.meta.url), 'utf8');
  const restore = await readFile(new URL('../composables/useRestoreLastStation.ts', import.meta.url), 'utf8');
  assert.match(config, /corsServer: process\.env\.NUXT_PUBLIC_CORS_SERVER_1/);
  assert.match(deploy, /NUXT_PUBLIC_CORS_SERVER_1: \$\{\{ vars\.NUXT_PUBLIC_CORS_SERVER_1 \}\}/);
  assert.doesNotMatch(source, /cors-eplus-bba6d8ad0ca6/);
  for (const usage of [play, renew, restore]) {
    assert.match(usage, /config\.public\.corsServer/);
    assert.match(usage, /corsServer/);
  }
});
