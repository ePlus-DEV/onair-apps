import { useListeningStore } from '~/stores/listening';
import { usePlaybackStore } from '~/stores/playback';
import { useListenerPreferencesStore } from '~/stores/listenerPreferences';
import { createPlaybackStation } from '~/utils/playback-station.mjs';
import { createAppleRadioQueue, createAuthorizedApplePlaybackStation } from '~/utils/global-radio-station.mjs';
import { PUBLIC_APPLE_TUNEIN_STATIONS, resolvePublicTuneInStream } from '~/utils/global-radio-public-tunein.mjs';
import type { GlobalRadioProvider } from '~/types/global-radio';
import type { RadioCatalogEntry } from '~/types/radio';

export function useRestoreLastStation() {
  const listening = useListeningStore();
  const playback = usePlaybackStore();
  const preferences = useListenerPreferencesStore();
  const route = useRoute();
  const config = useRuntimeConfig();
  const siteAssetUrl = useSiteAssetUrl();
  listening.hydrate();
  let disposed = false;
  onMounted(async () => {
    preferences.hydrate();
    if (!preferences.restoreStation) return;
    const saved = listening.library.lastStation;
    // Explicit station deep links take precedence over the saved station.
    if (!saved || route.path.split('/').filter(Boolean).length >= 3 || playback.playRequest
      || playback.requestedStationUrl || playback.playing || playback.station) return;
    const path = route.fullPath;
    const request = playback.playRequest;

    // Global and Country use the same idle-restore behavior. The difference
    // is that Global must obtain a NEW signed HLS URL: never persist or reuse
    // the expiring accessKey from a previous browser session.
    if (saved.url.startsWith('/global-radio/')) {
      const stationId = saved.url.slice('/global-radio/apple-music/'.length);
      if (!saved.url.startsWith('/global-radio/apple-music/')
        || !Object.hasOwn(PUBLIC_APPLE_TUNEIN_STATIONS, stationId)) return;
      try {
        const provider = await $fetch<GlobalRadioProvider>(
          siteAssetUrl('/catalog/providers/apple-music.json'), { timeout: 10_000 },
        );
        const station = provider.stations?.find(entry => entry.id === stationId);
        if (!station) return;
        const stream = await resolvePublicTuneInStream({ station, corsServer: String(config.public.corsServer || '') });
        if (disposed || route.fullPath !== path || playback.playRequest !== request
          || playback.requestedStationUrl || playback.station || playback.playing) return;
        playback.activateGlobalRadio(
          createAuthorizedApplePlaybackStation(station, stream.streamUrl),
          station.listen_url, stream.expiresAt,
          createAppleRadioQueue(provider.stations),
          { autoplay: false },
        );
      } catch { /* No stale keys; an offline restore must not interrupt browsing. */ }
      return;
    }
    const [, area, country, id] = saved.url.split('/');
    playback.activate({
      id,
      area,
      country,
      title: saved.title,
      image: saved.image,
      url: saved.url,
      countryKey: saved.countryKey || `world.${area.replace(/-/g, '_')}.${country.replace(/-/g, '_')}`,
      schedule: '',
      sources: [],
    }, [], { autoplay: false, onlyIfIdle: true });
    if (playback.station?.url !== saved.url) return;
    try {
      const catalog = await $fetch<Record<string, RadioCatalogEntry>>(siteAssetUrl(`/radio/${area}/${country}.json`), { timeout: 10_000 });
      if (disposed || route.fullPath !== path || playback.playRequest !== request || playback.requestedStationUrl || playback.station?.url !== saved.url || playback.playing) return;
      const meta = catalog[id];
      if (!meta || !meta.stream) return;
      const options = Object.entries(catalog).map(([key, entry]) => ({ id: key, title: entry.title, image: entry.features || '/brand/onair-mark.svg', url: `/${area}/${country}/${key}` }));
      playback.activate(createPlaybackStation({ area, country, id, meta,
        corsServer: String(config.public.corsServer || ''), placeholder: '/brand/onair-mark.svg',
      }), options, { autoplay: false });
    } catch { /* A removed station or offline catalog must not break the page. */ }
  });
  onBeforeUnmount(() => { disposed = true; });
}
