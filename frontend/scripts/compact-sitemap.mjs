// Keep every canonical sitemap URL and each station's own image, but do not
// associate every COUNTRY sidebar thumbnail with every station detail page.
// @nuxtjs/sitemap currently discovers sidebar images during prerender,
// duplicating ~230k image:image entries in production sitemap.xml.
// No page HTML, metadata, canonical URL, or actual image asset is altered.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const LOC = /<loc>([^<]+)<\/loc>/g;
const IMAGE = /<image:image>[\s\S]*?<\/image:image>/g;

export function compactSitemapXml(xml, siteUrl = 'https://radio.eplus.dev') {
  assert.equal(typeof xml, 'string');
  assert.match(xml, /<urlset\b/);
  const origin = new URL(siteUrl).origin;
  const beforeLocations = [...xml.matchAll(LOC)].map(row => row[1]);
  assert.ok(beforeLocations.length > 0, 'Sitemap has no canonical entries');

  let detailPages = 0;
  let removedImages = 0;
  let keptImages = 0;
  const filtered = xml.replace(/<url>[\s\S]*?<\/url>/g, block => {
    const raw = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!raw) return block;
    let url;
    try { url = new URL(raw); } catch { return block; }
    const parts = url.pathname.split('/').filter(Boolean);
    // Exactly three path segments identify a geographic station detail page;
    // global-radio provider paths are not geographic stations.
    if (url.origin !== origin || parts.length !== 3 || parts[0] === 'global-radio')
      return block;

    const images = [...block.matchAll(IMAGE)].map(row => row[0]);
    if (!images.length) return block;
    detailPages += 1;

    const stationSlug = parts[2].toLowerCase();
    const prefix = '/img/' + parts[0] + '/' + parts[1] + '/';
    const matchIndexes = [];
    images.forEach((image, index) => {
      const location = image.match(/<image:loc>([^<]+)<\/image:loc>/)?.[1];
      if (!location) return;
      try {
        const imageUrl = new URL(location);
        if (imageUrl.origin !== origin || !imageUrl.pathname.startsWith(prefix)) return;
        const filename = imageUrl.pathname.slice(prefix.length).split('/').at(-1) || '';
        const basename = filename.replace(/\.(png|jpe?g|webp|svg)$/i, '').toLowerCase();
        if (basename === stationSlug || basename.startsWith(stationSlug + '-'))
          matchIndexes.push(index);
      } catch { /* Never add an untrusted or malformed image URL. */ }
    });

    // When the catalog image basename differs from the slug, the station
    // artwork is the first image in its own detail page (before related radios).
    const keep = new Set(matchIndexes.length ? matchIndexes : [0]);
    let index = 0;
    return block.replace(IMAGE, image => {
      const selected = keep.has(index++);
      if (selected) {
        keptImages++;
        return image;
      }
      removedImages++;
      return '';
    });
  });

  // Remove formatting whitespace BETWEEN XML elements only. Text and all
  // canonical <loc> values are byte-for-byte preserved.
  const compacted = filtered.replace(/>\s+</g, '><').trim() + '\n';
  const afterLocations = [...compacted.matchAll(LOC)].map(row => row[1]);
  assert.deepEqual(afterLocations, beforeLocations, 'Canonical sitemap entries changed');
  assert.match(compacted, /<urlset\b/);
  assert.match(compacted, /<\/urlset>/);
  assert.ok(compacted.length <= xml.length, 'Sitemap grew after compaction');
  return {
    xml: compacted, detailPages, removedImages, keptImages,
    savedBytes: Buffer.byteLength(xml) - Buffer.byteLength(compacted),
    canonicalUrls: beforeLocations.length,
  };
}

export async function compactGeneratedSitemap(path = '.output/public/sitemap.xml',
  siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://radio.eplus.dev') {
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No sitemap.xml generated for this non-indexable preview/staging build.');
      return null;
    }
    throw error;
  }
  const result = compactSitemapXml(source, siteUrl);
  await writeFile(path, result.xml, 'utf8');
  console.log('Sitemap optimized: ' + result.canonicalUrls + ' canonical URLs, ' +
    result.detailPages + ' station pages, ' + result.keptImages +
    ' relevant station images retained, ' + result.removedImages +
    ' unrelated sidebar images removed; saved ' + result.savedBytes + ' bytes.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  compactGeneratedSitemap(process.argv[2], process.env.NUXT_PUBLIC_SITE_URL).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
