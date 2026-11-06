export const LISTENING_LIBRARY_KEY = 'radio_listening_library_v1';
export const emptyListeningLibrary = () => ({ recent: [], favorites: [], lastStation: null, lastState: 'pause' });

export function stationIdentity(value) {
  if (!value || typeof value.url !== 'string' || !/^\/(?!\/)[^/?#]+\/[^/?#]+\/[^/?#]+$/.test(value.url)) return null;
  if (value.url.split('/').some(part => part === '.' || part === '..') || value.url.includes('\\')) return null;
  if (typeof value.title !== 'string' || !value.title.trim()) return null;
  const image = typeof value.image === 'string' && /^(?:\/(?!\/)|https?:\/\/)/i.test(value.image) ? value.image : '/brand/onair-mark.svg';
  return { url: value.url, title: value.title.slice(0, 300), image, countryKey: String(value.countryKey || '').slice(0, 150) };
}

const uniqueStations = (values, limit) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const item = stationIdentity(value);
    if (!item || seen.has(item.url)) return [];
    seen.add(item.url);
    return [item];
  }).slice(0, limit);
};

export function parseListeningLibrary(raw) {
  try {
    const value = JSON.parse(raw);
    return {
      recent: uniqueStations(value?.recent, 20),
      favorites: uniqueStations(value?.favorites, 200),
      lastStation: stationIdentity(value?.lastStation),
      lastState: value?.lastState === 'play' ? 'play' : 'pause',
    };
  } catch { return emptyListeningLibrary(); }
}

export function rememberStation(library, station, state, heard = false) {
  const item = stationIdentity(station);
  if (!item) return library;
  return {
    ...library, lastStation: item, lastState: state === 'play' ? 'play' : 'pause',
    recent: heard ? [item, ...library.recent.filter(entry => entry.url !== item.url)].slice(0, 20) : library.recent,
  };
}

/** Remove one entry from history without changing favorites or active station preference. */
export function removeRecentStation(library, stationUrl) {
  if (typeof stationUrl !== 'string' || !stationUrl) return library;
  return { ...library, recent: library.recent.filter(entry => entry.url !== stationUrl) };
}

export function toggleFavoriteStation(library, station) {
  const item = stationIdentity(station);
  if (!item) return library;
  const exists = library.favorites.some(entry => entry.url === item.url);
  return { ...library, favorites: exists ? library.favorites.filter(entry => entry.url !== item.url) : [item, ...library.favorites].slice(0, 200) };
}
