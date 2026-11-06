import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { stationOgDeployment, stationSocialImage } from '../utils/station-og-deployment.mjs';
import { imageBatches, publishImageBatches } from '../scripts/publish-image-batches.mjs';

test('site-only production keeps valid PNG metadata until external images are configured', () => {
  const origin = 'https://radio.eplus.dev';
  const imagePath = '/og/stations/asia/viet-nam/vov1.jpg';
  const policy = stationOgDeployment({ siteUrl: origin, noIndex: 'false', skip: 'true', baseUrl: '' });
  assert.equal(policy.mode, 'shared');
  assert.deepEqual(stationSocialImage({ ...policy, origin, imagePath }), { url: origin + '/brand/social-preview.png', type: 'image/png' });
  const external = stationOgDeployment({ siteUrl: origin, skip: 'true', baseUrl: 'https://cdn.example/complete-set/' });
  assert.deepEqual(stationSocialImage({ ...external, origin, imagePath }), { url: 'https://cdn.example/complete-set' + imagePath, type: 'image/jpeg' });
  for (const baseUrl of ['http://cdn.example', 'https://user:pass@cdn.example', 'https://cdn.example?token=private']) {
    assert.throws(() => stationOgDeployment({ baseUrl }));
  }
});

test('site-only image hook removes stale generated JPEGs while preserving catalog logos', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onair-site-images-'));
  try {
    await mkdir(join(root, 'public/og/stations'), { recursive: true });
    await mkdir(join(root, 'public/img'), { recursive: true });
    await writeFile(join(root, 'public/og/stations/stale.jpg'), 'stale');
    await writeFile(join(root, 'public/img/logo.png'), 'existing-logo');
    execFileSync(process.execPath, [new URL('../scripts/generate-station-og-images.mjs', import.meta.url).pathname], {
      cwd: root, env: { ...process.env, ONAIR_SKIP_STATION_OG: 'true', NUXT_PUBLIC_STATION_OG_BASE_URL: '' },
    });
    await assert.rejects(access(join(root, 'public/og/stations')));
    assert.equal(await readFile(join(root, 'public/img/logo.png'), 'utf8'), 'existing-logo');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('image batches enforce the byte budget and put the complete manifest last', () => {
  const files = [
    { path: 'og/stations/manifest.json', bytes: 20 },
    { path: 'og/stations/a/b/1.jpg', bytes: 60 },
    { path: 'og/stations/a/b/2.jpg', bytes: 60 },
  ];
  assert.deepEqual(imageBatches(files, 100), [[files[1].path], [files[2].path], [files[0].path]]);
  assert.throws(() => imageBatches(files, 50), /budget/);
  assert.throws(() => imageBatches([{ path: 'index.html', bytes: 1 }]), /Unexpected/);
});

test('real Git upload pushes independent batches, supports retries and never changes website main', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'onair-image-git-'));
  const remote = join(dir, 'remote.git'), root = join(dir, 'images');
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
    await mkdir(root);
    git('init', '-b', 'main');
    git('config', 'user.name', 'Image test'); git('config', 'user.email', 'test@example.com');
    git('remote', 'add', 'origin', remote);
    await writeFile(join(root, 'index.html'), 'existing website');
    git('add', '.'); git('commit', '-m', 'website'); git('push', 'origin', 'main');
    const websiteSha = git('rev-parse', 'HEAD').trim();
    git('checkout', '--orphan', 'station-images'); git('rm', '-rf', '.');
    await mkdir(join(root, 'og/stations/a/b'), { recursive: true });
    const manifest = { version: 1, entries: {} };
    for (const id of ['1', '2']) {
      const bytes = Buffer.alloc(1100, Number(id)); bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
      await writeFile(join(root, 'og/stations/a/b', id + '.jpg'), bytes);
      manifest.entries['a/b/' + id + '.jpg'] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    await writeFile(join(root, 'og/stations/manifest.json'), JSON.stringify(manifest));
    // Fail the first push after its commit exists locally, then resume.
    git('remote', 'set-url', 'origin', join(dir, 'unavailable.git'));
    await assert.rejects(publishImageBatches({ root, budget: 1500 }));
    assert.equal(git('rev-list', '--count', 'HEAD').trim(), '1');
    git('remote', 'set-url', 'origin', remote);
    const result = await publishImageBatches({ root, budget: 1500 });
    assert.equal(result.batches, 2);
    assert.equal(git('rev-parse', 'origin/main').trim(), websiteSha);
    assert.equal(git('rev-list', '--count', 'HEAD').trim(), '3');
    assert.match(git('show', 'HEAD:og/stations/manifest.json'), /"complete":true/);
    assert.throws(() => git('show', 'HEAD~1:og/stations/manifest.json'));
    assert.equal((await publishImageBatches({ root, budget: 1500 })).changed, 0);
    assert.equal(git('rev-parse', 'origin/station-images').trim(), result.sha);
    await writeFile(join(root, 'og/stations/a/b/1.jpg'), 'corrupted');
    await assert.rejects(publishImageBatches({ root, budget: 1500 }), /corrupt/);
    assert.equal(git('rev-parse', 'origin/station-images').trim(), result.sha);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
