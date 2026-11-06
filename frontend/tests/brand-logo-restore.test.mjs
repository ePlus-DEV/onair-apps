import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('ePlus OnAir uses the recognized ON AIR logo without reverting its name or slogan', async () => {
  const [header, footer, artwork, config, app, manifestText] = await Promise.all([
    readFile('components/AppHeader.vue', 'utf8'),
    readFile('components/AppFooter.vue', 'utf8'),
    readFile('components/StationArtwork.vue', 'utf8'),
    readFile('nuxt.config.ts', 'utf8'),
    readFile('app.vue', 'utf8'),
    readFile('public/brand/site.webmanifest', 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  await Promise.all([
    access('public/brand/logo-share.png'),
    access('public/brand/favicon-16x16.png'),
    access('public/brand/favicon-32x32.png'),
    access('public/brand/android-chrome-192x192.png'),
    access('public/brand/android-chrome-512x512.png'),
  ]);

  for (const component of [header, footer, artwork]) {
    assert.match(component, /\/brand\/logo-share\.png/);
    assert.doesNotMatch(component, /\/brand\/onair-mark\.svg/);
  }
  assert.match(header, /ePlus <span class="text-rose-500">OnAir<\/span>/);
  assert.match(header, /\$t\('brand\.slogan'\)/);
  assert.match(footer, /ePlus OnAir/);
  assert.match(footer, /\$t\('footer\.tagline'\)/);
  assert.match(config, /resolveDeploymentSiteName\(/);
  assert.match(config, /configuredName: process\.env\.NUXT_PUBLIC_SITE_NAME/);
  assert.doesNotMatch(config, /rel: "icon", type: "image\/svg\+xml", href: "\/brand\/onair-mark\.svg"/);
  assert.match(config, /\/brand\/favicon-32x32\.png/);
  assert.match(config, /\/favicon\.ico\?v=onair-20261012/);
  assert.deepEqual(
    await readFile('public/favicon.ico'),
    await readFile('public/brand/favicon.ico'),
    'Default Nuxt favicon must not be published at /favicon.ico',
  );
  assert.match(app, /\/brand\/logo-share\.png/);
  assert.doesNotMatch(app, /\/brand\/onair-share\.png/);
  assert.equal(manifest.short_name, 'ePlus OnAir');
  assert.ok(manifest.icons.every(icon => !icon.src.includes('onair-mark.svg')));
  assert.ok(manifest.icons.some(icon => icon.src.includes('android-chrome-192x192.png')));
});
