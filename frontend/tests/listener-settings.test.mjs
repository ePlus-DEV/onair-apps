import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LISTENER_PREFERENCES_KEY, DEFAULT_LISTENER_PREFERENCES, parseListenerPreferences,
  shouldReconnectToLive, safeLiveSyncPosition,
} from '../utils/listener-preferences.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('settings default to live audio without destroying legacy listening data', () => {
  assert.equal(LISTENER_PREFERENCES_KEY, 'radio:listener-preferences:v1');
  assert.deepEqual(parseListenerPreferences(null), DEFAULT_LISTENER_PREFERENCES);
  assert.equal(DEFAULT_LISTENER_PREFERENCES.resumeLive, true);
  assert.equal(DEFAULT_LISTENER_PREFERENCES.restoreStation, true);
  assert.equal(DEFAULT_LISTENER_PREFERENCES.rememberVolume, true);
  assert.equal(DEFAULT_LISTENER_PREFERENCES.autoReconnect, true);
});

test('invalid, partial and malicious preference documents cannot change the schema', () => {
  assert.deepEqual(parseListenerPreferences('{'), DEFAULT_LISTENER_PREFERENCES);
  assert.deepEqual(parseListenerPreferences('[]'), DEFAULT_LISTENER_PREFERENCES);
  assert.deepEqual(parseListenerPreferences(JSON.stringify({
    resumeLive: false, restoreStation: 'false', arbitraryKey: true, reduceMotion: true,
  })), { ...DEFAULT_LISTENER_PREFERENCES, resumeLive: false, reduceMotion: true });
  assert.deepEqual(Object.keys(parseListenerPreferences('{"__proto__":{"polluted":true}}')),
    Object.keys(DEFAULT_LISTENER_PREFERENCES));
  assert.equal({}.polluted, undefined);
});

test('live resume is only requested after a real pause with an active source', () => {
  assert.equal(shouldReconnectToLive({ resumeLive: true, hasPaused: true, activeSource: 'https://example.com/stream' }), true);
  assert.equal(shouldReconnectToLive({ resumeLive: false, hasPaused: true, activeSource: 'https://example.com/stream' }), false);
  assert.equal(shouldReconnectToLive({ resumeLive: true, hasPaused: false, activeSource: 'https://example.com/stream' }), false);
  assert.equal(shouldReconnectToLive({ resumeLive: true, hasPaused: true, activeSource: '' }), false);
});

test('HLS live position is constrained to the seekable live window', () => {
  const media = { seekable: { length: 1, start: () => 55, end: () => 120 } };
  assert.equal(safeLiveSyncPosition(117, media), 117);
  assert.equal(safeLiveSyncPosition(25, media), null);
  assert.equal(safeLiveSyncPosition(140, media), null);
  assert.equal(safeLiveSyncPosition(Infinity, media), null);
  assert.equal(safeLiveSyncPosition(90, { seekable: { length: 0 } }), null);
  assert.equal(safeLiveSyncPosition(90, { seekable: { length: 1, start: () => { throw Error('expired'); } } }), null);
});

test('player and session use the same Settings store; source identity survives Live Resume', async () => {
  const [player, restore, store] = await Promise.all([
    read('components/player/Player.vue'), read('composables/useRestoreLastStation.ts'),
    read('stores/listenerPreferences.ts'),
  ]);
  assert.match(player, /shouldReconnectToLive/);
  assert.match(player, /safeLiveSyncPosition\(hlsInstance\.liveSyncPosition/);
  assert.match(player, /await applySource\(activeSourceIndex\.value, true\)/);
  assert.match(player, /liveResumePending = Boolean\(activeResolvedSrc\)/);
  assert.match(player, /if \(!preferences\.autoReconnect\)/);
  assert.match(restore, /if \(!preferences\.restoreStation\) return/);
  assert.match(player, /const autoPlayEnabled = Boolean\(props\.playRequest\)/);
  assert.match(store, /localStorage\.setItem\(LISTENER_PREFERENCES_KEY/);
  assert.match(store, /addEventListener\('storage'/);
});

test('Settings is prerendered, discoverable, noindex and available in every locale', async () => {
  const [page, config, header, sidebar] = await Promise.all([
    read('pages/settings.vue'), read('nuxt.config.ts'),
    read('components/AppHeader.vue'), read('components/AppSidebar.vue'),
  ]);
  assert.match(page, /noindex, follow/);
  assert.match(config, /"\/settings"/);
  assert.match(header, /to="\/settings"/);
  assert.match(sidebar, /to="\/settings"/);
  assert.match(page, /listener_settings\.analytics_note/);
  const locales = ['en-US', 'vi-VN', 'ja-JP', 'fr-FR', 'ru-RU', 'zh-CN', 'zh-TW'];
  for (const locale of locales) {
    const dict = JSON.parse(await read('lang/' + locale + '.json')).listener_settings;
    assert.ok(dict, locale + ' missing listener_settings');
    for (const key of ['title', 'description', 'live_resume', 'live_resume_hint', 'reconnect',
      'restore', 'volume', 'motion', 'privacy', 'analytics_note', 'confirm_history',
      'confirm_stats', 'cancel', 'confirm']) {
      assert.ok(typeof dict[key] === 'string' && dict[key].trim(), locale + ' missing ' + key);
    }
  }
});

test('Settings keeps legacy library and volume localStorage keys intact', async () => {
  const [library, player, notice] = await Promise.all([
    read('stores/listening.ts'), read('components/player/Player.vue'), read('components/CookieConsent.vue'),
  ]);
  assert.match(library, /LISTENING_LIBRARY_KEY/);
  assert.match(player, /radio:audio-preferences:v1/);
  assert.match(player, /preferences\.rememberVolume/);
  assert.match(notice, /GA4 never depends on this value/);
});
