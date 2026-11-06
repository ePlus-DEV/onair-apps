import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HOMEPAGE_FEATURED_STATION_PATHS } from '../utils/featured-stations.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('VOV is first featured but must never preempt a saved station on home', async () => {
  const home = await read('pages/index.vue');
  const restore = await read('composables/useRestoreLastStation.ts');
  assert.equal(HOMEPAGE_FEATURED_STATION_PATHS[0], 'asia/viet-nam/vov-gt-hcm');
  assert.match(home, /if \(import\.meta\.server\) return;/);
  assert.match(home, /listening\.hydrate\(\);[\s\S]*?if \(listening\.library\.lastStation\) return;/);
  assert.match(home, /onlyIfIdle: true/);
  assert.match(restore, /const saved = listening\.library\.lastStation;/);
  assert.match(restore, /playback\.activate\(\{[\s\S]*?sources: \[\],[\s\S]*?onlyIfIdle: true/);
});

test('country fallback cannot seed SSR state before saved station restoration', async () => {
  const country = await read('pages/[area]/[country]/index.vue');
  assert.match(country, /watch\(catalog, \(\) => \{[\s\S]*?if \(import\.meta\.server\) return;/);
  assert.match(country, /listening\.hydrate\(\);\s*if \(listening\.library\.lastStation\) return;\s*listenDefault\(\)/);
});

test('explicit selection persists before stream success without adding to recent history', async () => {
  const player = await read('components/player/Player.vue');
  const watcher = player.indexOf('const sourceSignature = computed');
  const restore = player.indexOf("if (request !== previousRequest) listening.remember(playback.station, 'play');");
  const apply = player.indexOf('if (autoplay && hasPlayableSource.value) void applySource(0, true);', watcher);
  assert.ok(watcher > 0 && restore > watcher && apply > restore);
  // Only the actual audio playing event marks a station as heard.
  assert.match(player, /const onMediaPlaying = \(\): void => \{[\s\S]*?listening\.remember\(playback\.station, 'play', true\);/);
  assert.doesNotMatch(player.slice(watcher, apply), /remember\(playback\.station, 'play', true\)/);
});
