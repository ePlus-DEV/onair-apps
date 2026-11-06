import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLibraryPlaybackQueue, parseLibraryStationPath } from '../utils/library-card-playback.mjs';

const station = (url, title = 'Radio') => ({ url, title, image: '/img/radio.png' });

test('library station path resolves only internal catalog station URLs', () => {
  assert.deepEqual(parseLibraryStationPath('/europe/united-kingdom/heart-uk'), {
    area: 'europe', country: 'united-kingdom', id: 'heart-uk',
  });
  for (const unsafe of [
    'https://example.com/europe/united-kingdom/heart-uk',
    '//external.example/radio/station', '/asia/../evil', '/asia/viet-nam/vov1?autoplay=1',
    '/asia/viet-nam/vov1#play', '/asia/viet-nam', '/asia//vov1', '/asia/viet-nam/vov1/extra',
  ]) assert.equal(parseLibraryStationPath(unsafe), null, unsafe);
});

test('library playback queue uses the stored group order without duplicate routes', () => {
  const options = buildLibraryPlaybackQueue([
    station('/europe/united-kingdom/heart-uk', 'Heart UK'),
    station('/asia/viet-nam/vov1', 'VOV1'),
    station('/europe/united-kingdom/heart-uk', 'Duplicated Heart'),
    station('https://evil.example/station', 'Unsafe'),
  ]);
  assert.deepEqual(options, [
    { id: 'heart-uk', url: '/europe/united-kingdom/heart-uk', title: 'Heart UK', image: '/img/radio.png' },
    { id: 'vov1', url: '/asia/viet-nam/vov1', title: 'VOV1', image: '/img/radio.png' },
  ]);
  assert.deepEqual(buildLibraryPlaybackQueue(null), []);
});

test('favorite and recent cards can play without leaving the page while retaining details and hearts', async () => {
  const source = await readFile(new URL('../components/panel/ListeningLibrary.vue', import.meta.url), 'utf8');
  assert.match(source, /v-for="group in groups"/);
  assert.match(source, /group\.key === 'recent'/);
  assert.match(source, /:to="station\.url"/);
  assert.match(source, /@click="openStationDetails\(\$event\)"/);
  const detailsHandler = source.match(/const openStationDetails = \(event: MouseEvent\) => \{[\s\S]*?\n\};/)?.[0];
  assert.ok(detailsHandler, 'Library details must have their own navigation handler');
  assert.doesNotMatch(detailsHandler, /playback\.requestStation|playback\.activate|autoplay/);
  assert.match(source, /@click="togglePlayback\(station, group\.items\)"/);
  assert.match(source, /isPlaying\(station\.url\) \? 'i-lucide-pause' : 'i-lucide-play'/);
  assert.match(source, /@click="listening\.toggleFavorite\(station\)"/);
  assert.match(source, /if \(isPlaying\(station\.url\)\)[\s\S]*?playback\.pauseRequest \+= 1/);
  assert.match(source, /if \(isActive\(station\.url\) && playback\.station\?\.sources\.length\)[\s\S]*?playback\.requestStation\(station\.url\)/);
  assert.match(source, /playback\.activate\(createPlaybackStation\([\s\S]*?\{ autoplay: true \}/);
  assert.match(source, /generation !== selectionGeneration/);
  assert.match(source, /onBeforeUnmount\(\(\) => \{ \+\+selectionGeneration;/);
});

test('recent-history cards expose individual remove actions while favorite cards do not', async () => {
  const source = await readFile(new URL('../components/panel/ListeningLibrary.vue', import.meta.url), 'utf8');
  assert.ok(source.includes("v-if=\"group.key === 'recent'\""));
  assert.ok(source.includes('icon="i-lucide-trash-2"'));
  assert.ok(source.includes('@click="listening.removeRecent(station.url)"'));
  assert.ok(source.includes("$t('library.remove_recent') + ': ' + station.title"));
  assert.ok(source.includes('@click="listening.toggleFavorite(station)"'));
});
