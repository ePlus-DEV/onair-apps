<template>
  <nav
    aria-label="Breadcrumb"
    class="radio-scrollbar mb-4 flex min-w-0 items-center gap-1 overflow-x-auto py-1 text-xs font-medium text-[var(--radio-text-muted)] sm:mb-5"
  >
    <NuxtLink
      to="/"
      class="radio-interactive flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]"
      :aria-label="$t('navmenu.homepage')"
    >
      <fa :icon="['fas', 'house']" class="h-3 w-3" />
      <span class="hidden sm:inline">{{ $t("navmenu.homepage") }}</span>
    </NuxtLink>

    <template v-for="item in items" :key="item.id">
      <fa
        :icon="['fas', 'chevron-right']"
        class="h-2.5 w-2.5 shrink-0 opacity-40"
        aria-hidden="true"
      />

      <NuxtLink
        v-if="item.to"
        :to="item.to"
        class="radio-interactive shrink-0 rounded-lg px-2 py-1.5 hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]"
      >
        {{ item.label }}
      </NuxtLink>

      <UTooltip v-else :text="item.label">
        <span
          aria-current="page"
          class="block max-w-[220px] shrink-0 truncate rounded-lg px-2 py-1.5 text-[var(--radio-text)] sm:max-w-md"
        >
          {{ item.label }}
        </span>
      </UTooltip>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { buildBreadcrumbItems } from "~/utils/breadcrumbs.mjs";

const props = withDefaults(
  defineProps<{
    area?: string;
    level_1?: string;
    level_1_slug?: string;
    level_2?: string;
  }>(),
  {
    area: "",
    level_1: "",
    level_1_slug: "",
    level_2: "",
  },
);

const { t } = useI18n();

const areaLabel = computed(() =>
  props.area
    ? t(`world.${props.area.replace(/-/g, "_")}.name`)
    : "",
);

const countryLabel = computed(() =>
  props.level_1 ? t(props.level_1) : "",
);

const items = computed(() =>
  buildBreadcrumbItems({
    area: props.area,
    areaLabel: areaLabel.value,
    countrySlug: props.level_1_slug,
    countryLabel: countryLabel.value,
    currentLabel: props.level_2,
  }),
);
</script>
