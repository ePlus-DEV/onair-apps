import { usePlaybackStore } from '~/stores/playback';
import { resolveAuthorizedAppleStream } from '~/utils/global-radio-resolver.mjs';
import { buildPublicTuneInRequest, resolvePublicTuneInStream } from '~/utils/global-radio-public-tunein.mjs';

// Keeps a licensed HLS stream current while its shared player remains mounted.
// One refresh timer at app scope, not one timer per route/card. No local storage.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const playback = usePlaybackStore();
  const endpoint = String(config.public.globalRadioResolverUrl || '');
  const corsServer = String(config.public.corsServer || '');
  if (!endpoint && !buildPublicTuneInRequest('apple-music-1', corsServer)) return;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let currentRequest: AbortController | null = null;
  let generation = 0;

  async function refresh(lease: NonNullable<typeof playback.globalRadioLease>, version: number) {
    currentRequest?.abort();
    const controller = new AbortController();
    currentRequest = controller;
    try {
      let result;
      try {
        result = await resolvePublicTuneInStream({
          station: { id: lease.stationId }, corsServer, signal: controller.signal,
        });
      } catch (publicError) {
        if (!endpoint || controller.signal.aborted) throw publicError;
        result = await resolveAuthorizedAppleStream({
          endpoint,
          station: { id: lease.stationId, listen_url: lease.listenUrl },
          signal: controller.signal,
        });
      }
      if (version !== generation || controller.signal.aborted || !result.ok) return;
      playback.refreshGlobalRadioStream(lease.stationUrl, result.streamUrl, result.expiresAt);
    } catch {
      // Country Radio retries transient network failures. Apply the same
      // principle here while the current signed Global HLS lease is valid.
      // A temporary TuneIn lookup failure must not stop playable audio early.
      if (version === generation && !controller.signal.aborted) {
        if (playback.station?.url !== lease.stationUrl) return;
        if (Date.now() < lease.expiresAt - 5_000) {
          const retryInMs = Math.min(10_000, Math.max(1_000, lease.expiresAt - Date.now() - 5_000));
          timer = setTimeout(() => { void refresh(lease, version); }, retryInMs);
          return;
        }
        playback.pauseRequest += 1;
        // Never let an expired signed Apple URL be reused by the shared player.
        playback.station = { ...playback.station, sources: [] };
        playback.globalRadioLease = null;
      }
    } finally {
      if (currentRequest === controller) currentRequest = null;
    }
  }

  watch(
    () => [playback.globalRadioLease?.stationUrl, playback.globalRadioLease?.expiresAt, playback.station?.url] as const,
    () => {
      generation += 1;
      const version = generation;
      if (timer) clearTimeout(timer);
      currentRequest?.abort();
      timer = null;
      const lease = playback.globalRadioLease;
      if (!lease || playback.station?.url !== lease.stationUrl) return;
      // Refresh 40s before expiry, including paused tabs, so resumed playback
      // does not try to reuse a stale signed stream.
      const delay = Math.max(0, lease.expiresAt - Date.now() - 40_000);
      timer = setTimeout(() => { void refresh(lease, version); }, Math.min(delay, 2147483647));
    },
    { immediate: true },
  );
});
