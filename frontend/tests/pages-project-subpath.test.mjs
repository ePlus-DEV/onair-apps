import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prefixPublicAsset } from '../utils/public-site-path.mjs';
import { assertProjectPagesOutput } from '../scripts/assert-project-pages-output.mjs';

test('public image/catalog URLs respect each Pages project path without rewriting streams', () => {
  for (const name of ['onair-staging-pages', 'onair-production-pages']) {
    const base = '/' + name + '/';
    assert.equal(prefixPublicAsset('/img/asia/flags/viet-nam.png', base), base + 'img/asia/flags/viet-nam.png');
    assert.equal(prefixPublicAsset('/radio/asia/viet-nam.json', base), base + 'radio/asia/viet-nam.json');
    assert.equal(prefixPublicAsset('/search/stations.json', base), base + 'search/stations.json');
    assert.equal(prefixPublicAsset('/brand/logo-share.png', base), base + 'brand/logo-share.png');
    assert.equal(prefixPublicAsset('/brand/logo-share.png?v=1', base), base + 'brand/logo-share.png?v=1');
    assert.equal(prefixPublicAsset(base + 'img/asia/flags/viet-nam.png', base), base + 'img/asia/flags/viet-nam.png');
    assert.equal(prefixPublicAsset('https://example.net/stream.mp3', base), 'https://example.net/stream.mp3');
    assert.equal(prefixPublicAsset('//radio.example.net/live', base), '//radio.example.net/live');
  }
  assert.equal(prefixPublicAsset('/brand/favicon.ico', '/'), '/brand/favicon.ico');
});

test('Pages output audit checks CSS, brand and direct-station routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'radio-project-pages-'));
  try {
    const deep = join(root, 'asia/viet-nam/vov-gt-hcm');
    await mkdir(deep, { recursive: true });
    const render = (base) =>
      '<html><head><link href="' + base + '_nuxt/main.css"></head><body>' +
      '<a href="' + base + 'asia">Region</a>' +
      '<img src="' + base + 'brand/logo-share.png"></body></html>';
    await writeFile(join(root, 'index.html'), render('/onair-staging-pages/'));
    await writeFile(join(deep, 'index.html'), render('/onair-staging-pages/'));
    assert.equal(await assertProjectPagesOutput(root, 'onair-staging-pages'), true);
    await writeFile(join(deep, 'index.html'), render('/'));
    await assert.rejects(assertProjectPagesOutput(root, 'onair-staging-pages'),
      /Nuxt JS\/CSS URLs must use/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('custom-domain Pages output uses root URLs and rejects legacy project prefixes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'radio-custom-domain-'));
  const render = (base) =>
    '<html><head><link href="' + base + '_nuxt/main.css"></head><body>' +
    '<a href="' + base + 'asia">Region</a>' +
    '<img src="' + base + 'brand/logo-share.png"></body></html>';
  try {
    const deep = join(root, 'asia/viet-nam/vov-gt-hcm');
    await mkdir(deep, { recursive: true });
    await writeFile(join(root, 'index.html'), render('/'));
    await writeFile(join(deep, 'index.html'), render('/'));
    assert.equal(await assertProjectPagesOutput(root, 'custom-domain'), true);
    await writeFile(join(deep, 'index.html'), render('/onair-staging-pages/'));
    await assert.rejects(assertProjectPagesOutput(root, 'custom-domain'),
      /invalid project-path\/root-domain assets/);
    await writeFile(join(deep, 'index.html'), render('/'));
    await writeFile(join(root, 'index.html'), render('/').replace('href="/asia"', 'href="/onair-production-pages/asia"'));
    await assert.rejects(assertProjectPagesOutput(root, 'custom-domain'),
      /invalid project-path\/root-domain assets/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Nuxt and fetchers preserve DigitalOcean root while supporting Pages subpaths', async () => {
  const nuxt = await readFile('nuxt.config.ts', 'utf8');
  assert.ok(nuxt.includes('baseURL,'));
  assert.ok(nuxt.includes('process.env.NUXT_APP_BASE_URL || "/"'));
  assert.ok(nuxt.includes('staticAsset("/favicon.ico'));
  for (const path of [
    'pages/index.vue',
    'pages/[area]/[country]/index.vue',
    'pages/[area]/[country]/[station].vue',
    'composables/useRestoreLastStation.ts',
    'composables/useStationSearchIndex.ts',
    'components/panel/ListeningLibrary.vue',
  ]) {
    const code = await readFile(path, 'utf8');
    assert.ok(code.includes('useSiteAssetUrl()'), path + ' must use the Pages public-path helper');
  }
});
