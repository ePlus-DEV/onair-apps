<template>
  <div class="min-w-0 space-y-6 sm:space-y-8">
    <nav class="flex flex-wrap items-center gap-2 text-xs text-[var(--radio-text-muted)]"
      :aria-label="t('global_radio.breadcrumb')">
      <NuxtLink to="/" class="hover:text-rose-500">{{ t('global_radio.home') }}</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="h-3.5 w-3.5" aria-hidden="true" />
      <NuxtLink to="/global-radio" class="hover:text-rose-500">{{ t('global_radio.title') }}</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="h-3.5 w-3.5" aria-hidden="true" />
      <span aria-current="page">{{ provider?.name }}</span>
    </nav>

    <!-- Visual-only hero: no fabricated playback state and no third-party image downloads. -->
    <header class="radio-hero relative isolate overflow-hidden rounded-3xl border border-rose-500/15 p-5 sm:p-7 lg:p-8">
      <div class="pointer-events-none absolute inset-0 opacity-70 dark:opacity-100" aria-hidden="true"
        style="background: radial-gradient(ellipse at 88% 35%, rgb(244 63 94 / .20), transparent 43%), radial-gradient(ellipse at 40% 110%, rgb(124 58 237 / .15), transparent 60%)" />
      <svg class="pointer-events-none absolute -right-6 top-0 hidden h-full w-[42%] text-rose-500/30 md:block"
        viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
        <path v-for="offset in [0, 14, 28, 42, 56, 70]" :key="offset"
          :d="`M-20 ${110 - offset} C 75 ${-20 + offset}, 155 ${200 - offset}, 340 ${32 + offset}`"
          stroke="currentColor" stroke-width="2" />
      </svg>
      <div class="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-700 text-white shadow-lg shadow-rose-900/15 sm:h-20 sm:w-20"
          aria-hidden="true">
          <UIcon name="i-lucide-radio-tower" class="h-8 w-8 sm:h-9 sm:w-9" />
        </div>
        <div class="min-w-0 max-w-2xl flex-1">
          <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">
            {{ t('global_radio.eyebrow') }}
          </p>
          <h1 class="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{{ provider?.name }}</h1>
          <p class="mt-2 text-sm leading-6 text-[var(--radio-text-muted)]">{{ t('global_radio.apple_description') }}</p>
          <div class="mt-4 flex flex-wrap gap-2 text-xs">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-[var(--radio-border)] bg-[var(--radio-surface)]/70 px-3 py-1.5">
              <UIcon name="i-lucide-radio" class="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
              {{ provider?.stations.length || 0 }} {{ t('global_radio.station_count') }}
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-[var(--radio-border)] bg-[var(--radio-surface)]/70 px-3 py-1.5">
              <UIcon name="i-lucide-globe-2" class="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
              {{ t('global_radio.title') }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <!-- Playback is now in-app; provider-account information belongs on details. -->
    <p class="flex items-center gap-2 text-xs leading-5 text-[var(--radio-text-muted)] sm:text-sm">
      <UIcon name="i-lucide-headphones" class="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
      <span>{{ t('global_radio.eplus_play_hint') }}</span>
    </p>

    <p v-if="!canListenOnEplus" role="status" class="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
      {{ t('global_radio.resolver_unavailable') }}
    </p>

    <p v-if="resolverError" role="alert" class="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
      {{ t('global_radio.resolver_unavailable') }}
    </p>

    <section :aria-label="t('global_radio.stations')" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-bold">{{ t('global_radio.stations') }}</h2>
        <span class="text-xs tabular-nums text-[var(--radio-text-muted)]">
          {{ provider?.stations.length || 0 }} {{ t('global_radio.station_count') }}
        </span>
      </div>
      <div class="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <article v-for="station in provider?.stations || []" :key="station.id"
          class="radio-surface group flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--radio-border)] p-3.5 transition-colors hover:border-rose-500/45 focus-within:border-rose-500/50 sm:gap-4 sm:p-5"
          :class="isStationActive(station.id) ? 'border-rose-500/55 ring-1 ring-rose-500/10' : ''">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/25 to-pink-900/15 text-rose-500 sm:h-12 sm:w-12"
              aria-hidden="true">
              <UIcon name="i-lucide-radio" class="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <div class="min-w-0 flex-1">
              <NuxtLink :prefetch="false" :to="`/global-radio/apple-music/${station.id}`"
                class="block truncate text-sm font-bold text-[var(--radio-text)] transition-colors hover:text-rose-500 sm:text-base">
                {{ station.title }}
              </NuxtLink>
              <p class="mt-0.5 truncate text-xs text-[var(--radio-text-muted)]">
                {{ station.genre }} · {{ station.language.toUpperCase() }}
              </p>
            </div>
            <span v-if="isStationActive(station.id)"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
              <span class="h-1.5 w-1.5 rounded-full bg-rose-500" :class="isStationPlaying(station.id) ? 'animate-pulse' : 'opacity-40'" aria-hidden="true" />
              {{ t(isStationPlaying(station.id) ? 'global_radio.playing_now' : 'redesign.paused') }}
            </span>
            <UIcon v-else-if="station.seasonal" name="i-lucide-snowflake"
              class="h-4 w-4 shrink-0 text-amber-500" :title="t('global_radio.seasonal')" aria-hidden="true" />
          </div>

          <p class="line-clamp-2 min-h-0 flex-1 text-sm leading-5 text-[var(--radio-text-muted)]">
            {{ station.description }}
          </p>

          <!-- Exactly one primary listen action. External providers are detail-only. -->
          <div class="mt-auto flex min-w-0 items-stretch gap-2">
            <button type="button"
              class="radio-interactive inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-sm font-bold text-white transition-colors hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              :disabled="!canListenOnEplus || pendingStationId === station.id" :aria-busy="pendingStationId === station.id"
              :title="!canListenOnEplus ? t('global_radio.resolver_unavailable') : undefined" :aria-pressed="isStationPlaying(station.id)"
              :aria-label="t(isStationPlaying(station.id) ? 'player.pause' : 'global_radio.listen_on_eplus') + ': ' + station.title"
              @click="playOnEplus(station)">
              <UIcon :name="pendingStationId === station.id ? 'i-lucide-loader-circle' : isStationPlaying(station.id) ? 'i-lucide-pause' : 'i-lucide-play'"
                :class="pendingStationId === station.id ? 'h-4 w-4 shrink-0 animate-spin' : 'h-4 w-4 shrink-0'" aria-hidden="true" />
              <span class="truncate">{{ t(pendingStationId === station.id ? 'global_radio.connecting_on_eplus' : isStationPlaying(station.id) ? 'player.pause' : 'global_radio.listen_on_eplus') }}</span>
            </button>
            <NuxtLink :prefetch="false" :to="`/global-radio/apple-music/${station.id}`"
              class="radio-interactive inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3 text-xs font-semibold text-[var(--radio-text)] transition-colors hover:border-rose-500 hover:text-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 sm:px-4">
              {{ t('global_radio.details') }}
              <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0" aria-hidden="true" />
            </NuxtLink>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { usePlaybackStore } from '~/stores/playback';

const { t } = useI18n();
const { data: provider } = await useAppleMusicProvider();
const playback = usePlaybackStore();
const {
  enabled: canListenOnEplus,
  play: playOnEplus,
  pendingStationId,
  error: resolverError,
} = useAuthorizedGlobalRadioPlayback(() => provider.value?.stations || []);
const isStationActive = (id: string) =>
  playback.station?.url === '/global-radio/apple-music/' + id;
const isStationPlaying = (id: string) =>
  isStationActive(id) && (playback.playing || playback.waiting);
const title = computed(() => 'Apple Music Radio');
const description = computed(() => t('global_radio.apple_description'));
useStaticPageSeo({ title, description });
</script>
