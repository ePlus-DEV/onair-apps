import { defineStore } from 'pinia';
import {
  LISTENING_DURATION_KEY,
  LISTENING_TRACKING_ENABLED_KEY,
  parseListeningTrackingEnabled,
  addListeningDurationAcrossDays,
  emptyListeningDuration,
  localDayKey,
  parseListeningDuration,
} from '~/utils/listening-duration.mjs';
import { createRawStorageSnapshot } from '~/utils/local-duration-snapshot.mjs';

const durationSnapshot = createRawStorageSnapshot();

export const useListeningDurationStore = defineStore('listeningDuration', {
  state: () => ({
    stats: emptyListeningDuration(),
    ready: false,
    enabled: true,
    // Live preview is not persisted: recorded checkpoints remain authoritative.
    activeStationUrl: '',
    liveMs: 0,
  }),
  getters: {
    todayMs: state => state.stats.todayKey === localDayKey() ? state.stats.todayMs : 0,
  },
  actions: {
    hydrate() {
      if (!import.meta.client || this.ready) return;
      try {
        this.enabled = parseListeningTrackingEnabled(localStorage.getItem(LISTENING_TRACKING_ENABLED_KEY));
        this.stats = durationSnapshot.external(
          localStorage.getItem(LISTENING_DURATION_KEY), parseListeningDuration, emptyListeningDuration,
        );
      } catch { /* Blocked storage should not interrupt playback or the controls. */ }
      this.ready = true;
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === LISTENING_TRACKING_ENABLED_KEY || event.key === null) {
          this.enabled = parseListeningTrackingEnabled(event.key === null
            ? localStorage.getItem(LISTENING_TRACKING_ENABLED_KEY) : event.newValue);
        }
        if (event.key === LISTENING_DURATION_KEY || event.key === null) {
          this.stats = durationSnapshot.external(
            event.key === null ? localStorage.getItem(LISTENING_DURATION_KEY) : event.newValue,
            parseListeningDuration, emptyListeningDuration,
          );
          if (event.newValue === null) window.dispatchEvent(new Event('radio:listening-duration-reset'));
        }
      });
    },
    setTrackingEnabled(enabled: boolean) {
      this.hydrate();
      this.enabled = Boolean(enabled);
      if (!this.enabled) this.setLivePreview('', 0);
      if (import.meta.client) {
        try {
          localStorage.setItem(LISTENING_TRACKING_ENABLED_KEY, this.enabled ? '1' : '0');
        } catch { /* Keep the in-memory privacy choice for this session. */ }
      }
    },
    clearStatistics() {
      this.hydrate();
      this.stats = emptyListeningDuration();
      this.setLivePreview('', 0);
      if (import.meta.client) {
        try {
          localStorage.removeItem(LISTENING_DURATION_KEY);
          durationSnapshot.saved(null);
        }
        catch { /* In-memory statistics have still been cleared. */ }
        // Player discards its unflushed buffer so deleted time never returns.
        // If playback continues with tracking enabled, a fresh session starts.
        window.dispatchEvent(new Event('radio:listening-duration-reset'));
      }
    },
    setLivePreview(stationUrl: string, elapsedMs: number) {
      this.activeStationUrl = stationUrl;
      this.liveMs = stationUrl && Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    },
    record(station: { url: string; title: string; image: string; countryKey?: string } | null, durationMs: number) {
      if (!station || durationMs <= 0) return;
      this.hydrate();
      if (!this.enabled) return;
      // Refresh from shared storage before adding time, so different tabs do
      // not blindly overwrite values from the previous write.
      if (import.meta.client) {
        try {
          const stored = localStorage.getItem(LISTENING_DURATION_KEY);
          this.stats = durationSnapshot.read(
            stored, this.stats, parseListeningDuration, emptyListeningDuration,
          );
        } catch { /* Keep tracking in memory for this session. */ }
      }
      this.stats = addListeningDurationAcrossDays(this.stats, station, durationMs);
      if (import.meta.client) {
        try {
          const raw = JSON.stringify(this.stats);
          localStorage.setItem(LISTENING_DURATION_KEY, raw);
          durationSnapshot.saved(raw);
        }
        catch { /* Keep tracking in memory for this session. */ }
      }
    },
  },
});
