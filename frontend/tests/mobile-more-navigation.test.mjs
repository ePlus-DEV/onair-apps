import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('phone bottom navigation restores More without displacing the three main actions', async () => {
  const [mobile, header] = await Promise.all([
    read('components/MobileNavigation.vue'),
    read('components/AppHeader.vue'),
  ]);
  assert.match(mobile, /grid grid-cols-4/);
  assert.match(mobile, /to="\/"[\s\S]*?redesign\.discover/);
  assert.match(mobile, /@click="openSearch"/);
  assert.match(mobile, /to="\/library"/);
  assert.match(mobile, /navmenu\.more/);
  assert.match(mobile, /@click="mobileOpen = true"/);
  assert.doesNotMatch(mobile, /to="\/settings"/, 'Settings belongs inside More, not bottom navigation');
  assert.match(mobile, /aria-expanded="mobileOpen"/);
  assert.match(header, /<USlideover v-model:open="mobileOpen"/);
  assert.match(header, /<AppSidebar mobile\s*\/>/);
});

test('phone More button and header drawer share the same state and close after navigation', async () => {
  const [mobile, header] = await Promise.all([
    read('components/MobileNavigation.vue'),
    read('components/AppHeader.vue'),
  ]);
  const id = 'radio:mobile-navigation-open';
  assert.ok(mobile.includes(id));
  assert.ok(header.includes(id));
  assert.match(header, /\(\) => route\.fullPath/);
  assert.match(header, /mobileOpen\.value = false/);
  assert.match(header, /:title="\$t\('navmenu\.more'\)"/);
  assert.match(header, /hidden h-11 w-11 justify-center sm:inline-flex/);
  assert.match(header, /sm:flex xl:hidden/);
});

test('mobile drawer restores all informational routes and puts Settings last', async () => {
  const [sidebar, pages, footer] = await Promise.all([
    read('components/AppSidebar.vue'),
    read('pages/library.vue'), read('components/AppFooter.vue'),
  ]);
  const paths = [
    '/about', '/statistics', '/contact',
    '/privacy-policy', '/terms-of-use', '/cookie-policy',
  ];
  for (const path of paths) {
    assert.ok(sidebar.includes("to: '" + path + "'"), path + ' missing from More');
    assert.ok(footer.includes('to: "' + path + '"'), path + ' missing from footer');
  }
  assert.match(sidebar, /v-if="mobile"[\s\S]*?navmenu\.information/);
  assert.match(sidebar, /v-for="item in informationLinks"/);
  assert.match(sidebar, /<NuxtLink to="\/settings"/);
  assert.match(sidebar, /:aria-current="route\.path === item\.to \? 'page'/);
  assert.match(sidebar, /listener_settings\.title/);
  assert.match(pages, /libraryTabHref/);
});

test('More and Information are localized in every supported language', async () => {
  for (const locale of ['en-US', 'vi-VN', 'ja-JP', 'fr-FR', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const dict = JSON.parse(await read('lang/' + locale + '.json'));
    for (const key of ['more', 'information']) {
      assert.ok(typeof dict.navmenu[key] === 'string' && dict.navmenu[key].trim(),
        locale + ': navmenu.' + key);
    }
  }
});
