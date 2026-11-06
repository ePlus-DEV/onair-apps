import { defineStore } from 'pinia';
import {
  LISTENER_PREFERENCES_KEY,
  DEFAULT_LISTENER_PREFERENCES,
  parseListenerPreferences,
} from '~/utils/listener-preferences.mjs';

type PreferenceKey = keyof typeof DEFAULT_LISTENER_PREFERENCES;

export const useListenerPreferencesStore = defineStore('listenerPreferences', {
  state: () => ({ ...DEFAULT_LISTENER_PREFERENCES, ready: false }),
  actions: {
    applyMotion() {
      if (import.meta.client) document.documentElement.classList.toggle('radio-reduce-motion', this.reduceMotion);
    },
    hydrate() {
      if (!import.meta.client || this.ready) return;
      try { Object.assign(this, parseListenerPreferences(localStorage.getItem(LISTENER_PREFERENCES_KEY))); }
      catch { /* Blocked storage must not interrupt playback. */ }
      this.ready = true;
      this.applyMotion();
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key !== LISTENER_PREFERENCES_KEY && event.key !== null) return;
        try { Object.assign(this, parseListenerPreferences(event.key === null ? localStorage.getItem(LISTENER_PREFERENCES_KEY) : event.newValue)); }
        catch { Object.assign(this, DEFAULT_LISTENER_PREFERENCES); }
        this.applyMotion();
      });
    },
    setPreference(key: PreferenceKey, enabled: boolean) {
      this.hydrate();
      this[key] = Boolean(enabled) as never;
      this.applyMotion();
      if (import.meta.client) {
        try {
          localStorage.setItem(LISTENER_PREFERENCES_KEY, JSON.stringify(
            Object.fromEntries(Object.keys(DEFAULT_LISTENER_PREFERENCES).map(name =>
              [name, this[name as PreferenceKey]])),
          ));
        } catch { /* Preference still applies to the current session. */ }
      }
    },
  },
});
