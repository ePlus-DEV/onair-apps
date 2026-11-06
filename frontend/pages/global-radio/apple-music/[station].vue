<template>
  <div class="space-y-6">
    <nav class="flex flex-wrap items-center gap-2 text-xs text-[var(--radio-text-muted)]" :aria-label="t('global_radio.breadcrumb')">
      <NuxtLink to="/" class="hover:text-rose-500">{{ t('global_radio.home') }}</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="h-3.5 w-3.5" aria-hidden="true" />
      <NuxtLink to="/global-radio" class="hover:text-rose-500">{{ t('global_radio.title') }}</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="h-3.5 w-3.5" aria-hidden="true" />
      <NuxtLink to="/global-radio/apple-music" class="hover:text-rose-500">Apple Music Radio</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="h-3.5 w-3.5" aria-hidden="true" />
      <span aria-current="page">{{ station?.title }}</span>
    </nav>
    <article class="radio-hero rounded-2xl p-5 sm:p-8">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500" aria-hidden="true">
          <UIcon name="i-lucide-radio-tower" class="h-8 w-8" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-bold uppercase tracking-[0.15em] text-rose-600 dark:text-rose-300">Apple Music Radio</p>
          <h1 class="mt-2 text-2xl font-bold sm:text-3xl">{{ station?.title }}</h1>
          <p class="mt-3 max-w-2xl text-sm leading-7 text-[var(--radio-text-muted)]">{{ station?.description }}</p>
          <div class="mt-4 flex flex-wrap gap-2 text-xs text-[var(--radio-text-muted)]">
            <span class="rounded-full border border-[var(--radio-border)] px-3 py-1.5">{{ station?.genre }}</span>
            <span class="rounded-full border border-[var(--radio-border)] px-3 py-1.5">{{ t('global_radio.origin') }}: US</span>
            <span v-if="station?.seasonal" class="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-700 dark:text-amber-300">{{ t('global_radio.seasonal') }}</span>
          </div>
          <p v-if="station?.seasonal" class="mt-4 text-xs leading-5 text-[var(--radio-text-muted)]">{{ t('global_radio.seasonal_note') }}</p>
          <p v-if="!canListenOnEplus" role="status" class="mt-4 text-xs text-amber-700 dark:text-amber-300">
            {{ t('global_radio.resolver_unavailable') }}
          </p>
          <p v-if="resolverError" role="alert" class="mt-4 text-xs text-amber-700 dark:text-amber-300">
            {{ t('global_radio.resolver_unavailable') }}
          </p>
          <div class="mt-6">
            <button v-if="station" type="button"
              :disabled="!canListenOnEplus || Boolean(pendingStationId)"
              :title="!canListenOnEplus ? t('global_radio.resolver_unavailable') : undefined" :aria-pressed="isPlayingHere"
              :aria-label="t(isPlayingHere ? 'player.pause' : 'global_radio.listen_on_eplus') + ': ' + station.title"
              @click="playOnEplus(station)"
              class="radio-interactive inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 text-sm font-bold text-white transition-colors hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 sm:w-auto sm:min-w-56">
              <UIcon :name="pendingStationId ? 'i-lucide-loader-circle' : isPlayingHere ? 'i-lucide-pause' : 'i-lucide-play'"
                :class="pendingStationId ? 'h-5 w-5 animate-spin' : 'h-5 w-5'" aria-hidden="true" />
              {{ t(pendingStationId ? 'global_radio.connecting_on_eplus' : isPlayingHere ? 'player.pause' : 'global_radio.listen_on_eplus') }}
            </button>
          </div>
        </div>
      </div>
    </article>
    <!-- Secondary external destinations live only on the station detail page. -->
    <section class="radio-surface rounded-2xl border border-[var(--radio-border)] p-4 sm:p-5"
      :aria-label="t('global_radio.other_listening_options')">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-external-link" class="h-4 w-4 text-[var(--radio-text-muted)]" aria-hidden="true" />
        <h2 class="text-sm font-bold">{{ t('global_radio.other_listening_options') }}</h2>
      </div>
      <p class="mt-2 text-xs leading-5 text-[var(--radio-text-muted)]">
        {{ t('global_radio.external_options_hint') }}
      </p>
      <div class="mt-4 grid gap-2 sm:grid-cols-2">
        <a v-if="station" :href="station.listen_url" target="_blank" rel="noopener noreferrer"
          class="radio-interactive inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-4 text-sm font-semibold text-[var(--radio-text)] transition-colors hover:border-rose-500 hover:text-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500">
          {{ t('global_radio.listen_on_apple') }}
          <UIcon name="i-lucide-external-link" class="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
        <a v-if="station?.tunein_url" :href="station.tunein_url" target="_blank" rel="noopener noreferrer"
          class="radio-interactive inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-4 text-sm font-semibold text-[var(--radio-text)] transition-colors hover:border-rose-500 hover:text-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500">
          {{ t('global_radio.listen_on_tunein') }}
          <UIcon name="i-lucide-external-link" class="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
      </div>
      <p class="mt-3 text-xs leading-5 text-[var(--radio-text-muted)]">
        {{ t('global_radio.apple_access') }}
      </p>
    </section>
    <NuxtLink to="/global-radio/apple-music" class="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-rose-700 hover:underline dark:text-rose-300">
      <UIcon name="i-lucide-arrow-left" class="h-4 w-4" aria-hidden="true" />{{ t('global_radio.back_to_provider') }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { usePlaybackStore } from '~/stores/playback';

const playback = usePlaybackStore();
const route = useRoute();
const { t } = useI18n();
const { data: provider } = await useAppleMusicProvider();
const {
  enabled: canListenOnEplus,
  play: playOnEplus,
  pendingStationId,
  error: resolverError,
} = useAuthorizedGlobalRadioPlayback(() => provider.value?.stations || []);
// A Next/Previous navigation reuses this route component. Follow route params
// reactively instead of retaining the ID from the first mounted station.
const stationId = computed(() => String(route.params.station || ''));
const station = computed(() => provider.value?.stations.find(item => item.id === stationId.value));
const stationPath = computed(() => '/global-radio/apple-music/' + stationId.value);
const isPlayingHere = computed(() => playback.station?.url === stationPath.value
  && (playback.playing || playback.waiting));

// Country detail pages honor requestedStationUrl from the shared PlayerQueue.
// Resolve a fresh signed Global HLS only for an explicit queue/skip request;
// visiting a detail link must never auto-play or interrupt the current station.
watch([station, () => playback.requestedStationUrl], ([current, requested]) => {
  if (!import.meta.client || !current || requested !== stationPath.value) return;
  playback.requestedStationUrl = '';
  void playOnEplus(current);
}, { immediate: true });
if (!station.value) {
  throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
}
const title = computed(() => station.value?.title || 'Apple Music Radio');
const description = computed(() => station.value
  ? `${station.value.title} — ${station.value.description} ${t('global_radio.external_note')}`
  : t('global_radio.apple_description'));
useStaticPageSeo({ title, description });
</script>
