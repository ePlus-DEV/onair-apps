import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_PAGES_BYTES = 1_000_000_000;

export async function checkPagesBuild(root, target) {
  assert.ok(['production', 'staging', 'development'].includes(target), 'Expected production, staging or development');
  const home = await readFile(join(root, 'index.html'), 'utf8');
  const robots = await readFile(join(root, 'robots.txt'), 'utf8');
  const hasNoindex = /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex)[^>]*>/i.test(home);
  assert.equal(hasNoindex, target !== 'production', 'Generated robots metadata does not match target');
  assert.equal(/Sitemap:/i.test(robots), target === 'production', 'Generated robots.txt has wrong sitemap setting');

  let bytes = 0;
  let count = 0;
  const groups = new Map();
  const largest = [];
  const groupFor = (path) => {
    if (path.endsWith('.html')) return 'prerendered HTML';
    if (path.startsWith('og/stations/')) return 'station Open Graph JPEGs';
    if (path.startsWith('_nuxt/')) return 'Nuxt JS/CSS bundles';
    if (path.startsWith('img/')) return 'catalog / station images';
    if (path.startsWith('radio/')) return 'radio JSON catalogs';
    if (path.endsWith('.json') || path.endsWith('.jsonl')) return 'other JSON/payloads';
    return 'other static assets';
  };
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlinks must not be published: ' + relative(root, full));
      if (entry.isDirectory()) {
        assert.ok(!['.git', '.github', 'node_modules'].includes(entry.name), 'Unexpected private directory: ' + full);
        await scan(full);
      } else if (entry.isFile()) {
        assert.ok(!['.env', '.env.local', '.npmrc'].includes(entry.name), 'Private configuration in output: ' + full);
        assert.ok(!entry.name.endsWith('.map'), 'Do not publish production source maps: ' + full);
        const info = await stat(full);
        bytes += info.size;
        count += 1;
        const rel = relative(root, full).replaceAll('\\', '/');
        const category = groupFor(rel);
        const current = groups.get(category) || { count: 0, bytes: 0 };
        current.count++;
        current.bytes += info.size;
        groups.set(category, current);
        if (largest.length < 10 || info.size > largest[largest.length - 1].bytes) {
          largest.push({ path: rel, bytes: info.size });
          largest.sort((a, b) => b.bytes - a.bytes);
          if (largest.length > 10) largest.pop();
        }
      }
    }
  }

  await scan(root);
  // Print actionable metrics even on failed builds; previous runs only
  // displayed total bytes, hiding repeated HTML and other major contributors.
  const mib = (size) => (size / 1024 / 1024).toFixed(2) + ' MiB';
  console.log('GitHub Pages output: ' + count + ' files, ' + mib(bytes) + ' / ' + mib(MAX_PAGES_BYTES));
  for (const [name, entry] of [...groups].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log('  ' + name + ': ' + entry.count + ' files / ' + mib(entry.bytes));
  }
  console.log('Largest generated files:');
  for (const file of largest) console.log('  ' + mib(file.bytes) + ' ' + file.path);

  assert.ok(count > 0, 'No static assets produced');
  assert.ok(bytes < MAX_PAGES_BYTES, 'GitHub Pages generated site exceeds 1 GB: ' + bytes +
    ' (see size breakdown above)');
  console.log('PASS: ' + target + ' Pages output fits within GitHub Pages limit.');
  return { bytes, count, groups: Object.fromEntries(groups), largest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkPagesBuild(process.argv[2] || '.output/public', process.argv[3]);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
