import { MAX_STREAM_ATTEMPTS, nextPlaybackIndex } from './radio-source-plan.mjs';

// A stream is not healthy merely because the manifest or metadata was loaded.
// Keep a watchdog through initial connecting and after playback begins buffering.
export const STREAM_STALL_TIMEOUT_MS = 10_000;
// Short bursts of audio must not reset the six-attempt retry budget.
export const STABLE_PLAYBACK_WINDOW_MS = 30_000;

export function playbackWatchdogAction({
  waiting = false,
  playing = false,
  userPaused = true,
  online = false,
  autoReconnect = false,
  attemptCount = 0,
  sourceCount = 0,
} = {}) {
  if (!online || userPaused || playing || !waiting || !Number.isInteger(sourceCount) || sourceCount < 1) {
    return 'ignore';
  }
  if (!autoReconnect || attemptCount >= MAX_STREAM_ATTEMPTS) return 'stop';
  // One source or the final source must still be retried (until budget ends).
  return 'advance';
}

export function nextRecoverySourceIndex(currentIndex, sourceCount) {
  return nextPlaybackIndex(currentIndex, sourceCount);
}
