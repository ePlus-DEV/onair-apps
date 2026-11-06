<template>
  <div>
    <div class="block" v-for="item in result" :key="item.objectID || item.url">
      <nuxt-link
        :to="item.url"
        class="radio-search-panel-row flex items-center gap-3 rounded-2xl px-3 py-3 transition focus:outline-none focus:ring-2 focus:ring-rose-400/40"
        :class="elevated ? 'bg-[var(--radio-surface-soft)]' : 'hover:bg-[var(--radio-hover)]'"
        @click="$emit('select', item.station_name)"
      >
        <img
          loading="lazy" decoding="async" width="44" height="44"
          class="radio-themed-artwork h-11 w-11 shrink-0 rounded-xl object-contain p-1 ring-1 ring-[var(--radio-border)]"
          :src="siteAssetUrl(item.station_image || '/brand/onair-mark.svg')"
          :alt="item.station_name"
        />
        <span dir="auto" class="min-w-0 flex-1 truncate text-sm font-medium text-[var(--radio-text)]">
          {{ item.station_name }}
        </span>
        <span class="hidden shrink-0 text-xs text-[var(--radio-text-muted)] sm:block">
          {{ item.station_country ? $t(item.station_country) : '' }}
        </span>
      </nuxt-link>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (event: "select", value?: string): void;
}>();

defineProps({
  result: {
    type: Array,
    default: () => [],
  },
  elevated: {
    type: Boolean,
    default: false,
  },
});
const siteAssetUrl = useSiteAssetUrl();
</script>
