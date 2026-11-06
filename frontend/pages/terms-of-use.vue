<template>
  <div class="space-y-6">
    <SitePageHero
      :eyebrow="t('site_pages.terms.eyebrow')"
      :title="title"
      :description="description"
    />

    <div class="radio-surface rounded-3xl p-5 sm:p-7">
      <p class="text-xs font-medium text-[var(--radio-text-muted)]">
        {{ t("site_pages.common.last_updated") }}: 08/10/2026
      </p>

      <div class="mt-6 divide-y divide-[var(--radio-border)]">
        <section
          v-for="section in sections"
          :key="section"
          class="py-6 first:pt-0 last:pb-0"
        >
          <h2 class="text-lg font-semibold text-[var(--radio-text)]">
            {{ t("site_pages.terms.sections." + section + ".title") }}
          </h2>
          <p class="mt-3 text-sm leading-7 text-[var(--radio-text-muted)]">
            {{ t("site_pages.terms.sections." + section + ".body") }}
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
const title = computed(() => t("site_pages.terms.title"));
const description = computed(() => t("site_pages.terms.description"));
const sections = [
  "service",
  "third_party",
  "copyright",
  "acceptable_use",
  "availability",
  "changes",
] as const;

useStaticPageSeo({ title, description });
</script>
