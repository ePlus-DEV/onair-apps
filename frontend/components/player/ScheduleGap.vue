<template>
  <div
    data-schedule-now
    role="note"
    class="relative my-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-3"
  >
    <div class="mb-2 flex items-center gap-2">
      <span data-schedule-clock role="timer" class="shrink-0 rounded-md bg-rose-500 px-2 py-1 text-xs font-bold tabular-nums text-white">
        {{ formattedNow }}
      </span>
      <div class="relative h-1 min-w-0 flex-1 rounded-full bg-rose-500/15" aria-hidden="true">
        <div data-schedule-time-progress class="h-full rounded-full bg-rose-500 transition-[width] duration-1000 ease-linear"
          :style="{ width: timelineProgress === null ? '0%' : timelineProgress + '%' }"></div>
        <span v-if="timelineProgress !== null"
          class="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--radio-surface)] bg-rose-500 shadow-sm transition-[left] duration-1000 ease-linear"
          :style="{ left: timelineProgress + '%' }"></span>
      </div>
      <span class="shrink-0 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
        {{ $t('panel.schedule_now_marker') }}
      </span>
    </div>
    <p class="text-xs font-semibold leading-5 text-[var(--radio-text)]">
      {{ $t('panel.schedule_gap_unknown') }}
    </p>
    <p v-if="nextStartTime && nextTitle" class="mt-1 text-xs leading-5 text-[var(--radio-text-muted)]">
      {{ $t('panel.schedule_gap_next', { title: nextTitle, time: formattedNext }) }}
    </p>
    <p v-else class="mt-1 text-xs leading-5 text-[var(--radio-text-muted)]">
      {{ $t('panel.schedule_gap_no_next') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { scheduleTimelineProgress } from '~/utils/station-schedule.mjs';
const props = withDefaults(defineProps<{
  timestamp: number;
  startTime?: number | null;
  nextTitle?: string;
  nextStartTime?: number | null;
}>(), { startTime: null, nextTitle: '', nextStartTime: null });

// Only used for broadcaster reference guides, all in Vietnam's UTC+7 zone.
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const formattedNow = computed(() => formatter.format(new Date(props.timestamp * 1000)));
const formattedNext = computed(() => props.nextStartTime
  ? new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(props.nextStartTime * 1000))
  : '');
const timelineProgress = computed(() => scheduleTimelineProgress(
  props.startTime, props.nextStartTime, props.timestamp,
));
</script>
