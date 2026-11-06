<template>
  <aside :class="mobile ? 'block' : 'radio-desktop-sidebar hidden xl:block'" class="min-w-0" :aria-label="$t('sidebar.browse_radio')">
    <div :class="mobile ? 'space-y-6' : 'radio-desktop-sidebar-scroll radio-scrollbar space-y-6'">
      <div class="space-y-1">
        <NuxtLink to="/" class="radio-interactive flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition"
          :class="route.path === '/' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'">
          <fa :icon="['fas', 'house']" class="w-4" />
          <span>{{ $t('redesign.discover') }}</span>
        </NuxtLink>
        <!-- The Library has one primary navigation entry. Its hash-backed panels
             are secondary links, not separate top-level pages. -->
        <div v-if="!mobile" class="space-y-1">
          <button type="button"
            class="radio-interactive flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition"
            :class="route.path === '/library' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'"
            :aria-expanded="libraryOpen"
            :aria-controls="mobile ? 'radio-library-subnav-mobile' : 'radio-library-subnav-desktop'"
            @click="libraryOpen = !libraryOpen">
            <UIcon name="i-lucide-library" class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span class="min-w-0 flex-1">{{ $t('redesign.library') }}</span>
            <UIcon name="i-lucide-chevron-down" class="h-4 w-4 shrink-0 transition-transform"
              :class="libraryOpen ? 'rotate-180' : ''" aria-hidden="true" />
          </button>
          <nav v-show="libraryOpen"
            :id="mobile ? 'radio-library-subnav-mobile' : 'radio-library-subnav-desktop'"
            :aria-label="$t('redesign.library')"
            class="ml-5 space-y-1 border-l border-[var(--radio-border)] pl-3">
            <NuxtLink v-for="section in librarySections" :key="section.value"
              :to="libraryTabHref(section.value)" :prefetch="false"
              class="radio-interactive flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition"
              :aria-current="route.path === '/library' && libraryTabFromHash(route.hash) === section.value ? 'location' : undefined"
              :class="route.path === '/library' && libraryTabFromHash(route.hash) === section.value
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'">
              <UIcon :name="section.icon" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span class="min-w-0 truncate">{{ $t(section.label) }}</span>
            </NuxtLink>
          </nav>
        </div>
        <NuxtLink v-if="!mobile" to="/statistics" class="radio-interactive flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition"
          :class="route.path === '/statistics' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'">
          <fa :icon="['fas', 'chart-simple']" class="w-4" />
          <span>{{ $t('navmenu.statistics') }}</span>
        </NuxtLink>
        <NuxtLink v-if="!mobile" to="/settings" class="radio-interactive flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition"
          :class="route.path === '/settings' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'">
          <UIcon name="i-lucide-settings-2" class="h-4 w-4" />
          <span>{{ $t('listener_settings.title') }}</span>
        </NuxtLink>
        <NuxtLink v-if="!mobile" to="/about" class="radio-interactive flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition"
          :class="route.path === '/about' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'">
          <fa :icon="['fas', 'circle-info']" class="w-4" />
          <span>{{ $t('navmenu.about') }}</span>
        </NuxtLink>
        <button type="button" class="radio-interactive flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-[var(--radio-text-muted)] transition hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]" @click="focusSearch">
          <fa :icon="['fas', 'magnifying-glass']" class="w-4" />
          <span>{{ $t('popup.search.text') }}</span>
        </button>
      </div>
      <!-- Shortcuts to real site pages were unreachable on phones because the
           header hamburger was tablet-only. Keep them high in the mobile drawer,
           and put Settings here rather than replacing the More navigation. -->
      <div v-if="mobile" class="border-t border-[var(--radio-border)] pt-4">
        <p class="mb-2 px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--radio-text-muted)]">{{ $t('navmenu.information') }}</p>
        <nav class="space-y-1" :aria-label="$t('navmenu.information')">
          <NuxtLink v-for="item in informationLinks" :key="item.to" :to="item.to"
            class="radio-interactive flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
            :class="route.path === item.to ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'"
            :aria-current="route.path === item.to ? 'page' : undefined">
            <UIcon :name="item.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ $t(item.label) }}</span>
          </NuxtLink>
          <NuxtLink to="/settings"
            class="radio-interactive mt-2 flex min-h-11 items-center gap-3 rounded-xl border-t border-[var(--radio-border)] px-4 py-2.5 text-sm font-semibold transition"
            :class="route.path === '/settings' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'"
            :aria-current="route.path === '/settings' ? 'page' : undefined">
            <UIcon name="i-lucide-settings-2" class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ $t('listener_settings.title') }}</span>
          </NuxtLink>
        </nav>
      </div>
      <div class="border-t border-[var(--radio-border)] pt-5">
        <p class="mb-3 px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--radio-text-muted)]">{{ $t('player.explore') }}</p>
        <NuxtLink to="/global-radio" :prefetch="false"
          class="radio-interactive mb-4 flex min-h-11 items-center gap-3 rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3 py-2.5 text-sm font-semibold transition hover:border-rose-500"
          :class="route.path.startsWith('/global-radio') ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text)]'"
          :aria-current="route.path === '/global-radio' ? 'page' : undefined">
          <UIcon name="i-lucide-globe-2" class="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
          <span class="min-w-0 flex-1">{{ $t('global_radio.title') }}</span>
          <UIcon name="i-lucide-arrow-up-right" class="h-4 w-4 text-[var(--radio-text-muted)]" aria-hidden="true" />
        </NuxtLink>
        <p class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--radio-text-muted)]">{{ $t('global_radio.by_country') }}</p>
        <nav class="space-y-1" :aria-label="$t('sidebar.radio_regions')">
          <NuxtLink v-for="item in areas" :key="item.slug" :to="`/${item.slug}`"
            class="radio-interactive flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm transition"
            :class="route.path.startsWith(`/${item.slug}`) ? 'bg-rose-500/10 font-semibold text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'">
            <span class="min-w-0 truncate">{{ $t(`world.${item.key}.name`) }}</span>
            <span class="shrink-0 text-[11px] tabular-nums opacity-60">{{ item.count }}</span>
          </NuxtLink>
        </nav>
      </div>
      <div class="hidden rounded-2xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] p-4">
        <div class="mb-2 flex items-center gap-2 text-xs font-semibold text-rose-500">
          <span class="h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden="true"></span>
          <span>{{ $t('sidebar.live_badge') }}</span>
        </div>
        <p class="text-sm leading-6 text-[var(--radio-text-muted)]">{{ $t('sidebar.description') }}</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import worldData from "~/data/world";
import { libraryTabFromHash, libraryTabHref } from '~/utils/library-tabs.mjs';

defineProps<{ mobile?: boolean }>();
const route = useRoute();
const libraryOpen = ref(route.path === '/library');
watch(() => route.path, path => {
  if (path === '/library') libraryOpen.value = true;
});
const librarySections = [
  { value: 'all', label: 'redesign.all', icon: 'i-lucide-layout-grid' },
  { value: 'favorites', label: 'library.favorites', icon: 'i-lucide-heart' },
  { value: 'recent', label: 'library.recent', icon: 'i-lucide-history' },
  { value: 'stats', label: 'library.listening_stats', icon: 'i-lucide-chart-no-axes-column-increasing' },
] as const;
// Only real prerendered routes. Match the established footer links so all
// informational pages remain reachable at phone widths.
const informationLinks = [
  { to: '/about', label: 'navmenu.about', icon: 'i-lucide-info' },
  { to: '/statistics', label: 'navmenu.statistics', icon: 'i-lucide-chart-no-axes-column' },
  { to: '/contact', label: 'navmenu.contact', icon: 'i-lucide-mail' },
  { to: '/privacy-policy', label: 'navmenu.privacy', icon: 'i-lucide-shield-check' },
  { to: '/terms-of-use', label: 'navmenu.terms', icon: 'i-lucide-file-text' },
  { to: '/cookie-policy', label: 'navmenu.cookie', icon: 'i-lucide-cookie' },
] as const;
const areas = Object.entries(worldData).map(([key, countries]) => ({
  key,
  slug: key.replace(/_/g, "-"),
  count: Object.keys(countries).length,
}));
const focusSearch = () => {
  if (!import.meta.client) return;
  window.dispatchEvent(new CustomEvent("radio:open-search"));
};
</script>

