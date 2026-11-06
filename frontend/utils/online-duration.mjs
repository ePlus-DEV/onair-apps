import {
  MAX_TRACKED_DAYS,
  dailyListeningSeries,
  localDayKey,
  splitListeningDurationByDay,
} from './listening-duration.mjs';

export const ONLINE_DURATION_KEY = 'radio_online_duration_v1';
export const ONLINE_TRACKING_ENABLED_KEY = 'radio_online_tracking_enabled_v1';
export const ONLINE_IDLE_MS = 5 * 60_000;
export const MAX_ONLINE_CHECKPOINT_MS = 15_000;
export const parseOnlineTrackingEnabled = value => value !== '0';
export const emptyOnlineDuration = () => ({
  totalMs: 0, todayKey: '', todayMs: 0, byDay: {},
});
const safeMs = value => Number.isFinite(value)
  ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0;
const validDayKey = key => {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const boundedDays = source => Object.fromEntries(
  Object.entries(source || {})
    .filter(([key]) => validDayKey(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-MAX_TRACKED_DAYS)
    .map(([key, value]) => [key, safeMs(value)]),
);

export function parseOnlineDuration(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyOnlineDuration();
    return {
      totalMs: safeMs(value.totalMs),
      todayKey: validDayKey(value.todayKey) ? value.todayKey : '',
      todayMs: safeMs(value.todayMs),
      byDay: boundedDays(value.byDay && typeof value.byDay === 'object'
        && !Array.isArray(value.byDay) ? value.byDay : {}),
    };
  } catch { return emptyOnlineDuration(); }
}

/** Persist online presence independently of audio listening and its stations. */
export function addOnlineDurationAcrossDays(stats, elapsedMs, endDate = new Date()) {
  const segments = splitListeningDurationByDay(
    Math.min(MAX_ONLINE_CHECKPOINT_MS, safeMs(elapsedMs)), endDate,
  );
  if (!Object.keys(segments).length) return stats;
  const byDay = { ...stats.byDay };
  let todayKey = stats.todayKey;
  let todayMs = stats.todayMs;
  let totalMs = stats.totalMs;
  for (const [key, duration] of Object.entries(segments)) {
    byDay[key] = safeMs((byDay[key] || 0) + duration);
    totalMs = safeMs(totalMs + duration);
    todayKey = key;
    todayMs = safeMs((stats.todayKey === key ? stats.todayMs : 0) + duration);
  }
  return { totalMs, todayKey, todayMs, byDay: boundedDays(byDay) };
}

export const dailyOnlineSeries = (stats, days, date = new Date(), pendingMs = 0) =>
  dailyListeningSeries(stats, days, date, pendingMs);

/** Time only a foreground tab with focus. Stop at the idle deadline and cap timer sleep gaps. */
export function createOnlineDurationTracker({
  now = () => performance.now(),
  date = () => new Date(),
  onDuration,
  idleMs = ONLINE_IDLE_MS,
} = {}) {
  if (typeof onDuration !== 'function') throw new TypeError('onDuration is required');
  let active = false;
  let lastAt = 0;
  let lastActivityAt = 0;

  const elapsed = () => {
    if (!active) return 0;
    const current = now();
    const end = Math.min(current, lastActivityAt + idleMs);
    return Math.max(0, Math.min(MAX_ONLINE_CHECKPOINT_MS, end - lastAt));
  };
  const flush = () => {
    if (!active) return;
    const value = elapsed();
    lastAt = now();
    if (value > 0) onDuration(value, date());
    if (lastAt >= lastActivityAt + idleMs) active = false;
  };
  const stop = () => { flush(); active = false; };
  return {
    start() {
      if (active) return;
      active = true;
      lastAt = now();
      lastActivityAt = lastAt;
    },
    activity() {
      const current = now();
      if (!active) { active = true; lastAt = current; }
      lastActivityAt = current;
    },
    flush,
    stop,
    discard() { active = false; },
    get active() { return active && now() < lastActivityAt + idleMs; },
    get pendingMs() { return elapsed(); },
  };
}
