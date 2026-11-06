/**
 * Lightweight accent-insensitive search for the static radio catalog.
 * Used when Algolia is not configured or a remote search fails.
 */
export const normalizeStationQuery = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .trim();

// Immutable client catalog: prepare normalized fields once, without retaining discarded arrays.
const preparedCatalogs = new WeakMap();
const prepare = stations => {
  if (preparedCatalogs.has(stations)) return preparedCatalogs.get(stations);
  const entries = stations.flatMap((station, index) => {
    if (!station || !station.url || !station.station_name) return [];
    return [{ station, index,
      title: normalizeStationQuery(station.station_name),
      country: normalizeStationQuery(station.country_label || station.station_country || ''),
      slug: normalizeStationQuery(station.url.replace(/[-/]/g, ' ')),
    }];
  });
  preparedCatalogs.set(stations, entries);
  return entries;
};

export function searchLocalStations(stations, query, limit = 20) {
  if (!Array.isArray(stations) || limit <= 0) return [];
  const term = normalizeStationQuery(query);
  const words = term.split(/\s+/).filter(Boolean);
  const ranked = prepare(stations).flatMap(({ station, index, title, country, slug }) => {
    if (words.length && !words.every(word => title.includes(word) || country.includes(word) || slug.includes(word))) return [];
    const featuredRank = Number(station.featured_rank || 0);
    const score = !term ? (featuredRank ? 1000 - featuredRank : Number(Boolean(station.featured)) * 10)
      : title === term ? 100
      : title.startsWith(term) ? 80
      : title.includes(term) ? 55
      : slug.includes(term) ? 30
      : 10;
    return [{ station, score, index, featuredRank }];
  });
  ranked.sort((a, b) => {
    if (!term && (a.featuredRank || b.featuredRank)) return (a.featuredRank || 9999) - (b.featuredRank || 9999);
    return b.score - a.score || a.index - b.index;
  });
  return ranked.slice(0, limit).map(({ station }) => station);
}

export function filterQueueStations(stations, query, favoriteUrls, favoritesOnly) {
  const term = normalizeStationQuery(query);
  const favorites = new Set(favoriteUrls);
  return stations.filter(station => (!favoritesOnly || favorites.has(station.url)) && (!term || normalizeStationQuery(station.title).includes(term)));
}
