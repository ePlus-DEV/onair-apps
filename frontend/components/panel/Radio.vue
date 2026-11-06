<template>
  <div class="space-y-6">
    <div v-if="loading" class="space-y-6">
      <section
        v-for="i in chooseTheArea ? 1 : 3"
        :key="i"
        class="radio-surface overflow-hidden"
      >
        <div class="flex items-center justify-between border-b border-[var(--radio-border)] px-4 py-4  sm:px-5">
          <div class="h-5 w-36 animate-pulse rounded-full bg-[var(--radio-border-strong)]"></div>
          <div class="h-4 w-12 animate-pulse rounded-full bg-[var(--radio-surface-soft)]"></div>
        </div>
        <div class="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-4 sm:p-4 lg:grid-cols-4 2xl:grid-cols-5">
          <div
            v-for="n in 12"
            :key="n"
            class="aspect-[7/4] animate-pulse rounded-2xl bg-[var(--radio-surface-soft)] sm:aspect-[5/4] lg:aspect-square"
          ></div>
        </div>
      </section>
    </div>

    <section
      v-for="(continent, continentIndex) in world"
      :key="continentIndex"
      class="radio-surface overflow-hidden"
      :class="compact ? 'radio-country-compact' : ''"
    >
      <div
        class="flex items-center justify-between gap-3 border-b border-[var(--radio-border)] px-4 py-4  sm:px-5"
      >
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">
            {{ $t("panel.country") }}
          </p>
          <h2 class="mt-1 truncate text-lg font-semibold tracking-tight text-[var(--radio-text)] sm:text-xl">
            {{ $t(`world.${continentIndex}.name`) }}
          </h2>
        </div>
        <span
          class="radio-count-badge inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold"
        >
          {{ continent.length }}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-4 sm:p-4 lg:grid-cols-4 2xl:grid-cols-5">
        <UTooltip
          v-for="country in continent"
          :key="country.url"
          :text="$t(country.name)"
        >
          <NuxtLink
            :prefetch="false"
            :to="country.url"
            class="radio-station-card group min-w-0 overflow-hidden rounded-2xl border transition duration-200 hover:-translate-y-1 hover:border-rose-400/40 hover:shadow-xl hover:shadow-slate-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            :aria-label="$t(country.name)"
          >
            <div class="radio-themed-artwork relative flex aspect-[7/4] items-center justify-center overflow-hidden p-3 sm:aspect-[5/4] sm:p-4 lg:aspect-square">
              <img
                loading="lazy"
                decoding="async"
                :src="siteAssetUrl(country.flag)"
                :alt="$t(country.name)"
                class="max-h-[72%] max-w-[82%] object-contain drop-shadow-sm transition duration-300 group-hover:scale-[1.08]"
              />
              <span
                v-if="country.station_count !== null"
                class="absolute right-2 top-2 rounded-full bg-[var(--radio-inverse-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--radio-inverse-text)] opacity-90 backdrop-blur"
              >
                {{ country.station_count }}
              </span>
            </div>

            <div class="flex min-w-0 items-center gap-2 border-t border-[var(--radio-border)] px-3 py-2.5 sm:py-3">
              <span class="min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--radio-text)]">
                <CountryMarquee :text="$t(country.name)" />
              </span>
              <span v-if="compact && country.station_count !== null" class="radio-count-badge shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium">{{ country.station_count }}</span>
              <fa
                v-if="!compact"
                :icon="['fas', 'arrow-right']"
                class="h-3 w-3 shrink-0 -translate-x-1 text-[var(--radio-text-muted)] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 "
              />
            </div>
          </NuxtLink>
        </UTooltip>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import worldData from "~/data/world";

const props = defineProps<{
  chooseTheArea?: string;
  compact?: boolean;
}>();

interface Country {
  name: string;
  url: string;
  flag: string;
  station_count: number | null;
  category: string;
}

interface GroupedResults {
  [key: string]: Country[];
}

interface WorldCountry {
  name: string;
  flag: string;
}

const config = useRuntimeConfig();
const countryCounts = config.public.radioCatalogStats.byCountry as Record<string, number>;

const selectedArea = computed(() =>
  props.chooseTheArea?.replace(/-/g, "_"),
);

const createLocalWorld = (): GroupedResults => {
  const grouped: GroupedResults = {};

  for (const [areaKey, countries] of Object.entries(worldData)) {
    if (selectedArea.value && areaKey !== selectedArea.value) continue;

    const areaSlug = areaKey.replace(/_/g, "-");
    grouped[areaKey] = Object.entries(countries).map(
      ([countrySlug, source]) => {
        const country = source as WorldCountry;
        return {
          name: country.name,
          flag: country.flag,
          url: `/${areaSlug}/${countrySlug}`,
          station_count: countryCounts[`/${areaSlug}/${countrySlug}`] ?? null,
          category: areaKey,
        };
      },
    );
  }

  return grouped;
};

const world = computed<GroupedResults>(createLocalWorld);
const loading = computed(() => Object.keys(world.value).length === 0);

const siteAssetUrl = useSiteAssetUrl();
</script>
