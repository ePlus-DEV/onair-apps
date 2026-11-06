<template>
  <section v-show="!nowPlayingOpen" class="radio-player-dock fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--radio-border)] bg-[var(--radio-surface-elevated)] shadow-[0_-12px_40px_-28px_rgba(15,23,42,0.4)]" :class="{ 'hidden': playerMini }" :aria-label="$t('player.title')">
    <div class="radio-player-inner mx-auto max-w-[1920px] px-3 sm:px-6">
      <PlayerRecovery v-if="health && health !== 'connecting'" :health="health" :online="online" :playable="hasPlayableSource" :source-items="sourceMenuItems" :report-url="reportUrl" :diagnostics="recoveryDiagnostics"
        class="absolute inset-x-3 bottom-[calc(100%+0.5rem)] max-h-[40dvh] overflow-y-auto shadow-lg sm:left-auto sm:right-6 sm:w-96" @retry="retryCurrentSource" />
      <div v-if="playerStatusVisible" class="sr-only" aria-live="polite">
        <span v-if="!online">{{ $t('text.offline') }}</span>
        <template v-else-if="streamError">
          <span class="truncate text-rose-500">{{ $t('alert.stream_error') }}</span>
        </template>
        <span v-else-if="waiting" class="inline-flex items-center gap-1.5"><span class="h-1 w-1 animate-pulse rounded-full bg-rose-500"></span>{{ $t(hasPlayedCurrentSource ? 'recovery.buffering' : 'player.connecting') }}</span>
        <span v-else-if="!hasPlayableSource">{{ $t('player.choose_station') }}</span>
        <span v-if="sleepRemaining" class="shrink-0 tabular-nums">· {{ $t('player.sleep_remaining', { minutes: sleepRemaining }) }}</span>
      </div>

      <div class="radio-player-console grid min-h-[var(--radio-player-height)] grid-cols-[minmax(0,1fr)_2.75rem_2.75rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4">
        <div class="relative flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div class="radio-themed-artwork radio-player-artwork relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--radio-border)] p-1.5 sm:h-14 sm:w-14">
            <img v-if="nowPlayingArtwork" :src="siteAssetUrl(nowPlayingArtwork)" :alt="nowPlayingTitle" class="max-h-full max-w-full object-contain" />
            <UIcon v-else name="i-lucide-radio" class="h-5 w-5 text-[var(--radio-text-muted)]" />
            <span v-if="playing" class="absolute bottom-1 right-1 flex h-4 w-4 items-end justify-center gap-px rounded-full bg-[var(--radio-inverse-bg)] pb-1 text-[var(--radio-inverse-text)]" aria-hidden="true">
              <span class="radio-bar is-playing h-1 w-px bg-current"></span><span class="radio-bar is-playing h-2 w-px bg-current"></span><span class="radio-bar is-playing h-1.5 w-px bg-current"></span>
            </span>
          </div>
          <button type="button" class="absolute inset-0 z-10 rounded-xl sm:hidden" :aria-label="$t('redesign.now_playing')" @click="nowPlayingOpen = true"></button>
          <div class="min-w-0 flex-1">
            <div class="mb-1 hidden items-center gap-2 sm:flex">
              <span class="radio-player-live-pill inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" :class="liveStateClass">
                <span class="h-1.5 w-1.5 rounded-full" :class="playing ? 'animate-pulse bg-emerald-500' : waiting ? 'animate-pulse bg-amber-500' : streamError ? 'bg-red-500' : 'bg-current'"></span>
                {{ liveStateLabel }}
              </span>
            </div>
            <UTooltip :text="nowPlayingTitle">
              <p dir="auto" class="radio-player-title text-xs font-semibold sm:text-sm" :class="{ 'radio-player-title-marquee': nowPlayingTitleMarquee }">
                <span>{{ nowPlayingTitle }}</span>
              </p>
            </UTooltip>
            <p v-if="nowPlayingArtist" dir="auto" class="radio-player-meta mt-0.5 truncate text-[10px] text-[var(--radio-text-muted)] sm:text-xs"><span class="sm:hidden">{{ streamName }} · {{ nowPlayingArtist }}</span><span class="hidden sm:inline">{{ nowPlayingArtist }}</span></p>
            <p v-else dir="auto" class="radio-player-meta mt-0.5 truncate text-[10px] text-[var(--radio-text-muted)] sm:text-xs">
              <span class="sm:hidden">{{ streamName }} · {{ countryName || $t(country) }}</span>
            </p>
            <NuxtLink v-if="stationUrl" :to="stationUrl" dir="auto" class="radio-player-meta mt-1 hidden truncate text-[10px] text-[var(--radio-text-muted)] hover:text-rose-500 sm:block sm:text-xs">{{ streamName }} · {{ countryName || $t(country) }}</NuxtLink>          </div>
        </div>

        <div class="radio-player-controls z-20 flex items-center justify-center gap-0.5 sm:gap-2">
          <span v-if="canNavigateStations" class="hidden sm:inline-flex">
            <UTooltip :text="previousStationLabel">
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-skip-back" class="h-11 w-11 cursor-pointer justify-center rounded-full" :aria-label="previousStationLabel" @click="navigateStation(-1)" />
            </UTooltip>
          </span>
          <UButton class="radio-player-main-action h-11 w-11 cursor-pointer justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-950/25 ring-4 ring-rose-500/10 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:w-12" :disabled="!hasPlayableSource" :aria-label="playing || waiting ? $t('player.pause') : $t('player.play')" @click="playing || waiting ? onPause() : onPlay()">
            <UIcon v-if="waiting" name="i-lucide-loader-circle" class="h-5 w-5 animate-spin" />
            <UIcon v-else :name="playing ? 'i-lucide-pause' : 'i-lucide-play'" class="h-5 w-5" />
          </UButton>
          <span v-if="canNavigateStations" class="hidden sm:inline-flex">
            <UTooltip :text="nextStationLabel">
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-skip-forward" class="h-11 w-11 cursor-pointer justify-center rounded-full" :aria-label="nextStationLabel" @click="navigateStation(1)" />
            </UTooltip>
          </span>
        </div>

        <div class="flex min-w-0 items-center justify-end sm:hidden">
          <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-list-music" class="h-11 w-11 cursor-pointer justify-center rounded-xl border border-[var(--radio-border)]" :disabled="!hasSidebar" :aria-label="$t('player.queue')" :aria-expanded="hasSidebar && mobileQueueOpen" @click="toggleQueue" />
        </div>

        <div class="hidden min-w-0 items-center justify-end gap-1 sm:flex">
          <UButton color="neutral" variant="ghost" icon="i-lucide-maximize-2" class="h-11 w-11 shrink-0 cursor-pointer justify-center rounded-full" :aria-label="$t('redesign.now_playing')" @click="nowPlayingOpen = true" />
          <UButton color="neutral" :variant="favoriteActive ? 'soft' : 'ghost'" icon="i-lucide-heart" class="h-11 w-11 shrink-0 cursor-pointer justify-center rounded-full" :class="favoriteActive ? 'text-rose-500' : ''" :disabled="!stationUrl" :aria-pressed="favoriteActive" :aria-label="$t(favoriteActive ? 'library.remove_favorite' : 'library.add_favorite')" @click="toggleFavorite" />

          <UDropdownMenu :items="sleepMenuItems" :content="{ align: 'end', side: 'top' }" :modal="false">
            <UTooltip :text="$t('player.sleep_timer')">
              <UButton color="neutral" :variant="sleepRemaining ? 'soft' : 'ghost'" icon="i-lucide-timer" class="h-11 min-w-11 cursor-pointer justify-center rounded-full" :disabled="!hasPlayableSource" :aria-label="$t('player.sleep_timer')" />
            </UTooltip>
          </UDropdownMenu>

          <UDropdownMenu v-if="sourceList.length > 1" :items="sourceMenuItems" :content="{ align: 'end', side: 'top' }" :modal="false" :ui="{ content: 'w-72' }">
            <UButton color="neutral" variant="soft" size="xs" icon="i-lucide-radio-tower" :aria-label="$t('player.source')" class="hidden max-w-36 cursor-pointer truncate rounded-full lg:inline-flex">{{ activeSourceName }}</UButton>
          </UDropdownMenu>
          <UButton v-else color="neutral" variant="soft" size="xs" icon="i-lucide-radio-tower" :aria-label="$t('player.source')" class="hidden max-w-36 truncate rounded-full lg:inline-flex">{{ activeSourceName }}</UButton>
          <UButton color="neutral" variant="ghost" size="sm" class="cursor-pointer rounded-full" :icon="muted || volume === 0 ? 'i-lucide-volume-x' : 'i-lucide-volume-2'" :aria-label="muted || volume === 0 ? $t('player.unmute') : $t('player.mute')" @click="toggleMute" />
          <input type="range" min="0" max="1" step="0.01" :value="muted ? 0 : volume" @input="onVolumeInput" :aria-label="$t('player.volume')" class="radio-volume hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-[var(--radio-track)] md:block xl:w-24" />
          <UButton v-if="lyricsAvailable" color="neutral" variant="ghost" size="sm" icon="i-lucide-mic-vocal" class="cursor-pointer rounded-full" :aria-label="$t('panel.lyric')" @click="$emit('open-lyrics')" />
          <UButton v-if="hasSidebar" color="neutral" variant="soft" size="sm" class="relative cursor-pointer rounded-full" icon="i-lucide-list-music" :aria-label="$t('player.queue')" :aria-expanded="wideViewport ? playback.queueOpen : mobileQueueOpen" @click="toggleQueue">
            <span v-if="sidebarCount" class="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">{{ sidebarCount }}</span>
          </UButton>
          <UTooltip :text="$t('player.window_player')">
            <UButton color="neutral" variant="ghost" size="sm" class="cursor-pointer rounded-full" icon="i-lucide-picture-in-picture-2" :aria-label="$t('player.window_player')" @click="setPlayerMini(true)" />
          </UTooltip>
        </div>
      </div>
    </div>
    <div class="radio-audio-host" aria-hidden="true"><audio ref="mediaElement" playsinline preload="none"></audio></div>
  </section>

  <section v-show="!nowPlayingOpen && playerMini" class="radio-player-mini fixed bottom-5 right-5 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-[var(--radio-border)] bg-[var(--radio-surface-elevated)] p-3 shadow-2xl shadow-black/40" :aria-label="$t('player.window_player')">
    <div class="flex items-center gap-3">
      <div class="radio-themed-artwork relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--radio-border)] p-1.5">
        <img v-if="nowPlayingArtwork" :src="siteAssetUrl(nowPlayingArtwork)" :alt="nowPlayingTitle" class="max-h-full max-w-full object-contain" />
        <UIcon v-else name="i-lucide-radio" class="h-6 w-6 text-[var(--radio-text-muted)]" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" :class="liveStateClass">
          <span class="h-1.5 w-1.5 rounded-full" :class="playing ? 'animate-pulse bg-emerald-500' : waiting ? 'animate-pulse bg-amber-500' : streamError ? 'bg-red-500' : 'bg-current'"></span>
          {{ liveStateLabel }}
        </p>
        <p dir="auto" class="mt-1 truncate text-sm font-semibold">{{ nowPlayingTitle }}</p>
        <p v-if="nowPlayingArtist" dir="auto" class="truncate text-xs text-[var(--radio-text-muted)]">{{ nowPlayingArtist }}</p>
      </div>
      <UButton class="h-12 w-12 cursor-pointer justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-950/25 hover:bg-rose-400" :disabled="!hasPlayableSource" :aria-label="playing || waiting ? $t('player.pause') : $t('player.play')" @click="playing || waiting ? onPause() : onPlay()">
        <UIcon v-if="waiting" name="i-lucide-loader-circle" class="h-5 w-5 animate-spin" />
        <UIcon v-else :name="playing ? 'i-lucide-pause' : 'i-lucide-play'" class="h-5 w-5" />
      </UButton>
    </div>
    <PlayerRecovery :health="health" :online="online" :playable="hasPlayableSource" :source-items="sourceMenuItems" :report-url="reportUrl" :diagnostics="recoveryDiagnostics" class="mt-3 max-h-[35dvh] overflow-y-auto" @retry="retryCurrentSource" />
    <div class="mt-3 flex items-center justify-between gap-1">
      <div class="flex items-center gap-1">
        <UButton v-if="canNavigateStations" color="neutral" variant="ghost" size="sm" icon="i-lucide-skip-back" class="cursor-pointer rounded-full" :aria-label="previousStationLabel" @click="navigateStation(-1)" />
        <UButton v-if="canNavigateStations" color="neutral" variant="ghost" size="sm" icon="i-lucide-skip-forward" class="cursor-pointer rounded-full" :aria-label="nextStationLabel" @click="navigateStation(1)" />
        <UButton color="neutral" variant="ghost" size="sm" :icon="muted || volume === 0 ? 'i-lucide-volume-x' : 'i-lucide-volume-2'" class="cursor-pointer rounded-full" :aria-label="muted || volume === 0 ? $t('player.unmute') : $t('player.mute')" @click="toggleMute" />
      </div>
      <div class="flex items-center gap-1">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-maximize-2" class="cursor-pointer rounded-full" :aria-label="$t('redesign.now_playing')" @click="nowPlayingOpen = true" />
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-panel-bottom" class="cursor-pointer rounded-full" :aria-label="$t('player.dock_player')" @click="setPlayerMini(false)" />
      </div>
    </div>
  </section>

  <Teleport to="#radio-queue-slot">
    <aside v-if="hasSidebar" v-show="playback.queueOpen" class="radio-right-panel sticky z-30 flex w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--radio-border)] bg-[var(--radio-surface)]" :aria-label="$t('player.queue')">
      <div class="flex items-center justify-between border-b border-[var(--radio-border)] p-4">
        <div class="min-w-0"><p class="text-xs font-semibold">{{ $t('player.queue') }}</p><p dir="auto" class="mt-1 truncate text-[11px] text-[var(--radio-text-muted)]">{{ streamName }}</p></div>
        <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-panel-right-close" :aria-label="$t('button.close')" @click="setQueueOpen(false)" />
      </div>
      <div v-if="song?.nextMedia?.title" class="border-b border-[var(--radio-border)] p-4">
        <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-rose-500">{{ $t("panel.next") }}</p>
        <p dir="auto" class="truncate text-sm font-semibold">{{ song.nextMedia.title }}</p>
        <p dir="auto" class="mt-1 truncate text-xs text-[var(--radio-text-muted)]">{{ song.nextMedia.artists }}</p>
      </div>
      <PlayerQueue class="min-h-0 flex-1" :playlist="playlist || []" :program="program || []" :stations="stations || []" :active-station-id="activeStationId" :active-station-url="stationUrl" :country-name="countryName || $t(country)" :visible="playback.queueOpen" :schedule-loading="queueLoading" :schedule-source-url="scheduleSourceUrl" :schedule-is-reference="scheduleIsReference" :thumb="thumb" :station-name="streamName" @select-station="selectStation" />
    </aside>
  </Teleport>

  <USlideover v-model:open="mobileQueueOpen" :title="$t('player.queue')" :description="streamName" :ui="{ content: 'w-full max-w-sm', body: 'flex min-h-0 flex-1 flex-col p-0 sm:p-0' }">
    <template #body>
      <div class="grid grid-cols-2 items-stretch gap-2 border-b border-[var(--radio-border)] p-3">
        <UButton color="neutral" variant="ghost" icon="i-lucide-heart" class="radio-queue-action" :class="favoriteActive ? '!text-rose-500' : ''" :disabled="!stationUrl" :aria-pressed="favoriteActive" @click="toggleFavorite">
          <span class="min-w-0 whitespace-normal text-left">{{ $t(favoriteActive ? 'library.remove_favorite' : 'library.add_favorite') }}</span>
        </UButton>
        <div class="radio-queue-action gap-1.5">
          <UButton color="neutral" variant="ghost" size="sm" class="min-h-10 min-w-0 shrink-0 justify-start px-0 text-xs font-semibold" :icon="muted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'" :aria-label="muted ? $t('player.unmute') : $t('player.mute')" @click="toggleMute">{{ muted ? $t('player.unmute') : $t('player.mute') }}</UButton>
          <input v-if="!systemVolumeOnly" type="range" min="0" max="1" step="0.01" :value="muted ? 0 : volume" @input="onVolumeInput" :aria-label="$t('player.volume')" class="radio-volume radio-volume-mobile h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent" />
        </div>
        <UDropdownMenu :items="sleepMenuItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" icon="i-lucide-timer" class="radio-queue-action" :disabled="!hasPlayableSource">
            <span class="min-w-0 whitespace-normal text-left">{{ $t('player.sleep_timer') }}</span>
          </UButton>
        </UDropdownMenu>
        <UDropdownMenu v-if="sourceList.length > 1" :items="sourceMenuItems" :content="{ align: 'end' }" :ui="{ content: 'w-64' }">
          <UButton color="neutral" variant="ghost" icon="i-lucide-radio-tower" class="radio-queue-action">
            <span class="min-w-0 whitespace-normal text-left">{{ $t('player.source') }}</span>
          </UButton>
        </UDropdownMenu>
        <UButton v-if="lyricsAvailable" color="neutral" variant="ghost" icon="i-lucide-mic-vocal" class="radio-queue-action" @click="mobileQueueOpen = false; $emit('open-lyrics')">
          <span class="min-w-0 whitespace-normal text-left">{{ $t('panel.lyric') }}</span>
        </UButton>
        <p v-if="systemVolumeOnly" role="note" class="col-span-2 text-xs leading-5 text-[var(--radio-text-muted)]">{{ $t('player.ios_volume_hint') }}</p>
      </div>
      <div v-if="song?.nextMedia?.title" class="border-b border-[var(--radio-border)] p-4">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-rose-500">{{ $t('panel.next') }}</p>
        <p dir="auto" class="mt-2 truncate text-sm">{{ song.nextMedia.title }}</p>
      </div>
      <PlayerQueue class="min-h-0 flex-1" :playlist="playlist || []" :program="program || []" :stations="stations || []" :active-station-id="activeStationId" :active-station-url="stationUrl" :country-name="countryName || $t(country)" :visible="mobileQueueOpen" :schedule-loading="queueLoading" :schedule-source-url="scheduleSourceUrl" :schedule-is-reference="scheduleIsReference" :thumb="thumb" :station-name="streamName" @select-station="selectStation" />
    </template>
  </USlideover>
  <UModal v-model:open="nowPlayingOpen" fullscreen :title="$t('redesign.now_playing')" :ui="{ content: 'bg-[var(--radio-page-bg)]' }" @after:leave="finishPlayerAction">
    <template #content>
      <PlayerNowPlaying :health="health" :online="online" :report-url="reportUrl" :station-path="stationUrl" :title="nowPlayingTitle" :artist="nowPlayingArtist" :artwork="nowPlayingArtwork" :station-name="streamName" :status="playerStatus" :playing="playing" :waiting="waiting" :playable="hasPlayableSource" :favorite="favoriteActive" :error="streamError" :can-navigate="canNavigateStations" :previous-label="previousStationLabel" :next-label="nextStationLabel" :sleep-remaining="sleepRemaining" :sleep-items="sleepMenuItems" :source-items="sourceMenuItems" :diagnostics="recoveryDiagnostics" :lyrics-available="lyricsAvailable" :next-title="song?.nextMedia?.title" :next-artist="song?.nextMedia?.artists" :next-station-title="nextStation?.title" @close="nowPlayingOpen = false" @favorite="toggleFavorite" @previous="navigateStation(-1)" @next="navigateStation(1)" @toggle="playing || waiting ? onPause() : onPlay()" @retry="retryCurrentSource" @queue="deferPlayerAction('queue')" @lyrics="deferPlayerAction('lyrics')" />
    </template>
  </UModal>
</template>

<script lang="ts" setup>
import { useListeningStore } from "~/stores/listening";
import { useListeningDurationStore } from "~/stores/listeningDuration";
import { createListeningDurationTracker } from "~/utils/listening-duration.mjs";
import { usePlaybackStore } from "~/stores/playback";
import { useListenerPreferencesStore } from "~/stores/listenerPreferences";
import { shouldReconnectToLive, safeLiveSyncPosition } from "~/utils/listener-preferences.mjs";
import { usesSystemVolumeControls } from "~/utils/mobile-volume.mjs";
import type { RadioSource, RadioStationOption } from "~/types/radio";
import {
  MAX_STREAM_ATTEMPTS,
  buildPlaybackSources,

} from "~/utils/radio-source-plan.mjs";
import { getAdjacentStation } from "~/utils/station-navigation.mjs";
import { createSleepTimer } from "~/utils/sleep-timer.mjs";
import { isAndroidApp, NativeRadio, type NativeRadioState } from "~/utils/native-radio";
import { nativeRadioAction, nativeStationMatches, nativeFailureReason } from "~/utils/native-radio-state.mjs";
import type { PluginListenerHandle } from '@capacitor/core';
import { buildRadioMediaMetadata } from "~/utils/radio-media-session.mjs";
import { playbackHealth, playbackFailureReason } from "~/utils/playback-health.mjs";
import { playbackWatchdogAction, nextRecoverySourceIndex, STREAM_STALL_TIMEOUT_MS, STABLE_PLAYBACK_WINDOW_MS } from "~/utils/playback-recovery-policy.mjs";
import { stationReportUrl } from "~/utils/station-sharing.mjs";
import { resolveLiveTrack } from "~/utils/live-track.mjs";
import { createTimedHlsTrackBuffer, extractNativeHlsId3Track } from "~/utils/hls-song-metadata.mjs";

interface CurrentMedia {
  title: string;
  artists: string;
  hasLyric?: boolean;
  encodeId: string;
  thumbnail?: string;
}

interface Song {
  encodeId: string;
  currentMedia?: CurrentMedia;
  nextMedia?: CurrentMedia;
  thumbnail?: string;
}

interface PlaylistItem {
  track_title: string;
  track_artist: string;
  track_image: string;
  track_played: number;
}

interface ProgramItem {
  startTime?: number;
  endTime?: number;
  title?: string;
  description?: string;
  encodeId?: string;
}

const props = defineProps<{
  thumb: string;
  streamName: string;
  country: string;
  program?: ProgramItem[];
  streamUrl: RadioSource;
  streamUrls?: RadioSource[];
  song?: Song;
  playlist?: PlaylistItem[];
  stations?: RadioStationOption[];
  activeStationId?: string;
  countryName?: string;
  queueLoading?: boolean;
  scheduleSourceUrl?: string;
  scheduleIsReference?: boolean;
  stationUrl?: string;
  lyricsAvailable?: boolean;
  playRequest?: number;
  pauseRequest?: number;
}>();

const emit = defineEmits<{
  (event: "select-station", station: RadioStationOption): void;
  (event: "open-lyrics"): void;
}>();

const $store = useMainStore();
const playback = usePlaybackStore();
const preferences = useListenerPreferencesStore();
const listening = useListeningStore();
listening.hydrate();
const PLAYER_QUEUE_OPEN_KEY = 'radio:player-queue-open';
const favoriteActive = computed(() => listening.library.favorites.some((item: { url: string }) => item.url === props.stationUrl));
const toggleFavorite = () => { if (playback.station) listening.toggleFavorite(playback.station); };
const { t, locale } = useI18n();
const nowPlayingOpen = ref(false);
const playerStatus = computed(() => t(!online.value ? 'text.offline' : streamError.value ? 'alert.stream_error' : waiting.value ? (hasPlayedCurrentSource.value ? 'recovery.buffering' : 'player.connecting') : playing.value ? 'player.on_air' : 'redesign.paused'));
const liveStateLabel = computed(() => t(!online.value ? 'text.offline' : streamError.value ? 'alert.stream_error' : waiting.value ? (hasPlayedCurrentSource.value ? 'recovery.buffering' : 'player.connecting') : playing.value ? 'player.on_air' : 'player.ready'));
const liveStateClass = computed(() => {
  if (streamError.value) return "bg-red-500/10 text-red-700 dark:text-red-300";
  if (!online.value || !hasPlayableSource.value) return "bg-[var(--radio-surface-soft)] text-[var(--radio-text-muted)]";
  if (waiting.value) return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (playing.value) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return "bg-[var(--radio-surface-soft)] text-[var(--radio-text-muted)]";
});
let pendingPlayerAction: 'queue' | 'lyrics' | null = null;
const deferPlayerAction = (action: 'queue' | 'lyrics') => { pendingPlayerAction = action; nowPlayingOpen.value = false; };
const finishPlayerAction = () => { const action = pendingPlayerAction; pendingPlayerAction = null; if (action === 'queue') { if (wideViewport.value) setQueueOpen(true); else mobileQueueOpen.value = true; } else if (action === 'lyrics') emit('open-lyrics'); };
const wideViewport = ref(false);
const updateViewport = () => { wideViewport.value = window.innerWidth >= 1536; if (wideViewport.value) mobileQueueOpen.value = false; };
const persistQueueOpen = (): void => {
  if (import.meta.client) localStorage.setItem(PLAYER_QUEUE_OPEN_KEY, playback.queueOpen ? '1' : '0');
};
const setQueueOpen = (value: boolean): void => {
  playback.queueOpen = value;
  persistQueueOpen();
};
const toggleQueue = () => { if (wideViewport.value) setQueueOpen(!playback.queueOpen); else mobileQueueOpen.value = !mobileQueueOpen.value; };
const runtimeConfig = useRuntimeConfig();
const listeningDuration = useListeningDurationStore();
// Count only media-playing intervals. Persist small checkpoints so a reload
// does not lose a long uninterrupted listening session.
const listeningDurationTracker = createListeningDurationTracker({
  onDuration: (station, elapsedMs) => listeningDuration.record(station, elapsedMs),
  onReport: (station, elapsedMs) => {
    if (!listeningDuration.enabled || !runtimeConfig.public.ga4Enabled || window.location.hostname !== 'radio.eplus.dev') return;
    const seconds = Math.floor(elapsedMs / 1000);
    if (!seconds) return;
    const gaWindow = window as Window & { gtag?: (...args: unknown[]) => void };
    gaWindow.gtag?.('event', 'radio_listen_duration', {
      station_path: station.url,
      station_name: station.title,
      listen_seconds: seconds,
    });
  },
});
let durationInterval: ReturnType<typeof setInterval> | null = null;
let durationTickCount = 0;
const stopListeningDuration = () => {
  listeningDurationTracker.stop();
  listeningDuration.setLivePreview('', 0);
};
const mediaElement = ref<HTMLAudioElement | null>(null);
const nativePlayback = import.meta.client && isAndroidApp();
let nativeListener: PluginListenerHandle | undefined;
let nativeListenerReady: Promise<void> = Promise.resolve();
let nativeQueue: Promise<void> = Promise.resolve();
let nativePausePending = false;
let nativeActiveId = '';
let nativePlayObserved = false;
const runNative = (action: () => Promise<void>): Promise<void> => {
  const result = nativeQueue.then(() => nativeListenerReady).then(action);
  nativeQueue = result.catch(() => {});
  return result;
};
const online = ref(true);
const waiting = ref(false);
const playing = ref(false);
const streamError = ref(false);
const unsupportedSource = ref(false);
const hasPlayedCurrentSource = ref(false);
// In-memory observations only; no stream URLs, diagnosis or user history is persisted.
const lastSourcePlaybackAt = ref<number | null>(null);
const sourceFailureReason = ref<'network' | 'decode' | 'timeout' | 'unknown' | ''>('');
const health = computed(() => playbackHealth({
  online: online.value,
  error: streamError.value,
  unsupported: unsupportedSource.value,
  waiting: waiting.value,
  hasPlayed: hasPlayedCurrentSource.value,
}));
const reportUrl = computed(() => stationReportUrl(props.stationUrl, props.streamName, health.value));
const activeSourceIndex = ref(0);
const pendingAutoPlay = ref(false);
const userPaused = ref(true);
const attemptCount = ref(0);
const AUDIO_PREFERENCES_KEY = "radio:audio-preferences:v1";
const volume = ref(1);
const muted = ref(false);
// iOS browsers reserve playback volume for the hardware/system controls.
const systemVolumeOnly = ref(false);
const mobileQueueOpen = ref(false);
const playerCompact = ref(false);
const playerMini = toRef(playback, 'playerMini');
const playerStatusVisible = computed(() => streamError.value || !online.value || waiting.value || !hasPlayableSource.value || Boolean(sleepRemaining.value));
const togglePlayerCompact = (): void => {
  playerCompact.value = !playerCompact.value;
  if (import.meta.client) localStorage.setItem('radio:player-compact', playerCompact.value ? '1' : '0');
};
const setPlayerMini = (value: boolean): void => {
  playerMini.value = value;
  if (value) {
    setQueueOpen(false);
    mobileQueueOpen.value = false;
  }
  if (import.meta.client) localStorage.setItem('radio:player-mini', value ? '1' : '0');
};

let hlsInstance: any = null;
let detachNativeHlsMetadata: (() => void) | null = null;
const hlsSongBuffer = createTimedHlsTrackBuffer({ appleMusic: true });
let HlsCtor: any = null;
let hlsImportPromise: Promise<any> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let fallbackProbeTimer: ReturnType<typeof setTimeout> | null = null;
let stablePlaybackTimer: ReturnType<typeof setTimeout> | null = null;
let sourceVersion = 0;
let playVersion = 0;
let activeResolvedSrc = "";
let liveResumePending = false;
let pausedAtMs = 0;

const RECONNECT_BASE_DELAY = 1200;

let hlsNetworkRecoveryCount = 0;
let hlsMediaRecoveryCount = 0;

const sourceList = computed<RadioSource[]>(() => {
  const candidates =
    Array.isArray(props.streamUrls) && props.streamUrls.length
      ? props.streamUrls
      : [props.streamUrl];

  return buildPlaybackSources(
    candidates.filter(
      (source): source is RadioSource =>
        Boolean(source && String(source.src || "").trim()),
    ),
    runtimeConfig.public.corsServer,
  ) as RadioSource[];
});

const hasPlayableSource = computed(() => sourceList.value.length > 0);

const sourceName = (source: RadioSource, index: number): string => {
  if (source.label?.trim()) return source.label.trim();

  const sourceKey = String(source.source || "").trim().toLowerCase();
  if (sourceKey === "primary" || index === 0) return t('player.primary_source');
  if (sourceKey.includes("alternative")) return t('player.alternative_source');
  if (sourceKey) {
    return sourceKey
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return t('player.source_number', { number: index + 1 });
};

const sourceFormat = (source: RadioSource): string => {
  const type = String(source.type || "").toLowerCase();
  const src = source.src.toLowerCase();

  if (type.includes("mpegurl") || /\.m3u8(?:$|[?#])/i.test(src)) return "HLS";
  if (type.includes("aac") || /\.aac(?:$|[?#])/i.test(src)) return "AAC";
  if (type.includes("ogg") || /\.ogg(?:$|[?#])/i.test(src)) return "OGG";
  if (type.includes("opus") || /\.opus(?:$|[?#])/i.test(src)) return "OPUS";
  if (type.includes("mpeg") || /\.mp3(?:$|[?#])/i.test(src)) return "MP3";
  if (/\.pls(?:$|[?#])/i.test(src)) return "PLS";
  if (/\.m3u(?:$|[?#])/i.test(src)) return "M3U";

  return t('player.stream_format');
};

const sourceHost = (source: RadioSource): string => {
  try {
    return new URL(source.src).hostname.replace(/^www\./, "");
  } catch {
    return source.proxied ? t('player.proxy') : t('player.direct');
  }
};

const recoveryDiagnostics = computed(() => ({
  sourceIndex: sourceList.value.length ? activeSourceIndex.value + 1 : 0,
  sourceCount: sourceList.value.length,
  sourceLabel: sourceList.value[activeSourceIndex.value]
    ? sourceName(sourceList.value[activeSourceIndex.value], activeSourceIndex.value)
    : '',
  retryAttempt: Math.min(attemptCount.value, MAX_STREAM_ATTEMPTS),
  maxAttempts: MAX_STREAM_ATTEMPTS,
  failureReason: sourceFailureReason.value,
  lastPlayedAt: lastSourcePlaybackAt.value
    ? new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(lastSourcePlaybackAt.value)
    : '',
}));

const sourceMenuItems = computed(() => sourceList.value.map((source, index) => ({
  label: `${index + 1}. ${sourceName(source, index)} · ${sourceFormat(source)}`,
  description: source.proxied ? t('player.proxy') : sourceHost(source),
  type: 'checkbox' as const,
  checked: index === activeSourceIndex.value,
  onSelect: () => selectSource(index),
})));

const activeSourceName = computed(() =>
  sourceName(
    sourceList.value[activeSourceIndex.value] || props.streamUrl,
    activeSourceIndex.value,
  ),
);

const scheduleCount = computed(
  () => (props.playlist?.length || 0) + (props.program?.length || 0),
);
const stationList = computed<RadioStationOption[]>(() => props.stations || []);
const stationCount = computed(() => stationList.value.length);
const canNavigateStations = computed(() => stationCount.value > 1);
const adjacentStation = (offset: -1 | 1): RadioStationOption | undefined =>
  getAdjacentStation(
    stationList.value,
    props.activeStationId,
    offset,
  ) as RadioStationOption | undefined;

const previousStation = computed(() => adjacentStation(-1));
const nextStation = computed(() => adjacentStation(1));
const previousStationLabel = computed(() =>
  previousStation.value
    ? t("player.previous", { name: previousStation.value.title })
    : "Previous station",
);
const nextStationLabel = computed(() =>
  nextStation.value
    ? t("player.next", { name: nextStation.value.title })
    : "Next station",
);

const hasSidebar = computed(
  () => stationCount.value > 0 || scheduleCount.value > 0,
);
const sidebarCount = computed(
  () => stationCount.value || scheduleCount.value,
);

const liveTrack = computed(() => {
  // TuneIn's playlist here is a session history, not a reliable live feed.
  // Never report a previously observed song as currently playing merely
  // because it appears first in the queue.
  if (props.stationUrl?.startsWith('/global-radio/apple-music/')) {
    const reported = playback.liveTrack;
    return reported?.stationUrl === props.stationUrl
      ? { title: reported.title, artist: reported.artist } : null;
  }
  return resolveLiveTrack(props.song, props.playlist);
});
const nowPlayingTitle = computed(() => liveTrack.value?.title || props.streamName || "Live radio");
const nowPlayingTitleMarquee = computed(() => nowPlayingTitle.value.length > 24);
const nowPlayingArtist = computed(() => liveTrack.value?.artist || "");

const nowPlayingArtwork = computed(() => {
  if (props.stationUrl?.startsWith('/global-radio/apple-music/')) {
    // The first history row can be stale. Only show album art bound to the
    // currently playing HLS ID3 track; otherwise show the station identity.
    const live = playback.liveTrack;
    return live?.stationUrl === props.stationUrl && live.artwork
      ? live.artwork : props.thumb;
  }
  return props.song?.currentMedia?.thumbnail ||
    props.song?.thumbnail ||
    props.playlist?.[0]?.track_image ||
    props.thumb;
});

const inferMime = (url: string, fallback = "audio/mpeg"): string => {
  const value = url.toLowerCase();
  if (/\.m3u8(?:$|[?#])/i.test(value)) return "application/vnd.apple.mpegurl";
  if (/\.aac(?:$|[?#])/i.test(value)) return "audio/aac";
  if (/\.ogg(?:$|[?#])/i.test(value)) return "audio/ogg";
  if (/\.opus(?:$|[?#])/i.test(value)) return "audio/opus";
  if (/\.mp3(?:$|[?#])/i.test(value)) return "audio/mpeg";
  return fallback || "audio/mpeg";
};

const isHlsSource = (source: RadioSource): boolean => {
  const type = String(source.type || "").toLowerCase();
  return (
    /\.m3u8(?:$|[?#])/i.test(source.src) ||
    type.includes("mpegurl") ||
    type.includes("m3u8")
  );
};

const isTextPlaylist = (url: string): boolean =>
  /\.pls(?:$|[?#])/i.test(url) ||
  /(?:[?&](?:output|format)=pls(?:&|$))/i.test(url) ||
  /\.m3u(?:$|[?#])/i.test(url);

const parsePlaylistUrls = (text: string): string[] => {
  const urls = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;

    const plsMatch = value.match(/^File\d+\s*=\s*(https?:\/\/.+)$/i);
    const candidate = plsMatch?.[1]?.trim() || value;

    if (/^https?:\/\//i.test(candidate)) {
      urls.add(candidate);
    }
  }

  return [...urls];
};

const resolvePlaylistSource = async (
  source: RadioSource,
): Promise<RadioSource> => {
  if (!isTextPlaylist(source.src)) return source;

  if (nativePlayback) {
    try {
      const result = await NativeRadio.resolvePlaylist({ url: source.src });
      return { ...source, src: result.url, type: result.isHls ? 'application/vnd.apple.mpegurl' : inferMime(result.url, 'audio/mpeg') };
    } catch { return source; }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(source.src, {
      signal: controller.signal,
      headers: { accept: "audio/x-scpls,audio/x-mpegurl,text/plain,*/*" },
    });
    if (!response.ok) return source;

    const urls = parsePlaylistUrls(await response.text());
    const first = urls[0];
    if (!first) return source;

    return {
      src: first,
      type: inferMime(first, source.type),
    };
  } catch {
    return source;
  } finally {
    clearTimeout(timer);
  }
};

const ensureHls = async (): Promise<any> => {
  if (HlsCtor) return HlsCtor;

  hlsImportPromise ||= import("hls.js").then((module) => {
    HlsCtor = module.default;
    return HlsCtor;
  });

  return await hlsImportPromise;
};

const destroyHls = (): void => {
  hlsSongBuffer.clear();
  detachNativeHlsMetadata?.();
  detachNativeHlsMetadata = null;
  if (!hlsInstance) return;
  hlsInstance.destroy();
  hlsInstance = null;
  hlsNetworkRecoveryCount = 0;
  hlsMediaRecoveryCount = 0;
};

const clearReconnectTimer = (): void => {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
};

const clearFallbackProbeTimer = (): void => {
  if (!fallbackProbeTimer) return;
  clearTimeout(fallbackProbeTimer);
  fallbackProbeTimer = null;
};

const clearStablePlaybackTimer = (): void => {
  if (!stablePlaybackTimer) return;
  clearTimeout(stablePlaybackTimer);
  stablePlaybackTimer = null;
};

const startStablePlaybackTimer = (): void => {
  if (stablePlaybackTimer) return;
  const version = sourceVersion;
  stablePlaybackTimer = setTimeout(() => {
    stablePlaybackTimer = null;
    const media = mediaElement.value;
    if (version !== sourceVersion || userPaused.value || !playing.value || waiting.value ||
      (!nativePlayback && (!media || media.paused || media.readyState < HTMLMediaElement.HAVE_CURRENT_DATA))) return;
    // Only uninterrupted, decoded playback replenishes the retry budget.
    attemptCount.value = 0;
  }, STABLE_PLAYBACK_WINDOW_MS);
};

const tryPlay = async (): Promise<void> => {
  const media = mediaElement.value;
  if (!media || userPaused.value) return;
  const version = sourceVersion;
  const request = ++playVersion;

  waiting.value = true;

  try {
    if (nativePlayback) {
      await runNative(() => NativeRadio.play());
      return;
    }
    await media.play();
    if (version !== sourceVersion || request !== playVersion || userPaused.value) return;
    // Resolving play() or receiving canplay does not always mean decoded
    // audio is being delivered. Keep the watchdog armed until real playback.
    const hasDecodedAudio = !media.paused && media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    pendingAutoPlay.value = !hasDecodedAudio;
    waiting.value = !hasDecodedAudio;
    playing.value = hasDecodedAudio;
    streamError.value = false;
    if (hasDecodedAudio && listeningDurationTracker.activeUrl !== playback.station?.url) {
      onMediaPlaying();
    } else if (!hasDecodedAudio) {
      startFallbackProbe();
    }

  } catch (error) {
    if (version !== sourceVersion || request !== playVersion || userPaused.value) return;
    waiting.value = false;
    playing.value = false;
    clearStablePlaybackTimer();

    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: string }).name || "")
        : "";

    if (name === "NotAllowedError") {
      // A blocked Play needs another explicit Play/Retry action. Unrelated
      // gestures (sharing, importing favorites, browsing) must not start audio.
      pendingAutoPlay.value = false;
      userPaused.value = true;
      return;
    }

    if (
      name === "AbortError" ||
      (hlsInstance && name === "NotSupportedError" && media.readyState === 0)
    ) {
      if (!preferences.autoReconnect) { stopPlaybackFailure(); return; }
      pendingAutoPlay.value = true;
      waiting.value = true;
      startFallbackProbe();
      return;
    }

    unsupportedSource.value = name === "NotSupportedError";
    sourceFailureReason.value = playbackFailureReason({ exceptionName: name });
    scheduleReconnect();
  }
};

const startFallbackProbe = (): void => {
  // Repeated waiting/canplay events must not extend a silent attempt forever.
  if (fallbackProbeTimer || userPaused.value || !online.value || !sourceList.value.length) return;

  const version = sourceVersion;
  fallbackProbeTimer = setTimeout(() => {
    fallbackProbeTimer = null;
    // The timer belongs to a particular source/station, never a later one.
    if (version !== sourceVersion) return;
    const action = playbackWatchdogAction({
      waiting: waiting.value,
      playing: playing.value,
      userPaused: userPaused.value,
      online: online.value,
      autoReconnect: preferences.autoReconnect,
      attemptCount: attemptCount.value,
      sourceCount: sourceList.value.length,
    });
    if (action === 'ignore') return;
    sourceFailureReason.value = playbackFailureReason({ timeout: true });
    if (action === 'stop') stopPlaybackFailure();
    else advanceFallbackSource();
  }, STREAM_STALL_TIMEOUT_MS);
};

const configureNativeSource = (
  source: RadioSource,
  autoplay: boolean,
): void => {
  const media = mediaElement.value;
  if (!media) return;

  destroyHls();
  media.src = source.src;
  media.load();

  if (autoplay && !userPaused.value) {
    startFallbackProbe();
    void tryPlay();
  }
};

// Safari/iOS uses native HLS rather than hls.js on devices without MSE.
const attachNativeHlsSongMetadata = (media: HTMLAudioElement, version: number): void => {
  const stationUrl = props.stationUrl;
  if (!stationUrl?.startsWith('/global-radio/apple-music/')) return;
  const tracks = media.textTracks;
  if (!tracks) return;
  const listeners = new Map<TextTrack, EventListener>();
  const register = (track: TextTrack | null | undefined) => {
    if (!track || track.kind !== 'metadata' || listeners.has(track)) return;
    track.mode = 'hidden';
    const onCueChange: EventListener = () => {
      if (version !== sourceVersion || userPaused.value || media.paused
        || playback.station?.url !== stationUrl) return;
      const current = extractNativeHlsId3Track(track.activeCues, { appleMusic: true });
      if (current) playback.setHlsLiveTrack(stationUrl, current);
    };
    track.addEventListener('cuechange', onCueChange);
    listeners.set(track, onCueChange);
    onCueChange(new Event('cuechange'));
  };
  const onAddTrack: EventListener = event => register((event as Event & { track?: TextTrack }).track);
  tracks.addEventListener('addtrack', onAddTrack);
  for (let i = 0; i < tracks.length; i++) register(tracks[i]);
  detachNativeHlsMetadata = () => {
    tracks.removeEventListener('addtrack', onAddTrack);
    for (const [track, listener] of listeners) track.removeEventListener('cuechange', listener);
    listeners.clear();
  };
};

const configureHlsSource = async (
  source: RadioSource,
  autoplay: boolean,
  version: number,
): Promise<void> => {
  const media = mediaElement.value;
  if (!media) return;

  destroyHls();

  // Prefer hls.js anywhere Media Source Extensions are available. Modern
  // Chromium can report native HLS support via canPlayType("...mpegurl")
  // while still failing on some manifests. Native HLS is the fallback for
  // browsers where hls.js/MSE is unavailable (notably Safari/iOS cases).
  const Hls = await ensureHls();
  if (version !== sourceVersion || !mediaElement.value) return;

  if (!Hls.isSupported()) {
    const nativeHls =
      media.canPlayType("application/vnd.apple.mpegurl") ||
      media.canPlayType("application/x-mpegURL");

    if (!nativeHls) {
      unsupportedSource.value = true;
      scheduleReconnect();
      return;
    }

    media.src = source.src;
    attachNativeHlsSongMetadata(media, version);
    media.load();

    if (autoplay && !userPaused.value) {
      startFallbackProbe();
      media.addEventListener(
        "loadedmetadata",
        () => {
          if (version !== sourceVersion || userPaused.value) return;
          void tryPlay();
        },
        { once: true },
      );
    }
    return;
  }

  hlsInstance = new Hls();
  // Feature-detect real timed ID3 inside HLS already decoded by hls.js.
  // This is not audio fingerprinting; no metadata => no guessed song.
  // Never inspect or log Apple accessKey / tokenized stream URLs.
  const metadataStationUrl = props.stationUrl;
  if (metadataStationUrl?.startsWith('/global-radio/apple-music/')) {
    hlsInstance.on(Hls.Events.FRAG_PARSING_METADATA, (_event: unknown, data: { samples?: unknown[] }) => {
      if (version !== sourceVersion || userPaused.value
        || playback.station?.url !== metadataStationUrl) return;
      hlsSongBuffer.add(data?.samples);
      flushHlsSongMetadata();
    });
  }
  hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
    if (version !== sourceVersion || !hlsInstance) return;
    hlsInstance.loadSource(source.src);
  });

  hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
    if (version !== sourceVersion) return;

    clearReconnectTimer();
    streamError.value = false;

    if (autoplay && !userPaused.value) {
      startFallbackProbe();
      void tryPlay();
    }
  });

  hlsInstance.on(Hls.Events.ERROR, (_event: unknown, data: any) => {
    if (version !== sourceVersion || !data?.fatal || !hlsInstance) return;
    sourceFailureReason.value = playbackFailureReason({ hlsType: data.type });
    clearStablePlaybackTimer();
    if (!preferences.autoReconnect) { stopPlaybackFailure(); return; }

    waiting.value = false;
    playing.value = false;

    if (
      data.type === Hls.ErrorTypes.NETWORK_ERROR &&
      hlsNetworkRecoveryCount < 1
    ) {
      hlsNetworkRecoveryCount += 1;
      waiting.value = true;
      hlsInstance.startLoad();
      startFallbackProbe();
      return;
    }

    if (
      data.type === Hls.ErrorTypes.MEDIA_ERROR &&
      hlsMediaRecoveryCount < 1
    ) {
      hlsMediaRecoveryCount += 1;
      waiting.value = true;
      hlsInstance.recoverMediaError();
      startFallbackProbe();
      return;
    }

    unsupportedSource.value = data.type === Hls.ErrorTypes.MEDIA_ERROR;
    // Never log full stream URLs: some providers use tokenized query strings.
    console.warn("Fatal HLS playback error", {
      type: data.type,
      details: data.details,
      sourceIndex: activeSourceIndex.value + 1,
    });
    scheduleReconnect();
  });

  hlsInstance.attachMedia(media);
};

const stopPlaybackFailure = (): void => {
  if (props.stationUrl?.startsWith('/global-radio/apple-music/')) {
    playback.clearHlsLiveTrack(props.stationUrl);
  }
  stopListeningDuration();
  clearReconnectTimer();
  clearFallbackProbeTimer();
  clearStablePlaybackTimer();
  destroyHls();

  const media = mediaElement.value;
  if (nativePlayback) void runNative(() => NativeRadio.stop()).catch(() => {});
  else media?.pause();

  waiting.value = false;
  playing.value = false;
  pendingAutoPlay.value = false;
  streamError.value = true;
  if (!sourceFailureReason.value) sourceFailureReason.value = 'unknown';
  userPaused.value = true;
};

const applySource = async (
  index: number,
  autoplay = false,
): Promise<void> => {
  stopListeningDuration();
  const media = mediaElement.value;
  const rawSource = sourceList.value[index];
  if (!media || !rawSource) {
    waiting.value = false;
    streamError.value = true;
    return;
  }

  if (autoplay && !userPaused.value) {
    if (attemptCount.value >= MAX_STREAM_ATTEMPTS) {
      stopPlaybackFailure();
      return;
    }
    attemptCount.value += 1;
  }

  const version = ++sourceVersion;
  hlsSongBuffer.clear();
  if (props.stationUrl?.startsWith('/global-radio/apple-music/')) {
    playback.clearHlsLiveTrack(props.stationUrl);
  }
  liveResumePending = false;
  pausedAtMs = 0;
  activeSourceIndex.value = index;
  hasPlayedCurrentSource.value = false;
  lastSourcePlaybackAt.value = null;
  sourceFailureReason.value = '';
  unsupportedSource.value = false;
  streamError.value = false;
  playing.value = false;
  pendingAutoPlay.value = autoplay && !userPaused.value;
  waiting.value = autoplay && !userPaused.value;

  clearReconnectTimer();
  clearFallbackProbeTimer();
  clearStablePlaybackTimer();
  // Start before playlist fetch / HLS manifest parsing so every candidate
  // (including a single or last source) has an upper bound on silence.
  if (pendingAutoPlay.value) startFallbackProbe();

  try {
    const source = await resolvePlaylistSource(rawSource);
    if (version !== sourceVersion || !mediaElement.value) return;

    activeResolvedSrc = source.src;

    if (nativePlayback) {
      if (autoplay && !userPaused.value) {
        await runNative(async () => {
          if (version !== sourceVersion || userPaused.value) return;
          nativeActiveId = `${version}|${props.stationUrl || ''}`;
          nativePlayObserved = false;
          await NativeRadio.playSource({ id: nativeActiveId, url: source.src, title: props.streamName, artist: props.countryName || '', artwork: siteAssetUrl(nowPlayingArtwork.value), isHls: isHlsSource(source) && (!isTextPlaylist(rawSource.src) || source.type === 'application/vnd.apple.mpegurl') });
          await NativeRadio.setVolume({ volume: media.muted ? 0 : media.volume });
        });
      }
      return;
    }
    if (isHlsSource(source)) {
      await configureHlsSource(source, autoplay, version);
    } else {
      configureNativeSource(source, autoplay);
    }
  } catch (error) {
    // Includes an unavailable hls.js chunk or a failed manifest setup.
    // Do not leak the station's tokenized stream URL in console/error text.
    if (version !== sourceVersion || userPaused.value) return;
    const name = error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: string }).name || '') : '';
    sourceFailureReason.value = playbackFailureReason({ exceptionName: name });
    scheduleReconnect();
  }
};

const advanceFallbackSource = (): boolean => {
  if (
    sourceList.value.length === 0 ||
    attemptCount.value >= MAX_STREAM_ATTEMPTS
  ) {
    stopPlaybackFailure();
    return false;
  }

  const nextIndex = nextRecoverySourceIndex(
    activeSourceIndex.value,
    sourceList.value.length,
  );
  if (nextIndex < 0) {
    stopPlaybackFailure();
    return false;
  }

  userPaused.value = false;
  void applySource(nextIndex, true);
  return true;
};

const scheduleReconnect = (): void => {
  if (!online.value || userPaused.value || reconnectTimer) return;
  if (!preferences.autoReconnect) { stopPlaybackFailure(); return; }

  clearFallbackProbeTimer();

  if (attemptCount.value >= MAX_STREAM_ATTEMPTS) {
    stopPlaybackFailure();
    return;
  }

  waiting.value = true;
  pendingAutoPlay.value = true;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    advanceFallbackSource();
  }, RECONNECT_BASE_DELAY);
};

const onPlay = async (): Promise<void> => {
  if (!hasPlayableSource.value) return;
  if (streamError.value) { retryCurrentSource(); return; }

  listening.remember(playback.station, 'play');
  userPaused.value = false;
  streamError.value = false;
  pendingAutoPlay.value = true;

  if (activeResolvedSrc && mediaElement.value) {
    if (shouldReconnectToLive({
      resumeLive: preferences.resumeLive,
      hasPaused: liveResumePending,
      activeSource: activeResolvedSrc,
    })) {
      liveResumePending = false;
      // Seek within the current sliding HLS live window when possible.
      // A long pause can leave an old HLS playlist and stale liveSyncPosition.
      // Force a fresh manifest after 10 seconds instead of trusting old segments.
      const recentPause = pausedAtMs > 0 && Date.now() - pausedAtMs <= 10_000;
      const target = hlsInstance && recentPause
        ? safeLiveSyncPosition(hlsInstance.liveSyncPosition, mediaElement.value)
        : null;
      if (target !== null) {
        try {
          mediaElement.value.currentTime = target;
          startFallbackProbe();
          await tryPlay();
          return;
        } catch { /* Expired live window: reconnect with a fresh manifest. */ }
      }
      // Native MP3/AAC and Safari/native HLS discard buffered old audio.
      // Resolving the source again preserves station and fallback identity.
      attemptCount.value = 0;
      await applySource(activeSourceIndex.value, true);
      return;
    }
    startFallbackProbe();
    await tryPlay();
    return;
  }

  await applySource(activeSourceIndex.value, true);
};

const onPause = (): void => {
  hlsSongBuffer.clear();
  if (props.stationUrl?.startsWith('/global-radio/apple-music/')) {
    playback.clearHlsLiveTrack(props.stationUrl);
  }
  stopListeningDuration();
  sleepTimer.cancel();
  listening.remember(playback.station, 'pause');
  const media = mediaElement.value;
  playVersion += 1;

  userPaused.value = true;
  pendingAutoPlay.value = false;
  clearReconnectTimer();
  clearFallbackProbeTimer();
  clearStablePlaybackTimer();

  if (nativePlayback) {
    nativePausePending = true;
    void runNative(() => NativeRadio.pause()).catch(() => {}).finally(() => { nativePausePending = false; });
    void runNative(() => NativeRadio.setSleep({ minutes: 0 })).catch(() => {});
  } else media?.pause();
  liveResumePending = Boolean(activeResolvedSrc);
  pausedAtMs = Date.now();
  waiting.value = false;
  playing.value = false;
};

const sleepRemaining = ref(0);
const sleepTimer = createSleepTimer({
  onExpire: () => onPause(),
  onChange: (minutes: number) => { sleepRemaining.value = minutes; },
});
const sleepMenuItems = computed(() => [
  ...[15, 30, 60, 120].map(minutes => ({
    label: t('player.sleep_minutes', { minutes }),
    icon: 'i-lucide-timer',
    onSelect: () => { sleepTimer.start(minutes); if (nativePlayback) void runNative(() => NativeRadio.setSleep({ minutes })).catch(() => {}); },
  })),
  { label: t('player.sleep_cancel'), icon: 'i-lucide-x', disabled: !sleepRemaining.value, onSelect: () => { sleepTimer.cancel(); if (nativePlayback) void runNative(() => NativeRadio.setSleep({ minutes: 0 })).catch(() => {}); } },
]);
const checkSleepDeadline = () => { if (!document.hidden) sleepTimer.check(); };

const retryCurrentSource = (): void => {
  if (!online.value || !hasPlayableSource.value) return;
  listening.remember(playback.station, 'play');
  attemptCount.value = 0;
  userPaused.value = false;
  void applySource(activeSourceIndex.value, true);
};

const selectSource = (index: number): void => {
  if (!sourceList.value[index]) return;

  attemptCount.value = 0;
  streamError.value = false;
  userPaused.value = false;
  pendingAutoPlay.value = true;
  activeResolvedSrc = "";
  void applySource(index, true);
};

const onSourceChange = (event: Event): void => {
  const target = event.target as HTMLSelectElement;
  selectSource(Number(target.value));
};

const selectStation = (station: RadioStationOption): void => {
  if (station.id === props.activeStationId) {
    // The Global provider rotates signed HLS tokens. If a previously selected
    // lease expired, a queue click must request a NEW stream rather than
    // silently doing nothing because the current audio source is empty.
    if (!hasPlayableSource.value && station.url?.startsWith('/global-radio/apple-music/')) {
      mobileQueueOpen.value = false;
      emit("select-station", station);
      return;
    }
    if (!playing.value && hasPlayableSource.value) {
      void onPlay();
    }
    mobileQueueOpen.value = false;
    return;
  }

  userPaused.value = false;
  pendingAutoPlay.value = true;
  mobileQueueOpen.value = false;
  emit("select-station", station);
};

const navigateStation = (offset: -1 | 1): void => {
  const station = adjacentStation(offset);
  if (!station) return;

  selectStation(station);
};

// Media Session integrates live radio with iOS lock-screen / Control Center
// metadata and headset controls. Track controls switch STATIONS, never songs:
// an individual song cannot be skipped in a linear live broadcast.
const mediaSessionActions = ['play', 'pause', 'nexttrack', 'previoustrack', 'seekforward', 'seekbackward'] as const;
const updateMediaSession = (): void => {
  if (!import.meta.client || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  const details = buildRadioMediaMetadata({
    title: nowPlayingTitle.value,
    artist: nowPlayingArtist.value,
    station: props.streamName,
    artwork: nowPlayingArtwork.value,
    fallbackArtwork: props.thumb,
  }, window.location.origin);
  navigator.mediaSession.metadata = new MediaMetadata(details);
  navigator.mediaSession.playbackState = playing.value ? 'playing' : 'paused';
};

const registerMediaSession = (): void => {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => { void onPlay(); },
    pause: () => onPause(),
    nexttrack: () => navigateStation(1),
    previoustrack: () => navigateStation(-1),
    // iOS may expose ±10s controls for live audio instead of track buttons.
    // They cannot seek the station stream, so use them to switch stations too.
    seekforward: () => navigateStation(1),
    seekbackward: () => navigateStation(-1),
  } as const;
  for (const action of mediaSessionActions) {
    try {
      navigator.mediaSession.setActionHandler(action, handlers[action]);
    } catch {
      // WebKit versions may support metadata but not every hardware action.
    }
  }
  // Linear live streams do not have a meaningful timeline to seek to.
  try { navigator.mediaSession.setActionHandler('seekto', null); } catch { /* unsupported */ }
};

const clearMediaSession = (): void => {
  if (!('mediaSession' in navigator)) return;
  for (const action of mediaSessionActions) {
    try { navigator.mediaSession.setActionHandler(action, null); } catch { /* unsupported */ }
  }
  navigator.mediaSession.metadata = null;
};

const toggleMute = (): void => {
  const media = mediaElement.value;
  if (!media) return;
  media.muted = !media.muted;
};

const onVolumeInput = (event: Event): void => {
  const media = mediaElement.value;
  if (!media || systemVolumeOnly.value) return;

  const target = event.target as HTMLInputElement;
  const nextVolume = Math.max(0, Math.min(1, Number(target.value)));
  media.volume = nextVolume;

  if (nextVolume > 0 && media.muted) {
    media.muted = false;
  }
};

const updateOnlineStatus = (): void => {
  const wasOffline = !online.value;
  online.value = navigator.onLine;

  if (!online.value) {
    clearReconnectTimer();
    clearFallbackProbeTimer();
    clearStablePlaybackTimer();
    waiting.value = false;
    return;
  }

  if (wasOffline && !userPaused.value) {
    retryCurrentSource();
  }
};

const onMediaCanPlay = (): void => {
  // Metadata/buffer readiness is not proof of actual audio delivery.
  // Keep both reconnect and stall deadlines until onMediaPlaying confirms it.
  if (userPaused.value || !pendingAutoPlay.value) return;
  if (!playing.value) void tryPlay();
};

const flushHlsSongMetadata = (): void => {
  const stationUrl = props.stationUrl;
  const media = mediaElement.value;
  if (!stationUrl?.startsWith('/global-radio/apple-music/') || !media
    || userPaused.value || media.paused) return;
  const track = hlsSongBuffer.consume(media.currentTime);
  if (track) playback.setHlsLiveTrack(stationUrl, track);
};

const onMediaPlaying = (): void => {
  // A queued "playing" event can arrive after the user has paused or after
  // a failed/stopped source. Never let it resurrect playback or pollute history.
  if (userPaused.value || !hasPlayableSource.value || !activeResolvedSrc || !playback.station) return;
  listening.remember(playback.station, 'play', true);
  if (listeningDuration.enabled) {
    listeningDurationTracker.start(playback.station);
    listeningDuration.setLivePreview(listeningDurationTracker.activeUrl, 0);
  }
  clearReconnectTimer();
  clearFallbackProbeTimer();
  startStablePlaybackTimer();
  pendingAutoPlay.value = false;
  waiting.value = false;
  playing.value = true;
  streamError.value = false;
  if (!hasPlayedCurrentSource.value) lastSourcePlaybackAt.value = Date.now();
  hasPlayedCurrentSource.value = true;
  sourceFailureReason.value = '';
  flushHlsSongMetadata();
};

const onMediaWaiting = (): void => {
  stopListeningDuration();
  clearStablePlaybackTimer();
  playing.value = false;
  if (!userPaused.value) {
    waiting.value = true;
    pendingAutoPlay.value = true;
    startFallbackProbe();
  }
};

// stalled describes network delivery; buffered audio may still be playing.
const onMediaStalled = (): void => {
  if ((mediaElement.value?.readyState ?? 0) < 3) onMediaWaiting();
};

const onMediaPause = (): void => {
  stopListeningDuration();
  clearStablePlaybackTimer();
  playing.value = false;
};

const onMediaEnded = (): void => {
  stopListeningDuration();
  clearStablePlaybackTimer();
  playing.value = false;
  if (!userPaused.value) scheduleReconnect();
};

const onMediaError = (): void => {
  stopListeningDuration();
  clearStablePlaybackTimer();
  if (!activeResolvedSrc || userPaused.value) return;

  // hls.js reports richer network/media failures through Hls.Events.ERROR.
  // Handling the media element error as well can schedule a duplicate retry
  // while the MediaSource is still attaching.
  if (hlsInstance) return;

  waiting.value = false;
  playing.value = false;
  const mediaCode = mediaElement.value?.error?.code ?? 0;
  unsupportedSource.value = [3, 4].includes(mediaCode);
  sourceFailureReason.value = playbackFailureReason({ mediaCode });
  scheduleReconnect();
};

const onVolumeChange = (): void => {
  const media = mediaElement.value;
  if (!media) return;
  volume.value = media.volume;
  muted.value = media.muted;
  if (nativePlayback) void runNative(() => NativeRadio.setVolume({ volume: media.muted ? 0 : media.volume })).catch(() => {});
  if (preferences.rememberVolume) {
    try {
      localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ volume: media.volume, muted: media.muted }));
    } catch { /* Storage restrictions must not interrupt audio. */ }
  }
};

const bindMediaEvents = (): void => {
  const media = mediaElement.value;
  if (!media) return;

  media.addEventListener("canplay", onMediaCanPlay);
  media.addEventListener("playing", onMediaPlaying);
  media.addEventListener("waiting", onMediaWaiting);
  media.addEventListener("stalled", onMediaStalled);
  media.addEventListener("pause", onMediaPause);
  media.addEventListener("ended", onMediaEnded);
  media.addEventListener("error", onMediaError);
  media.addEventListener("volumechange", onVolumeChange);
  // Consume ID3 at audible playback time, not when a future HLS fragment
  // has only been downloaded/buffered.
  media.addEventListener("timeupdate", flushHlsSongMetadata);
};

const unbindMediaEvents = (): void => {
  const media = mediaElement.value;
  if (!media) return;

  media.removeEventListener("canplay", onMediaCanPlay);
  media.removeEventListener("playing", onMediaPlaying);
  media.removeEventListener("waiting", onMediaWaiting);
  media.removeEventListener("stalled", onMediaStalled);
  media.removeEventListener("pause", onMediaPause);
  media.removeEventListener("ended", onMediaEnded);
  media.removeEventListener("error", onMediaError);
  media.removeEventListener("volumechange", onVolumeChange);
  media.removeEventListener("timeupdate", flushHlsSongMetadata);
};

watch(() => preferences.autoReconnect, (enabled) => {
  if (!enabled) {
    clearReconnectTimer();
    // Disabling auto-reconnect must not leave an endless spinner.
    // A stalled source times out to a manual Retry state instead.
    if (waiting.value && !userPaused.value && online.value) startFallbackProbe();
  }
});

watch([playing, waiting], ([isPlaying, isWaiting]) => {
  playback.playing = isPlaying;
  playback.waiting = isWaiting;
});

// Track/station images and song titles can update asynchronously via Zing;
// keep lock-screen metadata synchronized without restarting playback.
watch(
  [nowPlayingTitle, nowPlayingArtist, nowPlayingArtwork, () => props.streamName, playing],
  updateMediaSession,
  { flush: 'post' },
);

const sourceSignature = computed(() => JSON.stringify([props.stationUrl, sourceList.value]));
watch(
  [sourceSignature, () => props.playRequest, () => props.pauseRequest],
  ([signature, request, pause], [previousSignature, previousRequest, previousPause]) => {
    if (pause !== previousPause) onPause();
    if (signature === previousSignature) {
      if (request !== previousRequest) void onPlay();
      return;
    }
    // An explicit station selection must survive reload even when the stream
    // never reaches the media "playing" event. Do not mark it as heard yet:
    // Recently Played is updated only after real playback starts.
    if (request !== previousRequest) listening.remember(playback.station, 'play');
    const autoplay = !userPaused.value || request !== previousRequest;
    stopListeningDuration();
    sourceVersion += 1;
    hlsSongBuffer.clear();
    if (props.stationUrl?.startsWith('/global-radio/apple-music/')) {
      playback.clearHlsLiveTrack(props.stationUrl);
    }
    activeSourceIndex.value = 0;
    activeResolvedSrc = "";
    attemptCount.value = 0;
    hasPlayedCurrentSource.value = false;
    lastSourcePlaybackAt.value = null;
    sourceFailureReason.value = '';
    unsupportedSource.value = false;
    streamError.value = false;
    playing.value = false;
    waiting.value = false;
    pendingAutoPlay.value = false;
    clearReconnectTimer();
    clearFallbackProbeTimer();
    clearStablePlaybackTimer();
    destroyHls();
    if (nativePlayback) {
      nativeActiveId = '';
      const version = sourceVersion;
      const stationUrl = props.stationUrl;
      void runNative(async () => {
        if (version !== sourceVersion) return;
        if (!autoplay && stationUrl) {
          const state = await NativeRadio.getState();
          if (version !== sourceVersion) return;
          if (nativeStationMatches(state, stationUrl)) {
            nativeActiveId = state.id;
            nativePlayObserved = Boolean(state.playWhenReady || state.playing);
            activeResolvedSrc = sourceList.value[activeSourceIndex.value]?.src || '';
            // A restored paused live stream may have an expired buffer. A
            // later Play action must reconnect if the listener chose live resume.
            liveResumePending = !state.playWhenReady && Boolean(activeResolvedSrc);
            pausedAtMs = 0;
            // The saved station is initially restored without sources; wait
            // for its catalog entry before marking native playback active.
            if (state.playWhenReady && hasPlayableSource.value) {
              userPaused.value = false;
              if (state.playing) onMediaPlaying();
              else if (state.state === 2 && !state.suppression) onMediaWaiting();
            }
            return;
          }
        }
        nativeActiveId = '';
        await NativeRadio.stop();
      }).catch(() => {});
    }
    const media = mediaElement.value;
    if (media) {
      media.pause();
      media.removeAttribute("src");
      media.load();
    }
    userPaused.value = !autoplay;
    if (autoplay && hasPlayableSource.value) void applySource(0, true);
  },
  { flush: "post" },
);

watch(() => props.country, () => {
  const [, area, country] = props.country.split(".");
  if (area && country) $store.setTimezone(area.replace(/_/g, "-"), country.replace(/_/g, "-"));
});

// A privacy opt-out or explicit data deletion must discard buffered time without
// writing storage or emitting a final GA4 listening-duration report.
const resetListeningTracking = (): void => {
  listeningDurationTracker.discard();
  listeningDuration.setLivePreview('', 0);
  if (listeningDuration.enabled && playing.value && !waiting.value && !userPaused.value
    && !streamError.value && activeResolvedSrc && playback.station) {
    listeningDurationTracker.start(playback.station);
    listeningDuration.setLivePreview(listeningDurationTracker.activeUrl, 0);
  }
};
watch(() => listeningDuration.enabled, resetListeningTracking, { flush: 'sync' });

onMounted(() => {
  if (nativePlayback) {
    nativeListenerReady = NativeRadio.addListener('state', (state: NativeRadioState) => {
      if (state.id === nativeActiveId && (state.playWhenReady || state.playing)) nativePlayObserved = true;
      // A Play command from the Android notification or headset is also an
      // explicit user action. Ignore late playing events while pausing.
      if (userPaused.value && state.id === nativeActiveId && state.playing && hasPlayableSource.value && !nativePausePending) {
        userPaused.value = false;
      }
      const action = nativeRadioAction(state, nativeActiveId, userPaused.value, nativePlayObserved);
      if (action !== 'ignore' && props.stationUrl?.startsWith('/global-radio/apple-music/')
        && state.title && state.artist && state.title !== props.streamName && state.artist !== props.countryName) {
        playback.setHlsLiveTrack(props.stationUrl, { title: state.title, artist: state.artist });
      }
      if (action === 'error') {
        sourceFailureReason.value = nativeFailureReason(state.error);
        playing.value = false;
        scheduleReconnect();
      } else if (action === 'playing') {
        onMediaPlaying();
      } else if (action === 'waiting') {
        onMediaWaiting();
      } else if (action === 'suppressed') {
        onMediaPause();
        clearFallbackProbeTimer();
        waiting.value = false;
      } else if (action === 'ended') {
        onMediaEnded();
      } else if (action === 'pause') {
        // Pause from the system notification, Bluetooth or audio focus.
        onPause();
      }
    }).then(handle => { nativeListener = handle; });
  }
  preferences.hydrate();
  listeningDuration.hydrate();
  // Update the statistics dashboard every second while only persisting
  // checkpoints every five seconds to avoid excessive localStorage writes.
  durationInterval = setInterval(() => {
    durationTickCount += 1;
    if (durationTickCount % 5 === 0) listeningDurationTracker.flush();
    listeningDuration.setLivePreview(listeningDurationTracker.activeUrl, listeningDurationTracker.pendingMs);
  }, 1_000);
  window.addEventListener('pagehide', stopListeningDuration);
  window.addEventListener('radio:listening-duration-reset', resetListeningTracking);
  document.addEventListener("visibilitychange", checkSleepDeadline);
  window.addEventListener("pageshow", checkSleepDeadline);
  playerCompact.value = localStorage.getItem('radio:player-compact') === '1';
  playerMini.value = localStorage.getItem('radio:player-mini') === '1';
  playback.queueOpen = localStorage.getItem(PLAYER_QUEUE_OPEN_KEY) === '1' && !playerMini.value;
  systemVolumeOnly.value = usesSystemVolumeControls(navigator);
  const [, area, country] = props.country.split(".");
  if (area && country) {
    $store.setTimezone(area.replace(/_/g, "-"), country.replace(/_/g, "-"));
  }

  updateViewport();
  window.addEventListener("resize", updateViewport);
  online.value = navigator.onLine;

  // Restore before binding volumechange so partial restoration cannot overwrite preferences.
  const savedMedia = mediaElement.value;
  if (savedMedia && preferences.rememberVolume) {
    try {
      const saved = JSON.parse(localStorage.getItem(AUDIO_PREFERENCES_KEY) || 'null');
      if (saved && typeof saved.muted === 'boolean') savedMedia.muted = saved.muted;
      if (!systemVolumeOnly.value && typeof saved?.volume === 'number'
        && Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1) {
        savedMedia.volume = saved.volume;
      }
    } catch { /* Ignore malformed or unavailable preferences. */ }
  }
  bindMediaEvents();
  registerMediaSession();
  updateMediaSession();

  const media = mediaElement.value;
  if (media) {
    volume.value = media.volume;
    muted.value = media.muted;
  }

  // hls.js is loaded on demand by configureHlsSource; plain streams need no HLS download.

  // Reload restores a selection, never playback. Only a click in this session can play.
  const autoPlayEnabled = Boolean(props.playRequest);
  userPaused.value = !autoPlayEnabled;

  if (autoPlayEnabled && hasPlayableSource.value) {
    void applySource(0, true);
  }

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
});

onUnmounted(() => {
  void nativeListener?.remove();
  stopListeningDuration();
  if (durationInterval) clearInterval(durationInterval);
  window.removeEventListener('pagehide', stopListeningDuration);
  window.removeEventListener('radio:listening-duration-reset', resetListeningTracking);
  sleepTimer.cancel();
  document.removeEventListener("visibilitychange", checkSleepDeadline);
  window.removeEventListener("pageshow", checkSleepDeadline);
  clearMediaSession();
  sourceVersion += 1;
  clearReconnectTimer();
  clearFallbackProbeTimer();
  clearStablePlaybackTimer();
  unbindMediaEvents();
  destroyHls();


  window.removeEventListener("resize", updateViewport);
  window.removeEventListener("online", updateOnlineStatus);
  window.removeEventListener("offline", updateOnlineStatus);
});
const siteAssetUrl = useSiteAssetUrl();
</script>

<style scoped>
.radio-audio-host {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  opacity: 0;
  pointer-events: none;
}

.radio-queue-action {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--radio-border);
  border-radius: 12px;
  background: var(--radio-surface-soft);
  color: var(--radio-text);
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25rem;
  white-space: normal;
  text-align: left;
}

button.radio-queue-action:not(:disabled):hover {
  background: var(--radio-hover);
}

button.radio-queue-action:focus-visible {
  outline: 2px solid #f43f5e;
  outline-offset: 2px;
}

.radio-player-console {
  isolation: isolate;
}

.radio-player-dock-compact {
  --radio-player-height: 64px;
}

.radio-player-artwork {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--radio-border) 58%, transparent);
}

.radio-player-title {
  overflow: hidden;
  white-space: nowrap;
}

.radio-player-title span {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

.radio-player-meta {
  line-height: 1rem;
}

.radio-player-live-pill {
  letter-spacing: 0;
}

.radio-player-main-action:not(:disabled):hover {
  transform: translateY(-1px);
}

.radio-player-main-action:not(:disabled):active {
  transform: translateY(0);
}

@media (max-width: 639px) {
  /* Three real grid columns keep station metadata, Play and Playlist separate. */
  .radio-player-console > :first-child {
    min-width: 0;
  }

  .radio-player-console .radio-player-controls {
    position: static;
    transform: none;
    min-width: 0;
  }

  .radio-player-meta {
    min-height: 1rem;
  }
}

.radio-bar.is-playing:nth-child(1) {
  animation: radio-eq 0.8s ease-in-out infinite alternate;
}

.radio-bar.is-playing:nth-child(2) {
  animation: radio-eq 0.62s ease-in-out 0.12s infinite alternate;
}

.radio-bar.is-playing:nth-child(3) {
  animation: radio-eq 0.72s ease-in-out 0.24s infinite alternate;
}

@keyframes radio-eq {
  from { transform: scaleY(0.45); }
  to { transform: scaleY(1); }
}

@media (max-width: 639px) {
  .radio-player-title-marquee span {
    max-width: none;
    min-width: 100%;
    overflow: visible;
    padding-right: 2rem;
    text-overflow: clip;
    animation: radio-title-marquee 10s linear infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .radio-player-title-marquee span {
    animation: none;
  }
}

@keyframes radio-title-marquee {
  0%, 18% { transform: translateX(0); }
  82%, 100% { transform: translateX(calc(-100% + 11rem)); }
}

.radio-volume::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  appearance: none;
  border-radius: 9999px;
  background: #fb7185;
  box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.16);
}

.radio-volume::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 9999px;
  background: #fb7185;
  box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.16);
}
/* Keep a 44px touch target without making the visible mobile track oversized. */
.radio-volume-mobile::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 9999px;
  background: var(--radio-track);
}

.radio-volume-mobile::-moz-range-track {
  height: 4px;
  border-radius: 9999px;
  background: var(--radio-track);
}

.radio-volume-mobile::-webkit-slider-thumb {
  width: 22px;
  height: 22px;
  margin-top: -9px;
}

.radio-volume-mobile::-moz-range-thumb {
  width: 22px;
  height: 22px;
}
</style>

