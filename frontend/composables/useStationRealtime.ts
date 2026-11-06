import { usePlaybackStore } from '~/stores/playback';
import type { RadioProgram, RadioSong, RadioTrack } from '~/types/radio';
import { isZingScheduleUrl } from '~/utils/station-schedule.mjs';
import { getVietnamSchedule, vietnamReferencePrograms } from '~/utils/vietnam-schedules.mjs';
import { createStationPolling } from '~/utils/station-polling.mjs';
import { resolveLiveTrack } from '~/utils/live-track.mjs';
import { appleTuneInMetadataMarker, stationIdFromTuneInMetadataMarker, fetchPublicTuneInMetadata, addTuneInSessionTrack } from '~/utils/global-radio-tunein-metadata.mjs';

export function useStationRealtime() {
  const playback = usePlaybackStore();
  const config = useRuntimeConfig();
  const { t } = useI18n();
  const program = ref<RadioProgram[]>([]);
  const playlist = ref<RadioTrack[]>([]);
  const song = ref<RadioSong>();
  const lyrics = ref<string[]>([]);
  const lyricsOpen = ref(false);
  const loading = ref(false);
  let clientReady = false;

  const isZingStation = computed(() => isZingScheduleUrl(playback.station?.schedule));
  const referenceSchedule = computed(() => getVietnamSchedule(playback.station?.url));
  const scheduleSourceUrl = computed(() => referenceSchedule.value?.sourceUrl || '');
  const scheduleIsReference = computed(() => Boolean(referenceSchedule.value));
  const timestampUrl = (url: string) => /[?&](?:time|timestamp)=$/i.test(url) ? `${url}${Math.floor(Date.now() / 1000)}` : url;

  const lyricCache = new Map<string, string[]>();
  const fetchLyric = async (id: string, signal: AbortSignal): Promise<string[]> => {
    if (!import.meta.client) return [];
    if (lyricCache.has(id)) return lyricCache.get(id)!;
    if (!config.public.apiZingGetLyric) return [t('panel.no_lyric')];
    try {
      const result = await $fetch<{ err: number; data?: { sentences?: { words: { data: string }[] }[] } }>(
        `${config.public.apiZingGetLyric}${id}&time=${Math.floor(Date.now() / 1000)}`, { signal, timeout: 10_000 },
      );
      if (result.err === 0 && result.data?.sentences?.length) {
        const lines = result.data.sentences.map(s => s.words.map(w => w.data).join(' '));
        if (!signal.aborted) {
          if (lyricCache.size >= 20) lyricCache.delete(lyricCache.keys().next().value!);
          lyricCache.set(id, lines);
        }
        return lines;
      }
    } catch (error) {
      if (signal.aborted) throw error;
    }
    return [t('panel.no_lyric')];
  };

  const fetchDetail = async (id: string, signal: AbortSignal) => {
    if (!import.meta.client) return {};
    if (!config.public.apiZingLiveStreamProgramDetail) return {};
    const result = await $fetch<{ err: number; data?: RadioSong }>(timestampUrl(
      `${config.public.apiZingLiveStreamProgramDetail}${id}&time=`,
    ), { signal, timeout: 10_000 });
    const currentSong = result.err === 0 ? result.data : undefined;
    const media = currentSong?.currentMedia;
    const lines = media?.hasLyric ? await fetchLyric(media.encodeId, signal) : [t('panel.no_lyric')];
    return { song: currentSong, lyrics: lines };
  };

  interface RealtimeData {
    program: RadioProgram[];
    playlist: RadioTrack[];
    song?: RadioSong;
    lyrics: string[];
    isTuneInMetadata?: boolean;
    nowPlaying?: { title: string; artist: string } | null;
  }
  const fetchSchedule = async (url: string, signal: AbortSignal): Promise<RealtimeData | undefined> => {
    if (!import.meta.client || !clientReady) return;
    // Poll public station metadata separately from HLS decoding. The audio
    // player independently observes timed ID3 from the playing HLS stream.
    const tuneInId = stationIdFromTuneInMetadataMarker(url);
    if (tuneInId) {
      const nowPlaying = await fetchPublicTuneInMetadata({
        stationId: tuneInId, corsServer: String(config.public.corsServer || ''), signal,
      });
      return { program: [], playlist: [], lyrics: [],
        isTuneInMetadata: true, nowPlaying };
    }
    const value = await $fetch<{ err?: number; success?: boolean; data?: { items?: RadioProgram[] }; result?: RadioTrack[] }>(timestampUrl(url), { signal, timeout: 10_000 });
    if (isZingScheduleUrl(url)) {
      const items = value.err === 0 ? value.data?.items || [] : [];
      const detail = items[0]?.encodeId ? await fetchDetail(items[0].encodeId, signal) : {};
      return { program: items, playlist: [], lyrics: [t('panel.no_lyric')], ...detail };
    }
    return { program: [], playlist: value.success && Array.isArray(value.result) ? value.result : [], lyrics: [] };
  };

  const polling = createStationPolling({
    load: fetchSchedule,
    // Keep metadata fresh for background playback and visible schedule browsing.
    shouldPoll: () => navigator.onLine && (!document.hidden || playback.playing || playback.waiting),
    onData: (value: RealtimeData | undefined) => {
      if (!value) return;
      program.value = value.program;
      // Build a real, device-local history only from observed current-song
      // updates. TuneIn's directory playlist is NOT a song history API.
      playlist.value = value.isTuneInMetadata
        ? addTuneInSessionTrack(playlist.value, value.nowPlaying)
        : value.playlist;
      song.value = value.song;
      lyrics.value = value.lyrics;
      // Only TuneIn's explicit current_song + current_artist fields identify
      // the reported live song; never label the first history row as current.
      playback.setLiveTrack(playback.station?.url || '',
        value.isTuneInMetadata ? (value.nowPlaying || null)
          : resolveLiveTrack(value.song, value.playlist));
    },
    onLoading: (value: boolean) => { loading.value = value; },
    onError: () => {
      if (appleTuneInMetadataMarker(playback.station)) {
        // Avoid showing stale metadata as live; retain already observed
        // session tracks without making up missing song information.
        playback.setLiveTrack(playback.station?.url || '', null);
      }
    },
  });

  const activate = () => {
    // When the broadcaster provides a daily reference guide but no accessible
    // realtime EPG API, show its sourced time slots without fake network calls.
    program.value = vietnamReferencePrograms(playback.station?.url);
    playlist.value = [];
    song.value = undefined;
    playback.setLiveTrack(playback.station?.url || '', null);
    lyrics.value = [t('panel.updating')];
    lyricsOpen.value = false;
    if (!import.meta.client || !clientReady) return;
    // One existing polling lifetime for both station EPG and TuneIn's history:
    // station switches abort old requests, no extra player or background timer.
    polling.start(appleTuneInMetadataMarker(playback.station) || playback.station?.schedule || '');
  };
  watch(() => playback.station?.url, activate);
  // A track observed inside the actual HLS audio should also appear in the
  // session-only Queue history. TuneIn Describe may never publish songs.
  watch(() => playback.liveTrack, (track) => {
    if (!track || track.source !== 'hls' || track.stationUrl !== playback.station?.url
      || !appleTuneInMetadataMarker(playback.station)) return;
    playlist.value = addTuneInSessionTrack(playlist.value, track);
  });
  let referenceTimer: ReturnType<typeof setInterval> | null = null;
  onMounted(() => {
    clientReady = true;
    activate();
    // Update the local Vietnam date at midnight; leave provider EPG polling
    // untouched and never reinitialize audio merely because the date changed.
    referenceTimer = setInterval(() => {
      const path = playback.station?.url;
      if (!referenceSchedule.value?.slots.length) return;
      const next = vietnamReferencePrograms(path);
      if (next[0]?.startTime !== program.value[0]?.startTime) program.value = next;
    }, 60_000);
  });
  onBeforeUnmount(() => {
    clientReady = false;
    polling.stop();
    if (referenceTimer) clearInterval(referenceTimer);
  });
  return { program, playlist, song, lyrics, lyricsOpen, loading, isZingStation, scheduleSourceUrl, scheduleIsReference };
}
