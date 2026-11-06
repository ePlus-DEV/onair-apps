import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRawStorageSnapshot } from '../utils/local-duration-snapshot.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('unchanged local stats do not repeat JSON parse/validation on every checkpoint', () => {
  const snapshot = createRawStorageSnapshot();
  let parses = 0;
  const parse = raw => { parses++; return JSON.parse(raw); };
  const empty = () => ({ totalMs: 0 });
  const initial = { totalMs: 0 };
  const first = snapshot.read('{"totalMs":1000}', initial, parse, empty);
  assert.equal(first.totalMs, 1000);
  assert.equal(parses, 1);
  for (let i = 0; i < 20; i++) {
    assert.equal(snapshot.read('{"totalMs":1000}', first, parse, empty), first);
  }
  assert.equal(parses, 1);
  const updated = { totalMs: 6000 };
  snapshot.saved(JSON.stringify(updated));
  assert.equal(snapshot.read('{"totalMs":6000}', updated, parse, empty), updated);
  assert.equal(parses, 1);
});

test('external tab writes and cleared storage always update the cached snapshot', () => {
  const snapshot = createRawStorageSnapshot();
  let parses = 0;
  const parse = raw => { parses++; return JSON.parse(raw); };
  const empty = () => ({ totalMs: 0 });
  const first = snapshot.external('{"totalMs":9000}', parse, empty);
  assert.equal(first.totalMs, 9000);
  const second = snapshot.read('{"totalMs":12000}', first, parse, empty);
  assert.equal(second.totalMs, 12000, 'a write from another tab must not be skipped');
  assert.equal(parses, 2);
  assert.deepEqual(snapshot.external(null, parse, empty), { totalMs: 0 });
  assert.deepEqual(snapshot.read(null, { totalMs: 0 }, parse, empty), { totalMs: 0 });
  assert.equal(parses, 2);
});

test('two independently tracked durations do not share a storage snapshot', () => {
  const online = createRawStorageSnapshot();
  const listening = createRawStorageSnapshot();
  const parse = raw => JSON.parse(raw);
  const empty = () => ({ totalMs: 0 });
  online.saved('{"totalMs":100}');
  listening.saved('{"totalMs":1000}');
  assert.deepEqual(online.read('{"totalMs":100}', { totalMs: 100 }, parse, empty), { totalMs: 100 });
  assert.deepEqual(listening.read('{"totalMs":1000}', { totalMs: 1000 }, parse, empty), { totalMs: 1000 });
  assert.deepEqual(online.read('{"totalMs":150}', { totalMs: 100 }, parse, empty), { totalMs: 150 });
  assert.deepEqual(listening.read('{"totalMs":1000}', { totalMs: 1000 }, parse, empty), { totalMs: 1000 });
});

test('stores revalidate changed cross-tab data and preserve legacy duration keys', async () => {
  const [online, listening] = await Promise.all([
    read('stores/onlineDuration.ts'),
    read('stores/listeningDuration.ts'),
  ]);
  for (const source of [online, listening]) {
    assert.match(source, /createRawStorageSnapshot\(\)/);
    assert.match(source, /durationSnapshot\.external\(/);
    assert.match(source, /durationSnapshot\.read\(/);
    assert.match(source, /durationSnapshot\.saved\(raw\)/);
    assert.match(source, /localStorage\.getItem\(/);
    assert.match(source, /localStorage\.setItem\(/);
    assert.match(source, /event\.key === null/);
    assert.match(source, /durationSnapshot\.saved\(null\)/);
  }
  assert.match(online, /ONLINE_DURATION_KEY/);
  assert.match(listening, /LISTENING_DURATION_KEY/);
});
