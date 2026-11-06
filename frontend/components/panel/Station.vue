<template>
  <section class="radio-surface overflow-hidden">
    <div
      class="flex items-center justify-between gap-3 border-b border-[var(--radio-border)] px-4 py-4 sm:px-5"
    >
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">
          {{ $t("panel.play_from_radio") }}
        </p>
        <h2 class="mt-1 truncate text-lg font-semibold tracking-tight text-[var(--radio-text)] sm:text-xl">
          {{ countryName }}
        </h2>
      </div>
      <span
        class="radio-count-badge inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold"
      >
        {{ stations.length }}
      </span>
    </div>

    <div
      v-if="stations.length"
      class="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:gap-4 sm:p-4 lg:grid-cols-4 2xl:grid-cols-5"
    >
      <article
        v-for="station in stations"
        :key="station.id"
        class="radio-station-card group relative min-w-0 overflow-hidden rounded-2xl border transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10"
        :class="
          station.id === activeStationId
            ? 'border-rose-300 ring-2 ring-rose-500/15 dark:border-rose-400/40'
            : 'border-[var(--radio-border)] hover:border-rose-200 dark:hover:border-rose-400/30'
        "
      >
        <UTooltip :text="station.title">
          <NuxtLink
            :prefetch="false"
            :to="station.url"
            class="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            :aria-label="station.title"
          >
            <div class="radio-themed-artwork relative flex aspect-[5/4] items-center justify-center overflow-hidden p-3 sm:aspect-square sm:p-4">
              <img
                loading="lazy"
                decoding="async"
                :src="siteAssetUrl(station.image)"
                :alt="station.title"
                class="h-auto max-h-[75%] w-auto max-w-[75%] object-contain drop-shadow-sm transition duration-300 group-hover:scale-[1.08]"
              />

              <span
                v-if="station.id === activeStationId"
                class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
              >
                <span v-if="playback.playing" class="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
                {{ $t(playback.playing ? 'player.on_air' : 'redesign.paused') }}
              </span>
            </div>

            <div class="flex min-h-[4.5rem] min-w-0 items-center border-t border-[var(--radio-border)] px-3 py-2.5 pr-16 sm:py-3.5">
              <span dir="auto" class="block min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--radio-text)]">
                <CountryMarquee :text="station.title" />
              </span>
            </div>
          </NuxtLink>
        </UTooltip>
        <button
          type="button"
          class="absolute bottom-3 right-3 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-950/25 transition hover:bg-rose-400 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          :aria-label="$t(isPlaying(station) ? 'player.pause' : 'player.play') + ': ' + station.title"
          :aria-pressed="isPlaying(station)"
          @click="emit('select-station', station)"
        >
          <UIcon :name="isPlaying(station) ? 'i-lucide-pause' : 'i-lucide-play'" class="h-4 w-4" :class="isPlaying(station) ? '' : 'translate-x-px'" />
        </button>
      </article>
    </div>

    <div
      v-else
      class="px-5 py-10 text-center text-sm text-[var(--radio-text-muted)]"
    >
      {{ $t("panel.no_channels") }}
    </div>
  </section>
</template>

<script lang="ts" setup>
import { usePlaybackStore } from '~/stores/playback';
const playback = usePlaybackStore();
import type { RadioStationOption } from "~/types/radio";

const emit = defineEmits<{ (event: 'select-station', station: RadioStationOption): void }>();
const props = withDefaults(
  defineProps<{
    stations?: RadioStationOption[];
    activeStationId?: string;
    countryName?: string;
  }>(),
  {
    stations: () => [],
    activeStationId: "",
    countryName: "",
  },
);
const isPlaying = (station: RadioStationOption): boolean =>
  station.id === props.activeStationId && (playback.playing || playback.waiting);


const siteAssetUrl = useSiteAssetUrl();
</script>

