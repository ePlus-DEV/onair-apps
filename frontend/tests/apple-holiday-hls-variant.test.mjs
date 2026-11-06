import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAuthorizedAppleStream } from '../utils/global-radio-resolver.mjs';
import { inspectAppleHlsPreviewUrl } from '../utils/apple-hls-preview.mjs';

// Playlist structure observed in user-supplied TuneIn HAR, with fabricated
// signatures. The actual signed URLs and HAR are never included in the repo.
const holidayId = 'apple-music-holiday-hits';
const holidayPage = 'https://music.apple.com/us/station/holiday-hits/ra.6825447412';
const otherPage = 'https://music.apple.com/us/station/apple-music-1/ra.978194965';
const now = Date.UTC(2026, 10, 5, 8, 44);
const exp = 1793888691;
const key = String(exp) + '_' + 'a'.repeat(32) + '_' + 'QUJDREVGRw==';
const base = 'https://itsliveradio.apple.com/3p-tune-in/tune_in/';
const signed = path => base + path + '?accessKey=' + encodeURIComponent(key);
const payload = path => ({
  status: 'ok',
  authorized: true,
  provider: 'apple-music',
  station_id: holidayId,
  stream_url: signed(path),
  expires_at: exp,
});

test('Holiday Hits main CMAF master and its signed 256/64 media playlists are accepted', () => {
  for (const path of ['ppa/index-cmaf.m3u8', 'ppa-ts/index-ts.m3u8', 'ppa/usw/256.m3u8', 'ppa/usw/64.m3u8']) {
    const result = validateAuthorizedAppleStream(payload(path), holidayId, holidayPage, now);
    assert.equal(result.ok, true, path);
    assert.equal(result.streamUrl, signed(path));
    assert.equal(result.expiresAt, exp * 1000);
    assert.equal(JSON.stringify(result).includes('authorized'), false);
  }
});

test('Holiday Hits opaque alias is never accepted for another station or unsupported HLS variant', () => {
  const paths = [
    'ppa/usw/128.m3u8',
    'ppa/usw/256.mp3',
    'ppa/other/256.m3u8',
    'ppa/usw/256.m3u8/../evil',
    'ppa/index-cmaf.m3u8.mp3',
  ];
  for (const path of paths) {
    assert.equal(validateAuthorizedAppleStream(payload(path), holidayId, holidayPage, now).ok, false, path);
  }
  assert.equal(validateAuthorizedAppleStream({ ...payload('ppa/usw/256.m3u8'), station_id: 'apple-music-1' },
    'apple-music-1', otherPage, now).ok, false);
});

test('user-supplied Holiday Hits signed master or 256 media playlist passes local preview check', () => {
  for (const [path, quality] of [['ppa/index-cmaf.m3u8', 'auto'], ['ppa-ts/index-ts.m3u8', 'auto'], ['ppa/usw/256.m3u8', '256']]) {
    const result = inspectAppleHlsPreviewUrl(signed(path), holidayPage, now);
    assert.deepEqual(result, {
      ok: true, reason: 'ready', expiresAt: exp * 1000, stationId: '6825447412', qualityLabel: quality,
    });
    assert.equal(JSON.stringify(result).includes(key), false);
    assert.equal(inspectAppleHlsPreviewUrl(signed(path), otherPage, now).reason, 'station_mismatch');
  }
});

test('signed Holiday Hits HLS URLs remain short-lived and reject missing key, token and expiry errors', () => {
  assert.equal(validateAuthorizedAppleStream(payload('ppa/usw/256.m3u8'), holidayId, holidayPage, exp * 1000).ok, false);
  assert.equal(inspectAppleHlsPreviewUrl(signed('ppa/usw/256.m3u8'), holidayPage, exp * 1000).reason, 'expired');
  const invalid = payload('ppa/usw/256.m3u8');
  invalid.stream_url = invalid.stream_url.replace('accessKey=', 'foo=');
  assert.equal(validateAuthorizedAppleStream(invalid, holidayId, holidayPage, now).ok, false);
  assert.equal(inspectAppleHlsPreviewUrl(invalid.stream_url, holidayPage, now).ok, false);
});
