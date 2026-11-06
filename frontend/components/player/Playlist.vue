<template>
  <section v-if="playlist !== undefined && playlist.length > 0" class="border-t border-[var(--radio-border)]">
    <div class="flex items-center justify-between px-4 py-3 sm:px-6">
      <h3 class="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--radio-text)]">
        {{ $t("panel.playlist") }}
      </h3>
      <span class="text-xs text-[var(--radio-text-muted)]">{{ playlist.length }}</span>
    </div>

    <div class="radio-scrollbar max-h-60 overflow-y-auto px-3 pb-3 sm:px-4">
      <div
        v-for="(item, index) in playlist"
        :key="index"
        class="flex min-w-0 items-center gap-3 border-t border-[var(--radio-border)] px-2 py-3 first:border-t-0"
        :class="index === 0 ? 'rounded-xl bg-[var(--radio-hover)]' : ''"
      >
        <div class="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[var(--radio-surface-soft)]">
          <img
            loading="lazy"
            class="h-full w-full object-cover"
            :alt="item.track_title + ' - ' + item.track_artist"
            :src="siteAssetUrl(item.track_image !== '' ? item.track_image : thumb)"
          />
          <span
            v-if="index === 0"
            class="absolute inset-x-0 bottom-0 h-1 bg-rose-500"
          ></span>
        </div>

        <div class="min-w-0 flex-1">
          <p dir="auto" class="truncate text-sm font-medium text-[var(--radio-text)]">
            {{ item.track_title }}
          </p>
          <p dir="auto" class="mt-0.5 truncate text-xs text-[var(--radio-text-muted)]">
            {{ item.track_artist }}
          </p>
        </div>

        <span v-if="index === 0" class="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-rose-500">
          {{ $t("player.live") }}
        </span>
        <span v-else class="shrink-0 text-xs text-[var(--radio-text-muted)]">
          {{ dayjs.unix(item.track_played).fromNow() }}
        </span>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
const dayjs = useDayjs();

interface PlaylistItem {
  track_title: string;
  track_artist: string;
  track_image: string;
  track_played: number;
}

defineProps<{
  playlist: PlaylistItem[];
  thumb: string;
}>();
const siteAssetUrl = useSiteAssetUrl();
</script>
