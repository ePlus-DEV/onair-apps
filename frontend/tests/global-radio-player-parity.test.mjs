import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPinia, setActivePinia } from 'pinia';
import { usePlaybackStore } from '../stores/playback.ts';
import {
  createAppleRadioQueue, createAuthorizedApplePlaybackStation,
} from '../utils/global-radio-station.mjs';
import { createPlaybackStation } from '../utils/playback-station.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const getProvider = async () => JSON.parse(await read('public/catalog/providers/apple-music.json'));
const appleStream = 'https://itsliveradio.apple.com/3p-tune-in/tune_in/978194965-ts/index-ts.m3u8?accessKey=test';

test('Global and Country share a full station queue, not a one-station player', async () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  const provider = await getProvider();
  const queue = createAppleRadioQueue(provider.stations);
  assert.equal(queue.length, 7);
  assert.deepEqual(queue.map(item => item.id), provider.stations.map(item => item.id));
  assert.equal(new Set(queue.map(item => item.url)).size, 7);
  assert.equal(queue.every(item => item.url.startsWith('/global-radio/apple-music/')), true);
  assert.doesNotMatch(JSON.stringify(queue), /m3u8|accessKey/);
  const first = provider.stations[0];
  const station = createAuthorizedApplePlaybackStation(first, appleStream);
  playback.activateGlobalRadio(station, first.listen_url, Date.now() + 120_000, queue);
  assert.equal(playback.station.url, queue[0].url);
  assert.equal(playback.stations.length, 7);
  assert.equal(playback.playRequest, 1);
  assert.equal(playback.globalRadioLease.stationUrl, queue[0].url);
  assert.equal(playback.globalRadioLease.listenUrl, first.listen_url);

  const country = createPlaybackStation({
    area: 'asia', country: 'viet-nam', id: 'vov', meta: { title: 'VOV', stream: 'https://example.test/vov.mp3' },
  });
  playback.activate(country, [{ id: country.id, title: country.title, image: country.image, url: country.url }], { autoplay: true });
  assert.equal(playback.station.url, '/asia/viet-nam/vov');
  assert.equal(playback.stations.length, 1);
  assert.equal(playback.globalRadioLease, null, 'country switching clears Global Radio lease');
});

test('Global HLS refresh retains the 7-station queue while changing the audio source', async () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  const provider = await getProvider();
  const queue = createAppleRadioQueue(provider.stations);
  const station = createAuthorizedApplePlaybackStation(provider.stations[0], appleStream);
  playback.activateGlobalRadio(station, provider.stations[0].listen_url, Date.now() + 120_000, queue);
  const secondStream = appleStream + '-refreshed';
  const accepted = playback.refreshGlobalRadioStream(station.url, secondStream, Date.now() + 240_000);
  assert.equal(accepted, true);
  assert.equal(playback.stations.length, 7);
  assert.equal(playback.station.sources[0].src, secondStream);
  assert.equal(playback.playRequest, 1, 'paused playback must not start during refresh');
  assert.equal(playback.refreshGlobalRadioStream('/global-radio/apple-music/another', 'https://evil.invalid', 0), false);
});

test('Global station cards have the same Play/Pause behavior as Country and may reuse unexpired HLS', async () => {
  const composable = await read('composables/useAuthorizedGlobalRadioPlayback.ts');
  const directory = await read('pages/global-radio/apple-music/index.vue');
  const detail = await read('pages/global-radio/apple-music/[station].vue');
  assert.match(composable, /playback\.playing \|\| playback\.waiting/);
  assert.match(composable, /playback\.pauseRequest \+= 1/);
  assert.match(composable, /playback\.playRequest \+= 1/);
  assert.match(composable, /globalRadioLease\.expiresAt > Date\.now\(\) \+ 45_000/);
  assert.match(composable, /activeController\?\.abort\(\)/);
  assert.match(composable, /createAppleRadioQueue\(getStations\(\)\)/);
  for (const page of [directory, detail]) {
    assert.match(page, /:aria-pressed=/);
    assert.match(page, /i-lucide-pause/);
    assert.match(page, /useAuthorizedGlobalRadioPlayback\(\(\) => provider\.value\?\.stations \|\| \[\]\)/);
  }
  assert.match(directory, /redesign\.paused/);
});

test('transient TuneIn renewal failure preserves an unexpired playing station', async () => {
  const renew = await read('plugins/global-radio-renew.client.ts');
  assert.match(renew, /Date\.now\(\) < lease\.expiresAt - 5_000/);
  assert.match(renew, /timer = setTimeout\(\(\) => \{ void refresh\(lease, version\); \}, retryInMs\)/);
  assert.match(renew, /playback\.station = \{ \.\.\.playback\.station, sources: \[\] \}/);
  assert.match(renew, /playback\.globalRadioLease = null/);
});

test('saved Global station restores an idle player from fresh HLS, never old accessKey or autoplay', async () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  const provider = await getProvider();
  const first = provider.stations[0];
  const queue = createAppleRadioQueue(provider.stations);
  playback.activateGlobalRadio(
    createAuthorizedApplePlaybackStation(first, appleStream),
    first.listen_url, Date.now() + 120_000, queue, { autoplay: false },
  );
  assert.equal(playback.playRequest, 0);
  assert.equal(playback.stations.length, 7);
  assert.equal(playback.station.sources.length, 1);
  const restore = await read('composables/useRestoreLastStation.ts');
  assert.match(restore, /PUBLIC_APPLE_TUNEIN_STATIONS/);
  assert.match(restore, /resolvePublicTuneInStream\(\{ station, corsServer: String\(config\.public\.corsServer \|\| ''\) \}\)/);
  assert.match(restore, /siteAssetUrl\('\/catalog\/providers\/apple-music\.json'\)/);
  assert.match(restore, /\{ autoplay: false \}/);
  assert.match(restore, /playback\.station \|\| playback\.playing/);
  assert.doesNotMatch(restore, /localStorage\.setItem\([^\n]*accessKey/);
});

test('Global queue and Next/Previous requests use the same shared player navigation contract', async () => {
  const session = await read('components/player/Session.vue');
  const detail = await read('pages/global-radio/apple-music/[station].vue');
  const player = await read('components/player/Player.vue');
  assert.match(session, /playback\.requestStation\(target\.url\)/);
  assert.match(session, /navigateTo\(target\.url\)/);
  assert.match(session, /target\.url\.startsWith\('\/global-radio\/apple-music\/'\)/);
  assert.match(detail, /stationId = computed\(\(\) => String\(route\.params\.station \|\| ''\)\)/);
  assert.match(detail, /requested !== stationPath\.value/);
  assert.match(detail, /playback\.requestedStationUrl = ''/);
  assert.match(detail, /void playOnEplus\(current\)/);
  assert.match(player, /!hasPlayableSource\.value && station\.url\?\.startsWith/);
  assert.match(player, /emit\("select-station", station\)/);
  assert.match(player, /const canNavigateStations = computed\(\(\) => stationCount\.value > 1\)/);
  assert.match(player, /navigateStation\(1\)/);
  assert.doesNotMatch(detail, /onMounted\([^)]*playOnEplus/, 'opening a detail route must never autoplay');
});
