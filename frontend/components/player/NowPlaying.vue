<template>
  <div class="radio-now-playing radio-scrollbar h-full min-h-0 overflow-y-auto bg-[var(--radio-page-bg)] text-[var(--radio-text)]">
    <div class="mx-auto flex w-full max-w-md flex-col px-6 pb-6 lg:min-h-full lg:max-w-6xl lg:px-8 xl:px-10">
      <header class="flex min-h-16 items-center justify-between gap-3 lg:min-h-20">
        <UTooltip :text="$t('button.close')">
          <UButton color="neutral" variant="ghost" icon="i-lucide-chevron-down" class="h-11 w-11 justify-center rounded-full" :aria-label="$t('button.close')" @click="$emit('close')" />
        </UTooltip>
        <h2 class="text-sm font-semibold">{{ $t('redesign.now_playing') }}</h2>
        <UTooltip :text="$t('player.queue')">
          <UButton color="neutral" variant="ghost" icon="i-lucide-list-music" class="h-11 w-11 justify-center rounded-full" :aria-label="$t('player.queue')" @click="$emit('queue')" />
        </UTooltip>
      </header>

      <div class="radio-now-playing-console flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12">
        <div class="lg:flex lg:justify-end">
          <div class="radio-now-playing-artwork radio-themed-artwork mx-auto mt-4 flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl p-10 shadow-xl sm:mt-6 sm:p-12 lg:mx-0 lg:mt-0 lg:rounded-[2rem] lg:p-14">
            <StationArtwork :src="artwork" :alt="title" eager class="radio-now-playing-artwork-image max-h-full max-w-full object-contain" />
          </div>
        </div>

        <div class="min-w-0 lg:max-w-xl">
          <div class="mt-6 flex min-w-0 items-start justify-between gap-3 lg:mt-0">
            <div class="min-w-0">
              <div class="mb-3 flex flex-wrap items-center gap-2 text-xs" role="status">
                <span class="rounded-full px-3 py-1.5" :class="error ? 'bg-red-500/10 text-red-700 dark:text-red-300' : waiting ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : playing ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-[var(--radio-surface-soft)] text-[var(--radio-text-muted)]'">{{ status }}</span>
                <span v-if="sleepRemaining" class="text-[var(--radio-text-muted)]">{{ $t('player.sleep_remaining', { minutes: sleepRemaining }) }}</span>
              </div>
              <h3 dir="auto" class="break-words text-2xl font-bold leading-tight lg:text-5xl">{{ title }}</h3>
              <p v-if="artist" dir="auto" class="mt-2 break-words text-sm text-[var(--radio-text-muted)] lg:text-base">{{ artist }}</p>
              <p dir="auto" class="mt-1 break-words text-xs text-[var(--radio-text-muted)] lg:text-sm">{{ stationName }}</p>
            </div>
            <UTooltip :text="$t(favorite ? 'library.remove_favorite' : 'library.add_favorite')">
              <UButton color="neutral" :variant="favorite ? 'soft' : 'ghost'" icon="i-lucide-heart" class="h-11 w-11 shrink-0 justify-center rounded-full" :class="favorite ? 'text-rose-500' : ''" :aria-pressed="favorite" :aria-label="$t(favorite ? 'library.remove_favorite' : 'library.add_favorite')" @click="$emit('favorite')" />
            </UTooltip>
          </div>

          <div class="my-7 flex items-center justify-center gap-7 lg:justify-start">
            <UTooltip :text="previousLabel">
              <UButton color="neutral" variant="ghost" icon="i-lucide-skip-back" class="h-14 w-14 justify-center rounded-full" :disabled="!canNavigate" :aria-label="previousLabel" @click="$emit('previous')" />
            </UTooltip>
            <UTooltip :text="$t(playing || waiting ? 'player.pause' : 'player.play')">
              <UButton :icon="waiting ? 'i-lucide-loader-circle' : playing ? 'i-lucide-pause' : 'i-lucide-play'" class="h-20 w-20 justify-center rounded-full bg-rose-500 text-white hover:bg-rose-400 [&_.iconify]:h-8 [&_.iconify]:w-8" :disabled="!playable" :aria-label="$t(playing || waiting ? 'player.pause' : 'player.play')" @click="$emit('toggle')" />
            </UTooltip>
            <UTooltip :text="nextLabel">
              <UButton color="neutral" variant="ghost" icon="i-lucide-skip-forward" class="h-14 w-14 justify-center rounded-full" :disabled="!canNavigate" :aria-label="nextLabel" @click="$emit('next')" />
            </UTooltip>
          </div>

          <PlayerRecovery :health="health" :online="online" :playable="playable" :source-items="sourceItems" :report-url="reportUrl" :diagnostics="diagnostics" class="mb-4" @retry="$emit('retry')" />
          <StationShare v-if="stationPath" :path="stationPath" :title="stationName" class="mb-4" />
          <div class="grid grid-cols-3 gap-2 lg:max-w-lg">
            <UDropdownMenu :items="sleepItems" :content="{ align: 'start', side: 'top' }">
              <UTooltip :text="$t('player.sleep_timer')">
                <UButton color="neutral" variant="ghost" class="radio-player-tool" :disabled="!playable"><UIcon name="i-lucide-timer" class="h-5 w-5" />{{ $t('redesign.timer') }}</UButton>
              </UTooltip>
            </UDropdownMenu>
            <UDropdownMenu :items="sourceItems" :content="{ align: 'center', side: 'top' }" :ui="{ content: 'max-w-[calc(100vw-2rem)]' }">
              <UTooltip :text="$t('player.source')">
                <UButton color="neutral" variant="ghost" class="radio-player-tool" :disabled="!sourceItems.length"><UIcon name="i-lucide-radio-tower" class="h-5 w-5" />{{ $t('player.source') }}</UButton>
              </UTooltip>
            </UDropdownMenu>
            <UTooltip :text="$t('player.queue')">
              <UButton color="neutral" variant="ghost" class="radio-player-tool" @click="$emit('queue')"><UIcon name="i-lucide-list-music" class="h-5 w-5" />{{ $t('redesign.channel_list') }}</UButton>
            </UTooltip>
          </div>
          <UButton v-if="lyricsAvailable" color="neutral" variant="soft" icon="i-lucide-mic-vocal" class="mt-3 min-h-11 justify-center lg:max-w-lg" @click="$emit('lyrics')">{{ $t('panel.lyric') }}</UButton>

          <div v-if="nextTitle" class="mt-5 rounded-2xl border border-[var(--radio-border)] bg-[var(--radio-surface)] p-4 lg:max-w-lg">
            <p class="mb-2 text-[11px] text-[var(--radio-text-muted)]">{{ $t('panel.next') }}</p>
            <p dir="auto" class="break-words text-sm font-semibold">{{ nextTitle }}</p>
            <p v-if="nextArtist" dir="auto" class="mt-1 text-xs text-[var(--radio-text-muted)]">{{ nextArtist }}</p>
          </div>
          <UButton v-else-if="nextStationTitle" color="neutral" variant="soft" trailing-icon="i-lucide-chevron-right" class="mt-5 min-h-16 w-full justify-between rounded-2xl p-4 lg:max-w-lg" @click="$emit('next')">
            <span class="min-w-0 text-left"><span class="mb-1 block text-[11px] text-[var(--radio-text-muted)]">{{ $t('redesign.next_station') }}</span><span dir="auto" class="block truncate text-sm font-semibold">{{ nextStationTitle }}</span></span>
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
defineProps<{
  title: string; artist?: string; artwork?: string; stationName: string; status: string;
  playing: boolean; waiting: boolean; playable: boolean; favorite: boolean; error: boolean;
  canNavigate: boolean; previousLabel: string; nextLabel: string; sleepRemaining: number;
  sleepItems: DropdownMenuItem[]; sourceItems: DropdownMenuItem[]; lyricsAvailable?: boolean;
  health: string; online: boolean; reportUrl: string; stationPath?: string;
  diagnostics?: {
    sourceIndex: number; sourceCount: number; sourceLabel: string;
    retryAttempt: number; maxAttempts: number;
    failureReason: 'network' | 'decode' | 'timeout' | 'unknown' | '';
    lastPlayedAt: string;
  };
  nextTitle?: string; nextArtist?: string; nextStationTitle?: string;
}>();
defineEmits(['close', 'favorite', 'previous', 'next', 'toggle', 'queue', 'lyrics', 'retry']);
</script>
