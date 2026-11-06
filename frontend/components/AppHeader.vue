<template>
  <header class="fixed inset-x-0 top-0 z-50 border-b border-[var(--radio-border)] bg-[var(--radio-header-bg)] backdrop-blur-xl">
    <nav class="mx-auto flex h-16 max-w-[1920px] items-center gap-2 px-4 sm:h-20 sm:gap-5 sm:px-6">
      <NuxtLink to="/" class="radio-interactive flex shrink-0 items-center gap-2 rounded-xl xl:w-56">
        <img  :src="siteAssetUrl('/brand/logo-share.png')" width="36" height="36" alt="ePlus OnAir" class="h-9 w-9 rounded-lg object-contain" />
        <span class="hidden sm:block"><span class="block text-base font-bold">ePlus <span class="text-rose-500">OnAir</span></span><span class="block text-[10px] text-rose-500">{{ $t('brand.slogan') }}</span></span>
      </NuxtLink>
      <SearchBox ref="headerSearch" inline :autofocus="false" class="hidden min-w-0 flex-1 sm:block sm:max-w-2xl" @close="closeSearch" />
      <button type="button" class="radio-interactive flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3 text-left text-[var(--radio-text-muted)] sm:hidden" :aria-label="$t('popup.search.text')" @click="openSearch">
        <UIcon name="i-lucide-search" class="h-5 w-5 shrink-0" /><span class="truncate text-sm">{{ $t('popup.search.text') }}</span><kbd class="ml-auto hidden text-xs sm:block">/</kbd>
      </button>
      <div class="ml-auto flex shrink-0 items-center gap-1"><ThemeDarkMode /><LangSwitcher />
        <UButton to="/settings" color="neutral" variant="ghost" icon="i-lucide-settings-2" class="hidden h-11 w-11 justify-center sm:inline-flex" :aria-label="$t('listener_settings.title')" :title="$t('listener_settings.title')" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-menu" class="hidden h-11 w-11 justify-center sm:flex xl:hidden" :aria-label="$t('redesign.navigation')" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen" />
      </div>
    </nav>
  </header>
  <USlideover v-model:open="mobileOpen" side="left" :title="$t('navmenu.more')" :ui="{ content: 'w-80', body: 'p-3 sm:p-3' }"><template #body><AppSidebar mobile /></template></USlideover>
  <UModal v-model:open="searchOpen" :title="$t('popup.search.text')" :description="$t('popup.search.popular_channels')" :ui="{ content: 'max-w-2xl' }"><template #content><SearchBox @close="closeSearch" /></template></UModal>
</template>

<script lang="ts" setup>
const route = useRoute();
const searchOpen = ref(false);
// The bottom More tab and tablet Header hamburger control the same drawer.
const mobileOpen = useState<boolean>('radio:mobile-navigation-open', () => false);
const headerSearch = useTemplateRef("headerSearch");

const openSearch = (): void => {
  mobileOpen.value = false;
  if (import.meta.client && window.matchMedia("(min-width: 640px)").matches) {
    headerSearch.value?.focus?.();
    return;
  }
  searchOpen.value = true;
};

const closeSearch = (): void => {
  searchOpen.value = false;
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    closeSearch();
    mobileOpen.value = false;
    return;
  }

  if (
    event.key === "/" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !(event.target instanceof HTMLInputElement) &&
    !(event.target instanceof HTMLTextAreaElement) &&
    !(event.target instanceof HTMLElement && event.target.isContentEditable)
  ) {
    event.preventDefault();
    openSearch();
  }
};

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
    searchOpen.value = false;
  },
);

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("radio:open-search", openSearch);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("radio:open-search", openSearch);
});
const siteAssetUrl = useSiteAssetUrl();
</script>

