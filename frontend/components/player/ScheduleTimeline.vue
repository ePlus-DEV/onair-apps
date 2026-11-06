<template>
  <!-- One continuous day ruler; durations use real elapsed clock time. -->
  <div v-if="layout" data-schedule-timeline
    class="radio-schedule-timeline relative isolate ml-0.5 mr-1"
    :style="{ height: layout.height + 'px' }"
    role="group" :aria-label="$t('panel.schedule')">
    <div v-for="hour in layout.hours" :key="hour.time"
      class="pointer-events-none absolute inset-x-0 z-0 flex items-start gap-2"
      :style="{ top: hour.top + 'px' }">
      <div class="w-12 shrink-0 -translate-y-2 text-[11px] font-semibold tabular-nums text-[var(--radio-text-muted)]">
        <span v-if="hour.nextDay" class="text-rose-700 dark:text-rose-300">{{ formatDate(hour.time) }}</span>
        <span v-else>{{ formatHour(hour.time) }}</span>
      </div>
      <span class="h-px flex-1 bg-[var(--radio-border)]"></span>
    </div>

    <div class="absolute inset-y-0 left-[52px] right-0 border-l border-[var(--radio-border)]"
      aria-hidden="true"></div>

    <div v-for="block in layout.programmes" :key="block.item.startTime + '-' + block.index"
      :data-program-index="block.index"
      class="absolute left-[54px] right-1 z-10 overflow-hidden rounded-md border-l-[3px] transition-colors"
      :class="block.active
        ? 'border-rose-500 bg-rose-950/[0.88] text-white shadow-sm shadow-rose-950/30'
        : 'border-rose-500/40 bg-rose-500/[0.09] text-[var(--radio-text)] dark:bg-rose-950/40'"
      :style="{ top: block.top + 'px', height: block.height + 'px' }"
      :aria-label="formatHour(block.item.startTime) + '–' + formatHour(block.item.endTime) + ': ' + (block.item.title || $t('panel.updating'))">
      <div class="flex h-full min-w-0 items-start gap-2 overflow-hidden p-2"
        :class="block.height < 40 ? 'py-0.5' : ''">
        <img v-if="block.active && thumb && block.height >= 52"
          :src="siteAssetUrl(thumb)" :alt="stationName"
          loading="lazy"
          class="h-10 w-10 shrink-0 rounded-md bg-white/90 p-1 object-contain" />
        <div class="min-w-0">
          <span v-if="block.height >= 56" class="block text-[10px] font-semibold opacity-75">
            {{ formatHour(block.item.startTime) }}–{{ formatHour(block.item.endTime) }}
          </span>
          <p dir="auto" class="truncate text-xs font-semibold sm:text-sm">
            {{ block.item.title || $t('panel.updating') }}
          </p>
          <p v-if="block.item.description && block.height >= 90"
            class="mt-1 line-clamp-2 text-xs opacity-80">{{ block.item.description }}</p>
        </div>
      </div>
    </div>

    <template v-if="layout.nowTop !== null">
      <!-- Follows the ICT wall clock each second. Does not depend on audio
           playback and must not claim that an unspecified show is live. -->
      <div data-schedule-now
        class="pointer-events-none absolute inset-x-0 z-30 h-0 border-t-2 border-emerald-400 motion-safe:transition-[top] motion-safe:duration-1000 motion-safe:ease-linear"
        :style="{ top: layout.nowTop + 'px' }">
        <span data-schedule-clock role="timer"
          class="absolute left-0 top-0 -translate-y-1/2 rounded bg-emerald-400 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-950 shadow-sm">
          {{ formattedNow }}
        </span>
        <span class="absolute -top-1 left-[50px] h-2 w-2 rounded-full border border-emerald-200 bg-emerald-500"></span>
      </div>

      <div v-if="layout.gap" data-schedule-gap
        class="pointer-events-none absolute left-[59px] right-3 z-20 rounded-lg border border-[var(--radio-border)] bg-[var(--radio-surface)]/95 px-2.5 py-1.5 shadow-md"
        :style="{ top: Math.min(layout.height - 72, layout.nowTop + 10) + 'px' }">
        <p class="text-[11px] font-semibold leading-4 text-[var(--radio-text)]">
          {{ $t('panel.schedule_gap_unknown') }}
        </p>
        <p class="mt-0.5 truncate text-[10px] leading-4 text-[var(--radio-text-muted)]">
          {{ layout.gap.nextStartTime && layout.gap.nextTitle
            ? $t('panel.schedule_gap_next', {
              title: layout.gap.nextTitle, time: formatHour(layout.gap.nextStartTime),
            })
            : $t('panel.schedule_gap_no_next') }}
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { referenceTimelineLayout } from '~/utils/station-schedule.mjs';

interface TimelineProgramme {
  startTime?: number;
  endTime?: number;
  title?: string;
  description?: string;
}
const props = defineProps<{
  program: TimelineProgramme[];
  timestamp: number;
  thumb?: string;
  stationName: string;
}>();

const layout = computed(() => referenceTimelineLayout(props.program, props.timestamp));
const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const secondsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
  second: '2-digit', hourCycle: 'h23',
});
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
});
const formatHour = (time: number) => hourFormatter.format(new Date(time * 1000));
const formatDate = (time: number) => dateFormatter.format(new Date(time * 1000));
const formattedNow = computed(() => secondsFormatter.format(new Date(props.timestamp * 1000)));
const siteAssetUrl = useSiteAssetUrl();
</script>
