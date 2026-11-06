<template>
  <div class="space-y-5">
    <nav
      aria-label="Breadcrumb"
      class="flex items-center gap-2 px-1 text-xs font-medium text-[var(--radio-text-muted)]"
    >
      <NuxtLink
        to="/"
        class="transition hover:text-[var(--radio-text)]"
      >
        {{ $t("navmenu.homepage") }}
      </NuxtLink>
      <span aria-hidden="true">/</span>
      <span aria-current="page" class="text-[var(--radio-text)]">
        {{ title }}
      </span>
    </nav>

    <section
      class="radio-surface relative overflow-hidden rounded-[2rem] px-5 py-8 sm:px-8 sm:py-10"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.10),transparent_38%)]"
      ></div>
      <div class="relative max-w-3xl">
        <p
          class="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-500"
        >
          {{ eyebrow }}
        </p>
        <h1
          class="mt-2 text-3xl font-bold tracking-tight text-[var(--radio-text)] sm:text-4xl"
        >
          {{ title }}
        </h1>
        <p
          class="mt-4 max-w-2xl text-sm leading-7 text-[var(--radio-text-muted)] sm:text-base"
        >
          {{ description }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  description: string;
}>();
</script>
