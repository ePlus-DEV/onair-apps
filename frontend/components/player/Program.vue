<template>
  <section v-if="program && program.length > 0" class="border-t border-[var(--radio-border)]">
    <div class="flex items-center justify-between px-4 py-3 sm:px-6">
      <h3 class="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--radio-text)]">
        {{ $t("panel.schedule") }}
      </h3>
      <span class="text-xs text-[var(--radio-text-muted)]">{{ program.length }}</span>
    </div>

    <div class="radio-scrollbar max-h-56 overflow-y-auto px-3 pb-3 sm:px-4">
      <div
        v-for="(item, index) in program"
        :key="index"
        class="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-t border-[var(--radio-border)] px-2 py-3 text-sm first:border-t-0"
        :class="index === 0 ? 'rounded-xl bg-[var(--radio-hover)]' : ''"
      >
        <div>
          <div class="font-medium text-[var(--radio-text)]">
            {{ $dayjs.unix(item.startTime).format("HH:mm") }}–{{ $dayjs.unix(item.endTime).format("HH:mm") }}
          </div>
          <div class="mt-1 text-[11px] uppercase tracking-wide text-[var(--radio-text-muted)]">
            {{ $dayjs.unix(item.startTime).format("DD/MM") }}
          </div>
        </div>

        <div class="min-w-0">
          <p dir="auto" class="truncate font-medium text-[var(--radio-text)]">{{ item.title }}</p>
          <p dir="auto" class="mt-1 line-clamp-2 text-xs leading-5 text-[var(--radio-text-muted)]">
            {{ item.description }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  program: {
    type: Array,
    default: () => [],
  },
});
</script>
