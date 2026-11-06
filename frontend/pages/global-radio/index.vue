<template>
  <div class="space-y-6 sm:space-y-8">
    <header class="radio-hero rounded-2xl p-5 sm:p-8">
      <p class="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">
        <UIcon name="i-lucide-globe-2" class="h-4 w-4" aria-hidden="true" />
        {{ t('global_radio.eyebrow') }}
      </p>
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ title }}</h1>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-[var(--radio-text-muted)]">{{ description }}</p>
      <NuxtLink to="/#explore-radio" class="mt-4 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300">
        <UIcon name="i-lucide-map-pin" class="h-4 w-4" aria-hidden="true" />{{ t('global_radio.by_country') }}
      </NuxtLink>
    </header>

    <section :aria-label="t('global_radio.providers')" class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <h2 class="text-lg font-bold">{{ t('global_radio.providers') }}</h2>
        <span class="text-xs text-[var(--radio-text-muted)]">{{ providers.length }} {{ t('global_radio.provider_count') }}</span>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <NuxtLink v-for="provider in providers" :key="provider.id" :to="provider.href"
          class="radio-surface radio-interactive group flex min-w-0 flex-col gap-4 rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500">
          <div class="flex items-center justify-between gap-3">
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <UIcon name="i-lucide-radio-tower" class="h-6 w-6" aria-hidden="true" />
            </span>
            <span class="rounded-full border border-[var(--radio-border)] px-2.5 py-1 text-[11px] text-[var(--radio-text-muted)]">{{ t('global_radio.external_badge') }}</span>
          </div>
          <div>
            <h3 class="text-base font-bold">{{ provider.name }}</h3>
            <p class="mt-1 text-sm leading-6 text-[var(--radio-text-muted)]">{{ t('global_radio.apple_description') }}</p>
          </div>
          <span class="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300">
            {{ t('global_radio.explore_provider') }} <UIcon name="i-lucide-arrow-right" class="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </NuxtLink>
      </div>
    </section>
    <p class="text-xs leading-5 text-[var(--radio-text-muted)]">{{ t('global_radio.external_note') }}</p>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
const title = computed(() => t('global_radio.title'));
const description = computed(() => t('global_radio.description'));
const { data } = await useGlobalProviders();
const providers = computed(() => data.value?.providers || []);
useStaticPageSeo({ title, description });
</script>
