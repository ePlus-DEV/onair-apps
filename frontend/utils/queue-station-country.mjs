/**
 * Resolve a station's actual country from its canonical route, never from
 * whichever station happens to be playing in a mixed queue.
 */
export function stationCountryKey(url) {
  if (typeof url !== 'string') return '';
  const path = url.split(/[?#]/, 1)[0];
  // Global Radio uses a provider namespace, not a geographic country.
  if (/^\/global-radio\/apple-music\/[a-z0-9-]+$/.test(path)) return 'global_radio.title';
  const match = /^\/([a-z0-9-]+)\/([a-z0-9-]+)\/([^/]+)$/.exec(path);
  if (!match) return '';
  const [, area, country] = match;
  return `world.${area.replaceAll('-', '_')}.${country.replaceAll('-', '_')}`;
}

/** Only show a queue-wide country badge when every item belongs to it. */
export function queueCountryKey(stations) {
  if (!Array.isArray(stations) || stations.length === 0) return '';
  const first = stationCountryKey(stations[0]?.url);
  return first && stations.every(station => stationCountryKey(station?.url) === first)
    ? first
    : '';
}
