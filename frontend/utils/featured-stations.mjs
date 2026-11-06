// Hand-picked radio streams for the homepage. Keep the user-facing selection
// separate from the full catalog: unavailable VOV 1/2/3/5 must not reappear as
// featured stations just because the catalog order or favorite flags change.
export const VIETNAM_FEATURED_STATION_IDS = Object.freeze([
  'vov-gt-hcm',
  'rap-viet-radio-zing-mp3',
  'edm-radio-zing-mp3',
  'us-uk-radio-zing-mp3',
  'vpop-radio-zing-mp3',
  'chill-zing-mp3',
  'c-pop-zing-mp3',
  'acoustic-radio-zing-mp3',
]);

export const SEARCH_FEATURED_STATION_IDS = Object.freeze([
  ...VIETNAM_FEATURED_STATION_IDS.map(id => `asia/viet-nam/${id}`),
  'asia/singapore/power',
  'europe/united-kingdom/heart-uk',
]);

export function selectVietnamFeaturedStations(catalog) {
  if (!catalog || typeof catalog !== 'object') return [];
  return VIETNAM_FEATURED_STATION_IDS.flatMap(id => {
    const station = catalog[id];
    // Do not render stale entries without a usable stream or station name.
    if (!station || !station.title || !/^https?:\/\//i.test(String(station.stream || ''))) return [];
    return [[id, station]];
  });
}
// Curated international picks share the same homepage carousel as the original
// Vietnamese selection. Store full station paths so navigation and playback
// always resolve from the correct country catalog.
export const HOMEPAGE_FEATURED_STATION_PATHS = Object.freeze([
  ...VIETNAM_FEATURED_STATION_IDS.slice(0, 1).map(id => `asia/viet-nam/${id}`),
  'europe/united-kingdom/heart-uk',
  'asia/singapore/power',
  ...VIETNAM_FEATURED_STATION_IDS.slice(1).map(id => `asia/viet-nam/${id}`),
]);

export function selectHomepageFeaturedStations(catalogs) {
  if (!catalogs || typeof catalogs !== 'object') return [];
  return HOMEPAGE_FEATURED_STATION_PATHS.flatMap(path => {
    const [area, country, id] = path.split('/');
    const meta = catalogs[`${area}/${country}`]?.[id];
    if (!meta || !meta.title || !/^https?:\/\//i.test(String(meta.stream || ''))) return [];
    return [{ area, country, id, path, meta }];
  });
}
