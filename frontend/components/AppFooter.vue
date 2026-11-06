<template>
  <footer class="border-t border-[var(--radio-border)] bg-[var(--radio-surface)]">
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div class="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <NuxtLink to="/" class="inline-flex items-center gap-3">
            <span
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-transparent"
            >
              <img
                :src="siteAssetUrl('/brand/logo-share.png')"
                width="28"
                height="28"
                alt="ePlus OnAir"
                class="h-9 w-9 rounded-lg object-contain"
              />
            </span>
            <span>
              <span class="block text-sm font-bold text-[var(--radio-text)]">
                ePlus OnAir
              </span>
              <span class="block text-xs text-[var(--radio-text-muted)]">
                {{ $t('footer.tagline') }}
              </span>
            </span>
          </NuxtLink>

          <p class="mt-4 max-w-lg text-sm leading-6 text-[var(--radio-text-muted)]">
            {{ $t('footer.description') }}
          </p>

          <div class="mt-5 flex items-center gap-2">
            <a
              v-for="socialLink in socialLinks"
              :key="socialLink.id"
              :href="socialLink.href"
              target="_blank"
              rel="external nofollow noopener noreferrer"
              class="radio-interactive flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--radio-border)] text-[var(--radio-text-muted)] hover:bg-[var(--radio-surface-soft)] hover:text-[var(--radio-text)]"
            >
              <span class="sr-only">{{ socialLink.name }}</span>
              <fa :icon="['fab', socialLink.icon]" class="h-4 w-4" />
            </a>
          </div>
        </div>

        <div class="lg:text-right">
          <nav class="flex flex-wrap gap-x-5 gap-y-3 lg:justify-end">
            <NuxtLink
              v-for="link in links"
              :key="link.id"
              :to="link.to"
              class="text-sm font-medium text-[var(--radio-text-muted)] transition hover:text-[var(--radio-text)]"
            >
              {{ $t(link.text) }}
            </NuxtLink>
            <a
              href="https://old-radio.eplus.dev"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm font-medium text-[var(--radio-text-muted)] transition hover:text-[var(--radio-text)]"
            >
              {{ $t("navmenu.old_version") }}
            </a>
          </nav>

          <p class="mt-5 text-xs leading-5 text-[var(--radio-text-muted)]">
            © {{ new Date().getFullYear() }}
            <a
              :href="config.public.copyright"
              target="_blank"
              rel="external nofollow noopener noreferrer"
              class="font-medium text-[var(--radio-text-muted)] hover:text-[var(--radio-text)]"
            >
              ePlus.DEV
            </a>
          </p>
        </div>
      </div>
    </div>

    <button
      v-show="showTop"
      type="button"
      class="radio-themed-elevated fixed bottom-[calc(var(--radio-player-height)+var(--radio-mobile-nav-height)+env(safe-area-inset-bottom)+0.75rem)] right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--radio-border)] text-[var(--radio-text-muted)] shadow-lg shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-[var(--radio-hover)] hover:text-[var(--radio-text)] sm:right-5"
      :aria-label="$t('button.back')"
      @click="scrollToTop"
    >
      <svg
        viewBox="0 0 24 24"
        class="h-4 w-4 fill-none stroke-current"
        aria-hidden="true"
      >
        <path
          d="m6 10 6-6 6 6M12 4v16"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </footer>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const showTop = ref(false);

const links = [
  { id: 1, to: "/about", text: "navmenu.about" },
  { id: 2, to: "/statistics", text: "navmenu.statistics" },
  { id: 3, to: "/contact", text: "navmenu.contact" },
  { id: 4, to: "/privacy-policy", text: "navmenu.privacy" },
  { id: 5, to: "/terms-of-use", text: "navmenu.terms" },
  { id: 6, to: "/cookie-policy", text: "navmenu.cookie" },
];

const socialLinks = computed(() => [
  {
    id: 1,
    name: "Facebook",
    href: config.public.facebook,
    icon: "facebook-f",
  },
  {
    id: 2,
    name: "X",
    href: config.public.x,
    icon: "x-twitter",
  },
]);

const handleScroll = (): void => {
  showTop.value = window.scrollY > 500;
};

const scrollToTop = (): void => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", handleScroll);
});
const siteAssetUrl = useSiteAssetUrl();
</script>

