import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('search and footer use semantic text instead of hardcoded light/dark contrast', async () => {
  const [results, search, footer] = await Promise.all([
    read('components/search/Result.vue'),
    read('components/search/Box.vue'),
    read('components/AppFooter.vue'),
  ]);
  for (const source of [results, search, footer]) {
    assert.doesNotMatch(source, /text-slate-400|text-white\/55/);
    assert.match(source, /text-\[var\(--radio-text-muted\)\]/);
  }
  assert.doesNotMatch(results, /elevated \? 'text-white'/);
  assert.match(results, /text-\[var\(--radio-text\)\]/);
  assert.match(search, /text-rose-700 hover:text-rose-600 dark:text-rose-300/);
});

test('main and mini radio player share the same accessible playback status palette', async () => {
  const [player, fullscreen, resume, featured] = await Promise.all([
    read('components/player/Player.vue'),
    read('components/player/NowPlaying.vue'),
    read('components/panel/ResumeCard.vue'),
    read('components/panel/FeaturedStations.vue'),
  ]);
  assert.ok((player.match(/:class="liveStateClass"/g) || []).length >= 2);
  for (const token of ['bg-emerald-500/10 text-emerald-700', 'bg-amber-500/10 text-amber-700']) {
    assert.ok(player.includes(token), token);
    assert.ok(resume.includes(token), token);
    assert.ok(fullscreen.includes(token), token);
  }
  assert.match(player, /bg-red-500\/10 text-red-700/);
  assert.match(fullscreen, /bg-red-500\/10 text-red-700/);
  assert.match(featured, /bg-emerald-500\/15 text-emerald-700/);
  assert.match(featured, /bg-amber-500\/15 text-amber-700/);
  assert.match(featured, /'radio-neutral-badge'/);
});

test('navigation highlights the real current section, station hero uses the rose identity', async () => {
  const [sidebar, mobile, detail] = await Promise.all([
    read('components/AppSidebar.vue'),
    read('components/MobileNavigation.vue'),
    read('pages/[area]/[country]/[station].vue'),
  ]);
  assert.match(sidebar, /bg-rose-500\/10 text-rose-700 dark:text-rose-300/);
  assert.match(mobile, /route\.path === '\/' \? 'text-rose-700 dark:text-rose-300'/);
  assert.doesNotMatch(detail, /139,92,246|bg-violet-|text-violet-/);
  assert.match(detail, /radial-gradient\(circle_at_top_right,rgba\(244,63,94/);
});
