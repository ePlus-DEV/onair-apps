<template>
  <section class="rounded-2xl border border-[var(--radio-border)] bg-[var(--radio-surface)] p-4 sm:p-5" :aria-label="$t('surprise.title')">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-rose-600 dark:text-rose-300">
          <UIcon name="i-lucide-shuffle" class="h-4 w-4" aria-hidden="true" />
          {{ $t('surprise.title') }}
        </p>
        <h2 class="text-base font-bold sm:text-lg">{{ $t('surprise.heading') }}</h2>
        <p class="mt-1 max-w-2xl text-xs leading-5 text-[var(--radio-text-muted)]">{{ $t('surprise.description') }}</p>
      </div>
      <div class="flex shrink-0 flex-wrap gap-2">
        <UButton color="neutral" variant="outline" class="min-h-11"
          icon="i-lucide-sliders-horizontal" :aria-expanded="filtersOpen" aria-controls="radio-surprise-filters"
          @click="toggleFilters">{{ $t('surprise.filters') }}</UButton>
        <UButton class="min-h-11 bg-rose-500 text-white hover:bg-rose-400" icon="i-lucide-shuffle"
          :loading="busy" :disabled="busy" @click="surprise">{{ $t('surprise.action') }}</UButton>
      </div>
    </div>

    <div v-show="filtersOpen" id="radio-surprise-filters" class="mt-4 border-t border-[var(--radio-border)] pt-4">
      <p v-if="indexLoading" role="status" class="text-xs text-[var(--radio-text-muted)]">{{ $t('surprise.loading') }}</p>
      <p v-else-if="indexError" role="alert" class="text-xs text-rose-600 dark:text-rose-300">{{ $t('surprise.unavailable') }}</p>
      <div v-if="index.length" class="grid gap-3 sm:grid-cols-3">
        <label class="block min-w-0 text-xs font-medium text-[var(--radio-text-muted)]">
          {{ $t('surprise.country') }}
          <select v-model="country" class="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3 text-sm text-[var(--radio-text)]">
            <option value="">{{ $t('surprise.any_country') }}</option>
            <option v-for="key in countries" :key="key" :value="key">{{ $t(key) }}</option>
          </select>
        </label>
        <label v-if="genres.length" class="block min-w-0 text-xs font-medium text-[var(--radio-text-muted)]">
          {{ $t('surprise.genre') }}
          <select v-model="genre" class="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3 text-sm text-[var(--radio-text)]">
            <option value="">{{ $t('surprise.any_genre') }}</option>
            <option v-for="value in genres" :key="value" :value="value">{{ value }}</option>
          </select>
        </label>
        <label v-if="languages.length" class="block min-w-0 text-xs font-medium text-[var(--radio-text-muted)]">
          {{ $t('surprise.language') }}
          <select v-model="language" class="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3 text-sm text-[var(--radio-text)]">
            <option value="">{{ $t('surprise.any_language') }}</option>
            <option v-for="value in languages" :key="value" :value="value">{{ value }}</option>
          </select>
        </label>
      </div>
      <p v-if="index.length" class="mt-2 text-xs text-[var(--radio-text-muted)]">{{ $t('surprise.available_count', { count: availableCount }) }}</p>
    </div>

    <p v-if="status === 'empty'" role="status" class="mt-3 text-xs text-[var(--radio-text-muted)]">{{ $t('surprise.empty') }}</p>
    <p v-else-if="status === 'error'" role="alert" class="mt-3 text-xs text-rose-600 dark:text-rose-300">{{ $t('surprise.unavailable') }}</p>
    <div v-if="lastSelected" class="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span class="text-[var(--radio-text-muted)]">{{ $t('surprise.selected') }}</span>
      <NuxtLink :to="lastSelected.url" dir="auto" class="min-w-0 truncate font-semibold text-rose-600 hover:underline dark:text-rose-300">{{ lastSelected.title }}</NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { usePlaybackStore } from '~/stores/playback';
import { createPlaybackStation } from '~/utils/playback-station.mjs';
import { parseLibraryStationPath } from '~/utils/library-card-playback.mjs';
import { pickRandomStation, randomStationCandidates, randomStationFacets } from '~/utils/surprise-radio.mjs';
import type { RadioCatalogEntry, RadioStationOption } from '~/types/radio';

const playback = usePlaybackStore();
const route = useRoute();
const config = useRuntimeConfig();
const siteAssetUrl = useSiteAssetUrl();
const { index, loading: indexLoading, error: indexError, load } = useStationSearchIndex();

const busy = ref(false);
const filtersOpen = ref(false);
const country = ref('');
const genre = ref('');
const language = ref('');
const lastRandomUrl = ref('');
const lastSelected = ref<{ url: string; title: string } | null>(null);
const status = ref<'empty' | 'error' | ''>('');
let generation = 0;

const countries = computed(() => randomStationFacets(index.value, 'station_country'));
const genres = computed(() => randomStationFacets(index.value, 'station_category', { country: country.value }));
const languages = computed(() => randomStationFacets(index.value, 'station_language', { country: country.value, genre: genre.value }));
const filters = computed(() => ({ country: country.value, genre: genre.value, language: language.value }));
const availableCount = computed(() => randomStationCandidates(index.value, filters.value).length);

watch(country, () => { genre.value = ''; language.value = ''; });
watch(genre, () => { language.value = ''; });

const toggleFilters = () => {
  filtersOpen.value = !filtersOpen.value;
  if (filtersOpen.value) void load();
};

const surprise = async () => {
  if (busy.value) return;
  const request = ++generation;
  const snapshot = {
    path: route.fullPath,
    station: playback.station,
    playRequest: playback.playRequest,
    pauseRequest: playback.pauseRequest,
    requestedUrl: playback.requestedStationUrl,
  };
  busy.value = true;
  status.value = '';
  try {
    await load();
    if (request !== generation || route.fullPath !== snapshot.path) return;
    if (indexError.value || !index.value.length) { status.value = 'error'; return; }
    const next = pickRandomStation(index.value, {
      ...filters.value,
      previousUrl: lastRandomUrl.value || playback.station?.url || '',
    });
    if (!next) { status.value = 'empty'; return; }
    const path = parseLibraryStationPath(next.url);
    if (!path) { status.value = 'error'; return; }

    // A second static country request is intentional; the search index
    // contains no stream URLs or credentials. Only the station catalog does.
    const catalog = await $fetch<Record<string, RadioCatalogEntry>>(
      siteAssetUrl(`/radio/${path.area}/${path.country}.json`), { timeout: 10_000 },
    );
    if (request !== generation || route.fullPath !== snapshot.path
      || playback.station !== snapshot.station || playback.playRequest !== snapshot.playRequest
      || playback.pauseRequest !== snapshot.pauseRequest || playback.requestedStationUrl !== snapshot.requestedUrl) return;
    const meta = catalog?.[path.id];
    if (!meta || !/^https?:\/\//i.test(String(meta.stream || ''))) { status.value = 'error'; lastRandomUrl.value = next.url; return; }
    const queue: RadioStationOption[] = Object.entries(catalog).flatMap(([id, station]) => {
      if (!/^[a-z0-9-]+$/.test(id) || !/^https?:\/\//i.test(String(station?.stream || ''))) return [];
      return [{
        id, url: `/${path.area}/${path.country}/${id}`,
        title: station.title,
        image: station.features || String(config.public.placeholderStation),
      }];
    });
    playback.activate(createPlaybackStation({
      area: path.area, country: path.country, id: path.id, meta,
      corsServer: String(config.public.corsServer || ''),
      placeholder: String(config.public.placeholderStation || ''),
    }), queue, { autoplay: true });
    lastRandomUrl.value = next.url;
    lastSelected.value = { url: next.url, title: meta.title };
  } catch {
    if (request === generation) status.value = 'error';
  } finally {
    if (request === generation) busy.value = false;
  }
};

onBeforeUnmount(() => { ++generation; });
</script>
