import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPlaybackTitleTemplate } from '../utils/playback-tab-title.mjs';

test('tab title keeps route-specific SEO title when idle or paused', () => {
  assert.equal(buildPlaybackTitleTemplate('', 'ePlus OnAir'), '%s | ePlus OnAir');
  assert.equal(buildPlaybackTitleTemplate(null, 'ePlus OnAir'), '%s | ePlus OnAir');
  assert.equal(buildPlaybackTitleTemplate('   ', 'ePlus OnAir'), '%s | ePlus OnAir');
});

test('tab title follows the actual playing radio station', () => {
  const title = buildPlaybackTitleTemplate('Chill – Zing MP3', 'ePlus OnAir');
  assert.equal(typeof title, 'function');
  assert.equal(title('Discover'), '▶ Chill – Zing MP3 | ePlus OnAir');

  const switched = buildPlaybackTitleTemplate('Heart UK', 'ePlus OnAir');
  assert.equal(switched('About'), '▶ Heart UK | ePlus OnAir');
  assert.equal(buildPlaybackTitleTemplate(' VOV Giao Thông ', 'ePlus OnAir')('Search'), '▶ VOV Giao Thông | ePlus OnAir');
});

test('browser title prefers current song and artist when available', () => {
  assert.equal(buildPlaybackTitleTemplate('Heart UK', 'ePlus OnAir', { title: 'Price Tag', artist: 'Jessie J' })('Home'),
    '▶ Price Tag — Jessie J · Heart UK | ePlus OnAir');
  assert.equal(buildPlaybackTitleTemplate('VOV 1', 'ePlus OnAir', { title: 'News', artist: '' })('Home'),
    '▶ News · VOV 1 | ePlus OnAir');
  assert.equal(buildPlaybackTitleTemplate('Heart UK', 'ePlus OnAir', { title: ' ', artist: 'Unknown' })('Home'),
    '▶ Heart UK | ePlus OnAir');
  assert.equal(buildPlaybackTitleTemplate('', 'ePlus OnAir', { title: 'Price Tag', artist: 'Jessie J' }),
    '%s | ePlus OnAir');
});

test('application title observes live playback, not selected-but-paused or prerendered station', async () => {
  const app = await readFile('app.vue', 'utf8');
  assert.match(app, /clientReady\.value && playback\.playing\s*\?\s*playback\.station\?\.title/);
  assert.match(app, /titleTemplate: buildPlaybackTitleTemplate\(/);
  assert.match(app, /playback\.liveTrack\?\.stationUrl === playback\.station\?\.url/);
  assert.doesNotMatch(app, /document\.title\s*=/);
});
