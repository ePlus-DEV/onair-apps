import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { playbackHealth, playbackFailureReason } from '../utils/playback-health.mjs';
import { MAX_STREAM_ATTEMPTS, buildPlaybackSources } from '../utils/radio-source-plan.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('connection and buffering are distinct but buffering never implies a dead station', () => {
  assert.equal(playbackHealth({ online: false, error: false, waiting: true, hasPlayed: true }), 'offline');
  assert.equal(playbackHealth({ online: true, error: true, unsupported: true, waiting: true }), 'unsupported');
  assert.equal(playbackHealth({ online: true, error: true, unsupported: false, waiting: true }), 'exhausted');
  assert.equal(playbackHealth({ online: true, error: false, waiting: true }), 'connecting');
  assert.equal(playbackHealth({ online: true, error: false, waiting: true, hasPlayed: false }), 'connecting');
  assert.equal(playbackHealth({ online: true, error: false, waiting: true, hasPlayed: true }), 'buffering');
  assert.equal(playbackHealth({ online: true, error: false, waiting: false, hasPlayed: true }), '');
});

test('browser error categories are evidence, never a fabricated global offline status', () => {
  assert.equal(playbackFailureReason({ hlsType: 'networkError' }), 'network');
  assert.equal(playbackFailureReason({ hlsType: 'mediaError' }), 'decode');
  assert.equal(playbackFailureReason({ mediaCode: 2 }), 'network');
  assert.equal(playbackFailureReason({ mediaCode: 3 }), 'decode');
  assert.equal(playbackFailureReason({ mediaCode: 4 }), 'decode');
  assert.equal(playbackFailureReason({ exceptionName: 'NotSupportedError' }), 'decode');
  assert.equal(playbackFailureReason({ timeout: true, mediaCode: 4 }), 'timeout');
  assert.equal(playbackFailureReason({ exceptionName: 'AbortError' }), 'unknown');
  assert.equal(playbackFailureReason(), 'unknown');
});

test('source fallback limits and HLS proxy safeguards remain intact', () => {
  assert.equal(MAX_STREAM_ATTEMPTS, 6);
  const sources = buildPlaybackSources([
    { src: 'https://station.test/live.m3u8', type: 'application/vnd.apple.mpegurl' },
    { src: 'https://station.test/backup.mp3', type: 'audio/mpeg' },
  ], 'https://cors.example/');
  assert.equal(sources.length, 3);
  assert.equal(sources[0].src, 'https://station.test/live.m3u8');
  assert.equal(sources[0].proxied, undefined);
  assert.equal(sources[2].proxied, true);
});

test('player passes same transient diagnostics to dock, mini and fullscreen views', async () => {
  const [player, recovery, nowPlaying] = await Promise.all([
    read('components/player/Player.vue'),
    read('components/player/Recovery.vue'),
    read('components/player/NowPlaying.vue'),
  ]);
  assert.equal((player.match(/:diagnostics="recoveryDiagnostics"/g) || []).length, 3);
  assert.match(nowPlaying, /:diagnostics="diagnostics"/);
  assert.match(player, /playbackHealth\(\{[\s\S]*?hasPlayed: hasPlayedCurrentSource\.value/);
  assert.match(player, /hasPlayedCurrentSource\.value = false;/);
  assert.match(player, /hasPlayedCurrentSource\.value = true;/);
  assert.match(player, /lastSourcePlaybackAt\.value = Date\.now\(\)/);
  assert.match(player, /sourceFailureReason\.value = playbackFailureReason/);
  assert.match(player, /Math\.min\(attemptCount\.value, MAX_STREAM_ATTEMPTS\)/);
  assert.match(recovery, /recovery\.source_position/);
  assert.match(recovery, /recovery\.local_observation/);
  assert.match(recovery, /recovery\.reason_/);
  assert.doesNotMatch(player, /source: source\.src/, 'tokenized stream URLs must not enter HLS logs');
});

test('all seven locales translate distinct buffering and every diagnostic state', async () => {
  for (const lang of ['en-US', 'vi-VN', 'fr-FR', 'ja-JP', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const dictionary = JSON.parse(await read('lang/' + lang + '.json'));
    for (const key of [
      'buffering', 'source_position', 'attempt', 'reason_network',
      'reason_decode', 'reason_timeout', 'reason_unknown', 'last_played',
      'local_observation',
    ]) {
      assert.ok(dictionary.recovery[key] && typeof dictionary.recovery[key] === 'string', lang + ': ' + key);
    }
    assert.match(dictionary.recovery.source_position, /\{index\}/);
    assert.match(dictionary.recovery.source_position, /\{total\}/);
    assert.match(dictionary.recovery.attempt, /\{attempt\}/);
    assert.match(dictionary.recovery.last_played, /\{time\}/);
  }
});
