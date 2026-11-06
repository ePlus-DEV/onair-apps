<template>
  <details class="rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] p-4">
    <summary class="radio-interactive cursor-pointer text-sm font-semibold text-[var(--radio-text)]">
      {{ t('global_radio.hls_preview_title') }}
    </summary>
    <div class="mt-3 space-y-3">
      <p class="text-xs leading-6 text-[var(--radio-text-muted)]">{{ t('global_radio.hls_preview_help') }}</p>
      <form class="space-y-3" @submit.prevent="startPreview">
        <label class="block space-y-1.5">
          <span class="text-xs font-semibold">{{ t('global_radio.hls_preview_input') }}</span>
          <input v-model="temporaryUrl" type="password" autocomplete="off" autocapitalize="off"
            spellcheck="false" inputmode="url"
            class="radio-interactive block min-h-11 w-full min-w-0 rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface)] px-3 text-sm text-[var(--radio-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            :placeholder="t('global_radio.hls_preview_placeholder')"
            :aria-label="t('global_radio.hls_preview_input')" />
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <button type="submit" :disabled="!temporaryUrl.trim() || state === 'loading'"
            class="radio-interactive inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
            <UIcon name="i-lucide-play-circle" class="h-4 w-4" aria-hidden="true" />
            {{ t('global_radio.hls_preview_play') }}
          </button>
          <button type="button" class="radio-interactive inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--radio-border)] px-4 text-xs font-semibold text-[var(--radio-text)] hover:border-rose-500"
            @click="stopPreview">
            <UIcon name="i-lucide-square" class="h-4 w-4" aria-hidden="true" />
            {{ t('global_radio.hls_preview_stop') }}
          </button>
        </div>
      </form>
      <audio ref="temporaryAudio" :controls="state === 'loading' || state === 'playing'"
        :class="state === 'loading' || state === 'playing' ? 'block w-full' : 'hidden'"
        preload="none" playsinline
        :aria-label="t('global_radio.hls_preview_audio')"
        @playing="onPlaying" @pause="onPaused" @error="onAudioError" />
      <p v-if="state !== 'idle'" class="text-xs leading-5 text-[var(--radio-text-muted)]" role="status" aria-live="polite">
        {{ t('global_radio.hls_preview_' + message) }}
      </p>
      <p class="text-xs leading-5 text-[var(--radio-text-muted)]">{{ t('global_radio.hls_preview_privacy') }}</p>
    </div>
  </details>
</template>

<script setup lang="ts">
import { inspectAppleHlsPreviewUrl } from '~/utils/apple-hls-preview.mjs';
import { usePlaybackStore } from '~/stores/playback';
import type { GlobalRadioStation } from '~/types/global-radio';

const props = defineProps<{ station: GlobalRadioStation }>();
const { t } = useI18n();
const playback = usePlaybackStore();
const temporaryUrl = ref('');
const temporaryAudio = ref<HTMLAudioElement | null>(null);
const state = ref<'idle' | 'loading' | 'playing' | 'error'>('idle');
const message = ref('checking');

let activeHls: import('hls.js').default | null = null;
let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

// Always tear down our temporary audio before a route change or another
// station request. It never touches saved favorites, history or catalog data.
function cleanup(clearUrl = true) {
  attempt += 1;
  if (deadlineTimer) clearTimeout(deadlineTimer);
  deadlineTimer = null;
  if (activeHls) {
    activeHls.destroy();
    activeHls = null;
  }
  if (temporaryAudio.value) {
    temporaryAudio.value.pause();
    temporaryAudio.value.removeAttribute('src');
    temporaryAudio.value.load();
  }
  if (clearUrl) temporaryUrl.value = '';
}
function fail(error: string) {
  cleanup(false);
  state.value = 'error';
  message.value = error;
}
function stopPreview() {
  cleanup();
  state.value = 'idle';
  message.value = 'checking';
}
function onPlaying() {
  if (state.value === 'loading') {
    state.value = 'playing';
    message.value = 'playing';
  }
}
function onPaused() {
  if (state.value === 'playing') {
    state.value = 'error';
    message.value = 'paused';
  }
}
function onAudioError() {
  if (state.value === 'loading' || state.value === 'playing') fail('unavailable');
}

async function startPreview() {
  cleanup(false);
  const check = inspectAppleHlsPreviewUrl(temporaryUrl.value, props.station.listen_url);
  if (!check.ok) {
    state.value = 'error';
    message.value = check.reason;
    return;
  }
  const audio = temporaryAudio.value;
  if (!audio) return;
  const currentAttempt = ++attempt;
  state.value = 'loading';
  message.value = 'checking';

  // An experimental preview is allowed to play only while the global radio
  // is paused. Never attach a second source to PlayerSession or save tokens.
  if (playback.playing || playback.waiting) playback.pauseRequest += 1;
  const deadline = (check.expiresAt || 0) - Date.now() - 30000;
  deadlineTimer = setTimeout(() => {
    if (currentAttempt === attempt) fail('expired');
  }, Math.max(0, Math.min(deadline, 2147483647)));

  const source = temporaryUrl.value;
  // On iOS, play native HLS during the user gesture; other browsers continue
  // to use hls.js/MSE first, just like the primary radio player.
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS && audio.canPlayType('application/vnd.apple.mpegurl')) {
    audio.src = source;
    void audio.play().catch(() => {
      if (currentAttempt === attempt) fail('unavailable');
    });
    return;
  }

  try {
    const { default: Hls } = await import('hls.js');
    if (currentAttempt !== attempt) return;
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      activeHls = hls;
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (currentAttempt === attempt) hls.loadSource(source);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (currentAttempt !== attempt) return;
        void audio.play().catch(() => {
          if (currentAttempt === attempt) fail('unavailable');
        });
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (currentAttempt === attempt && data.fatal) fail('unavailable');
      });
      hls.attachMedia(audio);
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = source;
      void audio.play().catch(() => {
        if (currentAttempt === attempt) fail('unavailable');
      });
    } else {
      fail('unsupported');
    }
  } catch {
    if (currentAttempt === attempt) fail('unavailable');
  }
}

watch(() => props.station.id, stopPreview);
watch(() => playback.playing, isPlaying => {
  if (isPlaying && (state.value === 'loading' || state.value === 'playing')) stopPreview();
});
watch(() => playback.playRequest, () => {
  if (state.value === 'loading' || state.value === 'playing') stopPreview();
});
onBeforeUnmount(stopPreview);
</script>
