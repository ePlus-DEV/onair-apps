import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const locales = ['en-US','vi-VN','ja-JP','zh-CN','zh-TW','fr-FR','ru-RU'];
const read = p => readFile(p,'utf8');

test('all seven locales use ePlus OnAir and the exact official slogan', async () => {
  for (const locale of locales) {
    const raw = await read('lang/' + locale + '.json');
    const data = JSON.parse(raw);
    assert.equal(data.brand.slogan, 'Listen Beyond Borders.');
    assert.ok(data.brand.slogan_localized?.trim(), locale + ' missing localized slogan');
    assert.equal(data.footer.tagline, 'Listen Beyond Borders.');
    assert.doesNotMatch(raw, /Radio ePlus|Радио ePlus/i, locale + ' still shows old brand');
    assert.match(data.site_pages.about.title, /ePlus OnAir/);
    assert.match(data.site_pages.cookie.sections.analytics.body, /Google Analytics 4/);
    // Preserve all interpolation variables and player semantics.
    assert.match(data.seo.country_description, /\{count\}/);
    assert.match(data.seo.station_description, /\{station\}/);
    assert.match(data.player.source_number, /\{number\}/);
  }
});

test('header, footer, hero and policy pages show the new identity', async () => {
  const [header, footer, home, about, contact, config] = await Promise.all([
    read('components/AppHeader.vue'),
    read('components/AppFooter.vue'),
    read('pages/index.vue'),
    read('pages/about.vue'),
    read('pages/contact.vue'),
    read('nuxt.config.ts'),
  ]);
  assert.match(header, /ePlus <span class="text-rose-500">OnAir<\/span>/);
  assert.match(header, /brand\.slogan/);
  assert.match(header, /logo-share\.png/);
  assert.match(footer, /ePlus OnAir/);
  assert.match(footer, /logo-share\.png/);
  assert.match(home, /ePlus OnAir ·/);
  assert.match(about, /ePlus OnAir/);
  assert.match(contact, /ePlus%20OnAir%20support/);
  assert.match(config, /resolveDeploymentSiteName\(/);
  assert.match(config, /configuredName: process\.env\.NUXT_PUBLIC_SITE_NAME/);
  assert.match(config, /Listen Beyond Borders/);
  for(const [file,text] of [['header',header],['footer',footer],['about',about]]) {
    assert.doesNotMatch(text,/Radio ePlus/i,file);
  }
});

test('canonical domains and existing service identifiers are preserved', async () => {
  const [config, seo, ga4, app] = await Promise.all([
    read('nuxt.config.ts'), read('utils/seo-deployment.mjs'),
    read('utils/ga4-config.mjs'), read('app.vue'),
  ]);
  assert.match(config, /https:\/\/radio\.eplus\.dev/);
  assert.match(config, /algoliaIndexStation: "radio\.eplus\.dev"/);
  assert.match(ga4, /radio\.eplus\.dev/);
  assert.match(seo, /radio-new\.eplus\.dev/);
  assert.match(app, /logo-share\.png/);
  assert.match(app, /ogSiteName: siteName\.value/);
});

test('existing ON AIR assets stay authoritative and build hooks never overwrite them', async () => {
  const [config, header, footer, stationArtwork, manifestText, pkgText, app] = await Promise.all([
    read('nuxt.config.ts'),
    read('components/AppHeader.vue'),
    read('components/AppFooter.vue'),
    read('components/StationArtwork.vue'),
    read('public/brand/site.webmanifest'),
    read('package.json'),
    read('app.vue'),
  ]);
  const manifest = JSON.parse(manifestText);
  const pkg = JSON.parse(pkgText);

  for (const source of [header, footer, stationArtwork]) {
    assert.match(source, /\/brand\/logo-share\.png/);
    assert.doesNotMatch(source, /\/brand\/onair-mark\.svg/);
  }
  assert.match(app, /\/brand\/logo-share\.png/);
  assert.doesNotMatch(app, /\/brand\/onair-share\.png/);
  assert.match(config, /\/brand\/favicon-32x32\.png/);
  assert.doesNotMatch(config, /\/brand\/onair-mark\.svg/);
  assert.equal(manifest.short_name, 'ePlus OnAir');
  assert.ok(manifest.icons.some(i => i.src === './android-chrome-192x192.png'));
  assert.ok(manifest.icons.every(i => i.src !== './onair-mark.svg'));
  assert.equal(pkg.name, 'eplus-onair');
  for (const task of ['predev', 'prebuild', 'pregenerate']) {
    assert.doesNotMatch(pkg.scripts[task], /generate-brand-assets/);
    assert.match(pkg.scripts[task], /build-station-search-index/);
  }
  assert.ok(!('brand:generate' in pkg.scripts));
});
