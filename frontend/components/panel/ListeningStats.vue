<template>
  <section :aria-label="$t('library.listening_stats')" class="radio-stats-dashboard space-y-3 sm:space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-base font-bold tracking-tight sm:text-lg">{{ $t('library.listening_stats') }}</h2>
        <p class="mt-1 text-xs leading-5 text-[var(--radio-text-muted)]">{{ $t('online_stats.compare_intro') }}</p>
      </div>
      <NuxtLink to="/settings" class="stats-settings-link inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500">
        <UIcon name="i-lucide-sliders-horizontal" class="h-4 w-4" aria-hidden="true" />
        {{ $t('online_stats.manage_settings') }}
      </NuxtLink>
    </header>

    <!-- A single, consistent four-KPI row; no duplicated summary tiles. -->
    <div class="stats-overview grid grid-cols-2 gap-2.5">
      <article class="stats-kpi stats-kpi-listening min-w-0 rounded-xl p-3.5" :aria-label="$t('library.listening_total')">
        <div class="stats-kpi-label flex items-center gap-1.5">
          <UIcon name="i-lucide-headphones" class="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
          <span class="truncate">{{ $t('online_stats.listening') }}</span>
          <span v-if="isLive" class="stats-live ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-rose-500" :title="$t('library.listening_live')" />
        </div>
        <p class="stats-kpi-value mt-2 tabular-nums">{{ formatDuration(totalListeningMs) }}</p>
        <p class="stats-kpi-meta mt-1">{{ $t('online_stats.listening_today') }} · {{ formatDuration(todayListeningMs) }}</p>
        <p class="stats-kpi-context mt-1.5">
          <template v-if="listeningWeekDelta !== null">{{ formatWeekDelta(listeningWeekDelta) }} {{ $t('online_stats.vs_previous_week') }}</template>
          <template v-else>{{ $t('online_stats.weekly_activity') }} · {{ formatDuration(listeningWeekTotal) }}</template>
        </p>
      </article>
      <article class="stats-kpi stats-kpi-online min-w-0 rounded-xl p-3.5" :aria-label="$t('online_stats.total')">
        <div class="stats-kpi-label flex items-center gap-1.5">
          <UIcon name="i-lucide-monitor" class="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
          <span class="truncate">{{ $t('online_stats.online') }}</span>
        </div>
        <p class="stats-kpi-value mt-2 tabular-nums">{{ formatDuration(totalOnlineMs) }}</p>
        <p class="stats-kpi-meta mt-1">{{ $t('online_stats.today') }} · {{ formatDuration(todayOnlineMs) }}</p>
        <p class="stats-kpi-context mt-1.5">
          <template v-if="onlineWeekDelta !== null">{{ formatWeekDelta(onlineWeekDelta) }} {{ $t('online_stats.vs_previous_week') }}</template>
          <template v-else>{{ $t('online_stats.weekly_activity') }} · {{ formatDuration(onlineWeekTotal) }}</template>
        </p>
      </article>
      <article class="stats-kpi stats-kpi-stations min-w-0 rounded-xl p-3.5">
        <div class="stats-kpi-label flex items-center gap-1.5">
          <UIcon name="i-lucide-radio-tower" class="h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
          <span class="truncate">{{ $t('online_stats.stations_played') }}</span>
        </div>
        <p class="stats-kpi-value mt-2 tabular-nums">{{ stations.length }}</p>
      </article>
      <article class="stats-kpi stats-kpi-favorite min-w-0 rounded-xl p-3.5">
        <div class="stats-kpi-label flex items-center gap-1.5">
          <UIcon name="i-lucide-star" class="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <span class="truncate">{{ $t('online_stats.most_listened_station') }}</span>
        </div>
        <NuxtLink v-if="stations.length" :to="stations[0].url" :prefetch="false"
          class="stats-kpi-station mt-2 block truncate font-bold hover:text-rose-500"
          :title="stations[0].title">{{ stations[0].title }}</NuxtLink>
        <p v-else class="stats-kpi-value mt-2">—</p>
        <p v-if="stations.length" class="stats-kpi-meta mt-1 tabular-nums">{{ formatDuration(stations[0].ms) }} · {{ formatStationShare(stations[0].ms) }}</p>
      </article>
    </div>

    <div class="stats-insights-stack flex min-w-0 flex-col gap-3">
      <figure class="stats-chart stats-surface min-w-0 overflow-hidden rounded-2xl p-3.5 sm:p-5" :aria-label="$t('online_stats.daily_compare')">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-base font-bold sm:text-lg">
            <UIcon name="i-lucide-chart-no-axes-column-increasing" class="h-5 w-5 text-rose-500" aria-hidden="true" />
            {{ $t('online_stats.daily_compare') }}
          </h2>
          <p class="mt-1 text-xs leading-5 text-[var(--radio-text-muted)]">{{ $t('online_stats.chart_tooltip_hint') }}</p>
        </div>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <div class="stats-segment inline-flex items-center gap-1 rounded-lg p-1" role="group" :aria-label="$t('online_stats.chart_kind')">
            <button v-for="option in chartFilters" :key="option" type="button" :aria-pressed="visibleMetric === option"
              class="stats-filter min-h-9 rounded-md px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              :class="{ 'stats-filter-active': visibleMetric === option }"
              @click="visibleMetric = option">{{ $t('online_stats.filter_' + option) }}</button>
          </div>
          <div class="stats-segment inline-flex items-center gap-1 rounded-lg p-1" role="group" :aria-label="$t('library.listening_chart_range')">
            <button v-for="days in [7, 30, 90]" :key="days" type="button" :aria-pressed="rangeDays === days"
              class="stats-filter min-h-9 rounded-md px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              :class="{ 'stats-filter-active': rangeDays === days }"
              @click="rangeDays = days">{{ $t('library.listening_last_' + days) }}</button>
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div v-if="showListening" class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true"></span>
          <span class="text-[var(--radio-text-muted)]">{{ $t('online_stats.listening') }}</span>
          <strong class="tabular-nums text-rose-600 dark:text-rose-300">{{ formatDuration(listeningPeriodTotal) }}</strong>
        </div>
        <div v-if="showOnline" class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
          <span class="text-[var(--radio-text-muted)]">{{ $t('online_stats.online') }}</span>
          <strong class="tabular-nums text-emerald-700 dark:text-emerald-300">{{ formatDuration(onlinePeriodTotal) }}</strong>
        </div>
              </div>

      <div class="stats-chart-plot relative mt-2 min-w-0 px-0 pb-1 pt-2">
        <div class="mb-1 flex flex-wrap justify-between gap-2 text-[10px] font-semibold">
          <span v-if="showListening" class="text-rose-600 dark:text-rose-300">{{ $t('online_stats.listening') }} · {{ $t('online_stats.scale_max') }} {{ formatDuration(listeningGeometry.maxMs) }}</span>
          <span v-if="showOnline" class="text-emerald-700 dark:text-emerald-300">{{ $t('online_stats.online') }} · {{ $t('online_stats.scale_max') }} {{ formatDuration(onlineGeometry.maxMs) }}</span>
        </div>
        <svg v-if="visibleHasData"
          class="mt-2 block h-40 w-full cursor-crosshair touch-pan-y rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-rose-500 sm:h-44"
          viewBox="0 0 800 210" preserveAspectRatio="none" role="img" tabindex="0"
          :aria-label="$t('online_stats.chart_hover_label')"
          @pointerenter="cacheChartBounds" @pointermove="onChartPointerMove" @pointerdown="onChartPointerDown"
          @pointerleave="clearChartHover" @focus="hoveredDayIndex = selectedDayIndex" @blur="hoveredDayIndex = null"
          @keydown.left.prevent="moveSelectedDay(-1)" @keydown.right.prevent="moveSelectedDay(1)">
          <defs>
            <linearGradient id="radio-listening-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f43f8e" stop-opacity=".32" />
              <stop offset="100%" stop-color="#f43f8e" stop-opacity=".01" />
            </linearGradient>
            <linearGradient id="radio-online-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#10bfa6" stop-opacity=".22" />
              <stop offset="100%" stop-color="#10bfa6" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line v-for="step in [0, 1, 2, 3, 4]" :key="'row-' + step" x1="5" x2="795"
            :y1="8 + step * 48.5" :y2="8 + step * 48.5" stroke="var(--radio-border)"
            stroke-width="1" vector-effect="non-scaling-stroke" />
          <line v-for="index in gridColumnIndices" :key="'col-' + index"
            :x1="listeningGeometry.points[index]?.x" :x2="listeningGeometry.points[index]?.x"
            y1="8" y2="202" stroke="var(--radio-border)" stroke-opacity=".55"
            stroke-width="1" vector-effect="non-scaling-stroke" />
          <path v-if="showListening" :d="listeningGeometry.areaPath" fill="url(#radio-listening-area)" />
          <path v-if="showOnline" :d="onlineGeometry.areaPath" fill="url(#radio-online-area)" />
          <path v-if="showListening" :d="listeningGeometry.linePath" fill="none" stroke="#f43f8e"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          <path v-if="showOnline" :d="onlineGeometry.linePath" fill="none" stroke="#10bfa6"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          <circle v-for="(point, index) in rangeDays === 7 && showListening ? listeningGeometry.points : []"
            :key="'listen-' + index" :cx="point.x" :cy="point.y" r="3.5" fill="#f43f8e"
            stroke="var(--radio-surface)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          <circle v-for="(point, index) in rangeDays === 7 && showOnline ? onlineGeometry.points : []"
            :key="'online-' + index" :cx="point.x" :cy="point.y" r="3.5" fill="#10bfa6"
            stroke="var(--radio-surface)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          <line v-if="currentListeningPoint" :x1="currentListeningPoint.x" :x2="currentListeningPoint.x"
            y1="8" y2="202" stroke="var(--radio-text-muted)" stroke-dasharray="4 4"
            opacity=".8" stroke-width="1" vector-effect="non-scaling-stroke" />
          <circle v-if="showListening && currentListeningPoint" :cx="currentListeningPoint.x" :cy="currentListeningPoint.y"
            r="5.2" fill="#f43f8e" stroke="var(--radio-surface)" stroke-width="2" vector-effect="non-scaling-stroke" />
          <circle v-if="showOnline && currentOnlinePoint" :cx="currentOnlinePoint.x" :cy="currentOnlinePoint.y"
            r="5.2" fill="#10bfa6" stroke="var(--radio-surface)" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>
        <p v-else class="flex h-40 items-center justify-center text-sm text-[var(--radio-text-muted)] sm:h-44">
          {{ $t(visibleMetric === 'online' ? 'online_stats.daily_empty' : 'library.listening_daily_empty') }}
        </p>
        <div v-if="hoveredDayIndex !== null && visibleHasData" role="tooltip"
          class="stats-tooltip pointer-events-none absolute top-12 z-10 w-48 -translate-x-1/2 rounded-xl p-3 text-xs shadow-xl"
          :style="{ left: tooltipLeft }">
          <p class="font-bold">{{ formatDay(inspectedDateKey) }}</p>
          <div v-if="showListening" class="mt-2 flex items-center justify-between gap-2">
            <span class="text-rose-500">{{ $t('online_stats.listening') }}</span>
            <strong class="tabular-nums">{{ formatDuration(inspectedListeningMs) }}</strong>
          </div>
          <div v-if="showOnline" class="mt-1 flex items-center justify-between gap-2">
            <span class="text-emerald-500">{{ $t('online_stats.online') }}</span>
            <strong class="tabular-nums">{{ formatDuration(inspectedOnlineMs) }}</strong>
          </div>
        </div>
        <div class="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--radio-text-muted)]">
          <span>{{ formatTick(listeningTrend[0]?.key) }}</span>
          <span>{{ formatTick(listeningTrend.at(-1)?.key) }}</span>
        </div>
      </div>

      <!-- Touch and keyboard users can expand the day inspector; hover remains instant. -->
      <details class="stats-day-inspector mt-3 overflow-hidden rounded-lg">
        <summary class="stats-day-summary flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 text-xs">
          <span class="text-[var(--radio-text-muted)]">{{ $t('online_stats.selected_day') }} <strong class="ml-1 tabular-nums text-[var(--radio-text)]">{{ formatDay(selectedDateKey) }}</strong></span>
          <span class="flex flex-wrap items-center gap-3">
            <span v-if="showListening" class="inline-flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true"></span>
              <strong class="tabular-nums">{{ formatDuration(selectedListeningMs) }}</strong>
            </span>
            <span v-if="showOnline" class="inline-flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
              <strong class="tabular-nums">{{ formatDuration(selectedOnlineMs) }}</strong>
            </span>
            <UIcon name="i-lucide-chevron-down" class="stats-day-chevron h-4 w-4 text-[var(--radio-text-muted)]" aria-hidden="true" />
          </span>
        </summary>
        <div class="px-3 pb-3 pt-2">
          <label for="radio-stats-day" class="text-xs text-[var(--radio-text-muted)]">{{ $t('online_stats.select_day') }}</label>
          <input id="radio-stats-day" type="range" min="0" :max="Math.max(0, listeningTrend.length - 1)" step="1"
            :value="selectedDayIndex" @input="selectDayAtIndex"
            class="mt-2 h-2 w-full cursor-pointer accent-rose-500"
            :aria-label="$t('online_stats.select_day')" />
        </div>
      </details>

      <figcaption class="stats-chart-footer mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--radio-text-muted)]">
        <span class="inline-flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true"></span>
          {{ $t('online_stats.listening_peak') }}: <strong class="tabular-nums text-[var(--radio-text)]">{{ formatDuration(peakListeningDay.ms) }}</strong>
        </span>
        <span class="inline-flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
          {{ $t('online_stats.online_peak') }}: <strong class="tabular-nums text-[var(--radio-text)]">{{ formatDuration(peakOnlineDay.ms) }}</strong>
        </span>
        <span class="w-full text-[10px] leading-4">{{ $t('online_stats.independent_scales') }}</span>
      </figcaption>
    </figure>

    <section class="stats-ranking stats-surface min-w-0 rounded-2xl p-3.5 sm:p-5" :aria-label="$t('library.listening_top_stations')">
      <header class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <UIcon name="i-lucide-list-ordered" class="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
          <h2 class="text-sm font-bold sm:text-base">{{ $t('library.listening_top_stations') }}</h2>
          <span class="text-xs text-[var(--radio-text-muted)]">({{ stations.length }})</span>
        </div>
        <button v-if="stations.length > 3" type="button"
          class="stats-settings-link inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          @click="allStationsOpen = true">
          {{ $t('online_stats.show_all') }}
          <UIcon name="i-lucide-arrow-up-right" class="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <!-- No fixed card height or filler stations: 0, 1, 2 and 3 remain compact. -->
      <div v-if="stations.length" class="stats-top-stations flex flex-wrap items-stretch gap-3">
        <article v-for="(station, index) in stations.slice(0, 3)" :key="station.url"
          class="stats-station-card min-w-0 flex-[1_1_230px] rounded-xl p-3">
          <div class="flex min-w-0 items-center gap-2.5">
            <span class="stats-rank flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold tabular-nums"
              :class="index === 0 ? 'stats-rank-first' : index === 1 ? 'stats-rank-second' : 'stats-rank-third'">{{ index + 1 }}</span>
            <span class="stats-ranking-artwork flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg" aria-hidden="true">
              <img :src="siteAssetUrl(stationImage(station.url))" alt="" loading="lazy"
                class="h-full w-full object-contain p-1" @error="onStationImageError" />
            </span>
            <NuxtLink :to="station.url" :prefetch="false" class="min-w-0 flex-1 truncate text-xs font-semibold hover:text-rose-500"
              :title="station.title">{{ station.title }}</NuxtLink>
          </div>
          <div class="mt-3 flex items-center justify-between gap-2 text-xs tabular-nums text-[var(--radio-text-muted)]">
            <span>{{ formatDuration(station.ms) }}</span>
            <span>{{ formatStationShare(station.ms) }}</span>
          </div>
          <div class="stats-track mt-2 h-1.5 overflow-hidden rounded-full" aria-hidden="true">
            <div class="stats-progress h-full rounded-full" :style="{ width: percentOfTotalStation(station.ms) }"></div>
          </div>
        </article>
      </div>
      <p v-else class="rounded-xl border border-dashed border-[var(--radio-border)] p-4 text-sm text-[var(--radio-text-muted)]">
        {{ $t('library.listening_empty') }}
      </p>
    </section>
    </div>
    <UModal v-model:open="allStationsOpen" :title="$t('library.listening_top_stations')"
      :description="$t('online_stats.station_all_description')"
      :ui="{
        content: 'radio-station-stats-modal max-w-3xl bg-[var(--radio-station-dialog-bg)] text-[var(--radio-text)]',
        overlay: 'radio-station-stats-overlay',
        body: 'min-w-0',
      }">
      <template #body>
        <div class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row">
            <label class="min-w-0 flex-1">
              <span class="sr-only">{{ $t('online_stats.station_search') }}</span>
              <input v-model="stationQuery" type="search" autocomplete="off"
                class="stats-station-input min-h-11 w-full rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                :placeholder="$t('online_stats.station_search')" />
            </label>
            <label class="sm:w-52">
              <span class="sr-only">{{ $t('online_stats.station_sort') }}</span>
              <select v-model="stationSort" class="stats-station-input min-h-11 w-full rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                :aria-label="$t('online_stats.station_sort')">
                <option value="duration-desc">{{ $t('online_stats.station_sort_most') }}</option>
                <option value="duration-asc">{{ $t('online_stats.station_sort_least') }}</option>
                <option value="name-asc">{{ $t('online_stats.station_sort_name') }}</option>
              </select>
            </label>
          </div>
          <p class="text-xs text-[var(--radio-text-muted)]">
            {{ $t('online_stats.station_results', { from: stationPageData.from, to: stationPageData.to, total: stationPageData.total }) }}
          </p>
          <div v-if="stationPageData.items.length" class="radio-scrollbar max-h-[46dvh] space-y-1 overflow-y-auto overscroll-contain pr-1">
            <article v-for="station in stationPageData.items" :key="station.url"
              class="stats-ranking-row flex min-w-0 items-center gap-3 rounded-lg px-2 py-2.5">
              <span class="stats-rank flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums">
                {{ station.rank }}
              </span>
              <span class="stats-ranking-artwork flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg" aria-hidden="true">
                <img :src="siteAssetUrl(stationImage(station.url))" alt="" loading="lazy"
                  class="h-full w-full object-contain p-1" @error="onStationImageError" />
              </span>
              <div class="min-w-0 flex-1">
                <NuxtLink :to="station.url" :prefetch="false" class="block truncate text-sm font-semibold hover:text-rose-500"
                  :title="station.title">{{ station.title }}</NuxtLink>
                <div class="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums text-[var(--radio-text-muted)]">
                  <span>{{ formatDuration(station.ms) }}</span>
                  <span>{{ formatStationShare(station.ms) }}</span>
                </div>
                <div class="stats-track mt-1.5 h-1 overflow-hidden rounded-full" aria-hidden="true">
                  <div class="stats-progress h-full rounded-full" :style="{ width: percentOfTotalStation(station.ms) }"></div>
                </div>
              </div>
            </article>
          </div>
          <p v-else class="rounded-lg border border-dashed border-[var(--radio-border)] p-4 text-center text-sm text-[var(--radio-text-muted)]">
            {{ $t('online_stats.station_no_results') }}
          </p>
          <nav v-if="stationPageData.totalPages > 1" class="flex items-center justify-between gap-3 border-t border-[var(--radio-border)] pt-3"
            :aria-label="$t('online_stats.station_pagination')">
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-chevron-left"
              :disabled="!stationPageData.hasPrevious" @click="stationPage = stationPageData.currentPage - 1">
              {{ $t('online_stats.station_previous') }}
            </UButton>
            <span class="text-xs tabular-nums text-[var(--radio-text-muted)]">
              {{ $t('online_stats.station_page', { page: stationPageData.currentPage, total: stationPageData.totalPages }) }}
            </span>
            <UButton size="sm" color="neutral" variant="outline" trailing-icon="i-lucide-chevron-right"
              :disabled="!stationPageData.hasNext" @click="stationPage = stationPageData.currentPage + 1">
              {{ $t('online_stats.station_next') }}
            </UButton>
          </nav>
        </div>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { useListeningDurationStore } from '~/stores/listeningDuration';
import { useListeningStore } from '~/stores/listening';
import { useOnlineDurationStore } from '~/stores/onlineDuration';
import { dailyOnlineSeries } from '~/utils/online-duration.mjs';
import { usePlaybackStore } from '~/stores/playback';
import { dailyListeningSeries, localDayKey } from '~/utils/listening-duration.mjs';
import { buildActivityTrend } from '~/utils/activity-trend.mjs';
import { paginateListeningStations } from '~/utils/listening-station-pagination.mjs';

const duration = useListeningDurationStore();
const online = useOnlineDurationStore();
const playback = usePlaybackStore();
const listening = useListeningStore();
const siteAssetUrl = useSiteAssetUrl();
const { t, locale } = useI18n();
duration.hydrate();
online.hydrate();
listening.hydrate();
const allStationsOpen = ref(false);
const stationQuery = ref('');
const stationSort = ref('duration-desc');
const stationPage = ref(1);
type ChartFilter = 'both' | 'listening' | 'online';
const chartFilters: ChartFilter[] = ['both', 'listening', 'online'];
const visibleMetric = ref<ChartFilter>('both');
const rangeDays = ref(7);
const selectedDayKey = ref('');
const hoveredDayIndex = ref<number | null>(null);
const showListening = computed(() => visibleMetric.value !== 'online');
const showOnline = computed(() => visibleMetric.value !== 'listening');
const listeningTrend = computed(() => dailyListeningSeries(duration.stats, rangeDays.value, new Date(), duration.liveMs));
const onlineTrend = computed(() => dailyOnlineSeries(online.stats, rangeDays.value, new Date(), online.liveMs));
const listeningGeometry = computed(() => buildActivityTrend(listeningTrend.value, 800, 210));
const onlineGeometry = computed(() => buildActivityTrend(onlineTrend.value, 800, 210));
const last14Listening = computed(() => dailyListeningSeries(duration.stats, 14, new Date(), duration.liveMs));
const last14Online = computed(() => dailyOnlineSeries(online.stats, 14, new Date(), online.liveMs));
const listeningHeroDays = computed(() => last14Listening.value.slice(-7));
const onlineHeroDays = computed(() => last14Online.value.slice(-7));
const sumDays = (days: { ms: number }[]): number => days.reduce((sum, day) => sum + day.ms, 0);
const listeningWeekTotal = computed(() => sumDays(listeningHeroDays.value));
const onlineWeekTotal = computed(() => sumDays(onlineHeroDays.value));
const comparePreviousWeek = (days: { ms: number }[]): number | null => {
  const previous = sumDays(days.slice(0, 7));
  return previous > 0 ? Math.round(100 * (sumDays(days.slice(-7)) - previous) / previous) : null;
};
const listeningWeekDelta = computed(() => comparePreviousWeek(last14Listening.value));
const onlineWeekDelta = computed(() => comparePreviousWeek(last14Online.value));
const formatWeekDelta = (value: number): string => (value > 0 ? '+' : '') + new Intl.NumberFormat(locale.value).format(value) + '%';
const gridColumnIndices = computed(() => {
  const count = listeningTrend.value.length;
  if (count <= 1) return [0];
  return Array.from(new Set(Array.from({ length: Math.min(7, count) },
    (_, index) => Math.round(index * (count - 1) / (Math.min(7, count) - 1)))));
});
const peakDay = (series: { key: string; ms: number }[]) => series.reduce(
  (best, day) => day.ms > best.ms ? day : best,
  series.at(-1) || { key: localDayKey(), ms: 0 },
);
const peakListeningDay = computed(() => peakDay(listeningTrend.value));
const peakOnlineDay = computed(() => peakDay(onlineTrend.value));
const visibleHasData = computed(() =>
  (showListening.value && listeningGeometry.value.hasData) ||
  (showOnline.value && onlineGeometry.value.hasData));
const listeningPeriodTotal = computed(() => listeningTrend.value.reduce((sum, day) => sum + day.ms, 0));
const onlinePeriodTotal = computed(() => onlineTrend.value.reduce((sum, day) => sum + day.ms, 0));
const selectedDayIndex = computed(() => {
  const index = listeningTrend.value.findIndex(item => item.key === selectedDayKey.value);
  return index >= 0 ? index : Math.max(0, listeningTrend.value.length - 1);
});
const inspectedDayIndex = computed(() => hoveredDayIndex.value ?? selectedDayIndex.value);
const selectedDateKey = computed(() => listeningTrend.value[selectedDayIndex.value]?.key || localDayKey());
const inspectedDateKey = computed(() => listeningTrend.value[inspectedDayIndex.value]?.key || localDayKey());
const selectedListeningMs = computed(() => listeningTrend.value[selectedDayIndex.value]?.ms || 0);
const selectedOnlineMs = computed(() => onlineTrend.value[selectedDayIndex.value]?.ms || 0);
const inspectedListeningMs = computed(() => listeningTrend.value[inspectedDayIndex.value]?.ms || 0);
const inspectedOnlineMs = computed(() => onlineTrend.value[inspectedDayIndex.value]?.ms || 0);
const currentListeningPoint = computed(() => listeningGeometry.value.points[inspectedDayIndex.value] || null);
const currentOnlinePoint = computed(() => onlineGeometry.value.points[inspectedDayIndex.value] || null);
const tooltipLeft = computed(() => {
  const count = listeningTrend.value.length;
  const percent = count > 1 ? 100 * inspectedDayIndex.value / (count - 1) : 50;
  return `${Math.min(89, Math.max(11, percent))}%`;
});
let chartBounds: DOMRect | null = null;
const cacheChartBounds = (event: PointerEvent): void => {
  chartBounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
};
const clearChartHover = (): void => {
  chartBounds = null;
  hoveredDayIndex.value = null;
};
const indexFromPointer = (event: PointerEvent): number | null => {
  if (!chartBounds) cacheChartBounds(event);
  const bounds = chartBounds;
  if (!bounds?.width || listeningTrend.value.length === 0) return null;
  // Translate the actual pointer into the SVG plot's [5, 795] x-window.
  const x = (event.clientX - bounds.left) / bounds.width * 800;
  const fraction = Math.min(1, Math.max(0, (x - 5) / 790));
  return Math.round(fraction * (listeningTrend.value.length - 1));
};
const onChartPointerMove = (event: PointerEvent) => {
  if (event.pointerType === 'touch' && event.buttons === 0) return;
  const index = indexFromPointer(event);
  if (index !== hoveredDayIndex.value) hoveredDayIndex.value = index;
};
const onChartPointerDown = (event: PointerEvent) => {
  cacheChartBounds(event);
  const index = indexFromPointer(event);
  if (index === null) return;
  if (index !== hoveredDayIndex.value) hoveredDayIndex.value = index;
  selectedDayKey.value = listeningTrend.value[index].key;
};
const moveSelectedDay = (delta: number) => {
  const index = Math.max(0, Math.min(listeningTrend.value.length - 1, inspectedDayIndex.value + delta));
  selectedDayKey.value = listeningTrend.value[index]?.key || '';
  hoveredDayIndex.value = index;
};
const selectDayAtIndex = (event: Event) => {
  const raw = Number((event.target as HTMLInputElement).value);
  if (!Number.isInteger(raw) || raw < 0 || raw >= listeningTrend.value.length) return;
  selectedDayKey.value = listeningTrend.value[raw].key;
  hoveredDayIndex.value = null;
};
watch([rangeDays, visibleMetric], clearChartHover);
const parseDay = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const dayFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { day: '2-digit', month: 'short', year: 'numeric' }));
const tickFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { day: '2-digit', month: '2-digit' }));
const formatDay = (key: string) => dayFormatter.value.format(parseDay(key));
const formatTick = (key?: string) => key ? tickFormatter.value.format(parseDay(key)) : '';
const isLive = computed(() => duration.activeStationUrl !== '');
const totalListeningMs = computed(() => duration.stats.totalMs + duration.liveMs);
const totalOnlineMs = computed(() => online.stats.totalMs + online.liveMs);
const todayListeningMs = computed(() => listeningTrend.value.at(-1)?.ms || 0);
const todayOnlineMs = computed(() => onlineTrend.value.at(-1)?.ms || 0);
const stations = computed(() => {
  const entries = Object.entries(duration.stats.byStation)
    .map(([url, value]) => ({ url, title: value.title, ms: value.ms }));
  const liveUrl = duration.activeStationUrl;
  if (liveUrl && duration.liveMs > 0) {
    const existing = entries.find(entry => entry.url === liveUrl);
    if (existing) existing.ms += duration.liveMs;
    else if (playback.station?.url === liveUrl) {
      entries.push({ url: liveUrl, title: playback.station.title, ms: duration.liveMs });
    }
  }
  return entries.filter(station => station.ms > 0).sort((a, b) => b.ms - a.ms);
});
const stationPageData = computed(() => paginateListeningStations(
  stations.value.map((station, index) => ({ ...station, rank: index + 1 })),
  { query: stationQuery.value, sort: stationSort.value, page: stationPage.value, locale: locale.value },
));
watch([stationQuery, stationSort], () => { stationPage.value = 1; });
const totalRankedMs = computed(() => stations.value.reduce((total, station) => total + station.ms, 0));
const percentOfTotalStation = (ms: number): string => totalRankedMs.value > 0 ? `${Math.max(0, Math.min(100, ms * 100 / totalRankedMs.value))}%` : '0%';
const formatStationShare = (ms: number): string => {
  if (totalRankedMs.value <= 0 || ms <= 0) return '0%';
  const pct = 100 * ms / totalRankedMs.value;
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`;
};
const stationArtwork = computed(() => {
  const urls = new Map<string, string>();
  for (const station of [
    ...(listening.library.recent || []),
    ...(listening.library.favorites || []),
    ...(playback.station ? [playback.station] : []),
    ...playback.stations,
  ]) {
    if (station?.url && station.image) urls.set(station.url, station.image);
  }
  return urls;
});
const stationImage = (url: string): string => stationArtwork.value.get(url) || '/brand/onair-mark.svg';
const onStationImageError = (event: Event): void => {
  const image = event.target as HTMLImageElement;
  const fallback = siteAssetUrl('/brand/onair-mark.svg');
  if (!image.src.endsWith(fallback)) image.src = fallback;
};
const formatDuration = (value: number): string => {
  const seconds = Math.floor(value / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}${t('library.listening_hour_short')} ${minutes}${t('library.listening_minute_short')}`;
  if (minutes > 0) return `${minutes}${t('library.listening_minute_short')} ${seconds % 60}${t('library.listening_second_short')}`;
  return `${seconds}${t('library.listening_second_short')}`;
};
</script>

<style scoped>
/* Component-scoped refinements preserve the application's existing theme tokens. */
.radio-stats-dashboard { min-width: 0; container: listening-stats / inline-size; }
.stats-settings-link { border: 1px solid var(--radio-border); background: var(--radio-surface); color: var(--radio-text-muted); }
.stats-settings-link:hover { background: var(--radio-hover); color: var(--radio-text); }
.stats-kpi, .stats-surface {
  border: 1px solid var(--radio-border);
  background: var(--radio-surface);
  color: var(--radio-text);
}
.stats-kpi { min-height: 8rem; }
.stats-kpi-label { font-size: .7rem; font-weight: 650; line-height: 1.15rem; color: var(--radio-text-muted); }
.stats-kpi-value { font-size: clamp(1.25rem, 2.3vw, 1.8rem); font-weight: 800; letter-spacing: -.035em; line-height: 1.2; overflow-wrap: anywhere; }
.stats-kpi-station { font-size: 1.05rem; line-height: 1.35; }
.stats-kpi-meta { font-size: .7rem; line-height: 1.35; color: var(--radio-text-muted); }
.stats-kpi-context { font-size: .65rem; line-height: 1.35; color: var(--radio-text-muted); }
:global(html.dark) .stats-kpi { background: #1b2238; border-color: rgb(148 163 184 / .17); }
:global(html.dark) .stats-kpi-listening { background: #221e35; }
:global(html.dark) .stats-kpi-online { background: #192b35; }
:global(html.dark) .stats-surface { background: #1b2238; border-color: rgb(148 163 184 / .17); }
.stats-insights-stack { min-width: 0; }
@container listening-stats (min-width: 760px) {
  .stats-overview { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .stats-top-stations > .stats-station-card { flex: 0 1 calc((100% - 1.5rem) / 3); }
}
.stats-segment { border: 1px solid var(--radio-border); background: var(--radio-surface-soft); }
.stats-filter { color: var(--radio-text-muted); white-space: nowrap; }
.stats-filter:hover { color: var(--radio-text); background: var(--radio-hover); }
.stats-filter-active { background: #e11d58; color: #fff !important; }
.stats-filter-active:hover { background: #be185d; }
.stats-chart-plot { background: transparent; }
.stats-tooltip { background: var(--radio-surface-elevated); border: 1px solid var(--radio-border-strong); color: var(--radio-text); }
:global(html.dark) .stats-tooltip { background: #263149; border-color: #45526b; box-shadow: 0 14px 30px rgb(0 0 0 / .3); }
.stats-day-inspector { background: var(--radio-surface-soft); border: 1px solid var(--radio-border); }
.stats-day-summary { list-style: none; cursor: pointer; }
.stats-day-summary::-webkit-details-marker { display: none; }
.stats-day-summary::marker { content: ''; }
.stats-day-summary:hover { background: var(--radio-hover); }
.stats-day-chevron { transition: transform .18s ease; }
.stats-day-inspector[open] .stats-day-chevron { transform: rotate(180deg); }
.stats-chart-footer { border-top: 1px solid var(--radio-border); padding-top: .75rem; }
.stats-station-card { max-width: 380px; border: 1px solid var(--radio-border); background: var(--radio-surface-soft); }
.stats-station-input { border: 1px solid var(--radio-border); background: var(--radio-surface-soft); color: var(--radio-text); }
.stats-station-input:focus { border-color: #f43f8e; }
.stats-ranking-row:hover { background: var(--radio-hover); }
.stats-ranking-artwork { background: var(--radio-surface-soft); border: 1px solid var(--radio-border); }
.stats-rank { color: var(--radio-text); background: var(--radio-surface-soft); }
.stats-rank-first { background: #9d235e; color: #fff; }
.stats-rank-second { background: #64748b; color: #fff; }
.stats-rank-third { background: #9a6246; color: #fff; }
.stats-track { background: var(--radio-track); }
.stats-progress { background: #f43f8e; }
@media (max-width: 400px) {
  .stats-kpi { padding: .7rem; }
  .stats-kpi-label { font-size: .66rem; }
  .stats-kpi-station { font-size: .92rem; }
}
@media (prefers-reduced-motion: reduce) {
  .stats-live { animation: none; }
  .stats-day-chevron { transition: none; }
}
</style>
