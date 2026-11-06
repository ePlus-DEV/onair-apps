import test from 'node:test';
import assert from 'node:assert/strict';
import { createSleepTimer } from '../utils/sleep-timer.mjs';

function fixture() {
  let time = 0, expired = 0, remaining = 0, nextId = 0;
  const pending = new Map();
  const timer = createSleepTimer({
    now: () => time,
    setTimer: (callback, delay) => { const id = ++nextId; pending.set(id, { callback, delay }); return id; },
    clearTimer: id => pending.delete(id),
    onExpire: () => { expired++; },
    onChange: minutes => { remaining = minutes; },
  });
  return { timer, pending, advance: value => { time += value; }, get expired() { return expired; }, get remaining() { return remaining; } };
}

test('sleep timer uses wall-clock deadline, including resuming after background suspension', () => {
  const f = fixture();
  f.timer.start(15);
  assert.equal(f.remaining, 15);
  assert.equal(f.pending.size, 1);
  f.advance(2 * 60_000);
  f.timer.check();
  assert.equal(f.remaining, 13);
  assert.equal(f.pending.size, 1);
  f.advance(20 * 60_000);
  f.timer.check();
  f.timer.check();
  assert.equal(f.expired, 1);
  assert.equal(f.remaining, 0);
  assert.equal(f.pending.size, 0);
});

test('replacing or cancelling a timer removes the old deadline and pending work', () => {
  const f = fixture();
  f.timer.start(15);
  f.advance(10 * 60_000);
  f.timer.start(30);
  f.advance(5 * 60_000);
  f.timer.check();
  assert.equal(f.remaining, 25);
  assert.equal(f.expired, 0);
  f.timer.cancel();
  f.advance(60 * 60_000);
  f.timer.check();
  assert.equal(f.pending.size, 0);
  assert.equal(f.expired, 0);
  for (const invalid of [0, -1, NaN, Infinity, 121]) {
    f.timer.start(invalid);
    assert.equal(f.pending.size, 0);
  }
});
