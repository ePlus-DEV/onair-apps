import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('station page owns the static catalog and the application owns playback lifetime', async () => {
  const page = await readFile('pages/[area]/[country]/[station].vue', 'utf8');
  const panel = await readFile('components/panel/Station.vue', 'utf8');
  const app = await readFile('app.vue', 'utf8');
  assert.match(page, /const stationCatalogKey = computed/);
  assert.match(page, /stationCatalogPayload\.value\?\.key === stationCatalogKey\.value/);
  assert.match(page, /lg:grid-cols-\[minmax\(0,14rem\)_minmax\(0,1fr\)\]/);
  assert.match(page, /sourceCount/);
  assert.match(page, /playback\.queueOpen = true/);
  assert.doesNotMatch(page, /<Player\s|@update-data=|pollSchedule|onBeforeUnmount/);
  assert.doesNotMatch(panel, /\$fetch<|emit\("update-data"/);
  assert.match(app, /<PlayerSession\s*\/>/);
});
test('Zing metadata belongs to the selected provider and is reset on station changes', async () => {
  const realtime = await readFile('composables/useStationRealtime.ts', 'utf8');
  assert.match(realtime, /if \(isZingScheduleUrl\(url\)\)/);
  assert.match(realtime, /watch\(\(\) => playback\.station\?\.url, activate\)/);
  assert.match(realtime, /lyricsOpen\.value = false/);
  assert.doesNotMatch(realtime, /useRoute|viet-nam/);
});



test('detail navigation never requests playback unless an explicit player action asks for the route', async () => {
  const [detail, session, stationPanel, featuredPanel, searchResult] = await Promise.all([
    readFile('pages/[area]/[country]/[station].vue', 'utf8'),
    readFile('components/player/Session.vue', 'utf8'),
    readFile('components/panel/Station.vue', 'utf8'),
    readFile('components/panel/FeaturedStations.vue', 'utf8'),
    readFile('components/search/Result.vue', 'utf8'),
  ]);

  // Direct deep links prepare an idle player, never take over a different station.
  assert.match(detail, /watch\(\[stationMeta, stationPath, \(\) => playback\.requestedStationUrl\]/);
  assert.match(detail, /if \(requested === path\) activateStation\(true\)/);
  assert.match(detail, /else if \(!playback\.station && !requested\) activateStation\(\)/);
  assert.doesNotMatch(detail, /watch\(stationMeta, \(meta\) => \{ if \(meta\) activateStation\(\)/);
  assert.match(detail, /const playStation = \(\): void => \{[\s\S]*?activateStation\(true\)/);

  // Queue/Next/Previous remain explicit playback intents despite opening the route.
  assert.match(session, /playback\.requestStation\(target\.url\)/);
  assert.match(session, /void navigateTo\(target\.url\)/);
  assert.match(session, /target\.url\.startsWith\('\/global-radio\/apple-music\/'\)/);
  for (const panel of [stationPanel, featuredPanel]) {
    assert.match(panel, /:to="station\.url"/);
    const link = panel.match(/<NuxtLink[\s\S]*?<\/NuxtLink>/)?.[0];
    assert.ok(link);
    assert.doesNotMatch(link, /requestStation|activateStation|select-station/);
  }
  assert.match(searchResult, /:to="item\.url"/);
  assert.doesNotMatch(searchResult, /requestStation|activateStation/);
});
