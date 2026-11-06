<template>
  <div class="radio-library-page space-y-4 sm:space-y-5">
    <header class="flex items-center gap-3">
      <span class="library-title-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" aria-hidden="true">
        <UIcon name="i-lucide-chart-no-axes-column-increasing" class="h-6 w-6" />
      </span>
      <div class="min-w-0">
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">{{ $t('redesign.library') }}</h1>
        <p class="mt-1 text-xs leading-5 text-[var(--radio-text-muted)] sm:text-sm">{{ $t('redesign.library_description') }}</p>
      </div>
    </header>

    <!-- These are real URL links, not controlled UTabs buttons:
         navigation history and deep links must remain first-class. -->
    <nav class="radio-library-tabs rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] p-1"
      :aria-label="$t('redesign.library')">
      <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <NuxtLink v-for="tab in tabs" :key="tab.value" :to="libraryTabHref(tab.value)" custom v-slot="{ href, navigate }">
          <!-- Vue Router's automatic isExactActive ignores hashes. Render the
               anchor ourselves so aria-current reflects the actual panel. -->
          <a
            :href="href"
            :title="tab.label"
            :aria-current="clientReady && active === tab.value ? 'location' : undefined"
            class="radio-interactive library-tab flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-center text-xs font-semibold motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 sm:text-sm"
            :class="clientReady && active === tab.value
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-950/15 dark:bg-rose-600'
              : 'text-[var(--radio-text-muted)] hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)]'"
            @click="navigate"
          >
            <UIcon :name="tab.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span class="min-w-0 truncate">{{ tab.label }}</span>
          </a>
        </NuxtLink>
      </div>
    </nav>

    <ClientOnly>
      <PanelFavoritesTransfer v-if="active === 'all' || active === 'favorites'" />
      <PanelListeningStats v-if="active === 'stats'" />
      <PanelListeningLibrary v-else :group="active" />
      <template #fallback>
        <p class="radio-surface p-5 text-sm text-[var(--radio-text-muted)]">{{ $t('library.loading') }}</p>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { libraryTabFromHash, libraryTabHref } from '~/utils/library-tabs.mjs';

const route = useRoute();
const config = useRuntimeConfig();
const { t } = useI18n();

// URL fragments are unavailable during SSR. Avoid a wrong active highlight
// until hydration, when Vue Router knows the browser's actual hash.
const clientReady = ref(false);
onMounted(() => { clientReady.value = true; });
const active = computed(() => clientReady.value ? libraryTabFromHash(route.hash) : 'all');
const tabs = computed(() => [
  { label: t('redesign.all'), value: 'all', icon: 'i-lucide-library' },
  { label: t('library.favorites'), value: 'favorites', icon: 'i-lucide-heart' },
  { label: t('library.recent'), value: 'recent', icon: 'i-lucide-history' },
  { label: t('library.listening_stats'), value: 'stats', icon: 'i-lucide-chart-no-axes-column-increasing' },
]);
useHead(() => ({ title: t('redesign.library'), meta: [{ name: 'robots', content: config.public.noIndex ? 'noindex, nofollow, noarchive' : 'noindex, follow' }] }));
</script>

<style scoped>
.library-title-icon {
  color: #f43f8e;
  background: rgb(244 63 142 / .12);
}
:global(html.dark) .library-title-icon {
  color: #f472b6;
  background: linear-gradient(140deg, #311c45, #211f41);
  box-shadow: 0 0 24px -17px #f43f8e;
}
:global(html.dark) .radio-library-tabs {
  background: linear-gradient(100deg, #1b223b, #171d34);
  border-color: rgb(148 163 184 / .18);
}
:global(html.dark) .library-tab[aria-current='location'] {
  background: linear-gradient(95deg, #e11d58, #ed205f);
}
</style>
