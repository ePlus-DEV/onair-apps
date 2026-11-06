<template>
  <div class="space-y-6">
    <Breadcrumbs :area="area" />

    <section
      class="radio-surface relative overflow-hidden rounded-[2rem] px-5 py-7 sm:px-8"
    >
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.10),transparent_42%)]"></div>
      <div class="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">
            {{ $t("panel.country") }}
          </p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-[var(--radio-text)] sm:text-4xl">
            {{ areaName }}
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-[var(--radio-text-muted)]">
            {{ seoDescription }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <span class="inline-flex items-center rounded-full h-9 border-0 bg-[var(--radio-surface-soft)] px-4 text-sm font-semibold tabular-nums text-[var(--radio-text-muted)]">
            {{ countryCount }} countries
          </span>
        </div>
      </div>
    </section>

    <PanelRadio :chooseTheArea="area.replace('-', '_')" />
  </div>
</template>

<script setup lang="ts">
import worldData from "~/data/world";
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
} from "~/utils/seo-structured-data.mjs";

const { t } = useI18n();
const route = useRoute();
const config = useRuntimeConfig();
const noIndex = Boolean(config.public.noIndex);
const siteUrl = computed(() =>
  String(config.public.siteUrl).replace(/\/$/, ""),
);
const area = computed(() => String(route.params.area || ""));
const areaKey = computed(() => area.value.replace(/-/g, "_"));
const i18n = computed(() => `world.${areaKey.value}.name`);
const areaName = computed(() => t(i18n.value));
const areaCountries = computed(
  () =>
    (worldData as Record<string, Record<string, { name: string }>>)[
      areaKey.value
    ] || {},
);

if (!Object.prototype.hasOwnProperty.call(worldData, areaKey.value)) {
  throw createError({
    statusCode: 404,
    statusMessage: "Radio region not found",
  });
}
const countryCount = computed(() => Object.keys(areaCountries.value).length);

const seoTitle = computed(() => t("seo.country_title", { country: areaName.value }));
const seoDescription = computed(
  () =>
    t("seo.country_description_empty", { country: areaName.value }),
);

const areaPath = computed(() => `/${area.value}`);
const areaUrl = computed(() => `${siteUrl.value}${areaPath.value}`);
const areaBreadcrumbSchema = computed(() =>
  buildBreadcrumbSchema(siteUrl.value, [
    { name: t("seo.home_breadcrumb"), path: "/" },
    { name: areaName.value, path: areaPath.value },
  ]),
);
const areaCollectionSchema = computed(() =>
  buildCollectionPageSchema({
    siteUrl: siteUrl.value,
    path: areaPath.value,
    name: seoTitle.value,
    description: seoDescription.value,
    items: Object.entries(areaCountries.value).map(([countrySlug, country]) => ({
      name: t(country.name),
      path: `${areaPath.value}/${countrySlug}`,
    })),
  }),
);

useHead(() => ({
  title: seoTitle.value,
  script: noIndex ? [] : [
    {
      key: "area-breadcrumb-schema",
      type: "application/ld+json",
      innerHTML: JSON.stringify(areaBreadcrumbSchema.value),
    },
    {
      key: "area-collection-schema",
      type: "application/ld+json",
      innerHTML: JSON.stringify(areaCollectionSchema.value),
    },
  ],
}));
// Share cards are public on staging while robots noindex remains global.
useSeoMeta(() => ({
  description: seoDescription.value,
  ogTitle: seoTitle.value,
  ogDescription: seoDescription.value,
  ogUrl: areaUrl.value,
  ogImage: `${siteUrl.value}/brand/social-preview.png`,
  ogImageAlt: "ePlus OnAir — Live radio from around the world",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: "image/png",
  twitterCard: "summary_large_image",
  twitterImage: `${siteUrl.value}/brand/social-preview.png`,
  twitterImageAlt: "ePlus OnAir — Live radio from around the world",
  twitterTitle: seoTitle.value,
  twitterDescription: seoDescription.value,
}));
</script>
