import test from "node:test";
import assert from "node:assert/strict";

import {
  isZingScheduleUrl,
  normalizeScheduleUrl,
  schedulePosition,
  referenceScheduleGap,
  referenceTimelineLayout,
  SCHEDULE_TIMELINE_HOUR_PX,
  scheduleTimelineProgress,
} from "../utils/station-schedule.mjs";

test("normalizes only real HTTP schedule URLs", () => {
  assert.equal(
    normalizeScheduleUrl(" https://example.com/schedule?time= "),
    "https://example.com/schedule?time=",
  );
  assert.equal(normalizeScheduleUrl(true), "");
  assert.equal(normalizeScheduleUrl(false), "");
  assert.equal(normalizeScheduleUrl(""), "");
  assert.equal(normalizeScheduleUrl("schedule-only"), "");
});

test("detects Zing schedule by provider endpoint instead of country", () => {
  assert.equal(
    isZingScheduleUrl(
      "https://zing.eplus.dev/api/live-stream-program-list?id=IWZ9799A&time=",
    ),
    true,
  );
  assert.equal(
    isZingScheduleUrl("https://hncaching.tek4tv.vn/api/Playlist/json/FM96_"),
    false,
  );
  assert.equal(
    isZingScheduleUrl("https://example.com/api/live-stream-program-list?id=x"),
    false,
  );
});

test('reference schedule focuses current programme at exact interval boundaries', () => {
  const schedule = [
    { startTime: 100, endTime: 200, title: 'Morning' },
    { startTime: 220, endTime: 400, title: 'Noon' },
    { startTime: 500, endTime: 700, title: 'Afternoon' },
  ];
  assert.deepEqual(schedulePosition(schedule, 100, true), { currentIndex: 0, scrollIndex: 0 });
  assert.deepEqual(schedulePosition(schedule, 199, true), { currentIndex: 0, scrollIndex: 0 });
  assert.deepEqual(schedulePosition(schedule, 220, true), { currentIndex: 1, scrollIndex: 1 });
  assert.deepEqual(schedulePosition(schedule, 399, true), { currentIndex: 1, scrollIndex: 1 });
  assert.deepEqual(schedulePosition(schedule, 500, true), { currentIndex: 2, scrollIndex: 2 });
  assert.deepEqual(schedulePosition(schedule, 700, true), { currentIndex: -1, scrollIndex: 2 });
});

test('schedule gaps scroll to nearest upcoming programme without falsely marking it live', () => {
  const schedule = [
    { startTime: 100, endTime: 200 },
    { startTime: 300, endTime: 400 },
    { startTime: 600, endTime: 900 },
  ];
  assert.deepEqual(schedulePosition(schedule, 0, true), { currentIndex: -1, scrollIndex: 0 });
  assert.deepEqual(schedulePosition(schedule, 250, true), { currentIndex: -1, scrollIndex: 1 });
  assert.deepEqual(schedulePosition(schedule, 500, true), { currentIndex: -1, scrollIndex: 2 });
  assert.deepEqual(schedulePosition(schedule, 999, true), { currentIndex: -1, scrollIndex: 2 });
  assert.deepEqual(schedulePosition([], 350, true), { currentIndex: -1, scrollIndex: -1 });
  assert.deepEqual(schedulePosition(null, 350, true), { currentIndex: -1, scrollIndex: -1 });
});

test('legacy remote schedule keeps the provider first programme convention', () => {
  const schedule = [{ title: 'Provider now' }, { title: 'Later' }];
  assert.deepEqual(schedulePosition(schedule, 1234, false), { currentIndex: 0, scrollIndex: 0 });
});

test('16:29 ICT is an unlisted gap before VOV Giao thông TP.HCM 16:30', async () => {
  const { vietnamReferencePrograms } = await import('../utils/vietnam-schedules.mjs');
  const programs = vietnamReferencePrograms('/asia/viet-nam/vov-gt-hcm', new Date('2026-10-14T09:29:00Z'));
  const nowSeconds = Date.parse('2026-10-14T09:29:00Z') / 1000;
  const gap = referenceScheduleGap(programs, nowSeconds);
  assert.deepEqual(gap, {
    insertIndex: 7,
    nextTitle: 'Giờ cao điểm chiều',
    nextStartTime: Date.parse('2026-10-14T09:30:00Z') / 1000,
  });
  assert.deepEqual(schedulePosition(programs, nowSeconds, true), { currentIndex: -1, scrollIndex: 7 });
  assert.equal(referenceScheduleGap(programs, nowSeconds + 60), null,
    '16:30 switches to the actual on-air slot, removing the gap marker');
  assert.deepEqual(schedulePosition(programs, nowSeconds + 60, true), { currentIndex: 7, scrollIndex: 7 });
});

test('unlisted reference gaps include before first, between slots and after last', () => {
  const schedule = [
    { startTime: 100, endTime: 200, title: 'First' },
    { startTime: 300, endTime: 400, title: 'Next' },
  ];
  assert.deepEqual(referenceScheduleGap(schedule, 50),
    { insertIndex: 0, nextTitle: 'First', nextStartTime: 100 });
  assert.equal(referenceScheduleGap(schedule, 150), null);
  assert.deepEqual(referenceScheduleGap(schedule, 250),
    { insertIndex: 1, nextTitle: 'Next', nextStartTime: 300 });
  assert.equal(referenceScheduleGap(schedule, 300), null);
  assert.deepEqual(referenceScheduleGap(schedule, 400),
    { insertIndex: 2, nextTitle: '', nextStartTime: null });
  assert.equal(referenceScheduleGap([], 250), null);
  assert.equal(referenceScheduleGap(null, 250), null);
  assert.equal(referenceScheduleGap(schedule, NaN), null);
});

test('Queue UI scrolls to missing-programme marker, never displays the next show as live', async () => {
  const { readFile } = await import('node:fs/promises');
  const queue = await readFile(new URL('../components/player/Queue.vue', import.meta.url), 'utf8');
  const marker = await readFile(new URL('../components/player/ScheduleGap.vue', import.meta.url), 'utf8');
  assert.match(queue, /scheduleGap\.value\s*\?\s*container\?\.querySelector<HTMLElement>\('\[data-schedule-now\]'\)/);
  assert.match(queue, /scheduleGap\?\.insertIndex === index/);
  assert.match(queue, /scheduleGap\?\.insertIndex === program\.length/);
  assert.match(marker, /data-schedule-now/);
  assert.match(marker, /panel\.schedule_gap_unknown/);
  assert.match(marker, /panel\.schedule_gap_next/);
  assert.doesNotMatch(marker, /player\.live|schedule_loading/);
});

test('live timeline percentage advances smoothly with wall-clock seconds', () => {
  assert.equal(scheduleTimelineProgress(100, 200, 100), 0);
  assert.equal(scheduleTimelineProgress(100, 200, 125), 25);
  assert.equal(scheduleTimelineProgress(100, 200, 150), 50);
  assert.equal(scheduleTimelineProgress(100, 200, 199), 99);
  assert.equal(scheduleTimelineProgress(100, 200, 200), 100);
  assert.equal(scheduleTimelineProgress(100, 200, 90), 0);
  assert.equal(scheduleTimelineProgress(100, 200, 250), 100);
  assert.equal(scheduleTimelineProgress(null, 200, 150), null);
  assert.equal(scheduleTimelineProgress(100, null, 150), null);
  assert.equal(scheduleTimelineProgress(200, 200, 150), null);
  assert.equal(scheduleTimelineProgress(300, 200, 150), null);
  assert.equal(scheduleTimelineProgress(100, 200, Number.NaN), null);
});

test('VOV HCM at 16:29 shows 93.33% of the 16:15–16:30 gap, ticking every second', async () => {
  const { vietnamReferencePrograms } = await import('../utils/vietnam-schedules.mjs');
  const now = Date.parse('2026-10-14T09:29:00Z') / 1000; // ICT +07:00.
  const programs = vietnamReferencePrograms('/asia/viet-nam/vov-gt-hcm', new Date(now * 1000));
  const gap = referenceScheduleGap(programs, now);
  assert.equal(gap.insertIndex, 7);
  const start = programs[gap.insertIndex - 1].endTime;
  const end = gap.nextStartTime;
  assert.equal(new Date(start * 1000).toISOString(), '2026-10-14T09:15:00.000Z');
  assert.equal(scheduleTimelineProgress(start, end, now), 100 * 14 / 15);
  assert.ok(scheduleTimelineProgress(start, end, now + 1) > scheduleTimelineProgress(start, end, now));
  assert.equal(scheduleTimelineProgress(start, end, end), 100);
  assert.equal(referenceScheduleGap(programs, end), null);
  const show = programs[gap.insertIndex];
  assert.equal(scheduleTimelineProgress(show.startTime, show.endTime, end), 0);
  assert.ok(scheduleTimelineProgress(show.startTime, show.endTime, end + 1) > 0);
});

test('live time bar is wired to a one-second clock only for visible reference guides', async () => {
  const { readFile } = await import('node:fs/promises');
  const q = await readFile(new URL('../components/player/Queue.vue', import.meta.url), 'utf8');
  const gap = await readFile(new URL('../components/player/ScheduleGap.vue', import.meta.url), 'utf8');
  assert.match(q, /scheduleTimelineProgress\(item\.startTime, item\.endTime, scheduleNow\.value\)/);
  assert.match(q, /scheduleClockTimer = setInterval\(/);
  assert.match(q, /\}, 1_000\)/);
  assert.match(q, /props\.visible && props\.scheduleIsReference/);
  assert.match(q, /data-schedule-clock role="timer"/);
  assert.match(q, /data-schedule-time-progress/);
  assert.match(q, /:start-time="gapStartTime\(scheduleGap\.insertIndex\)"/);
  assert.match(gap, /second: '2-digit'/);
  assert.match(gap, /data-schedule-time-progress/);
  assert.match(gap, /timelineProgress \+ '%'/);
});

test('timeline uses proportional clock time rather than equal-height station cards', async () => {
  const { vietnamReferencePrograms } = await import('../utils/vietnam-schedules.mjs');
  const now = Date.parse('2026-10-14T08:00:00Z') / 1000; // 15:00 ICT
  const programmes = vietnamReferencePrograms('/asia/viet-nam/vov-gt-hcm', new Date(now * 1000));
  const layout = referenceTimelineLayout(programmes, now);
  assert.ok(layout);
  assert.equal(SCHEDULE_TIMELINE_HOUR_PX, 76);
  assert.equal(new Date(layout.dayStart * 1000).toISOString(), '2026-10-13T17:00:00.000Z');
  assert.equal(layout.height, 27 * 76);
  assert.equal(layout.hours.length, 28);
  assert.equal(layout.hours[24].nextDay, true);
  assert.equal(layout.hours[24].time, layout.dayStart + 86400);
  assert.equal(layout.programmes[0].top, 4 * 76);
  assert.equal(layout.programmes[0].height, 76); // 04:00–05:00
  assert.equal(layout.programmes[6].height, 1.75 * 76); // FM91 14:30–16:15
  assert.equal(layout.programmes[6].active, true);
  assert.equal(layout.nowTop, 15 * 76);
  assert.equal(layout.gap, null);
  assert.ok(Math.abs(scheduleTimelineProgress(programmes[6].startTime, programmes[6].endTime, now)
    - (30 / 105) * 100) < 1e-9);
});

test('timeline puts the green NOW line at 16:29 in the unpublished 16:15–16:30 window', async () => {
  const { vietnamReferencePrograms } = await import('../utils/vietnam-schedules.mjs');
  const before = Date.parse('2026-10-14T09:29:00Z') / 1000;
  const programmes = vietnamReferencePrograms('/asia/viet-nam/vov-gt-hcm', new Date(before * 1000));
  const gapLayout = referenceTimelineLayout(programmes, before);
  assert.ok(Math.abs(gapLayout.nowTop - (16 + 29 / 60) * 76) < 1e-7);
  assert.equal(gapLayout.programmes.some(block => block.active), false);
  assert.equal(gapLayout.gap.startTime, Date.parse('2026-10-14T09:15:00Z') / 1000);
  assert.equal(gapLayout.gap.endTime, Date.parse('2026-10-14T09:30:00Z') / 1000);
  assert.equal(gapLayout.gap.nextTitle, 'Giờ cao điểm chiều');
  const liveLayout = referenceTimelineLayout(programmes, before + 60);
  assert.equal(liveLayout.gap, null);
  assert.equal(liveLayout.programmes[7].active, true);
  assert.ok(Math.abs((liveLayout.nowTop - gapLayout.nowTop) - 76 / 60) < 1e-9);
});

test('timeline continues past midnight with next-date axis and bounded progress', () => {
  const programmes = [{
    startTime: Date.parse('2026-10-14T12:00:00Z') / 1000,
    endTime: Date.parse('2026-10-15T01:30:00Z') / 1000,
    title: 'Night programme',
  }];
  const now = Date.parse('2026-10-14T20:50:00Z') / 1000; // 03:50 ICT next day
  const layout = referenceTimelineLayout(programmes, now);
  assert.ok(layout.hours.some(hour => hour.nextDay));
  assert.equal(layout.programmes[0].height, 13.5 * 76);
  assert.equal(layout.nowTop, (27 + 50 / 60) * 76);
  assert.ok(layout.height > layout.nowTop);
  assert.equal(scheduleTimelineProgress(100, 200, 50), 0);
  assert.equal(scheduleTimelineProgress(100, 200, 250), 100);
  assert.equal(scheduleTimelineProgress(100, 100, 100), null);
  assert.equal(scheduleTimelineProgress(undefined, 200, 150), null);
  assert.equal(referenceTimelineLayout([], now), null);
});
