// Anonymous, read-only TuneIn station metadata for Apple's seven allowlisted
// radio channels. HLS access keys are NEVER used to request song information.
// TuneIn may not publish current_song/current_artist for every station.
import { PUBLIC_APPLE_TUNEIN_STATIONS } from './global-radio-public-tunein.mjs';

const PREFIX = 'tunein-apple-metadata:';
const MAX_RECENT_TRACKS = 30;
const clean = value => typeof value === 'string' ? value.trim().slice(0, 180) : '';
const isFalse = value => value === false || value === 'false' || value === 0 || value === '0';

export function appleTuneInStationId(station) {
  if (!station || typeof station.id !== 'string') return '';
  return station.url === '/global-radio/apple-music/' + station.id
    && Object.hasOwn(PUBLIC_APPLE_TUNEIN_STATIONS, station.id) ? station.id : '';
}

export function appleTuneInMetadataMarker(station) {
  const id = appleTuneInStationId(station);
  return id ? PREFIX + id : '';
}

export function stationIdFromTuneInMetadataMarker(marker) {
  const id = typeof marker === 'string' && marker.startsWith(PREFIX)
    ? marker.slice(PREFIX.length) : '';
  return Object.hasOwn(PUBLIC_APPLE_TUNEIN_STATIONS, id) ? id : '';
}

export function buildPublicTuneInMetadataRequest(stationId, corsServer) {
  const station = PUBLIC_APPLE_TUNEIN_STATIONS[stationId];
  if (!station || typeof corsServer !== 'string' || !corsServer.trim()) return null;
  try {
    // Match the public playback resolver's env-only HTTPS origin policy.
    // An unconfigured proxy must not silently revert to the old Heroku host.
    const proxy = new URL(corsServer);
    if (proxy.protocol !== 'https:' || !proxy.hostname ||
      proxy.username || proxy.password || proxy.port || proxy.search || proxy.hash ||
      proxy.pathname !== '/') return null;
    // Describe is TuneIn's read endpoint; Playing.ashx is the AIR write endpoint.
    const upstream = new URL('https://opml.radiotime.com/Describe.ashx');
    upstream.searchParams.set('id', station.tunein);
    upstream.searchParams.set('render', 'json');
    return proxy.origin + '/' + upstream.href;
  } catch { return null; }
}

export function parseTuneInStationMetadata(payload, stationId) {
  const expected = PUBLIC_APPLE_TUNEIN_STATIONS[stationId];
  if (!expected) throw new Error('invalid_station');
  if (payload?.head?.status != null && Number(payload.head.status) !== 200) {
    throw new Error('unavailable');
  }
  // Describe is often an OPML tree: body[] -> outline -> station.
  // Walk only bounded, in-response station records; do not follow URLs.
  const pending = Array.isArray(payload?.body) ? payload.body.slice(0, 20) : [];
  let examined = 0;
  while (pending.length && examined++ < 40) {
    const row = pending.shift();
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    if (Array.isArray(row.children)) pending.push(...row.children.slice(0, 20));
    if (row.station && typeof row.station === 'object') pending.push(row.station);
    if (row.element && row.element !== 'station') continue;
    if (row.guide_id && row.guide_id !== expected.tunein) continue;
    if (row.preset_id && row.preset_id !== expected.tunein) continue;
    if (isFalse(row.has_song) || isFalse(row.publish_song)
      || row.commercial === true || row.commercial === 'true') continue;
    const title = clean(row.current_song);
    const artist = clean(row.current_artist);
    if (title && artist && title.toLowerCase() !== artist.toLowerCase()) {
      return { title, artist };
    }
  }
  return null;
}

// Only tracks actually seen in the current listening session are kept in
// memory. No imagined past tracks, provider history endpoint, or persistence.
export function addTuneInSessionTrack(previous, nowPlaying) {
  const existing = Array.isArray(previous) ? previous : [];
  if (!nowPlaying?.title || !nowPlaying?.artist) return existing.slice(0, MAX_RECENT_TRACKS);
  const latest = existing[0];
  if (latest?.track_title === nowPlaying.title && latest?.track_artist === nowPlaying.artist) {
    // An ID3 fragment can add the real album artwork after a title/artist pair.
    return nowPlaying.artwork && latest.track_image !== nowPlaying.artwork
      ? [{ ...latest, track_image: nowPlaying.artwork }, ...existing.slice(1, MAX_RECENT_TRACKS)]
      : existing.slice(0, MAX_RECENT_TRACKS);
  }
  return [{
    track_title: nowPlaying.title,
    track_artist: nowPlaying.artist,
    track_image: nowPlaying.artwork || '',
    // Time of actual song start is unknown; do NOT fake the timestamp.
    track_played: 0,
  }, ...existing].slice(0, MAX_RECENT_TRACKS);
}

export async function fetchPublicTuneInMetadata({ stationId, corsServer, signal, fetcher = fetch }) {
  const requestUrl = buildPublicTuneInMetadataRequest(stationId, corsServer);
  if (!requestUrl) throw new Error('invalid_station');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(requestUrl, {
      method: 'GET', cache: 'no-store', credentials: 'omit',
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    if (!response?.ok) throw new Error('unavailable');
    return parseTuneInStationMetadata(await response.json(), stationId);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
