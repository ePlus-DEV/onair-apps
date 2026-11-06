import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { stat, appendFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BATCH_BYTES = 100 * 1024 * 1024;
const MANIFEST = 'og/stations/manifest.json';

export function imageBatches(files, budget = DEFAULT_BATCH_BYTES) {
  if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error('Invalid batch budget');
  const batches = [];
  let batch = [], bytes = 0;
  // Publish the manifest last: an interrupted upload must not advertise a
  // complete image set. Consumers use only the final, immutable commit URL.
  for (const file of files.filter(f => f.path !== MANIFEST)) {
    if (!file.path.startsWith('og/stations/') || file.path.split('/').includes('..')) {
      throw new Error('Unexpected image path: ' + file.path);
    }
    if (file.bytes > budget) throw new Error('Image exceeds batch budget: ' + file.path);
    if (batch.length && bytes + file.bytes > budget) { batches.push(batch); batch = []; bytes = 0; }
    batch.push(file.path); bytes += file.bytes;
  }
  if (batch.length) batches.push(batch);
  const manifest = files.find(f => f.path === MANIFEST);
  if (manifest) {
    if (manifest.bytes > budget) throw new Error('Manifest exceeds batch budget');
    batches.push([MANIFEST]);
  }
  return batches;
}

export async function publishImageBatches({ root, budget = DEFAULT_BATCH_BYTES } = {}) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (git('branch', '--show-current').trim() !== 'station-images') {
    throw new Error('Image uploads must use the station-images branch');
  }
  const manifestFile = join(root, MANIFEST);
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (!manifest.entries || !Object.keys(manifest.entries).length) throw new Error('Empty image manifest');
  for (const [path, entry] of Object.entries(manifest.entries)) {
    if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+\/[a-z0-9_.-]+\.jpg$/i.test(path) || path.split('/').includes('..')) {
      throw new Error('Invalid manifest path: ' + path);
    }
    const bytes = await readFile(join(root, 'og/stations', path));
    if (bytes.length !== entry.bytes || bytes.length <= 1000 ||
        bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff ||
        createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      throw new Error('Missing/corrupt image: ' + path);
    }
  }
  manifest.complete = true;
  await writeFile(manifestFile, JSON.stringify(manifest));
  git('add', '--all');
  const changed = git('diff', '--cached', '--name-only', '--no-renames', '-z').split('\0').filter(Boolean);
  let hasHead = true;
  try { git('rev-parse', '--verify', 'HEAD'); } catch { hasHead = false; }
  if (hasHead) {
    git('reset', '--quiet', 'HEAD');
    // Finish a previously committed but failed push before adding another batch.
    git('push', 'origin', 'HEAD:refs/heads/station-images');
  }
  else git('read-tree', '--empty');
  const files = [];
  for (const path of changed) {
    let bytes = 0;
    try { const info = await stat(join(root, path)); if (!info.isFile()) throw new Error('Not an image file'); bytes = info.size; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    files.push({ path, bytes });
  }
  const batches = imageBatches(files, budget);
  for (const [index, batch] of batches.entries()) {
    // Limit argv length too; do not assume all 4,000 paths fit in one command.
    for (let start = 0; start < batch.length; start += 100) git('add', '--', ...batch.slice(start, start + 100));
    git('commit', '--quiet', '-m', `images: upload batch ${index + 1}/${batches.length}`);
    git('push', 'origin', 'HEAD:refs/heads/station-images');
    console.log(`Uploaded image batch ${index + 1}/${batches.length}: ${batch.length} changed files`);
  }
  // On a retry after a successful commit but failed push, even an empty diff
  // must retry pushing HEAD before reporting completion.
  if (!batches.length) git('push', 'origin', 'HEAD:refs/heads/station-images');
  const sha = git('rev-parse', 'HEAD').trim();
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `images_sha=${sha}\n`);
  return { sha, batches: batches.length, changed: changed.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(await publishImageBatches({ root: resolve(process.argv[2]) }));
}
