import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { libraryTabFromHash, libraryTabHref } from '../utils/library-tabs.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('sidebar exposes one collapsible Library parent with four nested hash-backed destinations', async () => {
  const sidebar = await read('components/AppSidebar.vue');
  assert.match(sidebar, /const libraryOpen = ref\(route\.path === '\/library'\)/);
  assert.match(sidebar, /libraryOpen = !libraryOpen/);
  assert.match(sidebar, /:aria-expanded="libraryOpen"/);
  assert.match(sidebar, /<nav v-show="libraryOpen"/);
  assert.match(sidebar, /libraryTabHref\(section\.value\)/);
  assert.match(sidebar, /libraryTabFromHash\(route\.hash\) === section\.value/);
  assert.match(sidebar, /:aria-current="route\.path === '\/library'/);
  assert.match(sidebar, /'radio-library-subnav-mobile'/);
  assert.match(sidebar, /'radio-library-subnav-desktop'/);
  assert.doesNotMatch(sidebar, /v-for="item in \[\{ hash:/, 'avoid separate Library pages at top level');
  for (const value of ['all', 'favorites', 'recent', 'stats']) {
    assert.match(sidebar, new RegExp("value: '" + value + "'"), value + ' submenu missing');
  }
  assert.match(sidebar, /label: 'library\.listening_stats'/);
  assert.match(sidebar, /label: 'redesign\.library'|\$t\('redesign\.library'\)/);
});

test('Library children retain existing canonical URLs and back/forward hash semantics', () => {
  assert.equal(libraryTabHref('all'), '/library');
  assert.equal(libraryTabHref('favorites'), '/library#favorites');
  assert.equal(libraryTabHref('recent'), '/library#recent');
  assert.equal(libraryTabHref('stats'), '/library#stats');
  assert.equal(libraryTabFromHash('#stats'), 'stats');
  assert.equal(libraryTabFromHash('#recent'), 'recent');
  assert.equal(libraryTabFromHash(''), 'all');
  assert.equal(libraryTabFromHash('#unknown'), 'all');
});

test('Library grouping works in mobile More without hiding public Statistics or Settings', async () => {
  const sidebar = await read('components/AppSidebar.vue');
  const mobile = await read('components/MobileNavigation.vue');
  assert.match(sidebar, /v-if="!mobile" to="\/statistics"/);
  assert.match(sidebar, /v-if="!mobile" to="\/settings"/);
  assert.match(sidebar, /v-if="mobile"[\s\S]*?informationLinks/);
  assert.match(sidebar, /<NuxtLink to="\/settings"/);
  assert.match(mobile, /to="\/library"/);
  assert.match(sidebar, /watch\(\(\) => route\.path/);
  assert.match(sidebar, /if \(path === '\/library'\) libraryOpen\.value = true/);
});

test('mobile More hides duplicate Library group; mobile Library page retains its four tabs', async () => {
  const [sidebar, library, mobile] = await Promise.all([
    read('components/AppSidebar.vue'),
    read('pages/library.vue'),
    read('components/MobileNavigation.vue'),
  ]);
  assert.match(sidebar, /<div v-if="!mobile" class="space-y-1">\s*<button type="button"/);
  assert.match(mobile, /<NuxtLink to="\/library"/);
  assert.match(library, /v-for="tab in tabs"/);
  for (const name of ['all', 'favorites', 'recent', 'stats']) {
    assert.match(library, new RegExp("value: '" + name + "'"));
  }
  assert.match(sidebar, /v-if="mobile"[\s\S]*?informationLinks/);
});

test('existing localized Library labels cover all four nested destinations', async () => {
  for (const locale of ['vi-VN', 'en-US', 'ja-JP', 'fr-FR', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const copy = JSON.parse(await read('lang/' + locale + '.json'));
    for (const label of [copy.redesign.library, copy.redesign.all,
      copy.library.favorites, copy.library.recent, copy.library.listening_stats]) {
      assert.ok(typeof label === 'string' && label.trim(), locale + ': missing Library label');
    }
  }
});
