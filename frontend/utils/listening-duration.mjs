import { stationIdentity } from './listening-library.mjs';

export const LISTENING_DURATION_KEY = 'radio_listening_duration_v1';
export const LISTENING_TRACKING_ENABLED_KEY = 'radio_listening_tracking_enabled_v1';
// Tracking is enabled for existing users unless they explicitly opt out.
export const parseListeningTrackingEnabled = value => value !== '0';
export const MAX_TRACKED_STATIONS = 100;
export const MAX_TRACKED_DAYS = 365;
// A background tab can have timers suspended while native radio keeps playing.
// Guard against pathological clock gaps without truncating normal long listens.
export const MAX_LISTENING_GAP_MS = 6 * 60 * 60 * 1000;
export const emptyListeningDuration = () => ({
  totalMs: 0,
  todayKey: '',
  todayMs: 0,
  byStation: {},
  byDay: {},
});

const safeMs = value => Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0;


const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const validDayKey = key => {
  if (typeof key !== 'string' || !DAY_KEY_PATTERN.test(key)) return false;
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const boundedDayTotals = totals => Object.fromEntries(
  Object.entries(totals)
    .filter(([key]) => validDayKey(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-MAX_TRACKED_DAYS)
    .map(([key, value]) => [key, safeMs(value)]),
);

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseListeningDuration(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyListeningDuration();
    const entries = Object.entries(data.byStation && typeof data.byStation === 'object' ? data.byStation : {});
    const byStation = {};
    for (const [url, entry] of entries.slice(-MAX_TRACKED_STATIONS)) {
      const station = stationIdentity({ url, title: entry?.title, image: '/brand/onair-mark.svg' });
      if (!station) continue;
      byStation[url] = { title: station.title, ms: safeMs(entry?.ms) };
    }
    const todayKey = validDayKey(data.todayKey) ? data.todayKey : '';
    const todayMs = safeMs(data.todayMs);
    const byDay = boundedDayTotals(
      data.byDay && typeof data.byDay === 'object' && !Array.isArray(data.byDay) ? data.byDay : {},
    );
    // A v1 record knows today's listening time, but not the daily history.
    // Never invent earlier days or overwrite buckets already migrated.
    if (todayKey && !Object.hasOwn(byDay, todayKey) && !Object.hasOwn(data, 'byDay') && todayMs > 0) {
      byDay[todayKey] = todayMs;
    }
    return {
      totalMs: safeMs(data.totalMs),
      todayKey,
      todayMs,
      byStation,
      byDay: boundedDayTotals(byDay),
    };
  } catch { return emptyListeningDuration(); }
}

export function addListeningDuration(stats, station, durationMs, dayKey = localDayKey()) {
  const item = stationIdentity(station);
  const elapsed = safeMs(durationMs);
  if (!item || elapsed < 1) return stats;
  const byStation = { ...stats.byStation };
  const previous = byStation[item.url];
  delete byStation[item.url]; // Move recently used station to the end for bounded storage.
  byStation[item.url] = {
    title: item.title,
    ms: safeMs((previous?.ms || 0) + elapsed),
  };
  const keys = Object.keys(byStation);
  for (const oldUrl of keys.slice(0, -MAX_TRACKED_STATIONS)) delete byStation[oldUrl];
  const byDay = { ...(stats.byDay || {}) };
  if (validDayKey(dayKey)) byDay[dayKey] = safeMs((byDay[dayKey] || 0) + elapsed);
  return {
    totalMs: safeMs(stats.totalMs + elapsed),
    todayKey: dayKey,
    todayMs: safeMs((stats.todayKey === dayKey ? stats.todayMs : 0) + elapsed),
    byStation,
    byDay: boundedDayTotals(byDay),
  };
}


/** Allocate each checkpoint to its actual local calendar day, even at midnight. */
export function splitListeningDurationByDay(durationMs, endDate = new Date()) {
  // Trackers already cap unflushed intervals; enforce the same bound here.
  const elapsed = Math.min(MAX_LISTENING_GAP_MS, safeMs(durationMs));
  if (!elapsed || !(endDate instanceof Date) || !Number.isFinite(endDate.getTime())) return {};
  const result = {};
  let current = endDate.getTime() - elapsed;
  const end = endDate.getTime();
  while (current < end) {
    const startDate = new Date(current);
    const nextMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1).getTime();
    const until = Math.min(end, nextMidnight);
    const key = localDayKey(startDate);
    result[key] = (result[key] || 0) + (until - current);
    current = until;
  }
  return result;
}

export function addListeningDurationAcrossDays(stats, station, elapsedMs, endDate = new Date()) {
  const segments = splitListeningDurationByDay(elapsedMs, endDate);
  let next = stats;
  for (const [dayKey, value] of Object.entries(segments)) {
    next = addListeningDuration(next, station, value, dayKey);
  }
  return next;
}

/** Ordered daily buckets in local time, suitable for a 7/30/90-day chart. */
export function dailyListeningSeries(stats, days, endDate = new Date(), liveMs = 0) {
  const count = [7, 30, 90].includes(days) ? days : 7;
  const today = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const preview = splitListeningDurationByDay(liveMs, endDate);
  const series = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = localDayKey(date);
    series.push({ key, ms: safeMs((stats.byDay?.[key] || 0) + (preview[key] || 0)) });
  }
  return series;
}

// Monotonic clock: accumulate only between actual media "playing" and pause,
// waiting/stalled, ended, error or source-switch signals.
export function createListeningDurationTracker({
  now = () => performance.now(),
  onDuration,
  onReport = () => {},
  reportEveryMs = 30_000,
} = {}) {
  if (typeof onDuration !== 'function') throw new TypeError('onDuration is required');
  let active = null;
  let lastAt = 0;
  let unreportedMs = 0;

  const flush = () => {
    if (!active) return;
    const current = now();
    const elapsed = Math.max(0, Math.min(MAX_LISTENING_GAP_MS, current - lastAt));
    lastAt = current;
    if (elapsed <= 0) return;
    onDuration(active, elapsed);
    unreportedMs += elapsed;
    if (unreportedMs >= reportEveryMs) {
      onReport(active, unreportedMs);
      unreportedMs = 0;
    }
  };

  const stop = () => {
    if (!active) return;
    flush();
    if (unreportedMs >= 1000) onReport(active, unreportedMs);
    active = null;
    unreportedMs = 0;
  };

  // A privacy opt-out or "clear statistics" must not flush a final duration
  // checkpoint (or send a GA4 report) that the user has just disallowed.
  const discard = () => {
    active = null;
    unreportedMs = 0;
  };

  return {
    start(station) {
      const valid = stationIdentity(station);
      if (!valid) return;
      if (active?.url === valid.url) return;
      stop();
      active = valid;
      lastAt = now();
    },
    flush,
    stop,
    discard,
    // Preview accrued time without writing to storage. This is read by the
    // visible statistics dashboard each second; flush still persists every 5s.
    get pendingMs() {
      if (!active) return 0;
      return Math.max(0, Math.min(MAX_LISTENING_GAP_MS, now() - lastAt));
    },
    get activeUrl() { return active?.url || ''; },
  };
}
