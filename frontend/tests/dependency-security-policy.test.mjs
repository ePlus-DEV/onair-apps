import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Dependabot includes npm and GitHub Actions but does not bypass default-branch security updates', async () => {
  const config = await read('.github/dependabot.yml');
  assert.match(config, /version:\s*2/);
  assert.match(config, /package-ecosystem:\s*["']npm["']/);
  assert.match(config, /package-ecosystem:\s*["']github-actions["']/);
  // GitHub security updates must target the default branch, not a special branch.
  const effective = config.split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n');
  assert.doesNotMatch(effective, /^\s*target-branch\s*:/m);
  assert.match(effective, /open-pull-requests-limit:\s*2/);
  assert.match(effective, /applies-to:\s*security-updates/);
  assert.match(effective, /applies-to:\s*version-updates/);
});

test('PR CI audits the entire installed production tree for high or critical advisories', async () => {
  const ci = await read('.github/workflows/build.yml');
  const install = ci.indexOf('run: npm ci');
  const audit = ci.indexOf('run: npm audit --omit=dev --audit-level=high');
  assert.ok(install >= 0 && audit > install, 'audit must run after npm ci');
  assert.doesNotMatch(ci, /npm audit[^\n]*(?:\|\|\s*true|continue-on-error)/,
    'do not ignore high-severity security audit failures');
  assert.match(ci, /steps\.current\.outputs\.run == 'true'/,
    'retain the existing trusted PR CI scope guard');
});

test('production lockfile excludes the vulnerable nested esbuild copy', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.deepEqual(manifest.overrides?.fontless, { esbuild: '0.28.2' });
  assert.equal(lock.packages['node_modules/esbuild']?.version, '0.28.2');
  assert.equal(lock.packages['node_modules/nuxt']?.version, '4.6.4');
  assert.equal(lock.packages['node_modules/fontless/node_modules/esbuild'], undefined);
  assert.equal(
    Object.keys(lock.packages).filter((path) =>
      path.startsWith('node_modules/fontless/node_modules/@esbuild/')).length,
    0,
    'No outdated nested esbuild platform binaries should remain',
  );
  assert.equal(lock.packages['node_modules/@nuxt/ui']?.version, '4.12.0',
    'Preserve Dependabot PR #308 when backporting security fix');
});
