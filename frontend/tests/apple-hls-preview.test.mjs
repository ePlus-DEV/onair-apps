import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectAppleHlsPreviewUrl, appleHlsPreviewExpiry } from '../utils/apple-hls-preview.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const station = 'https://music.apple.com/us/station/apple-music-1/ra.978194965';
const exp = 1793867086;
const key = String(exp) + '_' + 'a'.repeat(32) + '_' + 'ABCDefg123+/=';
const sample = (stationId = '978194965', accessKey = key) =>
  'https://itsliveradio.apple.com/3p-tune-in/tune_in/' +
  stationId + '/usw/256.m3u8?accessKey=' + encodeURIComponent(accessKey);

test('signed Apple Music 1 HLS URL is accepted locally only before token deadline', () => {
  const result = inspectAppleHlsPreviewUrl(sample(), station, (exp - 3_600) * 1000);
  assert.deepEqual(result, {
    ok: true, reason: 'ready', expiresAt: exp * 1000, stationId: '978194965', qualityLabel: '256',
  });
  assert.equal(appleHlsPreviewExpiry(sample(), (exp - 3_600) * 1000), false);
  assert.equal(appleHlsPreviewExpiry(sample(), exp * 1000), true);
  assert.equal(result.expiresAt, Date.UTC(2026, 10, 5, 8, 24, 46));
});

test('bad host, credentials, mixed content and malformed query are rejected', () => {
  const good = sample();
  for (const bad of [
    good.replace('itsliveradio.apple.com', 'apple.com.evil.tld'),
    good.replace('https://', 'http://'),
    good.replace('https://', 'https://bob:password@'),
    good.replace('/usw/256.m3u8', '/usw/256.mp3'),
    good + '&foo=bar',
    good + '&accessKey=duplicate',
    good.replace('tune_in', 'other_provider'),
    good.replace('accessKey=', 'wrongKey='),
    sample('978194965', ''),
    'javascript:alert(1)',
    'not a URL',
  ]) {
    assert.equal(inspectAppleHlsPreviewUrl(bad, station, (exp - 3_600) * 1000).ok, false);
  }
});

test('wrong Apple station ID, expired and malformed access keys cannot play', () => {
  const now = (exp - 3_600) * 1000;
  assert.equal(inspectAppleHlsPreviewUrl(sample('1498155548'), station, now).reason, 'station_mismatch');
  assert.equal(inspectAppleHlsPreviewUrl(sample(), station, exp * 1000).reason, 'expired');
  assert.equal(inspectAppleHlsPreviewUrl(sample(), station, (exp - 10) * 1000).reason, 'expired');
  assert.equal(inspectAppleHlsPreviewUrl(sample('978194965', 'not-a-token'), station, now).reason, 'invalid');
  assert.equal(inspectAppleHlsPreviewUrl(sample(), 'https://music.apple.com/us/radio', now).reason, 'station_mismatch');
});

test('validation never exposes accessKey in UI diagnostics or serializable result', () => {
  const now = (exp - 3600) * 1000;
  const result = inspectAppleHlsPreviewUrl(sample(), station, now);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(key), false);
  assert.equal(serialized.includes('accessKey'), false);
});

test('HLS experimental component keeps token ephemeral and does not touch the internal catalog', async () => {
  const [component, page, provider, docs] = await Promise.all([
    read('components/global-radio/TemporaryHlsPreview.vue'),
    read('pages/global-radio/apple-music/[station].vue'),
    read('public/catalog/providers/apple-music.json'),
    read('docs/global-radio-providers.md'),
  ]);
  assert.doesNotMatch(page, /GlobalRadioTemporaryHlsPreview/,
    'end users must not be asked to enter signed access keys');
  assert.match(component, /type="password" autocomplete="off"/);
  assert.match(component, /inspectAppleHlsPreviewUrl/);
  assert.match(component, /await import\('hls\.js'\)/);
  assert.match(component, /Hls\.Events\.MANIFEST_PARSED/);
  assert.match(component, /Hls\.Events\.ERROR/);
  assert.match(component, /playback\.pauseRequest \+= 1/);
  assert.match(component, /onBeforeUnmount\(stopPreview\)/);
  assert.match(component, /temporaryUrl\.value = ''/);
  assert.doesNotMatch(component, /localStorage|sessionStorage|fetch\(|axios|console\.log|sendBeacon|requestStation|playback\.activate/);
  assert.doesNotMatch(provider, /accessKey|3p-tune-in|itsliveradio\.apple\.com/);
  assert.match(docs, /HLS preview/i);
});

test('preview error and privacy messages are translated across all languages', async () => {
  const keys = [
    'hls_preview_title', 'hls_preview_help', 'hls_preview_input',
    'hls_preview_placeholder', 'hls_preview_play', 'hls_preview_stop',
    'hls_preview_audio', 'hls_preview_privacy', 'hls_preview_checking',
    'hls_preview_playing', 'hls_preview_paused', 'hls_preview_invalid',
    'hls_preview_expired', 'hls_preview_station_mismatch',
    'hls_preview_unavailable', 'hls_preview_unsupported',
  ];
  for (const locale of ['en-US', 'vi-VN', 'ja-JP', 'fr-FR', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const messages = JSON.parse(await read('lang/' + locale + '.json'));
    for (const key of keys) {
      assert.ok(typeof messages.global_radio?.[key] === 'string' && messages.global_radio[key].trim(),
        locale + ' missing ' + key);
    }
  }
});
