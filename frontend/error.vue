<template>
  <main
    class="min-h-screen bg-[var(--radio-page-bg)] px-4 py-10 text-[var(--radio-text)] sm:px-6"
  >
    <div class="mx-auto flex min-h-[75vh] max-w-3xl items-center justify-center">
      <section class="radio-surface w-full rounded-[2rem] p-6 text-center sm:p-10">
        <NuxtLink
          to="/"
          class="mx-auto inline-flex items-center gap-3"
          @click.prevent="goHome"
        >
          <span
            class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--radio-inverse-bg)]"
          >
            <img
              :src="siteAssetUrl('/brand/logo-share.png')"
              width="32"
              height="32"
              alt="ePlus OnAir"
              class="h-8 w-8 rounded-lg object-contain"
            />
          </span>
          <span class="text-left">
            <span class="block text-sm font-bold">ePlus OnAir</span>
            <span class="block text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-500">
              {{ t("brand.slogan") }}
            </span>
          </span>
        </NuxtLink>

        <p class="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-rose-500">
          {{ statusCode }}
        </p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {{ heading }}
        </h1>
        <p class="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--radio-text-muted)]">
          {{ message }}
        </p>

        <div class="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            class="radio-interactive inline-flex h-11 items-center justify-center rounded-xl bg-rose-500 px-5 text-sm font-semibold text-white hover:bg-rose-600"
            @click="goHome"
          >
            {{ t("navmenu.homepage") }}
          </button>
          <NuxtLink
            to="/statistics"
            class="radio-interactive inline-flex h-11 items-center justify-center rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-5 text-sm font-semibold text-[var(--radio-text)] hover:bg-[var(--radio-hover)]"
          >
            {{ t("navmenu.statistics") }}
          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
interface NuxtErrorLike {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
}

const props = defineProps<{
  error: NuxtErrorLike;
}>();

const { t } = useI18n();
const siteAssetUrl = useSiteAssetUrl();
const statusCode = computed(() => props.error?.statusCode || 500);
const isNotFound = computed(() => statusCode.value === 404);
const heading = computed(() =>
  isNotFound.value
    ? t("site_pages.error.not_found_title")
    : t("site_pages.error.generic_title"),
);
const message = computed(() =>
  isNotFound.value
    ? t("404.content")
    : props.error?.statusMessage ||
      props.error?.message ||
      t("site_pages.error.generic_body"),
);

useHead(() => ({
  title: heading.value,
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));

const goHome = async (): Promise<void> => {
  await clearError({ redirect: "/" });
};
</script>
