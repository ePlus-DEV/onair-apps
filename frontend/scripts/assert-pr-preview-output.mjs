import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPrPreviewBasePath } from '../utils/pr-preview.mjs';

const root = process.argv[2] || '.output/public';
const base = getPrPreviewBasePath(process.argv[3]);

const cases = [
  ['home', 'index.html'],
  ['country', 'asia/viet-nam/index.html'],
  ['station deep link', 'asia/viet-nam/vov-gt-hcm/index.html'],
  ['Apple Music directory', 'global-radio/apple-music/index.html'],
  ['Apple Holiday Hits QA', 'global-radio/apple-music/apple-music-holiday-hits/index.html'],
  ['library', 'library/index.html'],
];
for (const [label, file] of cases) {
  const html = await readFile(join(root, file), 'utf8');
  assert.ok(html.includes(base + '_nuxt/'),
    `${label}: Nuxt JS/CSS must use ${base}`);
  assert.ok(html.includes(base + 'brand/logo-share.png'),
    `${label}: brand assets must use ${base}`);
  assert.match(html, /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex)[^>]*>/i,
    `${label}: noindex is required`);
  assert.doesNotMatch(html, /<script[^>]+googletagmanager\.com\/gtag/i,
    `${label}: production analytics is forbidden`);
  const attrs = [...html.matchAll(/\b(?:href|src)=["'](\/[^"'\s]*)["']/gi)]
    .map(match => match[1]);
  const unprefixedAssets = attrs.filter(path => /^\/(?:_nuxt\/|brand\/|favicon\.ico)/.test(path));
  assert.deepEqual(unprefixedAssets.slice(0, 5), [],
    `${label}: assets must use Pages subpath, found ${unprefixedAssets.slice(0, 5).join(', ')}`);
}
console.log(`PASS: PR preview pages use ${base} and never load production GA4`);
