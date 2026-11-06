import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(path, 'utf8');

test('full player changes presentation without creating a second audio engine', async () => {
  const [player, screen, app] = await Promise.all([read('components/player/Player.vue'), read('components/player/NowPlaying.vue'), read('app.vue')]);
  assert.equal((player.match(/<audio\b/g) || []).length, 1);
  assert.match(player, /v-show="!nowPlayingOpen"/);
  assert.doesNotMatch(screen, /<audio\b|new Audio\b|\.play\(/);
  assert.equal((app.match(/<PlayerSession\b/g) || []).length, 1);
  assert.match(player, /@after:leave="finishPlayerAction"/);
  assert.match(screen, /v-else-if="nextStationTitle"/);
  assert.match(screen, /redesign.next_station/);
  assert.match(screen, /radio-now-playing-console/);
  assert.match(screen, /lg:grid-cols-\[minmax\(280px,0\.9fr\)_minmax\(0,1\.1fr\)\]/);
  assert.match(screen, /<UTooltip/);
});

test('personal library is navigable, compact and excluded from public SEO lists', async () => {
  const [page, panel, config, nav, css] = await Promise.all([read('pages/library.vue'), read('components/panel/ListeningLibrary.vue'), read('nuxt.config.ts'), read('components/MobileNavigation.vue'), read('assets/css/main.css')]);
  assert.match(page, /<ClientOnly>/);
  assert.match(page, /noindex, follow/);
  assert.match(panel, /radio-library-artwork/);
  assert.doesNotMatch(panel, /aspect-square w-full/);
  assert.match(config, /prerender:[\s\S]*"\/library"/);
  assert.doesNotMatch(config.split('prerender:')[0], /loc:\s*['"]\/library['"]/);
  assert.match(nav, /to="\/library"/);
  assert.match(css, /var\(--radio-player-height\) \+ var\(--radio-mobile-nav-height\) \+ var\(--radio-mobile-player-gap\) \+ env\(safe-area-inset-bottom\)/);
});
