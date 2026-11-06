import { randomStationCandidates } from './surprise-radio.mjs';

// Pure, client-side recommendations. Never send favorites, history or listening
// duration to a server. All station metadata comes from the published catalog.
const DEFAULT_LIMIT = 4;
const MAX_SEEDS = 12;

function preferFeatured(a, b) {
  const ar = Number.isInteger(a.featured_rank) && a.featured_rank > 0 ? a.featured_rank : 999999;
  const br = Number.isInteger(b.featured_rank) && b.featured_rank > 0 ? b.featured_rank : 999999;
  return ar - br || Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    || a.station_name.localeCompare(b.station_name, 'en', { sensitivity: 'base' })
    || a.url.localeCompare(b.url);
}

export function recommendPersonalStations(index, library = {}, options = {}) {
  const valid = randomStationCandidates(index);
  const byUrl = new Map(valid.map(item => [item.url, item]));
  const favorites = Array.isArray(library?.favorites) ? library.favorites : [];
  const allRecent = Array.isArray(library?.recent) ? library.recent : [];
  const recent = options.includeRecent === false ? [] : allRecent;

  const allSavedUrls = new Set([...favorites, ...allRecent].map(item => item?.url).filter(Boolean));
  if (library?.lastStation?.url) allSavedUrls.add(library.lastStation.url);
  if (options.currentUrl) allSavedUrls.add(options.currentUrl);
  const excluded = new Set(Array.isArray(options.excludedUrls) ? options.excludedUrls : []);
  const candidates = valid.filter(item => !allSavedUrls.has(item.url) && !excluded.has(item.url));
  const limit = Number.isInteger(options.limit) && options.limit > 0
    ? Math.min(options.limit, 12) : DEFAULT_LIMIT;
  if (!candidates.length) return { mode: 'empty', items: [] };

  const seen = new Set();
  const seeds = [
    ...favorites.slice(0, MAX_SEEDS).map(item => ({ item, weight: 1 })),
    ...recent.slice(0, MAX_SEEDS).map(item => ({ item, weight: 0.5 })),
  ].flatMap(({ item, weight }) => {
    if (!item?.url || seen.has(item.url)) return [];
    seen.add(item.url);
    const meta = byUrl.get(item.url);
    if (!meta) return []; // Unknown sources cannot invent genre/language affinity.
    return [{ meta, weight }];
  });

  const ranked = candidates.map(item => {
    let score = 0;
    let strongestReason = '';
    let strongest = 0;
    for (const { meta, weight } of seeds) {
      for (const [field, points, reason] of [
        ['station_category', 5, 'genre'],
        ['station_language', 3, 'language'],
        ['station_country', 2, 'country'],
      ]) {
        if (!meta[field] || item[field] !== meta[field]) continue;
        const gained = points * weight;
        score += gained;
        if (gained > strongest) { strongest = gained; strongestReason = reason; }
      }
    }
    return { station: item, score, reason: strongestReason };
  });

  const personal = ranked.filter(item => item.score > 0);
  if (personal.length) {
    personal.sort((a, b) => b.score - a.score || preferFeatured(a.station, b.station));
    return { mode: 'personal', items: personal.slice(0, limit) };
  }

  // With no matching local preference, use only *genuinely marked* featured
  // entries. Do not claim "popular" or "trending" without real metrics.
  const curated = candidates.filter(item => item.featured || (item.featured_rank > 0));
  curated.sort(preferFeatured);
  return {
    mode: curated.length ? 'curated' : 'empty',
    items: curated.slice(0, limit).map(station => ({ station, score: 0, reason: 'featured' })),
  };
}
