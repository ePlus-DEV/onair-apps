import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIETNAM_SCHEDULE_TIMEZONE,
  VIETNAM_SCHEDULES,
  getVietnamSchedule,
  vietnamDateKey,
  vietnamMidnightUtc,
  vietnamReferencePrograms,
} from '../utils/vietnam-schedules.mjs';

test('Vietnam station schedules map only exact supported station paths to official broadcaster URLs', () => {
  assert.equal(VIETNAM_SCHEDULE_TIMEZONE, 'Asia/Ho_Chi_Minh');
  assert.equal(getVietnamSchedule('/asia/viet-nam/vov-giao-thong').sourceUrl, 'https://vovgiaothong.vn/lich-phat-song-hn/');
  assert.equal(getVietnamSchedule('/asia/viet-nam/vov-gt-hcm').sourceUrl, 'https://vovgiaothong.vn/lich-phat-song-hcm/');
  assert.equal(getVietnamSchedule('/asia/viet-nam/vov-mekong').sourceUrl, 'https://vovgiaothong.vn/lich-phat-song-mk/');
  assert.equal(getVietnamSchedule('/asia/viet-nam/vov1').sourceUrl, 'https://vov1.vov.vn/');
  assert.equal(getVietnamSchedule('/asia/viet-nam/vov3').sourceUrl, 'https://vov3.vov.vn/lich-phat-song');
  for (const id of ['voh-fm-99.9-mhz', 'voh-fm-95.6-mhz', 'voh-fm-87.7-mhz', 'voh-am-610khz']) {
    assert.equal(getVietnamSchedule('/asia/viet-nam/' + id).sourceUrl, 'https://voh.com.vn/radios/schedule');
    assert.deepEqual(vietnamReferencePrograms('/asia/viet-nam/' + id), []);
  }
  for (const path of ['/europe/united-kingdom/vov-gt-hcm', '/asia/viet-nam/other', '/asia/viet-nam/vov1?test=1', null, '', '/asia/viet-nam/../vov1']) {
    assert.equal(getVietnamSchedule(path), null);
    assert.deepEqual(vietnamReferencePrograms(path), []);
  }
});

test('radio station guides have validated, chronological, non-overlapping source windows', () => {
  for (const [id, info] of Object.entries(VIETNAM_SCHEDULES)) {
    assert.match(info.sourceUrl, /^https:\/\/(?:vovgiaothong\.vn|vov1\.vov\.vn|vov3\.vov\.vn|voh\.com\.vn)\//);
    let priorEnd = 0;
    for (const [start, end, name] of info.slots) {
      assert.match(start, /^\d\d:\d\d$/);
      assert.match(end, /^\d\d:\d\d$/);
      assert.equal(typeof name, 'string');
      assert.ok(name.length > 2);
      const toMinutes = v => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
      assert.ok(toMinutes(start) >= priorEnd, id + ': overlap or unordered ' + start);
      assert.ok(toMinutes(end) > toMinutes(start), id + ': invalid interval ' + end);
      priorEnd = toMinutes(end);
    }
  }
  assert.ok(vietnamReferencePrograms('/asia/viet-nam/vov-giao-thong').length >= 10);
  assert.ok(vietnamReferencePrograms('/asia/viet-nam/vov-gt-hcm').length >= 7);
  assert.ok(vietnamReferencePrograms('/asia/viet-nam/vov-mekong').length >= 6);
  assert.deepEqual(vietnamReferencePrograms('/asia/viet-nam/vov1'), [], 'do not invent VOV1 daily slots');
});

test('programmes are anchored in Vietnam UTC+7, independent of the listener time zone', () => {
  // 17:30 UTC is already the next day (00:30) in Vietnam.
  const instant = new Date('2026-10-14T17:30:00.000Z');
  assert.equal(vietnamDateKey(instant), '2026-10-15');
  assert.equal(new Date(vietnamMidnightUtc(instant)).toISOString(), '2026-10-14T17:00:00.000Z');
  const hanoi = vietnamReferencePrograms('/asia/viet-nam/vov-giao-thong', instant);
  assert.equal(new Date(hanoi[0].startTime * 1000).toISOString(), '2026-10-14T21:00:00.000Z'); // 04:00 ICT
  assert.equal(new Date(hanoi[0].endTime * 1000).toISOString(), '2026-10-14T22:30:00.000Z'); // 05:30 ICT
  assert.ok(hanoi.every((item, i) => item.endTime > item.startTime && (!i || hanoi[i - 1].endTime <= item.startTime)));
  const yesterday = vietnamReferencePrograms('/asia/viet-nam/vov-giao-thong', new Date('2026-10-14T16:30:00.000Z'));
  assert.equal(hanoi[0].startTime - yesterday[0].startTime, 86400);
});

test('player and detail page expose sourced schedule, not falsely a current broadcast', async () => {
  const { readFile } = await import('node:fs/promises');
  const realtime = await readFile(new URL('../composables/useStationRealtime.ts', import.meta.url), 'utf8');
  const queue = await readFile(new URL('../components/player/Queue.vue', import.meta.url), 'utf8');
  const page = await readFile(new URL('../pages/[area]/[country]/[station].vue', import.meta.url), 'utf8');
  assert.match(realtime, /vietnamReferencePrograms\(playback\.station\?\.url\)/);
  assert.match(realtime, /scheduleSourceUrl/);
  assert.match(queue, /schedule_reference_note/);
  assert.match(queue, /schedule_official_link/);
  assert.match(queue, /formatProgramTime/);
  assert.match(queue, /isCurrentProgram/);
  assert.match(page, /vietnamReferencePrograms\(stationPath\.value\)/);
  assert.match(page, /officialSchedule\.sourceUrl/);
});
