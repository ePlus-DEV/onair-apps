import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyListeningLibrary, parseListeningLibrary, rememberStation, removeRecentStation, toggleFavoriteStation } from '../utils/listening-library.mjs';

const station = id => ({ url: `/asia/viet-nam/${id}`, title: id, image: '/img/radio.png', countryKey: 'world.asia.viet_nam', sources: [{ src: 'https://stream.example/live' }] });

test('recent history records actual playback, deduplicates and limits to 20 stations', () => {
  let library = emptyListeningLibrary();
  library = rememberStation(library, station('idle'), 'pause');
  assert.equal(library.recent.length, 0);
  for (let i = 0; i < 30; i++) library = rememberStation(library, station('radio-' + i), 'play', true);
  assert.equal(library.recent.length, 20);
  library = rememberStation(library, station('radio-15'), 'play', true);
  assert.equal(library.recent[0].url, '/asia/viet-nam/radio-15');
  assert.equal(library.recent.length, 20);
  assert.equal(new Set(library.recent.map(item => item.url)).size, 20);
});

test('favorite toggle persists independently of history and last playback preference', () => {
  let library = toggleFavoriteStation(emptyListeningLibrary(), station('favorite'));
  library = rememberStation(library, station('last'), 'play', true);
  library = rememberStation(library, station('last'), 'pause');
  const restored = parseListeningLibrary(JSON.stringify(library));
  assert.equal(restored.favorites[0].title, 'favorite');
  assert.equal(restored.lastStation.title, 'last');
  assert.equal(restored.lastState, 'pause');
  assert.equal(restored.recent.length, 1);
  assert.equal('sources' in restored.lastStation, false, 'restore must resolve current stream URLs from the catalog');
  assert.equal(toggleFavoriteStation(restored, station('favorite')).favorites.length, 0);
  assert.equal(parseListeningLibrary(JSON.stringify({ ...library, lastState: 'play' })).lastState, 'play');
});

test('corrupt storage, duplicate entries and unsafe station URLs are ignored', () => {
  assert.deepEqual(parseListeningLibrary('invalid json'), emptyListeningLibrary());
  for (const url of ['https://evil.example/a/b/c', '//evil.example/a/b', '/asia/../station', '/asia/viet-nam/radio?autoplay=1', '/asia/viet-nam/radio#x']) {
    assert.equal(rememberStation(emptyListeningLibrary(), { ...station('test'), url }, 'play').lastStation, null);
  }
  const library = parseListeningLibrary(JSON.stringify({ favorites: [station('one'), station('one'), null], lastStation: station('one'), lastState: 'unexpected' }));
  assert.equal(library.favorites.length, 1);
  assert.equal(library.lastState, 'pause');
});

test('remove a single recent station while keeping other history, favorites and last station', () => {
  let library = emptyListeningLibrary();
  for (const id of ['first', 'middle', 'last']) library = rememberStation(library, station(id), 'play', true);
  library = toggleFavoriteStation(library, station('middle'));
  const previousLastStation = library.lastStation;
  const previousLastState = library.lastState;

  const removed = removeRecentStation(library, station('middle').url);
  assert.deepEqual(removed.recent.map(entry => entry.title), ['last', 'first']);
  assert.deepEqual(removed.favorites, library.favorites, 'removing recent must not remove the favorite');
  assert.deepEqual(removed.lastStation, previousLastStation);
  assert.equal(removed.lastState, previousLastState);
  assert.equal(library.recent.length, 3, 'original library must not be mutated');
  assert.deepEqual(parseListeningLibrary(JSON.stringify(removed)).recent, removed.recent);

  assert.deepEqual(removeRecentStation(removed, '/asia/viet-nam/unknown').recent, removed.recent);
  assert.deepEqual(removeRecentStation(removed, '').recent, removed.recent);
  // Removing the last played entry is not equivalent to stopping the player.
  const withoutLast = removeRecentStation(removed, station('last').url);
  assert.equal(withoutLast.lastStation.url, station('last').url);
  assert.deepEqual(withoutLast.recent.map(entry => entry.title), ['first']);
});
