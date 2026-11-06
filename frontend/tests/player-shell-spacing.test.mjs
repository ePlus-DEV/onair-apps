import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPinia, setActivePinia } from 'pinia';
import { usePlaybackStore } from '../stores/playback.ts';

const read = path => readFile(path, 'utf8');

test('dock metadata does not generate blank desktop rows when artist or station is missing', async () => {
  const player = await read('components/player/Player.vue');
  assert.doesNotMatch(player, /&nbsp;|radio-player-meta-placeholder/);
  assert.match(player, /v-if="nowPlayingArtist"/);
  assert.match(player, /v-if="stationUrl"/);
  assert.match(player, /sm:hidden/);
  assert.match(player, /radio-player-controls[^\"]*items-center justify-center/);
});

test('mini player is reflected in the app shell and no longer reserves full dock height', async () => {
  const [app, player, css] = await Promise.all([
    read('app.vue'),
    read('components/player/Player.vue'),
    read('assets/css/main.css'),
  ]);
  assert.match(player, /const playerMini = toRef\(playback, 'playerMini'\)/);
  assert.match(app, /'radio-shell-player-mini': clientReady && playback\.playerMini/);
  assert.match(css, /\.radio-shell-player-mini\s*\{\s*padding-bottom: calc\(var\(--radio-mobile-nav-height\) \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(css, /\.radio-shell-player-mini \.radio-desktop-sidebar/);
  assert.match(css, /--radio-player-height: 80px;/);
  assert.match(app, /radio-player-inner mx-auto flex min-h-\[80px\]/);
  assert.match(css, /--radio-mobile-nav-height: 64px;/);
  assert.match(css, /--radio-mobile-player-gap: 8px;/);
});

test('mini mode is reactive and scoped to playback state, preserving one audio engine', () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  assert.equal(playback.playerMini, false);
  playback.playerMini = true;
  assert.equal(playback.playerMini, true);
  assert.equal(playback.station, null);
});
