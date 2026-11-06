import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ONLINE_DURATION_KEY, ONLINE_TRACKING_ENABLED_KEY, ONLINE_IDLE_MS,
  MAX_ONLINE_CHECKPOINT_MS, emptyOnlineDuration, parseOnlineDuration,
  parseOnlineTrackingEnabled, addOnlineDurationAcrossDays, dailyOnlineSeries,
  createOnlineDurationTracker,
} from '../utils/online-duration.mjs';
import { emptyListeningDuration, addListeningDuration } from '../utils/listening-duration.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('online time has its own storage, consent and no listening-station data', () => {
  assert.equal(ONLINE_DURATION_KEY, 'radio_online_duration_v1');
  assert.equal(ONLINE_TRACKING_ENABLED_KEY, 'radio_online_tracking_enabled_v1');
  assert.equal(parseOnlineTrackingEnabled('0'), false);
  assert.equal(parseOnlineTrackingEnabled(null), true);
  assert.deepEqual(parseOnlineDuration(null), emptyOnlineDuration());
  assert.deepEqual(parseOnlineDuration('{bad'), emptyOnlineDuration());
  assert.deepEqual(parseOnlineDuration('[]'), emptyOnlineDuration());
  const listening = addListeningDuration(
    emptyListeningDuration(),
    { url: '/asia/viet-nam/voh', title: 'VOH', image: '/brand/onair-mark.svg' },
    30_000, '2026-11-02',
  );
  assert.equal(listening.totalMs, 30_000);
  const online = addOnlineDurationAcrossDays(emptyOnlineDuration(), 5_000, new Date(2026, 10, 2, 12, 0, 5));
  assert.equal(online.totalMs, 5_000);
  assert.equal(listening.totalMs, 30_000, 'online must not mutate the independent listening totals');
  assert.equal(online.byStation, undefined, 'online presence must not be assigned to a station');
});

test('online checkpoints split at local midnight and preserve daily totals', () => {
  const end = new Date(2026, 10, 3, 0, 0, 3);
  const stats = addOnlineDurationAcrossDays(emptyOnlineDuration(), 5_000, end);
  assert.deepEqual(stats.byDay, { '2026-11-02': 2_000, '2026-11-03': 3_000 });
  assert.equal(stats.totalMs, 5_000);
  assert.equal(stats.todayKey, '2026-11-03');
  assert.equal(stats.todayMs, 3_000);
  assert.deepEqual(parseOnlineDuration(JSON.stringify(stats)), stats);
  assert.deepEqual(dailyOnlineSeries(stats, 7, end, 1_000).slice(-2), [
    { key: '2026-11-02', ms: 2_000 },
    { key: '2026-11-03', ms: 4_000 },
  ]);
});

test('invalid daily values are sanitized and daily storage remains bounded', () => {
  const broken = parseOnlineDuration(JSON.stringify({
    totalMs: -100, todayKey: '2026-02-30', todayMs: -1,
    byDay: { '2026-11-02': 1234, '2026-02-30': 9999, '__proto__': 9 },
  }));
  assert.deepEqual(broken, { totalMs: 0, todayKey: '', todayMs: 0, byDay: { '2026-11-02': 1234 } });
  let stats = emptyOnlineDuration();
  for (let i = 0; i < 375; i++) stats = addOnlineDurationAcrossDays(stats, 1_000, new Date(2025, 0, 1+i, 12, 0, 1));
  assert.equal(stats.totalMs, 375_000);
  assert.equal(Object.keys(stats.byDay).length, 365);
  assert.equal(Object.keys(parseOnlineDuration(JSON.stringify(stats)).byDay).length, 365);
});

test('unusually long suspended timers never become hours of online presence', () => {
  const stats = addOnlineDurationAcrossDays(emptyOnlineDuration(), 6 * 60 * 60 * 1000,
    new Date(2026, 10, 2, 12, 0, 0));
  assert.equal(stats.totalMs, MAX_ONLINE_CHECKPOINT_MS);
});

test('active foreground tracker does not depend on media playing or pause', () => {
  let now = 0;
  const commits = [];
  const tracker = createOnlineDurationTracker({
    now: () => now,
    date: () => new Date(2026, 10, 2, 9, 0, 0),
    onDuration: ms => commits.push(ms),
  });
  tracker.start();
  now = 4_000; tracker.flush();
  now = 7_000; assert.equal(tracker.pendingMs, 3_000);
  tracker.stop(); // tab hidden or focus lost
  now = 90_000; tracker.flush();
  assert.deepEqual(commits, [4_000, 3_000]);
  assert.equal(tracker.pendingMs, 0);
  tracker.start();
  now = 95_000; tracker.stop();
  assert.deepEqual(commits, [4_000, 3_000, 5_000]);
});

test('idle state stops accumulation after five minutes; resuming requires user activity', () => {
  let now = 0;
  let counted = 0;
  const tracker = createOnlineDurationTracker({ now: () => now, onDuration: ms => { counted += ms; } });
  tracker.start();
  for (let i = 0; i < ONLINE_IDLE_MS / 5_000; i++) { now += 5_000; tracker.flush(); }
  assert.equal(counted, ONLINE_IDLE_MS);
  assert.equal(tracker.active, false);
  now += 60_000;
  tracker.flush();
  assert.equal(counted, ONLINE_IDLE_MS);
  tracker.activity();
  now += 2_000;
  tracker.stop();
  assert.equal(counted, ONLINE_IDLE_MS + 2_000);
  tracker.start();
  now += 60_000;
  tracker.discard(); // explicit tracking opt-out / statistics reset
  assert.equal(counted, ONLINE_IDLE_MS + 2_000);
});

test('online tracking is in the global app, separate from player, with visibility and privacy controls', async () => {
  const [app, online, stats, settings, store] = await Promise.all([
    read('app.vue'), read('composables/useOnlinePresence.ts'),
    read('components/panel/ListeningStats.vue'),
    read('pages/settings.vue'), read('stores/onlineDuration.ts'),
  ]);
  assert.match(app, /useOnlinePresence\(\)/);
  assert.match(online, /document\.visibilityState === 'visible'/);
  assert.match(online, /document\.hasFocus\(\)/);
  assert.match(online, /navigator\.onLine/);
  assert.match(online, /ONLINE_IDLE_MS/);
  assert.match(online, /pagehide/);
  assert.match(online, /radio:online-duration-reset/);
  assert.match(stats, /online_stats\.total/);
  assert.match(stats, /totalOnlineMs/);
  assert.match(stats, /dailyOnlineSeries/);
  assert.doesNotMatch(stats, /setTrackingEnabled\(/, 'tracking controls moved to Settings');
  assert.match(settings, /online\.setTrackingEnabled/);
  assert.match(settings, /duration\.clearStatistics\(\); online\.clearStatistics\(\)/);
  assert.match(store, /ONLINE_DURATION_KEY/);
  assert.match(store, /localStorage\.setItem/);
});

test('all seven locales explain online time and independent listening metrics', async () => {
  for (const locale of ['en-US', 'vi-VN', 'ja-JP', 'fr-FR', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const copy = JSON.parse(await read('lang/' + locale + '.json')).online_stats;
    for (const key of ['total', 'today', 'tracking', 'definition', 'listening', 'online',
      'chart_kind', 'daily_chart', 'daily_hint', 'period_total', 'daily_empty', 'listening_today',
      'clear_title', 'clear_description', 'clear_action']) {
      assert.ok(typeof copy?.[key] === 'string' && copy[key].trim(), locale + ' missing ' + key);
    }
  }
});
