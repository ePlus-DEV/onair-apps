<template>
  <section class="rounded-2xl border border-[var(--radio-border)] bg-[var(--radio-surface)] p-4 sm:p-5" :aria-label="$t('for_you.title')">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300" aria-hidden="true">
          <UIcon name="i-lucide-sparkles" class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <h2 class="text-base font-bold sm:text-lg">{{ $t('for_you.title') }}</h2>
          <p class="mt-1 max-w-xl text-xs leading-5 text-[var(--radio-text-muted)]">{{ $t('for_you.description') }}</p>
        </div>
      </div>
      <UButton color="neutral" variant="outline" class="min-h-11 shrink-0"
        :aria-expanded="open" aria-controls="radio-for-you-results"
        :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" @click="toggleOpen">
        {{ $t(open ? 'for_you.hide_panel' : 'for_you.show') }}
      </UButton>
    </div>

    <div v-if="open" id="radio-for-you-results" class="mt-4 border-t border-[var(--radio-border)] pt-4">
      <p v-if="loading" role="status" class="py-2 text-xs text-[var(--radio-text-muted)]">{{ $t('for_you.loading') }}</p>
      <div v-else-if="error && !index.length" role="alert" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--radio-border)] p-3">
        <span class="text-xs text-[var(--radio-text-muted)]">{{ $t('for_you.unavailable') }}</span>
        <UButton color="neutral" variant="outline" size="sm" class="min-h-10" @click="load">{{ $t('for_you.retry') }}</UButton>
      </div>

      <template v-if="index.length">
        <p class="mb-3 text-xs leading-5 text-[var(--radio-text-muted)]">
          {{ $t(recommendations.mode === 'personal' ? 'for_you.based_on_your_library' : 'for_you.curated_intro') }}
        </p>
        <div v-if="recommendations.items.length" class="flex flex-wrap items-stretch gap-3">
          <article v-for="result in recommendations.items" :key="result.station.url" class="relative min-w-0 max-w-[360px] flex-[1_1_220px] rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] p-3">
            <div class="flex min-w-0 items-start gap-2.5">
              <img :src="siteAssetUrl(result.station.station_image || '/brand/onair-mark.svg')" alt="" loading="lazy" decoding="async"
                width="44" height="44" class="radio-themed-artwork h-11 w-11 shrink-0 rounded-lg object-contain p-1" />
              <div class="min-w-0 flex-1">
                <NuxtLink :to="result.station.url" :prefetch="false" class="radio-interactive block min-w-0 truncate text-sm font-semibold hover:text-rose-600 dark:hover:text-rose-300"
                  :title="result.station.station_name">{{ result.station.station_name }}</NuxtLink>
                <p class="mt-1 truncate text-[11px] text-[var(--radio-text-muted)]">
                  {{ result.station.station_country ? $t(result.station.station_country) : '' }}
                </p>
              </div>
              <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" class="h-9 w-9 shrink-0 justify-center"
                :aria-label="$t('for_you.dismiss') + ': ' + result.station.station_name" @click="dismiss(result.station.url)" />
            </div>
            <p class="mt-3 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-300">
              <UIcon name="i-lucide-sparkles" class="h-3 w-3 shrink-0" aria-hidden="true"/>
              {{ $t('for_you.reason_' + result.reason) }}
            </p>
          </article>
        </div>
        <p v-else role="status" class="rounded-xl border border-dashed border-[var(--radio-border)] p-4 text-sm text-[var(--radio-text-muted)]">{{ $t('for_you.empty') }}</p>
        <p class="mt-3 text-[11px] leading-5 text-[var(--radio-text-muted)]">{{ $t('for_you.privacy_note') }}</p>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useListeningStore } from '~/stores/listening';
import { useListeningDurationStore } from '~/stores/listeningDuration';
import { usePlaybackStore } from '~/stores/playback';
import { recommendPersonalStations } from '~/utils/personal-radio.mjs';

const siteAssetUrl = useSiteAssetUrl();
const listening = useListeningStore();
const listeningDuration = useListeningDurationStore();
const playback = usePlaybackStore();
const { index, load, loading, error } = useStationSearchIndex();

listening.hydrate();
listeningDuration.hydrate();

const open = ref(false);
const excludedUrls = ref<string[]>([]);
const recommendations = computed(() => recommendPersonalStations(index.value, listening.library, {
  currentUrl: playback.station?.url || '',
  includeRecent: listeningDuration.enabled,
  excludedUrls: excludedUrls.value,
  limit: 4,
}));

const toggleOpen = () => {
  open.value = !open.value;
  if (open.value) void load();
};
const dismiss = (url: string) => {
  if (!excludedUrls.value.includes(url)) excludedUrls.value = [...excludedUrls.value, url];
};
</script>
