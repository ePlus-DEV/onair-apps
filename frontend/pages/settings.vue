<template>
  <div class="mx-auto w-full max-w-6xl space-y-5 pb-8 sm:space-y-6">
    <header class="radio-surface flex flex-wrap items-center gap-4 rounded-3xl p-5 sm:p-7">
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        <UIcon name="i-lucide-settings-2" class="h-6 w-6" />
      </div>
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ t('listener_settings.title') }}</h1>
        <p class="mt-1 text-sm leading-6 text-[var(--radio-text-muted)]">{{ t('listener_settings.description') }}</p>
      </div>
    </header>

    <div class="grid items-start gap-4 lg:grid-cols-2">
      <section class="radio-surface space-y-4 rounded-3xl p-5 sm:p-6" :aria-label="t('listener_settings.listening')">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-headphones" class="h-5 w-5 text-rose-500" />
          <h2 class="text-lg font-bold">{{ t('listener_settings.listening') }}</h2>
        </div>
        <button type="button" role="switch" :aria-checked="preferences.resumeLive" class="settings-row" @click="preferences.setPreference('resumeLive', !preferences.resumeLive)">
          <span class="min-w-0"><span class="settings-label">{{ t('listener_settings.live_resume') }}</span><span class="settings-hint">{{ t('listener_settings.live_resume_hint') }}</span></span>
          <span :class="toggleClass(preferences.resumeLive)" class="settings-switch" aria-hidden="true"><span class="settings-switch-thumb" /></span>
        </button>
        <button type="button" role="switch" :aria-checked="preferences.autoReconnect" class="settings-row" @click="preferences.setPreference('autoReconnect', !preferences.autoReconnect)">
          <span class="min-w-0"><span class="settings-label">{{ t('listener_settings.reconnect') }}</span><span class="settings-hint">{{ t('listener_settings.reconnect_hint') }}</span></span>
          <span :class="toggleClass(preferences.autoReconnect)" class="settings-switch" aria-hidden="true"><span class="settings-switch-thumb" /></span>
        </button>
        <button type="button" role="switch" :aria-checked="preferences.restoreStation" class="settings-row" @click="preferences.setPreference('restoreStation', !preferences.restoreStation)">
          <span class="min-w-0"><span class="settings-label">{{ t('listener_settings.restore') }}</span><span class="settings-hint">{{ t('listener_settings.restore_hint') }}</span></span>
          <span :class="toggleClass(preferences.restoreStation)" class="settings-switch" aria-hidden="true"><span class="settings-switch-thumb" /></span>
        </button>
        <button type="button" role="switch" :aria-checked="preferences.rememberVolume" class="settings-row" @click="preferences.setPreference('rememberVolume', !preferences.rememberVolume)">
          <span class="min-w-0"><span class="settings-label">{{ t('listener_settings.volume') }}</span><span class="settings-hint">{{ t('listener_settings.volume_hint') }}</span></span>
          <span :class="toggleClass(preferences.rememberVolume)" class="settings-switch" aria-hidden="true"><span class="settings-switch-thumb" /></span>
        </button>
      </section>

      <div class="space-y-4">
        <section class="radio-surface space-y-4 rounded-3xl p-5 sm:p-6" :aria-label="t('listener_settings.appearance')">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-palette" class="h-5 w-5 text-rose-500" />
            <h2 class="text-lg font-bold">{{ t('listener_settings.appearance') }}</h2>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block space-y-2 text-sm font-semibold">
              <span>{{ t('listener_settings.theme') }}</span>
              <select :value="colorMode.preference" class="settings-select" @change="onThemeChange">
                <option v-for="mode in ['system', 'light', 'dark']" :key="mode" :value="mode">{{ t('text.darkmode.' + mode) }}</option>
              </select>
            </label>
            <label class="block space-y-2 text-sm font-semibold">
              <span>{{ t('navmenu.language') }}</span>
              <select :value="locale" class="settings-select" @change="onLanguageChange">
                <option v-for="item in locales" :key="item.code" :value="item.code">{{ item.name || item.code }}</option>
              </select>
            </label>
          </div>
          <button type="button" role="switch" :aria-checked="preferences.reduceMotion" class="settings-row" @click="preferences.setPreference('reduceMotion', !preferences.reduceMotion)">
            <span class="min-w-0"><span class="settings-label">{{ t('listener_settings.motion') }}</span><span class="settings-hint">{{ t('listener_settings.motion_hint') }}</span></span>
            <span :class="toggleClass(preferences.reduceMotion)" class="settings-switch" aria-hidden="true"><span class="settings-switch-thumb" /></span>
          </button>
        </section>

        <section class="radio-surface space-y-4 rounded-3xl p-5 sm:p-6" :aria-label="t('listener_settings.privacy')">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-shield-check" class="h-5 w-5 text-rose-500" />
            <h2 class="text-lg font-bold">{{ t('listener_settings.privacy') }}</h2>
          </div>
          <p class="text-sm leading-6 text-[var(--radio-text-muted)]">{{ t('listener_settings.privacy_hint') }}</p>
          <button type="button" role="switch" :aria-checked="duration.enabled" class="settings-row" @click="duration.setTrackingEnabled(!duration.enabled)">
            <span class="min-w-0"><span class="settings-label">{{ t('library.listening_tracking_title') }}</span><span class="settings-hint">{{ t('listener_settings.tracking_hint') }}</span></span>
            <span :class="toggleClass(duration.enabled)" class="settings-switch" aria-hidden="true"><span class="settings-switch-thumb" /></span>
          </button>
          <button type="button" role="switch" :aria-checked="online.enabled" class="settings-row" @click="online.setTrackingEnabled(!online.enabled)">
            <span class="min-w-0"><span class="settings-label">{{ t('online_stats.tracking') }}</span><span class="settings-hint">{{ t('online_stats.definition') }}</span></span>
            <span :class="toggleClass(online.enabled)" class="settings-switch" aria-hidden="true"><span class="settings-switch-thumb" /></span>
          </button>
          <p class="text-xs leading-5 text-[var(--radio-text-muted)]">{{ t('listener_settings.analytics_note') }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton to="/library#favorites" color="neutral" variant="outline" icon="i-lucide-heart" class="min-h-11">{{ t('listener_settings.favorites') }}</UButton>
            <UButton to="/library#stats" color="neutral" variant="outline" icon="i-lucide-chart-no-axes-column" class="min-h-11">{{ t('listener_settings.statistics') }}</UButton>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="soft" icon="i-lucide-history" class="min-h-11" @click="clearHistoryOpen = true">{{ t('listener_settings.clear_history') }}</UButton>
            <UButton color="error" variant="soft" icon="i-lucide-trash-2" class="min-h-11" @click="clearStatsOpen = true">{{ t('online_stats.clear_action') }}</UButton>
          </div>
          <p class="text-xs leading-5 text-[var(--radio-text-muted)]">{{ t('listener_settings.local_note') }}</p>
        </section>
      </div>
    </div>

    <UModal v-model:open="clearHistoryOpen" :title="t('listener_settings.confirm_history')" :description="t('listener_settings.confirm_history_hint')" :ui="{ content: 'max-w-md' }">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="clearHistoryOpen = false">{{ t('listener_settings.cancel') }}</UButton>
          <UButton color="error" @click="clearHistory">{{ t('listener_settings.confirm') }}</UButton>
        </div>
      </template>
    </UModal>
    <UModal v-model:open="clearStatsOpen" :title="t('online_stats.clear_title')" :description="t('online_stats.clear_description')" :ui="{ content: 'max-w-md' }">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="clearStatsOpen = false">{{ t('listener_settings.cancel') }}</UButton>
          <UButton color="error" @click="clearStats">{{ t('listener_settings.confirm') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useListenerPreferencesStore } from '~/stores/listenerPreferences';
import { useListeningDurationStore } from '~/stores/listeningDuration';
import { useOnlineDurationStore } from '~/stores/onlineDuration';
import { useListeningStore } from '~/stores/listening';

const { t, locale, locales, setLocale } = useI18n();
const colorMode = useColorMode();
const config = useRuntimeConfig();
const preferences = useListenerPreferencesStore();
const duration = useListeningDurationStore();
const online = useOnlineDurationStore();
const listening = useListeningStore();
const clearHistoryOpen = ref(false);
const clearStatsOpen = ref(false);

const toggleClass = (value: boolean): string => value ? 'settings-switch-on' : 'settings-switch-off';
const onThemeChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (['system', 'light', 'dark'].includes(value)) colorMode.preference = value;
};
const onLanguageChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (locales.value.some(item => item.code === value)) void setLocale(value);
};
const clearHistory = () => { listening.clearRecent(); clearHistoryOpen.value = false; };
const clearStats = () => { duration.clearStatistics(); online.clearStatistics(); clearStatsOpen.value = false; };

onMounted(() => {
  preferences.hydrate();
  duration.hydrate();
  online.hydrate();
  listening.hydrate();
});
useHead(() => ({
  title: t('listener_settings.title'),
  meta: [{ name: 'robots', content: config.public.noIndex ? 'noindex, nofollow, noarchive' : 'noindex, follow' }],
}));
</script>

<style scoped>
.settings-row { display: flex; width: 100%; min-height: 4.25rem; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--radio-border); padding: .875rem 0; text-align: left; cursor: pointer; }
.settings-row:focus-visible, .settings-select:focus-visible { outline: 2px solid #f43f5e; outline-offset: 3px; }
.settings-label { display: block; font-size: .875rem; font-weight: 650; color: var(--radio-text); }
.settings-hint { display: block; margin-top: .25rem; font-size: .75rem; line-height: 1.5; color: var(--radio-text-muted); }
.settings-switch { position: relative; display: inline-flex; width: 2.75rem; height: 1.5rem; flex-shrink: 0; align-items: center; border-radius: 9999px; transition: background-color .2s; }
.settings-switch-on { background: #f43f5e; }
.settings-switch-off { background: var(--radio-border); }
.settings-switch-thumb { position: absolute; left: .125rem; top: .125rem; height: 1.25rem; width: 1.25rem; border-radius: 9999px; background: #fff; box-shadow: 0 1px 3px #0003; transition: transform .2s; }
.settings-switch-on .settings-switch-thumb { transform: translateX(1.25rem); }
.settings-select { width: 100%; min-height: 2.75rem; border: 1px solid var(--radio-border); border-radius: .75rem; background: var(--radio-surface-soft); color: var(--radio-text); padding: 0 .75rem; cursor: pointer; }
</style>
