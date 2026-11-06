<template>
  <div class="space-y-6">
    <Breadcrumbs
      :area="area"
      :level_1="i18n"
      :level_1_slug="slug"
    />

    <section class="radio-surface relative overflow-hidden px-5 py-6 sm:px-7">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.10),transparent_42%)]"></div>
      <div class="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div class="radio-themed-artwork flex h-20 w-24 shrink-0 items-center justify-center rounded-2xl border border-[var(--radio-border)] p-3 sm:h-24 sm:w-28">
          <img
            :src="countryFlag"
            :alt="countryName"
            class="max-h-full max-w-full object-contain"
          />
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">
            {{ $t("panel.radio_in", { name: countryName }) }}
          </p>
          <h1 class="mt-1 line-clamp-2 text-2xl font-bold tracking-tight text-[var(--radio-text)] sm:text-3xl">
            {{ countryName }}
          </h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-[var(--radio-text-muted)]">
            {{ seoDescription }}
          </p>
          <p
            v-if="stationCount"
            class="mt-2 text-xs font-medium tabular-nums text-[var(--radio-text-muted)]"
          >
            {{ $t("panel.station_count", { count: stationCount }) }}
          </p>
        </div>
      </div>
      <UButton icon="i-lucide-play" size="lg" class="relative mt-5 rounded-full px-5" :disabled="!defaultStationId" @click="listenDefault(true)">{{ $t('player.listen_country') }}</UButton>
    </section>

    <PanelStation
      @select-station="playSelected"
      :stations="stations"
      :active-station-id="activeStationId"
      :country-name="countryName"
    />
  </div>
</template>

<script setup lang="ts">
import type { RadioCatalogEntry as Channel, RadioStationOption } from "~/types/radio";
import { usePlaybackStore } from "~/stores/playback";
import { useListeningStore } from "~/stores/listening";
import { createPlaybackStation } from "~/utils/playback-station.mjs";
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
} from "~/utils/seo-structured-data.mjs";

interface CountryCatalogPayload {
  key: string;
  stations: Record<string, Channel>;
}

const siteAssetUrl = useSiteAssetUrl();
const playback = usePlaybackStore();
const listening = useListeningStore();
const { t } = useI18n();
const runtimeConfig = useRuntimeConfig();
const noIndex = Boolean(runtimeConfig.public.noIndex);
const route = useRoute();

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || "" : value || "";

const slug = computed(() => normalizeParam(route.params.country));
const country = computed(() => slug.value.replace(/-/g, "_"));
const area = computed(() => normalizeParam(route.params.area));
const i18n = computed(
  () => `world.${area.value.replace(/-/g, "_")}.${country.value}`,
);
const countryName = computed(() => t(i18n.value));
const countryFlag = computed(
  () => siteAssetUrl(`/img/${area.value}/flags/${slug.value}.png`),
);
const siteUrl = computed(() =>
  String(runtimeConfig.public.siteUrl).replace(/\/$/, ""),
);
const countryPath = computed(() => `/${area.value}/${slug.value}`);
const countryUrl = computed(() => `${siteUrl.value}${countryPath.value}`);
const countryImage = computed(() => `${siteUrl.value}${countryFlag.value}`);

const catalogUrl = computed(
  () => siteAssetUrl(`/radio/${area.value}/${slug.value}.json`),
);
const catalogKey = computed(
  () => `country-catalog:${area.value}:${slug.value}`,
);

const { data: catalogPayload, error: catalogError } =
  await useAsyncData<CountryCatalogPayload>(
  catalogKey,
  async () => {
    const key = catalogKey.value;

    try {
      let data: Record<string, Channel>;

      if (import.meta.server) {
        const [{ readFile }, { join }] = await Promise.all([
          import("node:fs/promises"),
          import("node:path"),
        ]);
        const file = join(
          process.cwd(),
          "public",
          "radio",
          area.value,
          `${slug.value}.json`,
        );
        data = JSON.parse(await readFile(file, "utf8")) as Record<
          string,
          Channel
        >;
      } else {
        data = await $fetch<Record<string, Channel>>(catalogUrl.value);
      }

      return { key, stations: data };
    } catch {
      throw createError({
        statusCode: 404,
        statusMessage: "Radio country not found",
      });
    }
  },
  {
    default: () => ({ key: "", stations: {} }),
  },
);

if (catalogError.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Radio country not found",
  });
}

const catalog = computed<Record<string, Channel>>(() =>
  catalogPayload.value?.key === catalogKey.value
    ? catalogPayload.value.stations
    : {},
);

const stationEntries = computed(() => Object.entries(catalog.value));
const stations = computed<RadioStationOption[]>(() =>
  stationEntries.value.map(([stationId, channel]) => ({
    id: stationId,
    title: channel.title,
    image:
      channel.features || String(runtimeConfig.public.placeholderStation),
    url: `${countryPath.value}/${stationId}`,
  })),
);
const stationCount = computed(() => stations.value.length);
const defaultStationId = computed(() => {
  const favorite = stationEntries.value.find(([, channel]) => channel.favorite);
  return favorite?.[0] || stationEntries.value[0]?.[0] || "";
});

const activeStationId = computed(() => playback.station?.url.startsWith(`${countryPath.value}/`) ? playback.station.id : '');

const seoTitle = computed(() => t("seo.country_title", { country: countryName.value }));
const seoDescription = computed(() =>
  stationCount.value > 0
    ? t("seo.country_description", { count: stationCount.value, country: countryName.value })
    : t("seo.country_description_empty", { country: countryName.value }),
);
const breadcrumbSchema = computed(() =>
  buildBreadcrumbSchema(siteUrl.value, [
    { name: t("seo.home_breadcrumb"), path: "/" },
    {
      name: t(`world.${area.value.replace(/-/g, "_")}.name`),
      path: `/${area.value}`,
    },
    { name: countryName.value, path: countryPath.value },
  ]),
);
const countryCollectionSchema = computed(() =>
  buildCollectionPageSchema({
    siteUrl: siteUrl.value,
    path: countryPath.value,
    name: seoTitle.value,
    description: seoDescription.value,
    items: stations.value.map((station) => ({
      name: station.title,
      path: station.url || countryPath.value,
    })),
  }),
);

useHead(() => ({
  title: seoTitle.value,
  script: noIndex ? [] : [
    {
      key: "country-breadcrumb-schema",
      type: "application/ld+json",
      innerHTML: JSON.stringify(breadcrumbSchema.value),
    },
    {
      key: "country-collection-schema",
      type: "application/ld+json",
      innerHTML: JSON.stringify(countryCollectionSchema.value),
    },
  ],
}));

// Share cards are public on staging while robots noindex remains global.
useSeoMeta(() => ({
  description: seoDescription.value,
  ogTitle: seoTitle.value,
  ogDescription: seoDescription.value,
  ogUrl: countryUrl.value,
  ogImage: countryImage.value,
  ogImageAlt: `${countryName.value} flag`,
  twitterTitle: seoTitle.value,
  twitterDescription: seoDescription.value,
  twitterCard: "summary_large_image",
  twitterImage: countryImage.value,
  twitterImageAlt: `${countryName.value} flag`,
}));

const listenDefault = (autoplay = false): void => {
  const id = defaultStationId.value;
  const meta = catalog.value[id];
  if (!meta) return;
  playback.activate(createPlaybackStation({
    area: area.value, country: slug.value, id, meta,
    corsServer: String(runtimeConfig.public.corsServer || ''),
    placeholder: String(runtimeConfig.public.placeholderStation),
  }), stations.value, { autoplay, onlyIfIdle: !autoplay });
};

const playSelected = (station: RadioStationOption): void => {
  if (playback.station?.url === station.url && (playback.playing || playback.waiting)) {
    playback.pauseRequest += 1;
    return;
  }
  const meta = catalog.value[station.id];
  if (!meta) return;
  playback.activate(createPlaybackStation({
    area: area.value, country: slug.value, id: station.id, meta,
    corsServer: String(runtimeConfig.public.corsServer || ''),
    placeholder: String(runtimeConfig.public.placeholderStation),
  }), stations.value, { autoplay: true });
};

// A fresh entry can prepare this country's featured station. Browsing another
// country while listening keeps the selected station and its queue intact.
watch(catalog, () => {
  // Browsing a country cannot seed a prerendered default before the client's
  // saved lastStation is restored by PlayerSession.
  if (import.meta.server) return;
  listening.hydrate();
  if (listening.library.lastStation) return;
  listenDefault();
}, { immediate: true });
</script>

