<template>
  <section class="flex h-full min-h-0 flex-col">
    <div class="border-b border-[var(--radio-border)] p-3">
      <UTabs
        v-if="hasSchedule && hasStations"
        v-model="activeTab"
        :items="tabs"
        :content="false"
        size="sm"
        :ui="{ list: 'w-full rounded-xl bg-[var(--radio-surface-soft)]', indicator: 'rounded-lg bg-[var(--radio-surface)] ring-1 ring-rose-500/25 shadow-sm', trigger: 'flex-1 text-[var(--radio-text-muted)] data-[state=active]:font-semibold data-[state=active]:text-rose-600 dark:data-[state=active]:text-rose-300' }"
        :aria-label="$t('player.sidebar_label')"
      />

      <div
        v-else
        class="flex h-9 items-center justify-between rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3"
      >
        <span class="truncate text-xs font-semibold text-[var(--radio-text)]">
          {{ hasStations ? $t("panel.channels") : $t(hasTuneInHistory ? "panel.playlist" : "panel.schedule") }}
        </span>
        <span class="radio-count-badge inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
          {{ hasStations ? stations.length : scheduleCount }}
        </span>
      </div>

      <p v-if="scheduleLoading" class="mt-2 text-[11px] text-[var(--radio-text-muted)]" aria-live="polite">{{ $t('player.schedule_loading') }}</p>
      <div v-if="activeTab === 'schedule' && program.length" class="mt-2 flex justify-end">
        <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-locate-fixed"
          class="min-h-9" :aria-label="$t('panel.schedule_jump_to_now')"
          @click="recenterSchedule">{{ $t('panel.schedule_jump_to_now') }}</UButton>
      </div>
      <p v-if="activeTab === 'schedule' && hasTuneInHistory" class="mt-2 text-xs leading-5 text-[var(--radio-text-muted)]">{{ $t('panel.tunein_history_note') }}</p>
      <div v-if="activeTab === 'schedule' && scheduleSourceUrl" class="mt-3 space-y-1 text-xs leading-5">
        <p class="text-[var(--radio-text-muted)]">
          {{ $t(scheduleIsReference ? 'panel.schedule_reference_note' : 'panel.schedule_official_note') }}
        </p>
        <a :href="scheduleSourceUrl" target="_blank" rel="noopener noreferrer"
          class="inline-flex min-h-9 items-center gap-1.5 font-semibold text-rose-700 underline-offset-4 hover:underline dark:text-rose-300">
          {{ $t('panel.schedule_official_link') }}
          <UIcon name="i-lucide-external-link" class="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        <p v-if="scheduleIsReference" class="text-[11px] text-[var(--radio-text-muted)]">{{ $t('panel.schedule_vietnam_timezone') }}</p>
      </div>

      <div
        v-if="activeTab === 'stations' && hasStations"
        class="mt-2.5 flex items-center gap-2"
      >
        <span
          v-if="queueCountryLabel"
          class="hidden items-center rounded-full border h-9 shrink-0 border-[var(--radio-border)] bg-[var(--radio-surface)] px-2.5 text-[11px] font-semibold text-[var(--radio-text-muted)] sm:inline-flex"
        >
          {{ queueCountryLabel }}
        </span>

        <UButton color="neutral" :variant="favoritesOnly ? 'soft' : 'ghost'" icon="i-lucide-heart"
          class="min-h-11 shrink-0" :aria-pressed="favoritesOnly" :aria-label="$t('transfer.favorites_only')" :title="$t('transfer.favorites_only')"
          @click="favoritesOnly = !favoritesOnly" />
        <label
          class="flex h-9 min-h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border-[var(--radio-border)] bg-[var(--radio-surface)] px-3 shadow-none outline-none transition focus-within:border-rose-300 focus-within:ring-2 focus-within:ring-rose-400/15"
        >
          <span class="sr-only">{{ $t("panel.search_channels") }}</span>
          <svg
            viewBox="0 0 24 24"
            class="h-3.5 w-3.5 shrink-0 fill-none stroke-[var(--radio-text-muted)]"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6" stroke-width="1.8"></circle>
            <path d="m16 16 4 4" stroke-width="1.8" stroke-linecap="round"></path>
          </svg>
          <input
            v-model="query"
            type="search"
            class="min-w-0 grow bg-transparent p-0 text-xs text-[var(--radio-text)] outline-none placeholder:text-[var(--radio-text-muted)]"
            :placeholder="$t('panel.search_channels')"
          />
        </label>
      </div>
    </div>

    <div ref="scheduleScrollContainer" class="radio-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5"
      tabindex="0" :aria-label="activeTab === 'schedule' ? $t(hasTuneInHistory ? 'panel.playlist' : 'panel.schedule') : $t('panel.channels')"
      @wheel.passive="markScheduleBrowsed" @touchstart.passive="markScheduleBrowsed"
      @pointerdown="markScheduleBrowsed" @keydown="onScheduleScrollKeydown">
      <div v-if="activeTab === 'stations' && hasStations" class="space-y-1">
        <button
          v-for="station in filteredStations"
          :key="station.url || station.id"
          type="button"
          class="group flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition"
          :class="
            isActiveStation(station)
              ? 'bg-rose-500/10 ring-1 ring-inset ring-rose-500/15'
              : 'hover:bg-[var(--radio-hover)]'
          "
          @click="$emit('select-station', station)"
        >
          <span
            class="radio-themed-artwork flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--radio-border)] p-1.5"
          >
            <img
              loading="lazy"
              :src="siteAssetUrl(station.image || thumb)"
              :alt="station.title"
              class="max-h-full max-w-full object-contain"
            />
          </span>

          <span class="min-w-0 flex-1">
            <span
              dir="auto"
              class="block truncate text-sm font-semibold"
              :class="
                isActiveStation(station)
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-[var(--radio-text)]'
              "
            >
              {{ station.title }}
            </span>
            <span class="mt-0.5 block truncate text-[11px] text-[var(--radio-text-muted)]">
              {{ stationCountryLabel(station) }}
            </span>
          </span>

          <span
            v-if="isActiveStation(station)"
            class="inline-flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-rose-500"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
            {{ $t('player.live') }}
          </span>
          <span
            v-else
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-500/20 transition group-hover:bg-rose-500/20 group-active:scale-95 dark:text-rose-300"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" class="ml-0.5 h-3.5 w-3.5 fill-current">
              <path d="M8 5.7v12.6c0 .85.92 1.38 1.66.95l9.85-6.3a1.1 1.1 0 0 0 0-1.9l-9.85-6.3A1.1 1.1 0 0 0 8 5.7Z"></path>
            </svg>
          </span>
        </button>

        <div
          v-if="filteredStations.length === 0"
          class="flex min-h-32 items-center justify-center px-5 text-center text-xs text-[var(--radio-text-muted)]"
        >
          {{ $t(favoritesOnly ? 'transfer.no_favorites' : 'panel.no_channels') }}
        </div>
      </div>

      <div v-else-if="activeTab === 'schedule' && hasSchedule"
        :class="scheduleIsReference && program.length ? '' : 'space-y-1'">
        <!-- Broadcast timeline is a time-scaled canvas. Keep legacy remote
             provider EPG as a compact list because it lacks reliable intervals. -->
        <PlayerScheduleTimeline
          v-if="scheduleIsReference && program.length"
          :program="program"
          :timestamp="scheduleNow"
          :thumb="thumb"
          :station-name="stationName"
        />
        <template v-else-if="program.length">
          <template v-for="(item, index) in program" :key="programKey(item, index)">
            <PlayerScheduleGap
              v-if="scheduleGap?.insertIndex === index"
              :timestamp="scheduleNow"
              :start-time="gapStartTime(scheduleGap.insertIndex)"
              :next-title="scheduleGap.nextTitle"
              :next-start-time="scheduleGap.nextStartTime"
            />
          <div
            :data-program-index="index"
            class="relative grid grid-cols-[72px_minmax(0,1fr)] gap-3 overflow-hidden rounded-xl px-2.5 py-2.5 transition"
            :class="
              isCurrentProgram(item, index)
                ? 'bg-[var(--radio-surface-soft)] ring-1 ring-inset ring-[var(--radio-border)]'
                : 'hover:bg-[var(--radio-hover)]'
            "
          >
            <span
              v-if="isCurrentProgram(item, index)"
              class="absolute inset-y-2 left-0 w-0.5 rounded-full bg-rose-500"
              aria-hidden="true"
            ></span>
            <div v-if="isCurrentProgram(item, index) && scheduleIsReference"
              class="pointer-events-none absolute inset-x-2 bottom-0 h-1 rounded-full bg-rose-500/15"
              aria-hidden="true">
              <div data-schedule-time-progress class="relative h-full rounded-full bg-rose-500 transition-[width] duration-1000 ease-linear"
                :style="{ width: (programmeProgress(item) ?? 0) + '%' }">
                <span class="absolute right-0 top-1/2 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--radio-surface)] bg-rose-500 shadow-sm"></span>
              </div>
            </div>

            <div
              class="rounded-lg bg-[var(--radio-surface)] px-2 py-1.5 text-xs font-semibold tabular-nums text-[var(--radio-text)] ring-1 ring-inset ring-[var(--radio-border)]"
            >
              <template v-if="item.startTime">
                <div>{{ formatProgramTime(item.startTime) }}</div>
                <div
                  v-if="item.endTime"
                  class="mt-0.5 text-[10px] font-normal text-[var(--radio-text-muted)]"
                >
                  {{ formatProgramTime(item.endTime) }}
                </div>
              </template>
              <template v-else>—</template>
            </div>

            <div class="min-w-0">
              <p
                dir="auto"
                class="truncate text-sm font-semibold text-[var(--radio-text)]"
              >
                {{ item.title || $t("panel.updating") }}
              </p>
              <p
                v-if="item.description"
                dir="auto"
                class="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--radio-text-muted)]"
              >
                {{ item.description }}
              </p>
              <p v-if="isCurrentProgram(item, index) && scheduleIsReference"
                data-schedule-clock role="timer"
                class="mt-1 text-[11px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                {{ $t('panel.schedule_now_marker') }} · {{ formattedScheduleNow }}
              </p>
            </div>
          </div>
          </template>
          <PlayerScheduleGap
            v-if="scheduleGap?.insertIndex === program.length"
            :timestamp="scheduleNow"
            :start-time="gapStartTime(scheduleGap.insertIndex)"
            :next-title="scheduleGap.nextTitle"
            :next-start-time="scheduleGap.nextStartTime"
          />
        </template>

        <template v-else-if="playlist.length">
          <div
            v-for="(item, index) in playlist"
            :key="playlistKey(item, index)"
            class="group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl px-2.5 py-2.5 transition"
            :class="
              isLivePlaylistTrack(item, index)
                ? 'bg-[var(--radio-surface-soft)] ring-1 ring-inset ring-[var(--radio-border)]'
                : 'hover:bg-[var(--radio-hover)]'
            "
          >
            <span
              v-if="isLivePlaylistTrack(item, index)"
              class="absolute inset-y-2 left-0 w-0.5 rounded-full bg-rose-500"
              aria-hidden="true"
            ></span>

            <div class="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[var(--radio-surface)] ring-1 ring-inset ring-[var(--radio-border)]">
              <img
                loading="lazy"
                :src="siteAssetUrl(item.track_image || thumb)"
                :alt="item.track_title || stationName"
                class="h-full w-full object-cover"
              />
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-[var(--radio-text)]">
                {{ item.track_title || $t("panel.updating") }}
              </p>
              <p class="mt-0.5 truncate text-xs text-[var(--radio-text-muted)]">
                {{ item.track_artist || stationName }}
              </p>
            </div>

            <span
              v-if="isLivePlaylistTrack(item, index)"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-rose-500"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
              {{ $t('player.live') }}
            </span>
            <span
              v-else-if="item.track_played"
              class="shrink-0 text-[10px] text-[var(--radio-text-muted)]"
            >
              {{ dayjs.unix(item.track_played).fromNow(true) }}
            </span>
          </div>
        </template>
        <p v-else-if="hasTuneInHistory" class="p-3 text-sm leading-6 text-[var(--radio-text-muted)]">{{ $t('panel.tunein_history_unavailable') }}</p>
        <p v-else-if="scheduleSourceUrl" class="p-3 text-sm leading-6 text-[var(--radio-text-muted)]">
          {{ $t('panel.schedule_provider_only') }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useListeningStore } from '~/stores/listening';
import { usePlaybackStore } from '~/stores/playback';
import { appleTuneInStationId } from '~/utils/global-radio-tunein-metadata.mjs';
import type { RadioStationOption } from "~/types/radio";
import { filterQueueStations } from "~/utils/station-search.mjs";
import { stationCountryKey, queueCountryKey } from "~/utils/queue-station-country.mjs";
import { schedulePosition, referenceScheduleGap, scheduleTimelineProgress } from "~/utils/station-schedule.mjs";

const dayjs = useDayjs();
const { t } = useI18n();

interface PlaylistItem {
  track_title: string;
  track_artist: string;
  track_image: string;
  track_played: number;
}

interface ProgramItem {
  startTime?: number;
  endTime?: number;
  title?: string;
  description?: string;
  encodeId?: string;
}

const props = withDefaults(
  defineProps<{
    playlist?: PlaylistItem[];
    program?: ProgramItem[];
    stations?: RadioStationOption[];
    activeStationId?: string;
    activeStationUrl?: string;
    thumb: string;
    stationName: string;
    countryName?: string;
    scheduleLoading?: boolean;
    scheduleSourceUrl?: string;
    scheduleIsReference?: boolean;
    visible?: boolean;
  }>(),
  {
    playlist: () => [],
    program: () => [],
    stations: () => [],
    activeStationId: "",
    activeStationUrl: "",
    countryName: "",
    scheduleLoading: false,
    scheduleSourceUrl: "",
    scheduleIsReference: false,
    visible: true,
  },
);

defineEmits<{
  (event: "select-station", station: RadioStationOption): void;
}>();

const query = ref("");
const favoritesOnly = ref(false);
const listening = useListeningStore();
const playback = usePlaybackStore();
const hasTuneInHistory = computed(() => Boolean(appleTuneInStationId({
  id: props.activeStationId, url: props.activeStationUrl,
})));
const isLivePlaylistTrack = (item: PlaylistItem, index: number): boolean => {
  if (index !== 0) return false;
  if (!hasTuneInHistory.value) return true;
  const current = playback.liveTrack;
  return Boolean(current && current.stationUrl === props.activeStationUrl
    && current.title === item.track_title && current.artist === item.track_artist);
};
onMounted(() => listening.hydrate());
const hasStations = computed(() => props.stations.length > 0);
const sharedCountryKey = computed(() => queueCountryKey(props.stations));
const queueCountryLabel = computed(() => sharedCountryKey.value ? t(sharedCountryKey.value) : "");
const stationCountryLabel = (station: RadioStationOption): string => {
  const key = stationCountryKey(station.url);
  return key ? t(key) : (queueCountryLabel.value || props.stationName);
};
const isActiveStation = (station: RadioStationOption): boolean =>
  Boolean(station.url && props.activeStationUrl)
    ? station.url === props.activeStationUrl
    : station.id === props.activeStationId;
const hasSchedule = computed(
  () => props.playlist.length > 0 || props.program.length > 0 || Boolean(props.scheduleSourceUrl) || hasTuneInHistory.value,
);
const scheduleCount = computed(
  () => props.program.length || props.playlist.length,
);
const tabs = computed(() => [
  { label: t(hasTuneInHistory.value ? 'panel.playlist' : 'panel.schedule'), value: 'schedule', badge: scheduleCount.value },
  { label: t('panel.channels'), value: 'stations', badge: props.stations.length },
]);
const activeTab = ref<"stations" | "schedule">(
  hasStations.value ? "stations" : "schedule",
);
const preferScheduleAfterLoad = ref(false);
const scheduleScrollContainer = ref<HTMLElement | null>(null);
const scheduleNow = ref(Math.floor(Date.now() / 1000));
const manuallyBrowsingSchedule = ref(false);
const schedulePositionNow = computed(() =>
  schedulePosition(props.program, scheduleNow.value, props.scheduleIsReference),
);
const scheduleGap = computed(() => props.scheduleIsReference
  ? referenceScheduleGap(props.program, scheduleNow.value)
  : null);
// Only a known interval has a meaningful progress percentage.
const gapStartTime = (index: number): number | null =>
  index > 0 ? props.program[index - 1]?.endTime ?? null : null;
const programmeProgress = (item: ProgramItem): number | null =>
  scheduleTimelineProgress(item.startTime, item.endTime, scheduleNow.value);
const vietnamSecondsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const formattedScheduleNow = computed(() =>
  vietnamSecondsFormatter.format(new Date(scheduleNow.value * 1000)));

// Move just the INNER queue scroller: scrollIntoView() would move the entire
// mobile slideover/page and could hide the fixed player/header.
let scrollGeneration = 0;
const jumpToSchedulePosition = async () => {
  const generation = ++scrollGeneration;
  if (activeTab.value !== 'schedule' || !props.visible) return;
  await nextTick();
  if (generation !== scrollGeneration || activeTab.value !== 'schedule' || !props.visible) return;
  const container = scheduleScrollContainer.value;
  const index = schedulePositionNow.value.scrollIndex;
  const row = props.scheduleIsReference
    ? container?.querySelector<HTMLElement>('[data-schedule-now]')
    : scheduleGap.value
      ? container?.querySelector<HTMLElement>('[data-schedule-now]')
      : index < 0 ? null : container?.querySelector<HTMLElement>(
        `[data-program-index="${index}"]`,
      );
  if (!container || !row || container.clientHeight === 0) return;
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const desiredTop = container.scrollTop + rowRect.top - containerRect.top
    - Math.max(0, (container.clientHeight - rowRect.height) / 3);
  container.scrollTop = Math.max(0, desiredTop);
};

const recenterSchedule = () => {
  manuallyBrowsingSchedule.value = false;
  scheduleNow.value = Math.floor(Date.now() / 1000);
  void jumpToSchedulePosition();
};
const markScheduleBrowsed = () => {
  if (activeTab.value === 'schedule') manuallyBrowsingSchedule.value = true;
};
const onScheduleScrollKeydown = (event: KeyboardEvent) => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
    markScheduleBrowsed();
  }
};

// Recenter once on opening the tab, after a provider schedule arrives, or
// after changing station. Ordinary list re-renders do not steal manual scroll.
watch(
  [activeTab, () => props.program, () => props.activeStationUrl, () => props.scheduleIsReference, () => props.visible],
  ([tab, program, station, isReference, visible], previous) => {
    if (tab !== 'schedule' || !visible) return;
    const opened = previous?.[0] !== 'schedule' || !previous?.[4];
    const changedStation = station !== previous?.[2] || isReference !== previous?.[3];
    const justLoaded = Boolean(program?.length && !previous?.[1]?.length);
    // Only an explicit open/station switch resets manual browsing. A background
    // provider refresh must never yank a user who is reading earlier programmes.
    if (opened || changedStation || justLoaded) manuallyBrowsingSchedule.value = false;
    if (!manuallyBrowsingSchedule.value) void jumpToSchedulePosition();
  },
  { flush: 'post', immediate: true },
);

// Update the highlight at a programme boundary. Follow it only if the visitor
// has not manually scrolled away. No polling/scrolling every animation frame.
watch(
  [
    () => schedulePositionNow.value.scrollIndex,
    () => schedulePositionNow.value.currentIndex,
    () => scheduleGap.value?.insertIndex,
  ],
  (next, previous) => {
    if (next.some((value, index) => value !== previous?.[index])
      && activeTab.value === 'schedule' && props.visible && !manuallyBrowsingSchedule.value) {
      void jumpToSchedulePosition();
    }
  },
  { flush: 'post' },
);

let scheduleClockTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  scheduleNow.value = Math.floor(Date.now() / 1000);
  scheduleClockTimer = setInterval(() => {
    // Clock and the timeline fill move once per second. Only update the
    // visible reference guide; real-time provider EPG is unaffected.
    if (activeTab.value === 'schedule' && props.visible && props.scheduleIsReference) {
      scheduleNow.value = Math.floor(Date.now() / 1000);
    }
  }, 1_000);
  if (activeTab.value === 'schedule' && props.visible) void jumpToSchedulePosition();
});
onBeforeUnmount(() => {
  if (scheduleClockTimer !== null) clearInterval(scheduleClockTimer);
  scrollGeneration += 1;
});

// Filter the presentation only; transport navigation still uses the original queue.
const filteredStations = computed(() => filterQueueStations(
  props.stations, query.value, listening.library.favorites.map((station: { url: string }) => station.url), favoritesOnly.value,
));

watch(
  () => props.activeStationId,
  () => {
    query.value = "";
    preferScheduleAfterLoad.value = false;
    activeTab.value = hasStations.value ? "stations" : "schedule";
  },
  { flush: "sync" },
);

watch(
  () => props.scheduleLoading,
  (loading, wasLoading) => {
    if (loading) {
      preferScheduleAfterLoad.value = true;
      return;
    }

    if (
      wasLoading &&
      preferScheduleAfterLoad.value &&
      hasSchedule.value
    ) {
      activeTab.value = "schedule";
      preferScheduleAfterLoad.value = false;
    }
  },
);

watch([hasStations, hasSchedule], ([stationsReady, scheduleReady]) => {
  if (activeTab.value === "stations" && !stationsReady && scheduleReady) {
    activeTab.value = "schedule";
  } else if (
    activeTab.value === "schedule" &&
    !scheduleReady &&
    stationsReady
  ) {
    activeTab.value = "stations";
  }
});

const vietnamTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const formatProgramTime = (timestamp: number): string => props.scheduleIsReference
  ? vietnamTimeFormatter.format(new Date(timestamp * 1000))
  : dayjs.unix(timestamp).format('HH:mm');
// Provider EPG usually puts the current programme first. The reference
// guide must never falsely highlight its first (morning) slot as "on air".
const isCurrentProgram = (_item: ProgramItem, index: number): boolean =>
  schedulePositionNow.value.currentIndex === index;

const playlistKey = (item: PlaylistItem, index: number): string =>
  [item.track_title, item.track_artist, item.track_played, index].join("-");

const programKey = (item: ProgramItem, index: number): string =>
  [item.encodeId, item.startTime, item.title, index].join("-");
const siteAssetUrl = useSiteAssetUrl();
</script>

