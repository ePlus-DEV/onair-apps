import { usePlaybackStore } from '~/stores/playback';
import { buildAuthorizedResolverRequest, resolveAuthorizedAppleStream } from '~/utils/global-radio-resolver.mjs';
import { buildPublicTuneInRequest, resolvePublicTuneInStream } from '~/utils/global-radio-public-tunein.mjs';
import { createAuthorizedApplePlaybackStation, createAppleRadioQueue } from '~/utils/global-radio-station.mjs';
import type { GlobalRadioStation } from '~/types/global-radio';

export function useAuthorizedGlobalRadioPlayback(getStations: () => GlobalRadioStation[] = () => []) {
  const config = useRuntimeConfig();
  const playback = usePlaybackStore();
  const pendingStationId = ref('');
  const error = ref('');
  let activeController: AbortController | null = null;
  const endpoint = computed(() => String(config.public.globalRadioResolverUrl || ''));
  // Both routes are explicitly configured at build time; never use a hardcoded CORS origin.
  const corsServer = computed(() => String(config.public.corsServer || ''));
  const enabled = computed(() => Boolean(buildPublicTuneInRequest('apple-music-1', corsServer.value)
    || buildAuthorizedResolverRequest(endpoint.value, 'apple-music-1')));

  async function play(station: GlobalRadioStation) {
    if (!import.meta.client || !enabled.value) return;
    // Country switching is immediate. The Global lookup is asynchronous:
    // a newer explicit station choice must win, not be ignored while an
    // earlier TuneIn request is still pending.
    if (pendingStationId.value) {
      if (pendingStationId.value === station.id) return;
      activeController?.abort();
      activeController = null;
      pendingStationId.value = '';
    }
    error.value = '';
    const stationUrl = '/global-radio/apple-music/' + station.id;
    if (playback.station?.url === stationUrl) {
      // Same semantics as Country Radio's station card: tap again to pause.
      if (playback.playing || playback.waiting) {
        playback.pauseRequest += 1;
        return;
      }
      // A paused, still-valid HLS stream resumes without resetting its
      // audio element or unnecessarily obtaining another short-lived token.
      if (playback.globalRadioLease?.stationUrl === stationUrl
        && playback.globalRadioLease.expiresAt > Date.now() + 45_000
        && playback.station.sources.length > 0) {
        playback.playRequest += 1;
        return;
      }
    }
    const controller = new AbortController();
    activeController = controller;
    pendingStationId.value = station.id;
    try {
      // Prefer configured ePlus CORS. An approved resolver (if configured) is fallback.
      let result;
      try {
        result = await resolvePublicTuneInStream({ station, corsServer: corsServer.value, signal: controller.signal });
      } catch (publicError) {
        if (!endpoint.value || controller.signal.aborted) throw publicError;
        result = await resolveAuthorizedAppleStream({
          endpoint: endpoint.value, station, signal: controller.signal,
        });
      }
      if (controller.signal.aborted || !result.ok) return;
      const source = createAuthorizedApplePlaybackStation(station, result.streamUrl);
      // Use the existing global PlayerSession; never mount a second audio element.
      playback.activateGlobalRadio(source, station.listen_url, result.expiresAt,
        createAppleRadioQueue(getStations()));
    } catch {
      if (!controller.signal.aborted) error.value = 'unavailable';
    } finally {
      if (activeController === controller) {
        activeController = null;
        pendingStationId.value = '';
      }
    }
  }
  onBeforeUnmount(() => {
    activeController?.abort();
    activeController = null;
  });
  return { enabled, play, pendingStationId, error };
}
