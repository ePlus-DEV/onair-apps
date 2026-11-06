import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachedSearchIndexCount } from '../scripts/build-station-search-index.mjs';
import { generateSocialPreview, cachedSocialPreviewValid } from '../scripts/generate-social-preview.mjs';

test('radio search index cache is used only for a valid exact cache hit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'onair-search-cache-'));
  const file = join(dir, 'stations.json');
  try {
    assert.equal(await cachedSearchIndexCount(file, true), null, 'missing output regenerates');
    await writeFile(file, '[{"objectID":"asia/viet-nam/test","station_name":"Test radio"}]');
    assert.equal(await cachedSearchIndexCount(file, true), 1);
    assert.equal(await cachedSearchIndexCount(file, false), null, 'cache miss regenerates');
    await writeFile(file, '{bad JSON');
    assert.equal(await cachedSearchIndexCount(file, true), null, 'corrupt cache regenerates');
    await writeFile(file, '[{}]');
    assert.equal(await cachedSearchIndexCount(file, true), null, 'malformed cache regenerates');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('social preview cache accepts only a valid 1200x630 PNG and exact hit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'onair-social-cache-'));
  const source = join(dir, 'source.svg');
  const output = join(dir, 'social-preview.png');
  try {
    assert.equal(await cachedSocialPreviewValid(output, true), false, 'missing output regenerates');
    await writeFile(source, '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="black"/></svg>');
    await generateSocialPreview(source, output);
    assert.equal(await cachedSocialPreviewValid(output, true), true);
    assert.equal(await cachedSocialPreviewValid(output, false), false, 'cache miss regenerates');
    await writeFile(output, 'not a PNG');
    assert.equal(await cachedSocialPreviewValid(output, true), false, 'corrupt cache regenerates');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
