import test from 'node:test';
import assert from 'node:assert/strict';
import { createStationPolling } from '../utils/station-polling.mjs';
import { createPlaybackStation } from '../utils/playback-station.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('a late schedule cannot overwrite the newly selected station', async () => {
  const pending = [];
  const received = [];
  const loading = [];
  const polling = createStationPolling({
    load: (url, signal) => new Promise(resolve => pending.push({ url, signal, resolve })),
    onData: value => received.push(value),
    onLoading: value => loading.push(value),
    setTimer: () => 1,
    clearTimer: () => {},
  });
  polling.start('first');
  polling.start('second');
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve('new schedule');
  await tick();
  pending[0].resolve('stale schedule');
  await tick();
  assert.deepEqual(received, ['new schedule']);
  assert.deepEqual(loading, [true, true, false]);
  polling.stop();
});

test('polling recovers after a provider failure and stops when a station has no schedule', async () => {
  const jobs = new Map();
  let requests = 0;
  let nextId = 0;
  const received = [];
  const polling = createStationPolling({
    load: async () => { if (++requests === 1) throw new Error('provider down'); return 'recovered'; },
    onData: value => received.push(value), onLoading: () => {},
    setTimer: (fn, delay) => { assert.equal(delay, 60_000); jobs.set(++nextId, fn); return nextId; },
    clearTimer: id => jobs.delete(id),
  });
  polling.start('schedule');
  await tick();
  assert.equal(jobs.size, 1);
  const callback = jobs.get(1); jobs.delete(1); await callback();
  assert.deepEqual(received, ['recovered']);
  polling.start('');
  assert.equal(jobs.size, 0);
  assert.equal(requests, 2);
});

test('teardown ignores a pending provider response without restarting polling', async () => {
  let resolve;
  const polling = createStationPolling({
    load: () => new Promise(done => { resolve = done; }),
    onData: () => assert.fail('disposed data'), onLoading: () => {},
    setTimer: () => assert.fail('disposed timer'),
  });
  polling.start('schedule'); polling.stop(); resolve('late'); await tick();
});

test('catalog activation preserves explicit proxy sources and ignores invalid legacy schedules', () => {
  const station = createPlaybackStation({
    area: 'north-america', country: 'example-country', id: 'station', corsServer: 'https://proxy/',
    meta: { title: 'Station', stream: ' https://example/live.m3u8 ', type: 'application/x-mpegURL', schedule: true,
      streams: [{ url: 'https://example/live.m3u8' }, { url: 'https://example/backup.mp3', cros: true }, { url: 'invalid' }] },
  });
  assert.equal(station.url, '/north-america/example-country/station');
  assert.equal(station.countryKey, 'world.north_america.example_country');
  assert.equal(station.schedule, '');
  assert.deepEqual(station.sources.map(source => [source.src, source.proxied]), [
    ['https://example/live.m3u8', false], ['https://proxy/https://example/backup.mp3', true],
  ]);
});

test('suspended polling makes no request and resumes without losing its station', async () => {
  let allowed = false;
  let callback;
  const calls = [];
  const polling = createStationPolling({
    shouldPoll: () => allowed,
    load: async url => { calls.push(url); return url; },
    onData: () => {}, onLoading: () => {},
    setTimer: fn => { callback = fn; return 1; }, clearTimer: () => {},
  });
  polling.start('current-station');
  await tick();
  assert.deepEqual(calls, []);
  allowed = true;
  await callback();
  assert.deepEqual(calls, ['current-station']);
  polling.stop();
});
