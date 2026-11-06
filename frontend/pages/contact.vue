<template>
  <div class="space-y-6">
    <SitePageHero
      :eyebrow="t('site_pages.contact.eyebrow')"
      :title="title"
      :description="description"
    />

    <section class="grid gap-4 md:grid-cols-3">
      <article
        v-for="section in sections"
        :key="section"
        class="radio-surface rounded-3xl p-5 sm:p-6"
      >
        <h2 class="text-lg font-semibold text-[var(--radio-text)]">
          {{ t("site_pages.contact.sections." + section + ".title") }}
        </h2>
        <p class="mt-3 text-sm leading-7 text-[var(--radio-text-muted)]">
          {{ t("site_pages.contact.sections." + section + ".body") }}
        </p>
      </article>
    </section>

    <section class="radio-surface rounded-3xl p-5 sm:p-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-[var(--radio-text)]">
            {{ t("site_pages.contact.support.title") }}
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-[var(--radio-text-muted)]">
            {{ t("site_pages.contact.support.body") }}
          </p>
        </div>
        <a
          href="mailto:support@eplus.dev?subject=ePlus%20OnAir%20support"
          class="radio-interactive inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white hover:bg-rose-600"
        >
          {{ t("site_pages.contact.support.action") }}
        </a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
const title = computed(() => t("site_pages.contact.title"));
const description = computed(() => t("site_pages.contact.description"));
const sections = ["bug", "station", "copyright"] as const;

useStaticPageSeo({
  title,
  description,
  type: "ContactPage",
});
</script>
