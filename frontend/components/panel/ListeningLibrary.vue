<template>
  <div v-if="groups.length" class="space-y-7">
    <section v-for="group in groups" :key="group.key" :aria-label="$t(`library.${group.key}`)">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 text-lg font-semibold"><UIcon :name="group.icon" class="h-5 w-5 text-rose-600 dark:text-rose-400" />{{ $t(`library.${group.key}`) }}<span class="text-xs font-normal text-[var(--radio-text-muted)]">{{ group.items.length }}</span></h2>
        <NuxtLink v-if="compact && group.items.length" :to="`/library#${group.key}`" class="radio-interactive rounded-lg p-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{{ $t('redesign.see_all') }}</NuxtLink>
        <UButton v-if="!compact && group.key === 'recent' && group.items.length" color="neutral" variant="ghost" class="min-h-11" @click="clearRecentOpen = true">{{ $t('library.clear_recent') }}</UButton>
      </div>
      <div v-if="group.items.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="station in compact ? group.items.slice(0, 4) : group.items"
          :key="station.url"
          class="radio-station-card flex min-w-0 items-center gap-1 rounded-2xl border p-2"
          :class="isActive(station.url) ? 'border-rose-500/40' : ''"
        >
          <UTooltip :text="station.title">
            <NuxtLink :to="station.url" :prefetch="false" class="radio-interactive flex min-h-16 min-w-0 flex-1 items-center gap-2 rounded-xl sm:gap-3" @click="openStationDetails($event)">
              <StationArtwork :src="station.image" :alt="station.title" class="radio-library-artwork radio-themed-artwork h-12 w-12 shrink-0 rounded-xl object-contain p-1.5" />
              <span dir="auto" class="block min-w-0 truncate text-sm font-semibold">{{ station.title }}</span>
            </NuxtLink>
          </UTooltip>
          <div class="flex shrink-0 items-center gap-0.5">
            <UButton
              color="neutral"
              :variant="isActive(station.url) ? 'soft' : 'ghost'"
              :icon="isPlaying(station.url) ? 'i-lucide-pause' : 'i-lucide-play'"
              :loading="pendingStationUrl === station.url"
              :disabled="pendingStationUrl === station.url"
              :class="isActive(station.url) ? 'text-rose-500' : ''"
              class="h-10 w-10 shrink-0 justify-center rounded-full"
              :aria-label="$t(isPlaying(station.url) ? 'player.pause' : 'player.play') + ': ' + station.title"
              @click="togglePlayback(station, group.items)"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-heart"
              :class="isFavorite(station.url) ? 'text-rose-500' : ''"
              class="h-10 w-10 shrink-0 justify-center rounded-full"
              :aria-pressed="isFavorite(station.url)"
              :aria-label="$t(isFavorite(station.url) ? 'library.remove_favorite' : 'library.add_favorite')"
              @click="listening.toggleFavorite(station)"
            />
            <UButton
              v-if="group.key === 'recent'"
              color="neutral"
              variant="ghost"
              icon="i-lucide-trash-2"
              class="h-10 w-10 shrink-0 justify-center rounded-full text-[var(--radio-text-muted)] hover:text-rose-500"
              :aria-label="$t('library.remove_recent') + ': ' + station.title"
              @click="listening.removeRecent(station.url)"
            />
          </div>
        </article>
      </div>
      <p v-else class="rounded-2xl border border-dashed border-[var(--radio-border)] p-4 text-sm leading-6 text-[var(--radio-text-muted)]">{{ $t(`library.${group.key}_empty`) }}</p>
      <p v-if="failedStationUrl && group.items.some(station => station.url === failedStationUrl)" role="alert" class="mt-2 text-xs text-rose-500">{{ $t('alert.stream_error') }}</p>
    </section>
    <UModal
      v-model:open="clearRecentOpen"
      :title="$t('library.confirm_clear_recent_title')"
      :description="$t('library.confirm_clear_recent_description')"
      :ui="{ content: 'max-w-md' }"
    >
      <template #footer>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="outline" class="min-h-11" @click="clearRecentOpen = false">
            {{ $t('library.confirm_clear_recent_no') }}
          </UButton>
          <UButton color="error" class="min-h-11" @click="confirmClearRecent">
            {{ $t('library.confirm_clear_recent_yes') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useListeningStore } from '~/stores/listening';
import { usePlaybackStore } from '~/stores/playback';
import { createPlaybackStation } from '~/utils/playback-station.mjs';
import { buildLibraryPlaybackQueue, parseLibraryStationPath } from '~/utils/library-card-playback.mjs';
import type { RadioCatalogEntry } from '~/types/radio';

type LibraryStation = { url: string; title: string; image: string; countryKey?: string };

const props = defineProps<{ compact?: boolean; group?: string }>();
const listening = useListeningStore();
const playback = usePlaybackStore();
const config = useRuntimeConfig();
const route = useRoute();
listening.hydrate();

const clearRecentOpen = ref(false);
const confirmClearRecent = () => {
  listening.clearRecent();
  clearRecentOpen.value = false;
};

const pendingStationUrl = ref<string | null>(null);
const failedStationUrl = ref<string | null>(null);
const catalogs = new Map<string, Promise<Record<string, RadioCatalogEntry>>>();
let selectionGeneration = 0;

const groups = computed(() => [
  { key: 'favorites', icon: 'i-lucide-heart', items: listening.library.favorites },
  { key: 'recent', icon: 'i-lucide-history', items: listening.library.recent },
].filter((group) =>
  (!props.group || props.group === 'all' || props.group === group.key)
  && (!props.compact || group.items.length > 0)
));

const isFavorite = (url: string) => listening.library.favorites.some((item: { url: string }) => item.url === url);
const isActive = (url: string) => playback.station?.url === url;
const isPlaying = (url: string) => isActive(url) && (playback.playing || playback.waiting);

const loadCatalog = (area: string, country: string) => {
  const key = `${area}/${country}`;
  const cached = catalogs.get(key);
  if (cached) return cached;
  const request = $fetch<Record<string, RadioCatalogEntry>>(siteAssetUrl(`/radio/${key}.json`), { timeout: 10_000 })
    .catch(error => {
      catalogs.delete(key);
      throw error;
    });
  catalogs.set(key, request);
  return request;
};

const togglePlayback = async (station: LibraryStation, items: LibraryStation[]) => {
  if (pendingStationUrl.value === station.url) return;
  const generation = ++selectionGeneration;
  pendingStationUrl.value = null;
  failedStationUrl.value = null;

  // A second click on the active station should pause it, not reload the stream.
  if (isPlaying(station.url)) {
    playback.pauseRequest += 1;
    return;
  }
  if (isActive(station.url) && playback.station?.sources.length) {
    playback.requestStation(station.url);
    return;
  }

  const target = parseLibraryStationPath(station.url);
  if (!target) {
    failedStationUrl.value = station.url;
    return;
  }
  pendingStationUrl.value = station.url;
  const previousStation = playback.station;
  const previousPlayRequest = playback.playRequest;
  const previousPauseRequest = playback.pauseRequest;
  const previousRequestedUrl = playback.requestedStationUrl;
  const previousRoute = route.fullPath;

  try {
    const catalog = await loadCatalog(target.area, target.country);
    // Do not autoplay a stale request if the user navigated or selected another station.
    if (generation !== selectionGeneration || route.fullPath !== previousRoute
      || playback.station !== previousStation || playback.playRequest !== previousPlayRequest
      || playback.pauseRequest !== previousPauseRequest || playback.requestedStationUrl !== previousRequestedUrl) return;

    const meta = catalog[target.id];
    if (!meta?.stream) throw new Error('Library station stream unavailable');
    playback.activate(createPlaybackStation({
      area: target.area,
      country: target.country,
      id: target.id,
      meta,
      corsServer: String(config.public.corsServer || ''),
      placeholder: String(config.public.placeholderStation),
    }), buildLibraryPlaybackQueue(items), { autoplay: true });
  } catch {
    if (generation === selectionGeneration) failedStationUrl.value = station.url;
  } finally {
    if (generation === selectionGeneration) pendingStationUrl.value = null;
  }
};

const openStationDetails = (event: MouseEvent) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  // Details is a navigation action, not Play. Cancel any pending async play
  // so its catalog response cannot start playback after the user leaves.
  ++selectionGeneration;
  pendingStationUrl.value = null;
};

onBeforeUnmount(() => { ++selectionGeneration; });
const siteAssetUrl = useSiteAssetUrl();
</script>
