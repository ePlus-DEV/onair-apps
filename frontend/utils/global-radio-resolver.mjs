// The browser only consumes an approved ePlus-controlled resolver. This module
// deliberately does NOT call TuneIn, extract keys or impersonate a provider.
export const APPLE_HLS_HOST = 'itsliveradio.apple.com';
export const MIN_STREAM_TTL_MS = 45_000;

const stationSlug = value => typeof value === 'string' && /^[a-z0-9-]{3,80}$/.test(value);
const httpsUrl = value => {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
    return url;
  } catch { return null; }
};

export function buildAuthorizedResolverRequest(endpoint, stationId) {
  const url = httpsUrl(endpoint);
  if (!url || !stationSlug(stationId) || url.search || url.hash) return null;
  url.searchParams.set('provider', 'apple-music');
  url.searchParams.set('station_id', stationId);
  return url.href;
}

export function validateAuthorizedAppleStream(payload, stationId, appleListenUrl, now = Date.now()) {
  if (!stationSlug(stationId) || !payload || typeof payload !== 'object'
    || payload.status !== 'ok' || payload.authorized !== true
    || payload.provider !== 'apple-music' || payload.station_id !== stationId) {
    return { ok: false, reason: 'unauthorized' };
  }
  const stationPage = httpsUrl(appleListenUrl);
  const stationNumber = stationPage?.hostname === 'music.apple.com'
    ? stationPage.pathname.match(/\/ra\.(\d+)$/)?.[1]
    : null;
  const stream = httpsUrl(payload.stream_url);
  // HAR confirms both Holiday Hits' master manifest and 64/256-kbps
  // media playlists use the opaque 'ppa' alias instead of a numeric station ID.
  // Do not generalize this alias to other Apple Music stations.
  const parts = stream?.pathname.split('/') || [];
  const matchesNumberedCmafMaster = Boolean(stationNumber)
    && stream?.pathname === `/3p-tune-in/tune_in/${stationNumber}/index-cmaf.m3u8`;
  const matchesNumberedTsMaster = Boolean(stationNumber)
    && stream?.pathname === `/3p-tune-in/tune_in/${stationNumber}-ts/index-ts.m3u8`;
  const matchesNumberedPath = Boolean(stationNumber)
    && parts.length === 6
    && parts[1] === '3p-tune-in'
    && parts[2] === 'tune_in'
    && parts[3] === stationNumber
    && /^[a-z0-9_-]+$/i.test(parts[4])
    && parts[5].endsWith('.m3u8')
    && /^[0-9]+$/.test(parts[5].slice(0, -5));
  const matchesHolidayPath = stationId === 'apple-music-holiday-hits'
    && stationNumber === '6825447412'
    && (stream?.pathname === '/3p-tune-in/tune_in/ppa/index-cmaf.m3u8'
      || stream?.pathname === '/3p-tune-in/tune_in/ppa-ts/index-ts.m3u8'
      || /^\/3p-tune-in\/tune_in\/ppa\/usw\/(?:64|256)\.m3u8$/.test(stream?.pathname || ''));
  if (!stationNumber || !stream || stream.hostname !== APPLE_HLS_HOST
    || !(matchesNumberedCmafMaster || matchesNumberedTsMaster || matchesNumberedPath || matchesHolidayPath)
    || !stream.searchParams.get('accessKey')) {
    return { ok: false, reason: 'invalid_source' };
  }
  // The signed token is never persisted or logged. Verify the server expiry,
  // and never trust it if the accessKey embeds an earlier Unix expiration.
  const expiresSeconds = Number(payload.expires_at);
  if (!Number.isSafeInteger(expiresSeconds)) return { ok: false, reason: 'invalid_expiry' };
  let expiresAt = expiresSeconds * 1000;
  const tokenEpoch = stream.searchParams.get('accessKey').split('_', 1)[0];
  if (/^\d{10}$/.test(tokenEpoch)) expiresAt = Math.min(expiresAt, Number(tokenEpoch) * 1000);
  if (expiresAt < now + MIN_STREAM_TTL_MS) return { ok: false, reason: 'expired' };
  return { ok: true, streamUrl: stream.href, expiresAt };
}

export async function resolveAuthorizedAppleStream({ endpoint, station, signal, fetcher = fetch }) {
  const requestUrl = buildAuthorizedResolverRequest(endpoint, station?.id);
  if (!requestUrl) throw new Error('not_configured');
  // No credentials, no access keys in request, and never cache signed URLs.
  const response = await fetcher(requestUrl, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error('unavailable');
  const payload = await response.json();
  const checked = validateAuthorizedAppleStream(payload, station.id, station.listen_url);
  if (!checked.ok) throw new Error(checked.reason);
  return checked;
}
