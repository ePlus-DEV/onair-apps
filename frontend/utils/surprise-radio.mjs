// Only publicly listed, canonical catalog entries can be discovered.
// This is not a live-health check: the browser verifies playback after selection.
const CANONICAL_STATION_PATH = /^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/;

export function randomStationCandidates(stations, filters = {}) {
  if (!Array.isArray(stations)) return [];
  const seen = new Set();
  return stations.filter(station => {
    if (!station || typeof station.url !== 'string'
      || !CANONICAL_STATION_PATH.test(station.url)
      || typeof station.station_name !== 'string' || !station.station_name.trim()
      || seen.has(station.url)) return false;
    if (filters.country && station.station_country !== filters.country) return false;
    if (filters.genre && station.station_category !== filters.genre) return false;
    if (filters.language && station.station_language !== filters.language) return false;
    seen.add(station.url);
    return true;
  });
}

export function pickRandomStation(stations, filters = {}, random = Math.random) {
  const pool = randomStationCandidates(stations, filters);
  if (!pool.length) return null;
  // Never immediately repeat the last random station if an alternative exists.
  const withoutPrevious = pool.length > 1
    ? pool.filter(item => item.url !== filters.previousUrl)
    : pool;
  const eligible = withoutPrevious.length ? withoutPrevious : pool;
  const roll = Number(random());
  const unit = Number.isFinite(roll) ? Math.min(1 - Number.EPSILON, Math.max(0, roll)) : 0;
  return eligible[Math.floor(unit * eligible.length)] || null;
}

export function randomStationFacets(stations, field, filters = {}) {
  const values = new Set(randomStationCandidates(stations, filters)
    .map(item => String(item[field] || '').trim()).filter(Boolean));
  return [...values].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}
