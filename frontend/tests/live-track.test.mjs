import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLiveTrack } from '../utils/live-track.mjs';

test('Zing currentMedia takes precedence over generic schedule playlist', () => {
  assert.deepEqual(resolveLiveTrack(
    { currentMedia: { title: ' Price Tag ', artists: ' Jessie J ' } },
    [{ track_title: 'Old song', track_artist: 'Old artist' }],
  ), { title: 'Price Tag', artist: 'Jessie J' });
});

test('Webrad playlist first track supplies the live song', () => {
  assert.deepEqual(resolveLiveTrack(undefined, [{ track_title: 'Stay', track_artist: 'Rihanna' }]),
    { title: 'Stay', artist: 'Rihanna' });
});

test('missing provider title never makes up a song', () => {
  for (const [song, playlist] of [
    [undefined, []],
    [{ currentMedia: { title: '', artists: 'Someone' } }, undefined],
    [undefined, [{ track_title: ' ', track_artist: 'Artist' }]],
    [undefined, [{ track_title: null, track_artist: 'Artist' }]],
  ]) assert.equal(resolveLiveTrack(song, playlist), null);
  assert.deepEqual(resolveLiveTrack(undefined, [{ track_title: 'News', track_artist: '' }]),
    { title: 'News', artist: '' });
});
