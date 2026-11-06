import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { usePlaybackStore } from '../stores/playback.ts';
import { createPlaybackStation } from '../utils/playback-station.mjs';

const station = id => createPlaybackStation({ area: 'asia', country: 'viet-nam', id, meta: { title: id, stream: 'https://radio.example/' + id + '.mp3' } });

test('desktop queue starts closed until the listener opens it', () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();

  assert.equal(playback.queueOpen, false);
});

test('browsing country/home catalogs preserves active audio and its station queue', () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  const first = station('first');
  playback.activate(first, [first], { autoplay: true });
  const active = playback.station;
  const second = station('second');
  playback.activate(second, [second], { onlyIfIdle: true });
  assert.equal(playback.station, active);
  assert.equal(playback.stations[0].id, 'first');
  assert.equal(playback.playRequest, 1);
});

test('revisiting a selected station preserves source identity; explicit play still requests playback', () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  playback.activate(station('first'), []);
  const active = playback.station;
  const sources = active.sources;
  playback.activate(station('first'), []);
  assert.equal(playback.station, active);
  assert.equal(playback.station.sources, sources);
  assert.equal(playback.playRequest, 0);
  playback.activate(station('first'), [], { autoplay: true });
  assert.equal(playback.playRequest, 1);
});

test('a library selection waits for its target instead of playing the old station', () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  playback.activate(station('first'), []);
  playback.requestStation('/asia/viet-nam/second');
  assert.equal(playback.playRequest, 0);
  playback.activate(station('second'), []);
  assert.equal(playback.playRequest, 1);
  assert.equal(playback.requestedStationUrl, '');
  playback.requestStation('/asia/viet-nam/second');
  assert.equal(playback.playRequest, 2, 'selecting the current station can resume it');
});

test('live track metadata is scoped to the active station and cleared on change', () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  playback.activate(station('first'), []);
  playback.setLiveTrack('/asia/viet-nam/first', { title: 'Price Tag', artist: 'Jessie J' });
  assert.equal(playback.liveTrack?.title, 'Price Tag');
  playback.setLiveTrack('/asia/viet-nam/other', { title: 'Stale', artist: '' });
  assert.equal(playback.liveTrack?.title, 'Price Tag');
  playback.activate(station('second'), [], { autoplay: true });
  assert.equal(playback.liveTrack, null);
  playback.setLiveTrack('/asia/viet-nam/second', { title: 'Next track', artist: '' });
  assert.equal(playback.liveTrack?.title, 'Next track');
  playback.setLiveTrack('/asia/viet-nam/second', null);
  assert.equal(playback.liveTrack, null);
});
