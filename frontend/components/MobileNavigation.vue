<template>
  <nav class="radio-mobile-navigation fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[var(--radio-border)] bg-[var(--radio-surface-elevated)] sm:hidden" :aria-label="$t('redesign.navigation')">
    <NuxtLink to="/" class="radio-mobile-nav-item" :class="route.path === '/' ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)]'" :aria-current="route.path === '/' ? 'page' : undefined">
      <UIcon name="i-lucide-house" class="h-5 w-5" />{{ $t('redesign.discover') }}
    </NuxtLink>
    <button type="button" class="radio-mobile-nav-item text-[var(--radio-text-muted)]" @click="openSearch">
      <UIcon name="i-lucide-search" class="h-5 w-5" />{{ $t('redesign.search') }}
    </button>
    <NuxtLink to="/library" class="radio-mobile-nav-item" :class="route.path === '/library' ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)]'" :aria-current="route.path === '/library' ? 'page' : undefined">
      <UIcon name="i-lucide-library" class="h-5 w-5" />{{ $t('redesign.library') }}
    </NuxtLink>
    <button type="button" class="radio-mobile-nav-item" :class="mobileOpen ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--radio-text-muted)]'"
      :aria-label="$t('navmenu.more')" :aria-expanded="mobileOpen" aria-haspopup="dialog"
      @click="mobileOpen = true">
      <UIcon name="i-lucide-menu" class="h-5 w-5" />{{ $t('navmenu.more') }}
    </button>
  </nav>
</template>
<script setup lang="ts">
const route = useRoute();
const mobileOpen = useState<boolean>('radio:mobile-navigation-open', () => false);
const openSearch = () => window.dispatchEvent(new CustomEvent('radio:open-search'));
</script>
