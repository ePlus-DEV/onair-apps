import { defineStore } from 'pinia';
import { LISTENING_LIBRARY_KEY, emptyListeningLibrary, parseListeningLibrary, rememberStation, removeRecentStation, toggleFavoriteStation } from '~/utils/listening-library.mjs';
import { mergeFavorites } from '~/utils/favorites-transfer.mjs';
import type { PlaybackStation } from '~/types/radio';

export const useListeningStore = defineStore('listening', {
  state: () => ({ library: emptyListeningLibrary(), ready: false }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.ready) return;
      try { this.library = parseListeningLibrary(localStorage.getItem(LISTENING_LIBRARY_KEY)); } catch { /* Storage may be disabled. */ }
      this.ready = true;
      // Keep open tabs in sync. Otherwise the next save from an older tab can
      // overwrite a newly played station or favorite with stale Pinia state.
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === LISTENING_LIBRARY_KEY || event.key === null) {
          this.library = parseListeningLibrary(event.newValue);
        }
      });
    },
    save() {
      if (!import.meta.client) return;
      try { localStorage.setItem(LISTENING_LIBRARY_KEY, JSON.stringify(this.library)); } catch { /* Keep the current session usable. */ }
    },
    remember(station: PlaybackStation | null, state: 'play' | 'pause', heard = false) {
      this.hydrate();
      this.library = rememberStation(this.library, station, state, heard);
      this.save();
    },
    toggleFavorite(station: { url: string; title: string; image: string; countryKey?: string }) {
      this.hydrate();
      this.library = toggleFavoriteStation(this.library, station);
      this.save();
    },
    mergeFavorites(stations: { url: string; title: string; image: string; countryKey?: string }[]) {
      this.hydrate();
      this.library = { ...this.library, favorites: mergeFavorites(this.library.favorites, stations) };
      this.save();
    },
    removeRecent(stationUrl: string) {
      this.hydrate();
      this.library = removeRecentStation(this.library, stationUrl);
      this.save();
    },
    clearRecent() { this.hydrate(); this.library.recent = []; this.save(); },
  },
});
