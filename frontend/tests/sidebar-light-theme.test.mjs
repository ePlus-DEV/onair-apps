import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('desktop sidebar stays sticky and owns an independently scrolling viewport', async () => {
  const [sidebar, css, app, header] = await Promise.all([
    read('components/AppSidebar.vue'),
    read('assets/css/main.css'),
    read('app.vue'),
    read('components/AppHeader.vue'),
  ]);
  assert.match(app, /<AppSidebar\s*\/>/);
  assert.match(header, /sm:h-20/);
  assert.match(sidebar, /radio-desktop-sidebar hidden xl:block/);
  assert.match(sidebar, /radio-desktop-sidebar-scroll radio-scrollbar space-y-6/);
  assert.doesNotMatch(sidebar, /sticky top-28 max-h-/);
  assert.match(css, /@media \(min-width: 1280px\)\s*\{\s*\.radio-desktop-sidebar\s*\{/);
  assert.match(css, /\.radio-desktop-sidebar\s*\{[^}]*position: sticky;[^}]*top: 104px;[^}]*height: calc\(100dvh - 104px - var\(--radio-player-height\) - 16px - env\(safe-area-inset-bottom\)\)/s);
  assert.match(css, /\.radio-desktop-sidebar-scroll\s*\{[^}]*height: 100%;[^}]*overflow-y: auto;[^}]*overscroll-behavior-y: contain;[^}]*padding-bottom: 16px;/s);
  // Slideover sidebar should remain in the normal document flow on mobile.
  assert.match(sidebar, /mobile \? 'block' : 'radio-desktop-sidebar hidden xl:block'/);
  assert.match(sidebar, /mobile \? 'space-y-6' : 'radio-desktop-sidebar-scroll radio-scrollbar space-y-6'/);
});

test('light artwork tiles use neutral slate instead of a pink wash', async () => {
  const [css, featured, station, radio] = await Promise.all([
    read('assets/css/main.css'),
    read('components/panel/FeaturedStations.vue'),
    read('components/panel/Station.vue'),
    read('components/panel/Radio.vue'),
  ]);
  const light = css.match(/html\[data-theme="light"\]\s*\{([\s\S]*?)\n\s*\}/)?.[1];
  const dark = css.match(/html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(light && dark);
  assert.match(light, /--radio-artwork-bg: #f1f5f9;/);
  assert.doesNotMatch(light, /--radio-artwork-bg: #fff7f8;/);
  assert.match(dark, /--radio-artwork-bg: #181923;/);
  assert.match(css, /\.radio-themed-artwork\s*\{\s*background: var\(--radio-artwork-bg\);/);
  for (const component of [featured, station, radio]) {
    assert.match(component, /radio-themed-artwork/);
  }
});
