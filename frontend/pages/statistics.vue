<template>
  <div class="space-y-6">
    <SitePageHero
      :eyebrow="t('site_pages.statistics.eyebrow')"
      :title="title"
      :description="description"
    />

    <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <article
        v-for="metric in metrics"
        :key="metric.key"
        class="radio-surface rounded-3xl p-5 sm:p-6"
      >
        <p class="text-xs font-semibold text-[var(--radio-text-muted)]">
          {{ t("site_pages.statistics.metrics." + metric.key) }}
        </p>
        <p class="mt-2 text-3xl font-bold tracking-tight text-[var(--radio-text)]">
          {{ metric.value.toLocaleString() }}
        </p>
      </article>
    </section>

    <section class="radio-surface overflow-hidden rounded-3xl">
      <div class="border-b border-[var(--radio-border)] px-5 py-5 sm:px-6">
        <h2 class="text-lg font-semibold text-[var(--radio-text)]">
          {{ t("site_pages.statistics.coverage_title") }}
        </h2>
        <p class="mt-2 text-sm leading-6 text-[var(--radio-text-muted)]">
          {{ t("site_pages.statistics.coverage_description") }}
        </p>
      </div>

      <div class="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <NuxtLink
          v-for="area in stats.byArea"
          :key="area.slug"
          :to="'/' + area.slug"
          class="radio-themed-soft group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-rose-300"
        >
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-[var(--radio-text)]">
              {{ t("world." + area.slug.replace(/-/g, "_") + ".name") }}
            </h3>
            <span class="text-rose-500 transition group-hover:translate-x-0.5">
              →
            </span>
          </div>
          <div class="mt-4 flex gap-4 text-xs text-[var(--radio-text-muted)]">
            <span>
              <strong class="text-[var(--radio-text)]">{{ area.countries }}</strong>
              {{ t("site_pages.statistics.metrics.countries").toLowerCase() }}
            </span>
            <span>
              <strong class="text-[var(--radio-text)]">{{ area.stations.toLocaleString() }}</strong>
              {{ t("site_pages.statistics.metrics.stations").toLowerCase() }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section class="radio-surface rounded-3xl p-5 sm:p-6">
      <h2 class="text-lg font-semibold text-[var(--radio-text)]">
        {{ t("site_pages.statistics.method_title") }}
      </h2>
      <p class="mt-3 max-w-3xl text-sm leading-7 text-[var(--radio-text-muted)]">
        {{ t("site_pages.statistics.method_body") }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
interface AreaStats {
  slug: string;
  countries: number;
  stations: number;
}

interface CatalogStats {
  areas: number;
  countries: number;
  stations: number;
  byArea: AreaStats[];
}

const { t } = useI18n();
const config = useRuntimeConfig();
const title = computed(() => t("site_pages.statistics.title"));
const description = computed(() => t("site_pages.statistics.description"));
const stats = computed(
  () => config.public.radioCatalogStats as unknown as CatalogStats,
);
const metrics = computed(() => [
  { key: "areas", value: stats.value.areas },
  { key: "countries", value: stats.value.countries },
  { key: "stations", value: stats.value.stations },
]);

useStaticPageSeo({ title, description });
</script>
