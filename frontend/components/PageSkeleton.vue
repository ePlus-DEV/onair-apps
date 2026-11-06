<template>
  <section class="radio-page-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">{{ $t("search.loading") }}</span>
    <div aria-hidden="true" class="space-y-6">
      <!-- Homepage: editorial heading, featured stations and country discovery. -->
      <template v-if="variant === 'home'">
        <div class="space-y-3 py-1">
          <div class="radio-skeleton h-3 w-36 rounded-full" />
          <div class="radio-skeleton h-9 w-[min(22rem,80%)] rounded-xl" />
          <div class="radio-skeleton h-4 w-[min(36rem,90%)] rounded-lg" />
          <div class="radio-skeleton h-4 w-[min(28rem,75%)] rounded-lg" />
          <div class="radio-skeleton mt-4 h-8 w-52 rounded-lg" />
        </div>
        <div class="space-y-4">
          <div class="radio-skeleton h-6 w-40 rounded-lg" />
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            <div v-for="i in 5" :key="'featured-' + i" class="radio-skeleton-card radio-surface overflow-hidden rounded-2xl">
              <div class="radio-skeleton aspect-[5/4] w-full sm:aspect-square" />
              <div class="space-y-2 p-3">
                <div class="radio-skeleton h-4 w-4/5 rounded-md" />
                <div class="radio-skeleton h-3 w-1/2 rounded-md" />
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <div class="radio-skeleton h-6 w-44 rounded-lg" />
          <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            <div v-for="i in 8" :key="'browse-' + i" class="radio-skeleton-card radio-surface flex items-center gap-3 rounded-xl p-2">
              <div class="radio-skeleton h-11 w-11 shrink-0 rounded-lg" />
              <div class="min-w-0 flex-1 space-y-2">
                <div class="radio-skeleton h-3 w-4/5 rounded-md" />
                <div class="radio-skeleton h-3 w-1/2 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Region: breadcrumb, introduction and country cards. -->
      <template v-else-if="variant === 'area'">
        <div class="radio-skeleton h-4 w-48 rounded-md" />
        <div class="radio-surface space-y-4 p-5 sm:p-8">
          <div class="radio-skeleton h-3 w-32 rounded-md" />
          <div class="radio-skeleton h-9 w-52 rounded-xl" />
          <div class="radio-skeleton h-4 w-[min(34rem,90%)] rounded-md" />
          <div class="radio-skeleton h-4 w-2/3 rounded-md" />
        </div>
        <div class="radio-surface overflow-hidden">
          <div class="border-b border-[var(--radio-border)] p-4">
            <div class="radio-skeleton h-6 w-40 rounded-lg" />
          </div>
          <div class="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            <div v-for="i in 10" :key="'country-' + i" class="radio-skeleton-card overflow-hidden rounded-xl border border-[var(--radio-border)]">
              <div class="radio-skeleton aspect-[7/4] w-full sm:aspect-square" />
              <div class="space-y-2 p-3">
                <div class="radio-skeleton h-4 w-4/5 rounded-md" />
                <div class="radio-skeleton h-3 w-1/2 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Country: flag/hero then grid of stations. -->
      <template v-else-if="variant === 'country'">
        <div class="radio-skeleton h-4 w-56 rounded-md" />
        <div class="radio-surface space-y-4 p-5 sm:p-7">
          <div class="flex items-center gap-4 sm:gap-5">
            <div class="radio-skeleton h-20 w-24 shrink-0 rounded-2xl sm:h-24 sm:w-28" />
            <div class="min-w-0 flex-1 space-y-3">
              <div class="radio-skeleton h-3 w-28 rounded-md" />
              <div class="radio-skeleton h-7 w-3/5 rounded-lg" />
              <div class="radio-skeleton h-4 w-5/6 rounded-md" />
            </div>
          </div>
          <div class="radio-skeleton h-11 w-40 rounded-full" />
        </div>
        <div class="radio-surface overflow-hidden">
          <div class="border-b border-[var(--radio-border)] p-4">
            <div class="radio-skeleton h-6 w-36 rounded-lg" />
          </div>
          <div class="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            <div v-for="i in 10" :key="'station-' + i" class="radio-skeleton-card overflow-hidden rounded-2xl border border-[var(--radio-border)]">
              <div class="radio-skeleton aspect-[5/4] w-full sm:aspect-square" />
              <div class="flex items-center gap-2 p-3">
                <div class="radio-skeleton h-4 min-w-0 flex-1 rounded-md" />
                <div class="radio-skeleton h-10 w-10 shrink-0 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Station: artwork, listening details, channel/schedule panel. -->
      <template v-else-if="variant === 'station'">
        <div class="radio-skeleton h-4 w-64 max-w-full rounded-md" />
        <div class="radio-surface grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-center">
          <div class="radio-skeleton aspect-square w-40 rounded-3xl sm:w-48 lg:w-56" />
          <div class="space-y-4">
            <div class="radio-skeleton h-5 w-28 rounded-full" />
            <div class="radio-skeleton h-9 w-4/5 rounded-xl" />
            <div class="radio-skeleton h-4 w-[90%] rounded-md" />
            <div class="radio-skeleton h-4 w-2/3 rounded-md" />
            <div class="flex gap-3">
              <div class="radio-skeleton h-12 w-36 rounded-full" />
              <div class="radio-skeleton h-12 w-12 rounded-full" />
            </div>
          </div>
        </div>
        <div class="grid gap-4 lg:grid-cols-2">
          <div v-for="i in 2" :key="'detail-' + i" class="radio-surface space-y-4 p-5 sm:p-6">
            <div class="radio-skeleton h-6 w-40 rounded-lg" />
            <div v-for="n in 4" :key="n" class="flex gap-3">
              <div class="radio-skeleton h-11 w-11 shrink-0 rounded-xl" />
              <div class="min-w-0 flex-1 space-y-2 py-1">
                <div class="radio-skeleton h-4 w-3/4 rounded-md" />
                <div class="radio-skeleton h-3 w-1/2 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Personal library: favorites and recent-listening cards. -->
      <template v-else-if="variant === 'library'">
        <div class="space-y-3">
          <div class="radio-skeleton h-9 w-48 rounded-xl" />
          <div class="radio-skeleton h-4 w-80 max-w-full rounded-md" />
        </div>
        <div v-for="group in 2" :key="'library-' + group" class="space-y-4">
          <div class="radio-skeleton h-6 w-44 rounded-lg" />
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="n in 3" :key="n" class="radio-skeleton-card radio-surface flex min-h-20 items-center gap-3 rounded-2xl p-3">
              <div class="radio-skeleton h-12 w-12 shrink-0 rounded-xl" />
              <div class="radio-skeleton h-4 min-w-0 flex-1 rounded-md" />
              <div class="radio-skeleton h-10 w-10 shrink-0 rounded-full" />
              <div class="radio-skeleton h-10 w-10 shrink-0 rounded-full" />
            </div>
          </div>
        </div>
      </template>

      <!-- Statistics: summary metrics and coverage details. -->
      <template v-else-if="variant === 'statistics'">
        <div class="radio-surface space-y-4 p-5 sm:p-7">
          <div class="radio-skeleton h-3 w-28 rounded-md" />
          <div class="radio-skeleton h-9 w-56 rounded-xl" />
          <div class="radio-skeleton h-4 w-5/6 rounded-md" />
        </div>
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div v-for="i in 4" :key="i" class="radio-surface space-y-4 p-5">
            <div class="radio-skeleton h-3 w-24 rounded-md" />
            <div class="radio-skeleton h-8 w-28 max-w-full rounded-lg" />
          </div>
        </div>
        <div class="radio-surface space-y-5 p-5 sm:p-7">
          <div class="radio-skeleton h-6 w-44 rounded-lg" />
          <div v-for="i in 6" :key="i" class="flex items-center justify-between gap-4">
            <div class="radio-skeleton h-4 w-1/2 rounded-md" />
            <div class="radio-skeleton h-4 w-12 rounded-md" />
          </div>
        </div>
      </template>

      <!-- About, contact, privacy, terms, cookies, and unknown routes. -->
      <template v-else>
        <div class="radio-surface space-y-4 p-5 sm:p-8">
          <div class="radio-skeleton h-3 w-28 rounded-md" />
          <div class="radio-skeleton h-9 w-3/5 rounded-xl" />
          <div class="radio-skeleton h-4 w-[90%] rounded-md" />
          <div class="radio-skeleton h-4 w-2/3 rounded-md" />
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div v-for="i in 4" :key="i" class="radio-surface space-y-4 p-5 sm:p-7">
            <div class="radio-skeleton h-6 w-2/3 rounded-lg" />
            <div class="radio-skeleton h-4 w-full rounded-md" />
            <div class="radio-skeleton h-4 w-5/6 rounded-md" />
            <div class="radio-skeleton h-4 w-3/4 rounded-md" />
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { pageSkeletonKind } from "~/utils/page-skeleton.mjs";

const props = defineProps<{ path: string }>();
const variant = computed(() => pageSkeletonKind(props.path));
</script>
