import { stationIdentity } from './listening-library.mjs';

export const FAVORITES_FILE_LIMIT = 256 * 1024;
export const FAVORITES_LIMIT = 200;

// Only identities cross devices. Stream URLs, history and playback intent never do.
export function exportFavorites(favorites) {
  const seen = new Set();
  const urls = favorites.flatMap(value => {
    const item = stationIdentity(value);
    if (!item || seen.has(item.url)) return [];
    seen.add(item.url);
    return [item.url];
  }).slice(0, FAVORITES_LIMIT);
  return JSON.stringify({ format: 'eplus-onair-favorites', version: 1, stations: urls }, null, 2);
}

export function parseFavoritesFile(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > FAVORITES_FILE_LIMIT) throw new Error('Invalid favorites file');
  const value = JSON.parse(text);
  if (value?.format !== 'eplus-onair-favorites' || value.version !== 1 || !Array.isArray(value.stations) || value.stations.length > FAVORITES_LIMIT) throw new Error('Invalid favorites file');
  if (!value.stations.every(url => typeof url === 'string' && stationIdentity({ url, title: 'station' }))) throw new Error('Invalid station identity');
  return [...new Set(value.stations)];
}

export function previewFavoritesImport(urls, catalog, current) {
  const catalogByUrl = new Map(catalog.map(station => [station.url, stationIdentity({
    url: station.url, title: station.station_name, image: station.station_image, countryKey: station.station_country,
  })]));
  const existing = new Set(current.map(station => station.url));
  const available = [];
  let missing = 0;
  let duplicates = 0;
  for (const url of new Set(urls)) {
    const station = catalogByUrl.get(url);
    if (!station) missing += 1;
    else if (existing.has(url)) duplicates += 1;
    else available.push(station);
  }
  const room = Math.max(0, FAVORITES_LIMIT - current.length);
  return { additions: available.slice(0, room), missing, duplicates, overflow: Math.max(0, available.length - room) };
}

export function mergeFavorites(current, additions) {
  const seen = new Set();
  return [...current, ...additions].flatMap(value => {
    const station = stationIdentity(value);
    if (!station || seen.has(station.url)) return [];
    seen.add(station.url);
    return [station];
  }).slice(0, FAVORITES_LIMIT);
}
