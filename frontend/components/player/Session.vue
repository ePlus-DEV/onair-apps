<template>
  <Player
    :country="station?.countryKey || ''"
    :country-name="station ? $t(station.countryKey) : ''"
    :thumb="station?.image || ''"
    :stream-name="station?.title || $t('player.choose_station')"
    :stream-url="station?.sources[0] || emptySource"
    :stream-urls="station?.sources || emptySources"
    :station-url="station?.url"
    :active-station-id="station?.id"
    :stations="playback.stations"
    :play-request="playback.playRequest"
    :pause-request="playback.pauseRequest"
    :program="program"
    :playlist="playlist"
    :song="song"
    :queue-loading="loading"
    :schedule-source-url="scheduleSourceUrl"
    :schedule-is-reference="scheduleIsReference"
    :lyrics-available="isZingStation"
    @select-station="selectStation"
    @open-lyrics="lyricsOpen = true"
  />
  <UModal v-model:open="lyricsOpen" :title="$t('panel.lyric')" :description="station?.title" :ui="{ content: 'max-w-xl', body: 'radio-scrollbar max-h-[60dvh] overflow-y-auto' }">
    <template #body>
      <p v-for="(line, index) in lyrics" :key="index" dir="auto" class="py-2 text-sm leading-7 text-[var(--radio-text-muted)]">{{ line }}</p>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePlaybackStore } from '~/stores/playback';
import type { RadioSource, RadioStationOption } from '~/types/radio';

const playback = usePlaybackStore();
useRestoreLastStation();
const { station } = storeToRefs(playback);
const { program, playlist, song, lyrics, lyricsOpen, loading, isZingStation, scheduleSourceUrl, scheduleIsReference } = useStationRealtime();
const emptySource: RadioSource = { src: '', type: 'audio/mpeg' };
const emptySources: RadioSource[] = [];

const selectStation = (target: RadioStationOption) => {
  if (!target.url) return;
  // Queue and Next/Previous are explicit playback actions. Request the target
  // before navigating; a regular station-detail link never requests playback.
  // If a signed Global HLS URL expired and the shared player cleared it,
  // route the explicit queue click through the Global resolver rather than
  // requesting playback from an empty/stale source.
  if (target.url === playback.station?.url
    && target.url.startsWith('/global-radio/apple-music/')
    && !playback.station.sources.length) {
    playback.requestedStationUrl = target.url;
  } else {
    playback.requestStation(target.url);
  }
  void navigateTo(target.url);
};
</script>
