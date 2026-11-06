import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getRadioCatalogStats } from '../build/radioStats.ts';
import { createCachedLoader } from '../utils/cached-loader.mjs';

test('catalog counts include each country, empty catalogs and ignore artwork folders', async () => {
  const root = await mkdtemp(join(tmpdir(), 'radio-counts-'));
  try {
    const area = join(root, 'public/radio/asia');
    await mkdir(area, { recursive: true });
    await mkdir(join(root, 'public/radio/artwork'), { recursive: true });
    await writeFile(join(area, 'viet-nam.json'), JSON.stringify({ one: {}, two: {} }));
    await writeFile(join(area, 'empty.json'), '{}');
    const stats = getRadioCatalogStats(root);
    assert.deepEqual(stats.byCountry, { '/asia/empty': 0, '/asia/viet-nam': 2 });
    assert.equal(stats.stations, 2);
    assert.equal(stats.countries, 2);
    assert.equal(stats.areas, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('search catalog is loaded once across concurrent opens; failed loads can retry', async () => {
  let requests = 0;
  const items = [];
  const load = createCachedLoader(async () => { requests++; if (requests === 1) throw new Error('Offline'); return items; });
  const failed = await Promise.allSettled([load(), load()]);
  assert.ok(failed.every(result => result.status === 'rejected'));
  assert.equal(requests, 1);
  assert.equal(await load(), items);
  assert.equal(await load(), items);
  assert.equal(requests, 2);
});
