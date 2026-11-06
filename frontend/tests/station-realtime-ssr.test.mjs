import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('station realtime providers never run during SSR/prerender', async () => {
  const source = await readFile('composables/useStationRealtime.ts', 'utf8');
  for (const fn of ['fetchLyric', 'fetchDetail', 'fetchSchedule']) {
    const start = source.indexOf('const ' + fn);
    assert.ok(start >= 0);
    assert.match(source.slice(start, start + 350), /if \(!import\.meta\.client(?: \|\| !clientReady)?\) return/);
  }
  assert.match(source, /let clientReady = false/);
  assert.match(source, /onMounted\(\(\) => \{\s*clientReady = true/);
});
test('static station metadata and realtime polling are owned by separate lifetimes', async () => {
  const source = await readFile('pages/[area]/[country]/[station].vue', 'utf8');
  assert.match(source, /playback\.activate\(createPlaybackStation\(/);
  assert.doesNotMatch(source, /apiZing|fetchLyric|fetchDetail|fetchSchedule|pollingSchedule/);
});

