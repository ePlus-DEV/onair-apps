import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MAX_STREAM_ATTEMPTS, buildPlaybackSources } from '../utils/radio-source-plan.mjs';
import {
  playbackWatchdogAction, nextRecoverySourceIndex,
  STREAM_STALL_TIMEOUT_MS, STABLE_PLAYBACK_WINDOW_MS,
} from '../utils/playback-recovery-policy.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const stalled = overrides => ({
  waiting: true, playing: false, userPaused: false, online: true,
  autoReconnect: true, attemptCount: 1, sourceCount: 1, ...overrides,
});

test('single source and last source always have bounded fallback until six attempts', () => {
  assert.equal(STREAM_STALL_TIMEOUT_MS, 10_000);
  assert.equal(MAX_STREAM_ATTEMPTS, 6);
  for (const sourceCount of [1, 2, 5]) {
    assert.equal(playbackWatchdogAction(stalled({ sourceCount, attemptCount: 1 })), 'advance');
    assert.equal(playbackWatchdogAction(stalled({ sourceCount, attemptCount: 5 })), 'advance');
    assert.equal(playbackWatchdogAction(stalled({ sourceCount, attemptCount: 6 })), 'stop');
    assert.equal(playbackWatchdogAction(stalled({ sourceCount, attemptCount: 9 })), 'stop');
    assert.equal(nextRecoverySourceIndex(sourceCount - 1, sourceCount), 0);
  }
  assert.equal(nextRecoverySourceIndex(0, 1), 0, 'retry the only station source, not another station');
  assert.equal(nextRecoverySourceIndex(0, 0), -1);
  assert.equal(playbackWatchdogAction(stalled({ sourceCount: 0 })), 'ignore');
});

test('never recover when deliberately paused, already playing, offline or no longer waiting', () => {
  for (const state of [
    { userPaused: true }, { playing: true }, { online: false },
    { waiting: false }, { sourceCount: -1 }, { sourceCount: 2.5 },
  ]) {
    assert.equal(playbackWatchdogAction(stalled(state)), 'ignore', JSON.stringify(state));
  }
});

test('disable auto reconnect turns silence into manual Retry state, not infinite loading', () => {
  assert.equal(playbackWatchdogAction(stalled({ autoReconnect: false })), 'stop');
  assert.equal(playbackWatchdogAction(stalled({ autoReconnect: false, sourceCount: 1 })), 'stop');
  assert.equal(playbackWatchdogAction(stalled({ autoReconnect: false, waiting: false })), 'ignore');
});

test('MP3, AAC and HLS source plans preserve ordering, no unsafe HLS proxy and six tries', () => {
  const plan = buildPlaybackSources([
    { src: 'https://audio.test/live.mp3', type: 'audio/mpeg' },
    { src: 'https://audio.test/live.aac', type: 'audio/aac' },
    { src: 'https://audio.test/live.m3u8', type: 'application/vnd.apple.mpegurl' },
  ], 'https://proxy.test/');
  assert.deepEqual(plan.map(x => x.proxied ? 'proxy' : x.type), [
    'audio/mpeg', 'proxy', 'audio/aac', 'proxy', 'application/vnd.apple.mpegurl',
  ]);
  assert.equal(plan.filter(x => x.src.includes('.m3u8')).length, 1);
  for (let i = 1; i < MAX_STREAM_ATTEMPTS; i++) {
    assert.equal(playbackWatchdogAction(stalled({ sourceCount: plan.length, attemptCount: i })), 'advance');
  }
  assert.equal(playbackWatchdogAction(stalled({ sourceCount: plan.length, attemptCount: MAX_STREAM_ATTEMPTS })), 'stop');
});

test('player keeps one watchdog through loading, canplay and repeated waiting events', async () => {
  const player = await read('components/player/Player.vue');
  assert.match(player, /if \(fallbackProbeTimer \|\| userPaused\.value/);
  assert.match(player, /const version = sourceVersion;\s*fallbackProbeTimer = setTimeout/);
  assert.match(player, /if \(version !== sourceVersion\) return;\s*const action = playbackWatchdogAction/);
  assert.match(player, /if \(pendingAutoPlay\.value\) startFallbackProbe\(\);/);
  assert.match(player, /if \(action === 'stop'\) stopPlaybackFailure\(\);\s*else advanceFallbackSource\(\);/);
  const canplay = player.split('const onMediaCanPlay = (): void => {')[1].split('const onMediaPlaying')[0];
  assert.match(canplay, /if \(userPaused\.value \|\| !pendingAutoPlay\.value\) return;/);
  assert.doesNotMatch(canplay, /clearFallbackProbeTimer\(\)|clearReconnectTimer\(\)/,
    'canplay alone must never cancel any recovery timer');
  const waiting = player.split('const onMediaWaiting = (): void => {')[1].split('const onMediaStalled')[0];
  assert.match(waiting, /pendingAutoPlay\.value = true;/);
  assert.match(waiting, /startFallbackProbe\(\);/);
  assert.match(player, /await configureHlsSource\(source, autoplay, version\);/);
  assert.match(player, /catch \(error\) \{[\s\S]*?scheduleReconnect\(\);/, 'failed HLS import/setup must not leave pending promise');
});

test('retry budget resets only after stable real playback, and timers are cancelled on pause/change/unmount', async () => {
  assert.equal(STABLE_PLAYBACK_WINDOW_MS, 30_000);
  const player = await read('components/player/Player.vue');
  const onPlaying = player.split('const onMediaPlaying = (): void => {')[1].split('const onMediaWaiting')[0];
  assert.match(onPlaying, /startStablePlaybackTimer\(\);/);
  assert.doesNotMatch(onPlaying, /attemptCount\.value = 0/, 'short successes must not replenish the retry budget');
  const stability = player.split('const startStablePlaybackTimer = (): void => {')[1].split('const tryPlay')[0];
  assert.match(stability, /version !== sourceVersion/);
  assert.match(stability, /!playing\.value \|\| waiting\.value/);
  assert.match(stability, /!media \|\| media\.paused/);
  assert.match(stability, /attemptCount\.value = 0/);
  for (const marker of ['const onMediaWaiting', 'const onMediaPause', 'const onMediaEnded', 'const onMediaError', 'onUnmounted']) {
    const after = player.split(marker)[1];
    assert.ok(after?.slice(0, marker === 'onUnmounted' ? 900 : 230).includes('clearStablePlaybackTimer()'),
      marker + ' must invalidate stability window');
  }
  const pause = player.split('const onPause = (): void => {')[1].split('const sleepRemaining')[0];
  assert.match(pause, /clearFallbackProbeTimer\(\);\s*clearStablePlaybackTimer\(\);/);
});

test('manual retry and offline/online restoration keep explicit intent and source identity', async () => {
  const player = await read('components/player/Player.vue');
  assert.match(player, /const retryCurrentSource = \(\): void => \{[\s\S]*?attemptCount\.value = 0;[\s\S]*?applySource\(activeSourceIndex\.value, true\)/);
  assert.match(player, /if \(wasOffline && !userPaused\.value\) \{\s*retryCurrentSource\(\)/);
  assert.match(player, /fallbackProbeTimer \|\| userPaused\.value \|\| !online\.value/);
  assert.doesNotMatch(player, /source: source\.src/, 'sensitive stream URL must not be logged');
  const recovery = player.split('const advanceFallbackSource = (): boolean => {')[1].split('const scheduleReconnect')[0];
  assert.doesNotMatch(recovery, /navigateStation|navigateTo/, 'recovery must not switch station');
});
