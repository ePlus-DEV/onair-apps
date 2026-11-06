// Direct public TuneIn resolver for ePlus OnAir's seven known Apple Radio
// listings. The CORS server comes from Nuxt runtimeConfig (NUXT_PUBLIC_CORS_SERVER_1).
// The public Tune.ashx response contains a fresh signed Apple HLS URL.
// Do not persist/log the URL, accessKey or provider response anywhere.
export const PUBLIC_APPLE_TUNEIN_STATIONS = Object.freeze({
  'apple-music-1': { tunein: 's345732', apple: '978194965' },
  'apple-music-hits': { tunein: 's345724', apple: '1498155548' },
  'apple-music-country': { tunein: 's345725', apple: '1498157166' },
  'apple-music-club': { tunein: 's345726', apple: '1740613859' },
  'apple-musica-uno': { tunein: 's345727', apple: '1740613864' },
  'apple-music-chill': { tunein: 's345733', apple: '1740614260' },
  'apple-music-holiday-hits': { tunein: 's363737', apple: '6825447412' },
});

const MIN_LIFETIME_MS = 45_000;
const APPLE_HOST = 'itsliveradio.apple.com';

export function buildPublicTuneInRequest(stationId, corsServer) {
  const station = PUBLIC_APPLE_TUNEIN_STATIONS[stationId];
  if (!station || typeof corsServer !== 'string' || !corsServer.trim()) return null;
  try {
    const proxy = new URL(corsServer);
    // Configured by the site owner, never supplied by listeners or station data.
    // No implicit Heroku fallback: an absent/invalid env value disables this path.
    if (proxy.protocol !== 'https:' || !proxy.hostname ||
      proxy.username || proxy.password || proxy.search || proxy.hash ||
      proxy.pathname !== '/') return null;
    const upstream = new URL('https://opml.radiotime.com/Tune.ashx');
    upstream.searchParams.set('id', station.tunein);
    upstream.searchParams.set('render', 'json');
    upstream.searchParams.set('formats', 'aac,hls,mp3');
    // CORS Anywhere uses the full absolute upstream URL as its request path.
    return proxy.origin + '/' + upstream.href;
  } catch { return null; }
}

export function inspectPublicAppleStream(streamValue, stationId, now = Date.now()) {
  const station = PUBLIC_APPLE_TUNEIN_STATIONS[stationId];
  if (!station || typeof streamValue !== 'string' || streamValue.length > 8192) return null;
  let url;
  try { url = new URL(streamValue); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== APPLE_HOST ||
    url.username || url.password || url.port || url.hash ||
    [...url.searchParams].length !== 1 || url.searchParams.getAll('accessKey').length !== 1) return null;

  const base = '/3p-tune-in/tune_in/';
  const path = url.pathname;
  // TuneIn may return either MPEG-TS or CMAF masters. The numeric Apple ID
  // binds the CMAF stream to the selected station (unlike Holiday's 'ppa').
  const normalTs = path === base + station.apple + '-ts/index-ts.m3u8';
  const normalCmaf = path === base + station.apple + '/index-cmaf.m3u8';
  const holidayTs = stationId === 'apple-music-holiday-hits'
    && path === base + 'ppa-ts/index-ts.m3u8';
  const normalHls = new RegExp('^' + base + station.apple +
    '/[a-z0-9_-]+/(?:64|128|256|320)\\.m3u8$', 'i').test(path);
  const holidayCmaf = stationId === 'apple-music-holiday-hits' &&
    (path === base + 'ppa/index-cmaf.m3u8' ||
      /^\/3p-tune-in\/tune_in\/ppa\/usw\/(?:64|256)\.m3u8$/.test(path));
  if (!normalTs && !normalCmaf && !holidayTs && !normalHls && !holidayCmaf) return null;

  const key = url.searchParams.get('accessKey') || '';
  const match = key.match(/^(\d{10})_[A-Za-z0-9+/=_-]+$/);
  if (!match) return null;
  const expiresAt = Number(match[1]) * 1000;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now + MIN_LIFETIME_MS) return null;
  return { ok: true, streamUrl: url.href, expiresAt };
}

export async function resolvePublicTuneInStream({ station, corsServer, signal, fetcher = fetch }) {
  const requestUrl = buildPublicTuneInRequest(station?.id, corsServer);
  if (!requestUrl) throw new Error('invalid_station');
  const response = await fetcher(requestUrl, {
    method: 'GET', cache: 'no-store', credentials: 'omit',
    headers: { Accept: 'application/json' }, signal,
  });
  if (!response?.ok) throw new Error('unavailable');
  const payload = await response.json();
  if (payload?.head?.status != null && Number(payload.head.status) !== 200) {
    throw new Error('unavailable');
  }
  const candidates = Array.isArray(payload?.body) ? payload.body : [];
  let fallback = null;
  for (const item of candidates) {
    const checked = inspectPublicAppleStream(item?.url, station.id);
    if (!checked) continue;
    // Prefer a provider-issued CMAF master when offered: its in-band emsg/ID3
    // can supply accurate current-song metadata. Retain MPEG-TS as fallback.
    if (new URL(checked.streamUrl).pathname.endsWith('/index-cmaf.m3u8')) return checked;
    fallback ||= checked;
  }
  if (fallback) return fallback;
  throw new Error('unavailable');
}
