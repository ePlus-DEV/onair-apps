import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeRadioAction } from '../frontend/utils/native-radio-state.mjs';

test('only events for the active source can affect the player', () => {
  assert.equal(nativeRadioAction({ id: '1', playing: true }, 2, false), 'ignore');
  assert.equal(nativeRadioAction({ id: '2', playing: true }, 2, true), 'ignore');
  assert.equal(nativeRadioAction({ id: '2', playing: true }, 2, false), 'playing');
});

test('native buffering, audio-focus interruptions, failures and external pause are distinct', () => {
  const base = { id: '2', playing: false, playWhenReady: true, suppression: 0, state: 2 };
  assert.equal(nativeRadioAction(base, 2, false), 'waiting');
  assert.equal(nativeRadioAction({ ...base, suppression: 1 }, 2, false), 'suppressed');
  assert.equal(nativeRadioAction({ ...base, error: 'ERROR_CODE_IO' }, 2, false), 'error');
  assert.equal(nativeRadioAction({ ...base, state: 3, playWhenReady: false }, 2, false), 'pause');
  assert.equal(nativeRadioAction({ ...base, state: 4 }, 2, false), 'ended');
});
