import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAuthorizedResolverRequest, validateAuthorizedAppleStream, resolveAuthorizedAppleStream } from '../utils/global-radio-resolver.mjs';
import { createAuthorizedApplePlaybackStation } from '../utils/global-radio-station.mjs';
import { PUBLIC_APPLE_TUNEIN_STATIONS } from '../utils/global-radio-public-tunein.mjs';

const station = { id: 'apple-music-1', title: 'Apple Music 1',
  listen_url: 'https://music.apple.com/us/station/apple-music-1/ra.978194965' };
const now = Date.UTC(2026, 10, 5, 12);
const expires = Math.floor(now / 1000) + 600;
const appleStream = `https://itsliveradio.apple.com/3p-tune-in/tune_in/978194965/usw/256.m3u8?accessKey=${expires}_opaque_signature`;
const valid = { status: 'ok', authorized: true, provider: 'apple-music',
  station_id: station.id, stream_url: appleStream, expires_at: expires + 100 };

test('resolver URL requires HTTPS, fixed station slug and no caller query', () => {
  assert.equal(buildAuthorizedResolverRequest('https://radio-api.eplus.dev/v1/radio/resolve', station.id),
    'https://radio-api.eplus.dev/v1/radio/resolve?provider=apple-music&station_id=apple-music-1');
  for (const endpoint of ['', 'http://radio-api.eplus.dev/resolve', 'https://a.test/resolve?url=https://evil.test',
    'https://user:password@a.test/resolve', 'https://a.test/#fragment']) {
    assert.equal(buildAuthorizedResolverRequest(endpoint, station.id), null);
  }
  assert.equal(buildAuthorizedResolverRequest('https://a.test/resolve', '../other'), null);
});

test('valid signed Apple stream is matched against the selected Apple Music station and earliest expiry', () => {
  const result = validateAuthorizedAppleStream(valid, station.id, station.listen_url, now);
  assert.equal(result.ok, true);
  assert.equal(result.streamUrl, appleStream);
  assert.equal(result.expiresAt, expires * 1000);
});

test('Holiday Hits CMAF path observed in TuneIn HAR is accepted only for that station', () => {
  const holiday = {
    id: 'apple-music-holiday-hits',
    listen_url: 'https://music.apple.com/us/station/holiday-hits/ra.6825447412',
  };
  const cmaf = `https://itsliveradio.apple.com/3p-tune-in/tune_in/ppa/index-cmaf.m3u8?accessKey=${expires}_opaque_signature`;
  const payload = { ...valid, station_id: holiday.id, stream_url: cmaf };
  assert.equal(validateAuthorizedAppleStream(payload, holiday.id, holiday.listen_url, now).ok, true);
  assert.equal(validateAuthorizedAppleStream({ ...payload, station_id: station.id },
    station.id, station.listen_url, now).ok, false);
});

test('optional resolver accepts strict numbered CMAF masters for the six core stations', () => {
  for (const [id, entry] of Object.entries(PUBLIC_APPLE_TUNEIN_STATIONS)) {
    if (id === 'apple-music-holiday-hits') continue;
    const listenUrl = 'https://music.apple.com/us/station/channel/ra.' + entry.apple;
    const cmaf = 'https://itsliveradio.apple.com/3p-tune-in/tune_in/'
      + entry.apple + '/index-cmaf.m3u8?accessKey=' + expires + '_opaque_signature';
    const payload = { ...valid, station_id: id, stream_url: cmaf };
    assert.equal(validateAuthorizedAppleStream(payload, id, listenUrl, now).ok, true, id);
    assert.equal(validateAuthorizedAppleStream({
      ...payload, stream_url: cmaf.replace(entry.apple + '/index-cmaf', '999999/index-cmaf'),
    }, id, listenUrl, now).ok, false, id);
    assert.equal(validateAuthorizedAppleStream({
      ...payload, stream_url: cmaf.replace('index-cmaf.m3u8', 'index-cmaf.mp4'),
    }, id, listenUrl, now).ok, false, id);
    const ts = cmaf.replace(entry.apple + '/index-cmaf', entry.apple + '-ts/index-ts');
    assert.equal(validateAuthorizedAppleStream({ ...payload, stream_url: ts }, id, listenUrl, now).ok, true, id);
  }
});

test('rejects unauthorized, mismatched, expired, malformed or non-Apple stream responses', () => {
  const rejected = [
    { ...valid, authorized: false }, { ...valid, station_id: 'apple-music-hits' },
    { ...valid, provider: 'tunein' }, { ...valid, stream_url: 'https://evil.test/file.m3u8?accessKey=x' },
    { ...valid, stream_url: 'http://itsliveradio.apple.com/3p-tune-in/tune_in/978194965/usw/256.m3u8?accessKey=x' },
    { ...valid, stream_url: appleStream.replace('978194965/usw', '99999999/usw') },
    { ...valid, stream_url: appleStream.replace('accessKey=', 'anyKey=') },
    { ...valid, expires_at: 5 }, { ...valid, expires_at: 'invalid' },
  ];
  for (const payload of rejected) {
    assert.equal(validateAuthorizedAppleStream(payload, station.id, station.listen_url, now).ok, false);
  }
});

test('resolver never forwards third-party credentials and never caches signed URLs', async () => {
  let called = false;
  const signal = new AbortController().signal;
  const response = await resolveAuthorizedAppleStream({
    endpoint: 'https://radio-api.eplus.dev/v1/radio/resolve', station, signal,
    fetcher: async (url, opts) => {
      called = true;
      assert.match(url, /station_id=apple-music-1/);
      assert.doesNotMatch(url, /accessKey|itemToken|Tune\.ashx/);
      assert.equal(opts.credentials, 'omit');
      assert.equal(opts.cache, 'no-store');
      assert.equal(opts.signal, signal);
      return { ok: true, json: async () => ({ ...valid, expires_at: Math.floor(Date.now() / 1000) + 600,
        stream_url: `https://itsliveradio.apple.com/3p-tune-in/tune_in/978194965/usw/256.m3u8?accessKey=${Math.floor(Date.now() / 1000)+600}_opaque_signature` }) };
    },
  });
  assert.equal(called, true);
  assert.equal(response.ok, true);
});

test('creates an ephemeral station for the existing single global player', () => {
  const entry = createAuthorizedApplePlaybackStation(station, appleStream);
  assert.equal(entry.url, '/global-radio/apple-music/apple-music-1');
  assert.equal(entry.sources.length, 1);
  assert.equal(entry.sources[0].src, appleStream);
  assert.equal(entry.sources[0].type, 'application/vnd.apple.mpegurl');
  assert.equal(entry.schedule, '');
});

test('provider pages keep ePlus one-click Play while external destinations remain detail-only', async () => {
  const list = await readFile(new URL('../pages/global-radio/apple-music/index.vue', import.meta.url), 'utf8');
  const detail = await readFile(new URL('../pages/global-radio/apple-music/[station].vue', import.meta.url), 'utf8');
  for (const source of [list, detail]) {
    assert.doesNotMatch(source, /v-if="canListenOnEplus/, 'Play must remain visible when ENV is absent');
    assert.match(source, /v-if="!canListenOnEplus"/, 'tell the user why playback is unavailable');
    assert.match(source, /@click="playOnEplus\(station\)"/);
    assert.match(source, /useAuthorizedGlobalRadioPlayback/);
    assert.doesNotMatch(source, /GlobalRadioTemporaryHlsPreview|\.m3u8|accessKey|<audio\b/);
  }
  assert.match(list, /:disabled="!canListenOnEplus \|\| pendingStationId === station\.id"/);
  assert.match(detail, /:disabled="!canListenOnEplus \|\| Boolean\(pendingStationId\)"/);
  assert.doesNotMatch(list, /listen_on_apple|listen_on_tunein|:href="station\.listen_url"|:href="station\.tunein_url"/);
  assert.match(detail, /listen_on_apple/);
  assert.match(detail, /listen_on_tunein/);
});

test('optional ePlus-controlled resolver remains configurable as playback fallback', async () => {
  const config = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8');
  const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(config, /NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL/);
  assert.match(env, /NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL=/);
  assert.doesNotMatch(env, /NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL=https:\/\//);
});
