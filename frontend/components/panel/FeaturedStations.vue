<template>
  <section :aria-label="$t('home.featured')">
    <div
      class="radio-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4 2xl:grid-cols-5"
    >
      <article
        v-for="station in stations"
        :key="station.url || station.id"
        class="radio-featured-card group relative w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--radio-border)] bg-[var(--radio-surface)] transition duration-200 hover:-translate-y-0.5 hover:border-rose-400/50 hover:shadow-lg sm:w-auto"
        :class="station.url === activeStationUrl ? 'border-rose-400/60 ring-2 ring-rose-500/35' : ''"
      >
        <UTooltip :text="station.title">
          <NuxtLink
            :prefetch="false"
            :to="station.url"
            class="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            :aria-label="station.title"
          >
            <div class="radio-themed-artwork relative flex aspect-[5/4] items-center justify-center overflow-hidden p-5 sm:aspect-square">
              <img
                loading="lazy"
                decoding="async"
                :src="siteAssetUrl(station.image)"
                :alt="station.title"
                class="max-h-[75%] max-w-[85%] object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
              />
              <span
                v-if="station.url === activeStationUrl"
                class="absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold" :class="isPlaying(station) ? (playback.waiting ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300') : 'radio-neutral-badge'"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-current"></span> {{ $t(playback.playing ? 'player.on_air' : playback.waiting ? 'player.connecting' : 'redesign.paused') }}
              </span>
            </div>
            <div class="flex min-h-[4.25rem] min-w-0 items-center border-t border-[var(--radio-border)] px-3 py-3 pr-14">
              <span dir="auto" class="block min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--radio-text)]">
                <CountryMarquee :text="station.title" />
              </span>
            </div>
          </NuxtLink>
        </UTooltip>
        <button
          type="button"
          class="absolute bottom-4 right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white shadow-md shadow-rose-950/25 transition group-hover:scale-105 hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          :aria-label="$t(isPlaying(station) ? 'player.pause' : 'player.play') + ': ' + station.title"
          :aria-pressed="isPlaying(station)"
          @click="emit('select-station', station)"
        >
          <UIcon :name="isPlaying(station) ? 'i-lucide-pause' : 'i-lucide-play'" class="h-4 w-4" :class="isPlaying(station) ? '' : 'translate-x-px'" />
        </button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { usePlaybackStore } from '~/stores/playback';
const playback = usePlaybackStore();
import type { RadioStationOption } from '~/types/radio';

const props = defineProps<{ stations: RadioStationOption[]; activeStationUrl?: string }>();
const isPlaying = (station: RadioStationOption) => station.url === props.activeStationUrl && (playback.playing || playback.waiting);
const emit = defineEmits<{ (event: 'select-station', station: RadioStationOption): void }>();
const siteAssetUrl = useSiteAssetUrl();
</script>
