import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, truncate, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPagesBuild } from '../scripts/check-pages-build.mjs';

test('Nuxt serves common CSS as reusable assets rather than repeated inline styles', async () => {
  const config = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8');
  assert.match(config, /features:\s*\{\s*inlineStyles:\s*false\s*,?\s*\}/);
});

test('Pages size audit gives categories and retains the real 1GB limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onair-size-'));
  try {
    await mkdir(join(root, '_nuxt'));
    await mkdir(join(root, 'og', 'stations'), { recursive: true });
    await writeFile(join(root, 'index.html'), '<meta name="robots" content="noindex, nofollow">');
    await writeFile(join(root, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    await writeFile(join(root, '_nuxt', 'main.css'), 'body{margin:0}');
    await writeFile(join(root, 'og', 'stations', 'a.jpg'), 'jpeg-fixture');
    const result = await checkPagesBuild(root, 'staging');
    assert.equal(result.count, 4);
    assert.equal(result.groups['prerendered HTML'].count, 1);
    assert.equal(result.groups['Nuxt JS/CSS bundles'].count, 1);
    assert.equal(result.groups['station Open Graph JPEGs'].count, 1);
    assert.ok(result.largest.length > 0);

    await truncate(join(root, 'og', 'stations', 'a.jpg'), 1_000_000_000);
    await assert.rejects(checkPagesBuild(root, 'staging'), /exceeds 1 GB/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
