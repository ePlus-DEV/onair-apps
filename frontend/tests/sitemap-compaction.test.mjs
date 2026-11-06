import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSitemapXml } from '../scripts/compact-sitemap.mjs';

const base = 'https://radio.eplus.dev';
const image = name => '<image:image><image:loc>' + base +
  '/img/asia/viet-nam/' + name + '.png</image:loc></image:image>';
const page = (path, images = []) =>
  '<url><loc>' + base + path + '</loc>' + images.join('') + '</url>';
const prefix = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
  'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
const suffix = '\n</urlset>';

test('sitemap compaction preserves every canonical URL and image on directory pages', () => {
  const xml = prefix +
    page('/') + '\n' +
    page('/asia/viet-nam', [image('a'), image('b')]) + '\n' +
    page('/asia/viet-nam/a', [image('a'), image('b'), image('c')]) + '\n' +
    page('/asia/viet-nam/b', [image('a'), image('b'), image('c')]) +
    suffix;
  const result = compactSitemapXml(xml, base);
  assert.equal(result.canonicalUrls, 4);
  assert.equal(result.detailPages, 2);
  assert.equal(result.removedImages, 4);
  assert.equal(result.keptImages, 2);
  assert.ok(result.savedBytes > 0);
  assert.deepEqual([...result.xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]),
    [base + '/', base + '/asia/viet-nam', base + '/asia/viet-nam/a', base + '/asia/viet-nam/b']);
  assert.match(result.xml, /<urlset\b/);
  assert.doesNotMatch(result.xml, />\s+</);
  // Country page still lists both images; detail pages keep only their own.
  const country = result.xml.match(/<url><loc>https:\/\/radio\.eplus\.dev\/asia\/viet-nam<\/loc>[\s\S]*?<\/url>/)?.[0];
  assert.equal((country?.match(/<image:image>/g) || []).length, 2);
  const a = result.xml.match(/<url><loc>https:\/\/radio\.eplus\.dev\/asia\/viet-nam\/a<\/loc>[\s\S]*?<\/url>/)?.[0];
  assert.deepEqual([...a.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(x => x[1]),
    [base + '/img/asia/viet-nam/a.png']);
});

test('station with nonmatching image filename retains its own first asset', () => {
  const xml = prefix + page('/asia/viet-nam/ha-noi-fm90', [
    image('fm90'), image('unrelated-other-radio'),
  ]) + suffix;
  const result = compactSitemapXml(xml, base);
  assert.equal(result.removedImages, 1);
  assert.match(result.xml, /img\/asia\/viet-nam\/fm90\.png/);
  assert.doesNotMatch(result.xml, /unrelated-other-radio/);
});

test('global provider station routes and metadata are left untouched', () => {
  const xml = prefix + '<url><loc>' + base + '/global-radio/apple-music/apple-music-1' +
    '</loc><priority>0.5</priority>' + image('other') + image('another') +
    '</url>' + suffix;
  const result = compactSitemapXml(xml, base);
  assert.equal(result.removedImages, 0);
  assert.equal((result.xml.match(/<image:image>/g) || []).length, 2);
  assert.match(result.xml, /<priority>0.5<\/priority>/);
});

test('many pages remain indexed without sidebar image amplification', () => {
  let original = prefix;
  for (let i = 0; i < 120; i++) {
    const images = [image('station-' + i)];
    for (let j = 0; j < 40; j++) images.push(image('other-' + j));
    original += page('/asia/viet-nam/station-' + i, images) + '\n';
  }
  original += suffix;
  const result = compactSitemapXml(original, base);
  assert.equal(result.canonicalUrls, 120);
  assert.equal(result.keptImages, 120);
  assert.equal(result.removedImages, 4800);
  assert.ok(result.savedBytes > 100_000);
});

test('release build invokes sitemap compaction before Pages size and SEO validations', async () => {
  const generator = await readFile(new URL('../scripts/generate-site.mjs', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../.github/workflows/deploy-github-pages.yml', import.meta.url), 'utf8');
  const seo = await readFile(new URL('../scripts/assert-sitemap-xml.mjs', import.meta.url), 'utf8');
  assert.match(generator, /compactGeneratedSitemap\('\.output\/public\/sitemap\.xml'/);
  assert.match(workflow, /npm run generate:site/);
  assert.match(workflow, /scripts\/assert-sitemap-xml\.mjs/);
  assert.match(workflow, /scripts\/check-pages-build\.mjs/);
  assert.match(seo, /Canonical home URL missing/);
});
