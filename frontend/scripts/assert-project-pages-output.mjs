import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Verify root-domain or legacy project-path markup before publishing. */
export async function assertProjectPagesOutput(root, repoName) {
  const customDomain = repoName === 'custom-domain';
  if (!customDomain) assert.match(repoName, /^onair-(?:staging|production)-pages$/);
  const base = customDomain ? '/' : '/' + repoName + '/';
  const pages = [
    ['home', 'index.html'],
    ['station deep link', 'asia/viet-nam/vov-gt-hcm/index.html'],
  ];
  for (const [label, file] of pages) {
    const html = await readFile(join(root, file), 'utf8');
    assert.ok(html.includes(base + '_nuxt/'),
      label + ': Nuxt JS/CSS URLs must use ' + base);
    assert.ok(html.includes(base + 'brand/logo-share.png'),
      label + ': brand image must use Pages project base');
    const assetUrls = [...html.matchAll(/\b(?:href|src)=["'](\/[^"']*)["']/gi)]
      .map(m => m[1]).filter(url => !url.startsWith('//'));
    const invalid = customDomain
      ? assetUrls.filter(url => /^\/onair-(?:staging|production)-pages\//.test(url))
      : assetUrls.filter(url => !url.startsWith(base));
    assert.deepEqual(invalid.slice(0, 8), [],
      label + ': invalid project-path/root-domain assets: ' + invalid.slice(0, 8));
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await assertProjectPagesOutput(process.argv[2] || '.output/public', process.argv[3] || '');
    console.log('PASS: GitHub Pages assets and direct-station URLs use the configured base path.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
