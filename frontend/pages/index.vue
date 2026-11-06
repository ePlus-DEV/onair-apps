<template>
  <div class="space-y-7 sm:space-y-8">
    <section class="radio-hero rounded-2xl">
      <p class="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">ePlus OnAir · {{ $t("brand.slogan") }}</p>
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ $t('home.title') }}</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[var(--radio-text-muted)]">{{ $t('home.description') }}</p>
      <div class="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-rose-700 dark:text-rose-300">
        <a href="#featured-radio" class="radio-interactive rounded-lg py-2">{{ $t('home.start_listening') }}</a>
        <a href="#explore-radio" class="radio-interactive rounded-lg py-2">{{ $t('home.explore_countries') }} · {{ totalCountries }}</a>
      </div>
    </section>
    <section id="featured-radio" class="scroll-mt-24">
      <div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-semibold">{{ $t('home.featured') }}</h2><span class="text-xs text-[var(--radio-text-muted)]">{{ $t('home.start_listening') }}</span></div>
      <PanelFeaturedStations @select-station="playFeatured" :stations="featuredStations" :active-station-url="playback.station?.url" />
    </section>
    <ClientOnly><PanelSurpriseRadio /></ClientOnly>
    <ClientOnly><PanelResumeCard /><PanelForYou /><PanelListeningLibrary compact /></ClientOnly>
    <!-- External-provider directory lives beside geographic discovery, not inside a fake country. -->
    <section class="radio-surface flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      :aria-label="$t('global_radio.title')">
      <div class="flex min-w-0 items-start gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500" aria-hidden="true">
          <UIcon name="i-lucide-globe-2" class="h-5 w-5" />
        </span>
        <div>
          <h2 class="text-base font-bold">{{ $t('global_radio.title') }}</h2>
          <p class="mt-1 max-w-xl text-xs leading-5 text-[var(--radio-text-muted)]">{{ $t('global_radio.apple_description') }}</p>
        </div>
      </div>
      <NuxtLink to="/global-radio" :prefetch="false" class="radio-interactive inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--radio-border)] px-4 text-xs font-semibold text-rose-700 hover:border-rose-500 dark:text-rose-300">
        {{ $t('global_radio.explore_provider') }}
        <UIcon name="i-lucide-arrow-right" class="h-4 w-4" aria-hidden="true" />
      </NuxtLink>
    </section>
    <section id="explore-radio" class="scroll-mt-24">
      <h2 class="mb-4 text-lg font-semibold">{{ $t('home.browse_country') }}</h2>
      <PanelRadio compact />
    </section>
  </div>
</template>

<script setup lang="ts">
import worldData from "~/data/world";
import type { RadioCatalogEntry, RadioStationOption } from "~/types/radio";
import { usePlaybackStore } from "~/stores/playback";
import { useListeningStore } from "~/stores/listening";
import { createPlaybackStation } from "~/utils/playback-station.mjs";
import { HOMEPAGE_FEATURED_STATION_PATHS, selectHomepageFeaturedStations } from "~/utils/featured-stations.mjs";
import { buildCollectionPageSchema } from "~/utils/seo-structured-data.mjs";

const siteAssetUrl = useSiteAssetUrl();
const runtimeConfig = useRuntimeConfig();
const noIndex = Boolean(runtimeConfig.public.noIndex);
const { t } = useI18n();
const siteUrl = computed(() =>
  String(runtimeConfig.public.siteUrl).replace(/\/$/, ""),
);
const playback = usePlaybackStore();
const listening = useListeningStore();
// Load only curated stations into the Nuxt payload, not entire country catalogs.
const featuredCountries = [...new Set(HOMEPAGE_FEATURED_STATION_PATHS.map(path => path.split('/').slice(0, 2).join('/')))];
const { data: featuredCatalogs } = await useAsyncData('homepage-featured-catalogs', async () => {
  const catalogs = await Promise.all(featuredCountries.map(async (country) => {
    let catalog: Record<string, RadioCatalogEntry>;
    if (import.meta.server) {
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      catalog = JSON.parse(await readFile(join(process.cwd(), 'public/radio', `${country}.json`), 'utf8')) as Record<string, RadioCatalogEntry>;
    } else {
      catalog = await $fetch<Record<string, RadioCatalogEntry>>(siteAssetUrl(`/radio/${country}.json`));
    }
    const ids = new Set(HOMEPAGE_FEATURED_STATION_PATHS
      .filter(path => path.startsWith(`${country}/`))
      .map(path => path.slice(country.length + 1)));
    return Object.fromEntries(Object.entries(catalog).filter(([id]) => ids.has(id))) as Record<string, RadioCatalogEntry>;
  }));
  return Object.fromEntries(featuredCountries.map((country, index) => [country, catalogs[index]])) as Record<string, Record<string, RadioCatalogEntry>>;
});
const featuredEntries = computed(() => selectHomepageFeaturedStations(featuredCatalogs.value || {}));
const featuredStations = computed<RadioStationOption[]>(() => featuredEntries.value.map(({ area, country, id, meta }) => ({
  id, title: meta.title, image: meta.features || String(runtimeConfig.public.placeholderStation), url: `/${area}/${country}/${id}`,
})));

const areaItems = computed(() =>
  Object.entries(worldData).map(([key, countries]) => ({
    key,
    slug: key.replace(/_/g, "-"),
    count: Object.keys(countries).length,
  })),
);

const totalCountries = computed(() =>
  areaItems.value.reduce((total, area) => total + area.count, 0),
);

const seoTitle = computed(() => t("home.title"));
const seoDescription = computed(() => t("home.description"));

const homeCollectionSchema = computed(() =>
  buildCollectionPageSchema({
    siteUrl: siteUrl.value,
    path: "/",
    name: seoTitle.value,
    description: seoDescription.value,
    items: areaItems.value.map((item) => ({
      name: t(`world.${item.key}.name`),
      path: `/${item.slug}`,
    })),
  }),
);

useHead(() => ({
  title: seoTitle.value,
  script: noIndex ? [] : [
    {
      key: "home-collection-schema",
      type: "application/ld+json",
      innerHTML: JSON.stringify(homeCollectionSchema.value),
    },
  ],
}));
// Social metadata is still useful on noindex staging previews.
useSeoMeta({
  description: () => seoDescription.value,
  ogUrl: () => `${siteUrl.value}/`,
  ogImage: () => `${siteUrl.value}/brand/social-preview.png`,
  ogImageAlt: "ePlus OnAir — Live radio from around the world",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: "image/png",
  twitterCard: "summary_large_image",
  twitterImage: () => `${siteUrl.value}/brand/social-preview.png`,
  twitterImageAlt: "ePlus OnAir — Live radio from around the world",
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
});

const playFeatured = (station: RadioStationOption): void => {
  const selected = featuredEntries.value.find(entry => `/${entry.path}` === station.url);
  if (!selected) return;

  // The featured-card button controls the existing player. Never restart
  // an already-playing stream just to pause it.
  if (playback.station?.url === station.url && playback.station.sources.length) {
    if (playback.playing || playback.waiting) playback.pauseRequest += 1;
    else playback.requestStation(station.url);
    return;
  }

  const { area, country, id, meta } = selected;
  playback.activate(createPlaybackStation({
    area, country, id, meta,
    corsServer: String(runtimeConfig.public.corsServer || ''),
    placeholder: String(runtimeConfig.public.placeholderStation),
  }), featuredStations.value, { autoplay: true });
};

watch(featuredCatalogs, () => {
  // Prerendering must not serialize a default radio into Pinia: the restore
  // composable cannot apply the saved station when onlyIfIdle finds it busy.
  if (import.meta.server) return;
  listening.hydrate();
  // The user's last selection wins over the homepage's featured fallback.
  // PlayerSession restores its current stream without starting playback.
  if (listening.library.lastStation) return;
  const first = featuredEntries.value[0];
  if (!first) return;
  playback.activate(createPlaybackStation({
    area: first.area, country: first.country, id: first.id, meta: first.meta,
    corsServer: String(runtimeConfig.public.corsServer || ''),
    placeholder: String(runtimeConfig.public.placeholderStation),
  }), featuredStations.value, { onlyIfIdle: true });
}, { immediate: true });
</script>

