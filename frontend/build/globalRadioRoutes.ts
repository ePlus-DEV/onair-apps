import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ProviderRecord {
  id: string;
  href: string;
  catalog: string;
  playback: string;
}
interface StationRecord {
  id: string;
  title: string;
  listen_url: string;
  tunein_url?: string;
  seasonal?: boolean;
}
interface GlobalProviderRecord {
  id: string;
  playback: string;
  stations: StationRecord[];
}
interface ProviderIndex { providers: ProviderRecord[]; }

export function getGlobalRadioRoutes(rootDir: string = process.cwd()) {
  const index = JSON.parse(readFileSync(join(rootDir, 'public/catalog/providers/index.json'), 'utf8')) as ProviderIndex;
  const routes = [{ loc: '/global-radio', priority: 0.7, changefreq: 'monthly' as const }];
  const seen = new Set<string>();
  for (const entry of index.providers) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || entry.playback !== 'external') {
      throw new Error('Invalid external provider registration: ' + entry.id);
    }
    if (seen.has(entry.id)) throw new Error('Duplicate provider: ' + entry.id);
    seen.add(entry.id);
    const expectedPath = '/catalog/providers/' + entry.id + '.json';
    if (entry.catalog !== expectedPath || entry.href !== '/global-radio/' + entry.id) {
      throw new Error('Provider manifest/route mismatch: ' + entry.id);
    }
    const provider = JSON.parse(readFileSync(join(rootDir, 'public' + entry.catalog), 'utf8')) as GlobalProviderRecord;
    if (provider.id !== entry.id || provider.playback !== 'external') {
      throw new Error('Invalid provider manifest: ' + entry.id);
    }
    routes.push({ loc: entry.href, priority: 0.6, changefreq: 'monthly' as const });
    const stationIds = new Set<string>();
    for (const station of provider.stations) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(station.id) || stationIds.has(station.id)) {
        throw new Error('Duplicate/invalid external station ID in ' + entry.id);
      }
      stationIds.add(station.id);
      const url = new URL(station.listen_url);
      if (url.protocol !== 'https:' || url.hostname !== 'music.apple.com' || !url.pathname.includes('/station/')) {
        throw new Error('External station link must be an Apple Music station page: ' + station.id);
      }
      if (station.tunein_url) {
        const tuneIn = new URL(station.tunein_url);
        if (tuneIn.protocol !== 'https:' || tuneIn.hostname !== 'tunein.com' ||
            !/^\/radio\/Apple-/i.test(tuneIn.pathname)) {
          throw new Error('Unexpected TuneIn page for ' + station.id);
        }
      }
      routes.push({ loc: entry.href + '/' + station.id, priority: 0.5, changefreq: 'monthly' as const });
    }
  }
  return routes;
}
