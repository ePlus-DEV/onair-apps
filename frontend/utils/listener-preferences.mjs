/** Only new listener controls belong here. Existing library/audio/theme/i18n data are preserved. */
export const LISTENER_PREFERENCES_KEY = 'radio:listener-preferences:v1';
export const DEFAULT_LISTENER_PREFERENCES = Object.freeze({
  resumeLive: true,
  autoReconnect: true,
  restoreStation: true,
  rememberVolume: true,
  reduceMotion: false,
});
export const parseListenerPreferences = (raw) => {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return { ...DEFAULT_LISTENER_PREFERENCES }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ...DEFAULT_LISTENER_PREFERENCES };
  }
  return Object.fromEntries(Object.entries(DEFAULT_LISTENER_PREFERENCES).map(([key, value]) =>
    [key, typeof data[key] === 'boolean' ? data[key] : value]));
};
export const shouldReconnectToLive = ({ resumeLive, hasPaused, activeSource }) =>
  Boolean(resumeLive && hasPaused && activeSource);

/** Seek only within a valid live window; if the window is unknown, reconnect. */
export const safeLiveSyncPosition = (livePosition, media) => {
  if (!media || !Number.isFinite(livePosition)) return null;
  const ranges = media.seekable;
  try {
    if (!ranges || !ranges.length) return null;
    const end = ranges.end(ranges.length - 1);
    const start = ranges.start(ranges.length - 1);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    if (livePosition < start || livePosition > end) return null;
    return Math.min(end, Math.max(start, livePosition));
  } catch { return null; }
};
