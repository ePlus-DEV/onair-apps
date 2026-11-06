import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LISTENING_DURATION_KEY,
  LISTENING_TRACKING_ENABLED_KEY,
  parseListeningTrackingEnabled,
  MAX_LISTENING_GAP_MS,
  MAX_TRACKED_DAYS,
  addListeningDurationAcrossDays,
  dailyListeningSeries,
  splitListeningDurationByDay,
  addListeningDuration,
  createListeningDurationTracker,
  emptyListeningDuration,
  localDayKey,
  parseListeningDuration,
} from '../utils/listening-duration.mjs';

const station = (id) => ({ url: `/europe/united-kingdom/${id}`, title: id, image: '/brand/onair-mark.svg' });

test('duration statistics accumulate only actual playback, independently of history and favorites', () => {
  assert.equal(LISTENING_DURATION_KEY, 'radio_listening_duration_v1');
  let data = emptyListeningDuration();
  data = addListeningDuration(data, station('heart-uk'), 32_000, '2026-10-14');
  data = addListeningDuration(data, station('heart-uk'), 8_000, '2026-10-14');
  data = addListeningDuration(data, station('bbc'), 12_000, '2026-10-14');
  assert.equal(data.totalMs, 52_000);
  assert.equal(data.todayMs, 52_000);
  assert.equal(data.byStation['/europe/united-kingdom/heart-uk'].ms, 40_000);
  assert.equal(data.byStation['/europe/united-kingdom/bbc'].ms, 12_000);
  const nextDay = addListeningDuration(data, station('heart-uk'), 5_000, '2026-10-15');
  assert.equal(nextDay.totalMs, 57_000);
  assert.equal(nextDay.todayMs, 5_000);
  assert.equal(nextDay.todayKey, '2026-10-15');
  assert.deepEqual(parseListeningDuration(JSON.stringify(nextDay)), nextDay);
  assert.deepEqual(parseListeningDuration('{broken json'), emptyListeningDuration());
  assert.equal(addListeningDuration(data, { ...station('x'), url: 'https://evil.example' }, 5_000), data);
  assert.match(localDayKey(new Date(2026, 9, 14)), /^2026-10-14$/);
});

test('duration tracker pauses during waiting, resume and stream switch, and reports in batches', () => {
  let now = 0;
  const commits = [];
  const reports = [];
  const tracker = createListeningDurationTracker({
    now: () => now,
    onDuration: (target, ms) => commits.push([target.url, ms]),
    onReport: (target, ms) => reports.push([target.url, ms]),
  });
  tracker.start(station('heart-uk'));
  now = 5_000;
  tracker.flush(); // heartbeat
  now = 10_000;
  tracker.stop(); // pause or waiting
  now = 40_000;
  tracker.flush(); // paused duration is excluded
  tracker.start(station('heart-uk')); // resume
  now = 70_000;
  tracker.flush();
  now = 72_000;
  tracker.start(station('bbc')); // station switch flushes old
  now = 77_000;
  tracker.stop();

  assert.deepEqual(commits, [
    ['/europe/united-kingdom/heart-uk', 5_000],
    ['/europe/united-kingdom/heart-uk', 5_000],
    ['/europe/united-kingdom/heart-uk', 30_000],
    ['/europe/united-kingdom/heart-uk', 2_000],
    ['/europe/united-kingdom/bbc', 5_000],
  ]);
  assert.deepEqual(reports, [
    ['/europe/united-kingdom/heart-uk', 10_000],
    ['/europe/united-kingdom/heart-uk', 30_000],
    ['/europe/united-kingdom/heart-uk', 2_000],
    ['/europe/united-kingdom/bbc', 5_000],
  ]);
  assert.equal(tracker.activeUrl, '');
});

test('duration tracker ignores duplicate playing and caps unusually long sleep gaps', () => {
  let now = 100;
  const elapsed = [];
  const tracker = createListeningDurationTracker({ now: () => now, onDuration: (_station, ms) => elapsed.push(ms) });
  tracker.start(station('heart-uk'));
  now = 5_000;
  tracker.start(station('heart-uk')); // duplicate media playing event must not reset the clock
  now = 900_000;
  tracker.stop();
  // A normal 15-minute listening session must not be clipped by the 6h cap.
  assert.deepEqual(elapsed, [899_900]);

  // A much longer missing checkpoint is capped to guard unusual sleep gaps.
  tracker.start(station('heart-uk'));
  now += MAX_LISTENING_GAP_MS + 60_000;
  tracker.stop();
  assert.deepEqual(elapsed, [899_900, MAX_LISTENING_GAP_MS]);
});

test('live preview updates without persisting, then resets after checkpoint and pause', () => {
  let now = 100;
  const saved = [];
  const tracker = createListeningDurationTracker({
    now: () => now,
    onDuration: (target, ms) => saved.push({ url: target.url, ms }),
  });
  assert.equal(tracker.pendingMs, 0);
  tracker.start(station('heart-uk'));
  assert.equal(tracker.activeUrl, '/europe/united-kingdom/heart-uk');
  now = 1_600;
  assert.equal(tracker.pendingMs, 1_500);
  assert.deepEqual(saved, [], 'live preview must not write persistent time each second');

  now = 5_100;
  tracker.flush();
  assert.equal(tracker.pendingMs, 0);
  assert.deepEqual(saved, [{ url: '/europe/united-kingdom/heart-uk', ms: 5_000 }]);

  now = 6_100;
  assert.equal(tracker.pendingMs, 1_000);
  tracker.stop();
  assert.deepEqual(saved.map(entry => entry.ms), [5_000, 1_000]);
  assert.equal(tracker.pendingMs, 0);
  assert.equal(tracker.activeUrl, '');

  now += 4_000;
  assert.equal(tracker.pendingMs, 0, 'no live preview accrues while paused');
});

test('daily buckets preserve historical totals and render missing days as zero', () => {
  let stats = emptyListeningDuration();
  stats = addListeningDuration(stats, station('heart-uk'), 120_000, '2026-10-12');
  stats = addListeningDuration(stats, station('heart-uk'), 30_000, '2026-10-14');
  stats = addListeningDuration(stats, station('bbc'), 90_000, '2026-10-14');
  assert.equal(stats.totalMs, 240_000);
  assert.deepEqual(stats.byDay, { '2026-10-12': 120_000, '2026-10-14': 120_000 });
  assert.equal(stats.todayMs, 120_000);
  assert.deepEqual(dailyListeningSeries(stats, 7, new Date(2026, 9, 14)).slice(-3), [
    { key: '2026-10-12', ms: 120_000 },
    { key: '2026-10-13', ms: 0 },
    { key: '2026-10-14', ms: 120_000 },
  ]);
  const loaded = parseListeningDuration(JSON.stringify(stats));
  assert.deepEqual(loaded, stats, 'daily buckets survive reload without duplicate accumulation');
});

test('checkpoints crossing local midnight split exactly, including the live preview', () => {
  const end = new Date(2026, 9, 15, 0, 0, 3);
  assert.deepEqual(splitListeningDurationByDay(5_000, end), {
    '2026-10-14': 2_000,
    '2026-10-15': 3_000,
  });
  const stats = addListeningDurationAcrossDays(emptyListeningDuration(), station('heart-uk'), 5_000, end);
  assert.equal(stats.totalMs, 5_000);
  assert.equal(stats.todayKey, '2026-10-15');
  assert.equal(stats.todayMs, 3_000);
  assert.deepEqual(stats.byDay, { '2026-10-14': 2_000, '2026-10-15': 3_000 });
  const preview = dailyListeningSeries(stats, 7, end, 2_000);
  assert.deepEqual(preview.slice(-2), [
    { key: '2026-10-14', ms: 2_000 },
    { key: '2026-10-15', ms: 5_000 },
  ]);
});

test('older listening data migrates the one known daily bucket without fabricating older days', () => {
  const legacy = { totalMs: 3_600_000, todayKey: '2026-10-14', todayMs: 60_000, byStation: {} };
  const upgraded = parseListeningDuration(JSON.stringify(legacy));
  assert.equal(upgraded.totalMs, 3_600_000);
  assert.deepEqual(upgraded.byDay, { '2026-10-14': 60_000 });
  assert.deepEqual(parseListeningDuration(JSON.stringify(upgraded)), upgraded);
  assert.deepEqual(parseListeningDuration(JSON.stringify({
    ...legacy, byDay: { '2026-10-13': 99_000, '2026-02-30': 42_000, 'invalid': 100 },
  })).byDay, { '2026-10-13': 99_000 });
});

test('daily storage is bounded to 365 days while retaining lifetime and station totals', () => {
  let stats = emptyListeningDuration();
  for (let n = 0; n < MAX_TRACKED_DAYS + 10; n++) {
    const date = new Date(2025, 0, 1 + n);
    stats = addListeningDuration(stats, station('heart-uk'), 1_000, localDayKey(date));
  }
  assert.equal(stats.totalMs, (MAX_TRACKED_DAYS + 10) * 1_000);
  assert.equal(stats.byStation['/europe/united-kingdom/heart-uk'].ms, stats.totalMs);
  assert.equal(Object.keys(stats.byDay).length, MAX_TRACKED_DAYS);
  assert.equal(Object.keys(parseListeningDuration(JSON.stringify(stats)).byDay).length, MAX_TRACKED_DAYS);
  assert.equal(dailyListeningSeries(stats, 30, new Date(2025, 1, 2)).length, 30);
  assert.equal(dailyListeningSeries(stats, 90, new Date(2025, 1, 2)).length, 90);
});

test('listening tracking preference defaults on but honors an explicit persistent opt-out', () => {
  assert.equal(LISTENING_TRACKING_ENABLED_KEY, 'radio_listening_tracking_enabled_v1');
  assert.equal(parseListeningTrackingEnabled(null), true);
  assert.equal(parseListeningTrackingEnabled('1'), true);
  assert.equal(parseListeningTrackingEnabled('0'), false);
});

test('privacy opt-out and data deletion discard buffered listening instead of reporting', () => {
  let now = 0;
  const stored = [];
  const reports = [];
  const tracker = createListeningDurationTracker({
    now: () => now,
    onDuration: (_station, ms) => stored.push(ms),
    onReport: (_station, ms) => reports.push(ms),
  });
  tracker.start(station('heart-uk'));
  now = 22_000;
  assert.equal(tracker.pendingMs, 22_000);
  tracker.discard();
  assert.equal(tracker.activeUrl, '');
  assert.equal(tracker.pendingMs, 0);
  assert.deepEqual(stored, []);
  assert.deepEqual(reports, []);
  now += 60_000;
  tracker.stop();
  assert.deepEqual(stored, []);
  assert.deepEqual(reports, []);
  // Tracking can be restarted from exactly the moment the visitor opts in.
  tracker.start(station('heart-uk'));
  now += 2_000;
  tracker.stop();
  assert.deepEqual(stored, [2_000]);
  assert.deepEqual(reports, [2_000]);
});
