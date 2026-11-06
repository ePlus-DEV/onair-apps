import { normalizeScheduleUrl } from './station-schedule.mjs';

// Catalog proxy flags are deliberate. Automatic stream fallbacks remain the
// audio engine's responsibility, including its prohibition on proxying HLS.
export function createPlaybackStation({ area, country, id, meta, corsServer = '', placeholder = '' }) {
  const seen = new Set();
  const sources = [
    { url: meta.stream, type: meta.type, cros: meta.cros, source: 'primary' },
    ...(meta.streams || []),
    ...(meta.stream_alternative ? [{ url: meta.stream_alternative, source: 'alternative' }] : []),
  ].flatMap((item) => {
    const url = String(item?.url || '').trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return [];
    seen.add(url);
    return [{
      src: item.cros ? `${corsServer}${url}` : url,
      type: item.type || 'audio/mpeg',
      source: item.source,
      label: item.label,
      proxied: Boolean(item.cros),
    }];
  });

  return {
    id, area, country,
    title: meta.title,
    image: meta.features || placeholder,
    url: `/${area}/${country}/${id}`,
    countryKey: `world.${area.replace(/-/g, '_')}.${country.replace(/-/g, '_')}`,
    schedule: normalizeScheduleUrl(meta.schedule),
    sources,
  };
}
