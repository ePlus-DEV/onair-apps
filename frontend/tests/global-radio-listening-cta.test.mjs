import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Apple directory uses compact responsive cards with ePlus Play as the only primary action', async () => {
  const page = await read('pages/global-radio/apple-music/index.vue');
  assert.match(page, /<header class="radio-hero relative isolate overflow-hidden/);
  assert.match(page, /radial-gradient\(/);
  assert.match(page, /grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-3/);
  assert.match(page, /v-for="station in provider\?\.stations \|\| \[\]"/);
  assert.match(page, /:key="station\.id"/);
  assert.match(page, /station\.seasonal/);
  assert.match(page, /@click="playOnEplus\(station\)"/);
  assert.match(page, /global_radio\.listen_on_eplus/);
  assert.match(page, /t\('global_radio\.details'\)/);
  assert.match(page, /t\('global_radio\.eplus_play_hint'\)/);
  assert.match(page, /global_radio\.playing_now/);
  assert.match(page, /min-h-11/, 'touch targets must be at least 44px high');
  assert.match(page, /line-clamp-2/, 'descriptions remain compact on narrow viewports');
  assert.match(page, /focus-visible:outline-2/, 'buttons and links must be keyboard accessible');
  assert.doesNotMatch(page, /:href="station\.(?:listen_url|tunein_url)"/,
    'Apple Music and TuneIn links must only be shown on station detail');
  assert.doesNotMatch(page, /t\('global_radio\.external_note'\)/,
    'do not render the old notice saying ePlus cannot play these stations');
});

test('directory/detail use shared player without raw HLS prompts; provider links are detail-only', async () => {
  const [page, detail, catalog] = await Promise.all([
    read('pages/global-radio/apple-music/index.vue'),
    read('pages/global-radio/apple-music/[station].vue'),
    read('public/catalog/providers/apple-music.json'),
  ]);
  for (const publicPage of [page, detail]) {
    assert.doesNotMatch(publicPage, /GlobalRadioTemporaryHlsPreview|accessKey|\.m3u8|preview_on_eplus|preview_requires_url|TemporaryHlsPreview|<audio\b|<UModal\b/);
    assert.doesNotMatch(publicPage, /playback\.(?:activate|requestStation|play)\s*\(|requestStation\(/);

    assert.doesNotMatch(publicPage, /v-if="canListenOnEplus/, 'missing proxy must not hide the Play control');
    assert.match(publicPage, /v-if="!canListenOnEplus"/, 'explain why the Play button is disabled');
    assert.match(publicPage, /global_radio\.resolver_unavailable/);
    assert.match(publicPage, /useAuthorizedGlobalRadioPlayback/);
  }
  assert.match(page, /:disabled="!canListenOnEplus \|\| pendingStationId === station\.id"/);
  assert.match(detail, /:disabled="!canListenOnEplus \|\| Boolean\(pendingStationId\)"/);
  assert.match(detail, /rel="noopener noreferrer"/);
  assert.match(detail, /:href="station\.listen_url"/);
  assert.match(detail, /:href="station\.tunein_url"/);
  assert.match(detail, /t\('global_radio\.other_listening_options'\)/);
  assert.match(detail, /t\('global_radio\.external_options_hint'\)/);
  assert.doesNotMatch(detail, /t\('global_radio\.external_badge'\)/);
  assert.match(detail, /useStaticPageSeo/);
  assert.match(page, /useStaticPageSeo/);
  assert.doesNotMatch(catalog, /accessKey|itsliveradio\.apple\.com|3p-tune-in/);
});

test('provider pages use real external links for all seven stations without fabricated playable state', async () => {
  const provider = JSON.parse(await read('public/catalog/providers/apple-music.json'));
  assert.equal(provider.stations.length, 7);
  assert.equal(provider.playback, 'external');
  for (const station of provider.stations) {
    assert.equal(new URL(station.listen_url).hostname, 'music.apple.com');
    assert.equal(new URL(station.tunein_url).hostname, 'tunein.com');
    assert.equal('stream' in station, false);
    assert.equal('streams' in station, false);
  }
});

test('all seven languages retain live destination and seasonal labels without obsolete token prompts', async () => {
  for (const locale of ['vi-VN', 'en-US', 'fr-FR', 'ja-JP', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const lang = JSON.parse(await read('lang/' + locale + '.json'));
    for (const key of [
      'listen_on_eplus', 'listen_on_apple', 'listen_on_tunein', 'details', 'seasonal',
      'external_note', 'apple_access', 'eplus_play_hint', 'playing_now',
      'other_listening_options', 'external_options_hint',
    ]) {
      assert.ok(typeof lang.global_radio?.[key] === 'string' && lang.global_radio[key].trim(), locale + ': missing ' + key);
    }
    assert.equal('preview_on_eplus' in lang.global_radio, false);
    assert.equal('preview_requires_url' in lang.global_radio, false);
  }
});

test('Apple Music preview prerenders in-app player QA routes and keeps custom noindex', async () => {
  const routes = await read('utils/pr-preview.mjs');
  const config = await read('nuxt.config.ts');
  const workflow = await read('.github/workflows/pr-preview-pages.yml');
  for (const path of [
    '/global-radio', '/global-radio/apple-music',
    '/global-radio/apple-music/apple-music-holiday-hits',
  ]) {
    assert.ok(routes.includes("'" + path + "'"), 'missing preview route ' + path);
  }
  assert.match(config, /routes: isPrPreview \? \[\.\.\.PR_PREVIEW_ROUTES/);
  assert.match(workflow, /NUXT_PUBLIC_NO_INDEX: 'true'/);
  // Public vars live in the dedicated Preview Environment (legacy development fallback).
  // Only the trusted pre-build job may access that Environment; never checkout
  // or run untrusted PR code in a job that also holds deploy credentials.
  const trusted = workflow.split('  preview_config:')[1]?.split('\n  build:')[0];
  const build = workflow.split('  build:')[1]?.split('\n  publish:')[0];
  assert.ok(trusted && build, 'trusted config and isolated build jobs exist');
  assert.match(trusted, /environment:\s*\n\s*name: \$\{\{ vars\.PAGES_PREVIEW_READY == 'true' && 'preview' \|\| 'development' \}\}/);
  assert.match(trusted, /CORS_SERVER: \$\{\{ vars\.NUXT_PUBLIC_CORS_SERVER_1 \}\}/);
  assert.match(trusted, /RESOLVER_URL: \$\{\{ vars\.NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL \}\}/);
  assert.doesNotMatch(trusted, /actions\/checkout|npm ci|secrets\./,
    'the trusted job cannot checkout or execute untrusted code or expose secrets');
  assert.match(build, /needs: \[preview_config, comment_status\]/);
  assert.match(build, /NUXT_PUBLIC_CORS_SERVER_1: \$\{\{ needs\.preview_config\.outputs\.cors_server \}\}/);
  assert.match(build, /NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL: \$\{\{ needs\.preview_config\.outputs\.resolver_url \}\}/);
  assert.doesNotMatch(build, /\n\s*environment:|secrets\.PAGES_DEPLOY_TOKEN/,
    'untrusted build must never receive Preview secrets or Environment access');
});
