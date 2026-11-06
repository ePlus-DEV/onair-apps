import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEARCH_FEATURED_STATION_IDS, VIETNAM_FEATURED_STATION_IDS } from '../utils/featured-stations.mjs';

const featuredIds = new Set(VIETNAM_FEATURED_STATION_IDS);
const searchFeaturedIds = new Map(SEARCH_FEATURED_STATION_IDS.map((id, index) => [id, index + 1]));
const humanLabel = value => value.replaceAll('-', ' ').replaceAll('_', ' ');

/**
 * Generate a single static JSON catalog that works without Algolia.
 * The index contains public display fields only, never API credentials or
 * streaming URLs. Call it from npm predev/prebuild/pregenerate.
 */
export async function buildStationSearchIndex({
  radioRoot = 'public/radio',
  outputFile = 'public/search/stations.json',
} = {}) {
  const result = [];
  for (const area of (await readdir(radioRoot, { withFileTypes: true })).filter(x => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const areaPath = join(radioRoot, area.name);
    for (const countryFile of (await readdir(areaPath, { withFileTypes: true })).filter(x => x.isFile() && x.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
      const country = countryFile.name.slice(0, -5);
      const catalog = JSON.parse(await readFile(join(areaPath, countryFile.name), 'utf8'));
      for (const [id, station] of Object.entries(catalog)) {
        if (!station || typeof station.title !== 'string' || !station.title.trim()) continue;
        if (!/^https?:\/\//i.test(String(station.stream || '')) || station.disabled === true || station.active === false) continue;
        result.push({
          objectID: `${area.name}/${country}/${id}`,
          station_name: station.title,
          station_country: `world.${area.name.replaceAll('-', '_')}.${country.replaceAll('-', '_')}`,
          country_label: humanLabel(country),
          // Optional public facets; do not guess a genre or language from a name.
          station_category: typeof station.category === 'string' ? station.category.trim() : '',
          station_language: typeof station.language === 'string' ? station.language.trim() : '',
          station_image: station.features || '/brand/onair-mark.svg',
          url: `/${area.name}/${country}/${id}`,
          featured: area.name === 'asia' && country === 'viet-nam' && featuredIds.has(id),
          featured_rank: searchFeaturedIds.get(`${area.name}/${country}/${id}`) || 0,
        });
      }
    }
  }
  result.sort((a, b) => {
    if (a.featured_rank || b.featured_rank) return (a.featured_rank || 9999) - (b.featured_rank || 9999);
    return Number(b.featured) - Number(a.featured) || a.station_name.localeCompare(b.station_name);
  });
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(result));
  return result;
}

/**
 * A cache-hit is supplied only by GitHub Actions when the radio catalog,
 * ranking rules and generator hash exactly match the saved artifact.
 * Local builds and invalid/missing restored files always regenerate.
 */
export async function cachedSearchIndexCount(
  outputFile = 'public/search/stations.json',
  cacheHit = process.env.ONAIR_SEARCH_INDEX_CACHE_HIT === 'true',
) {
  if (!cacheHit) return null;
  try {
    const saved = JSON.parse(await readFile(outputFile, 'utf8'));
    if (!Array.isArray(saved) || saved.length === 0 ||
      !saved.every(item => typeof item.objectID === 'string' && typeof item.station_name === 'string')) {
      return null;
    }
    return saved.length;
  } catch {
    return null;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await cachedSearchIndexCount();
  if (count !== null) {
    process.stdout.write(`Reused cached local radio search index: ${count} stations\n`);
  } else {
    const stations = await buildStationSearchIndex();
    process.stdout.write(`Built local radio search index: ${stations.length} stations\n`);
  }
}
