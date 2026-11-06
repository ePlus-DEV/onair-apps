import { defineStore } from 'pinia';
import {
  ONLINE_DURATION_KEY,
  ONLINE_TRACKING_ENABLED_KEY,
  addOnlineDurationAcrossDays,
  emptyOnlineDuration,
  parseOnlineDuration,
  parseOnlineTrackingEnabled,
} from '~/utils/online-duration.mjs';
import { createRawStorageSnapshot } from '~/utils/local-duration-snapshot.mjs';

const durationSnapshot = createRawStorageSnapshot();

export const useOnlineDurationStore = defineStore('onlineDuration', {
  state: () => ({
    stats: emptyOnlineDuration(),
    enabled: true,
    ready: false,
    liveMs: 0,
  }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.ready) return;
      try {
        this.enabled = parseOnlineTrackingEnabled(localStorage.getItem(ONLINE_TRACKING_ENABLED_KEY));
        this.stats = durationSnapshot.external(
          localStorage.getItem(ONLINE_DURATION_KEY), parseOnlineDuration, emptyOnlineDuration,
        );
      } catch { /* Local storage is optional. */ }
      this.ready = true;
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === ONLINE_TRACKING_ENABLED_KEY || event.key === null) {
          this.enabled = parseOnlineTrackingEnabled(
            event.key === null ? localStorage.getItem(ONLINE_TRACKING_ENABLED_KEY) : event.newValue,
          );
        }
        if (event.key === ONLINE_DURATION_KEY || event.key === null) {
          this.stats = durationSnapshot.external(
            event.key === null ? localStorage.getItem(ONLINE_DURATION_KEY) : event.newValue,
            parseOnlineDuration, emptyOnlineDuration,
          );
          if (event.newValue === null) window.dispatchEvent(new Event('radio:online-duration-reset'));
        }
      });
    },
    setTrackingEnabled(enabled: boolean) {
      this.hydrate();
      this.enabled = Boolean(enabled);
      if (!this.enabled) this.liveMs = 0;
      if (import.meta.client) {
        try { localStorage.setItem(ONLINE_TRACKING_ENABLED_KEY, this.enabled ? '1' : '0'); }
        catch { /* Keep the current session functional. */ }
        window.dispatchEvent(new Event('radio:online-duration-reset'));
      }
    },
    clearStatistics() {
      this.hydrate();
      this.stats = emptyOnlineDuration();
      this.liveMs = 0;
      if (import.meta.client) {
        try {
          localStorage.removeItem(ONLINE_DURATION_KEY);
          durationSnapshot.saved(null);
        }
        catch { /* The in-memory result is still clear. */ }
        window.dispatchEvent(new Event('radio:online-duration-reset'));
      }
    },
    setLivePreview(ms: number) {
      this.liveMs = this.enabled && Number.isFinite(ms) ? Math.max(0, ms) : 0;
    },
    record(ms: number, endDate = new Date()) {
      this.hydrate();
      if (!this.enabled || ms <= 0) return;
      if (import.meta.client) {
        try {
          const stored = localStorage.getItem(ONLINE_DURATION_KEY);
          this.stats = durationSnapshot.read(
            stored, this.stats, parseOnlineDuration, emptyOnlineDuration,
          );
        } catch { /* Keep in-memory tracking if storage is blocked. */ }
      }
      this.stats = addOnlineDurationAcrossDays(this.stats, ms, endDate);
      if (import.meta.client) {
        try {
          const raw = JSON.stringify(this.stats);
          localStorage.setItem(ONLINE_DURATION_KEY, raw);
          durationSnapshot.saved(raw);
        }
        catch { /* Keep in-memory tracking if storage is blocked. */ }
      }
    },
  },
});
