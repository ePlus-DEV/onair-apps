import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

// GHSA-83rm-6c8r-g728, GHSA-8rc2-428q-7ww3 and GHSA-mrwp-f3q8-3g9p.
// Verify the *resolved* dependency tree, not just the manifest.
test('patched Vue I18n tree does not include unsupported/vulnerable v10 copies', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  const required = ['@intlify/core', '@intlify/core-base', '@intlify/devtools-types',
    '@intlify/message-compiler', '@intlify/shared', 'vue-i18n'];
  assert.equal(manifest.overrides['@intlify/vue-i18n-extensions'], '9.0.0');
  assert.equal(lock.packages['node_modules/@intlify/vue-i18n-extensions']?.version, '9.0.0');
  for (const pkg of required) {
    assert.equal(manifest.overrides[pkg], '11.4.14');
    const installed = Object.entries(lock.packages)
      .filter(([path]) => path.endsWith('/node_modules/' + pkg) || path === 'node_modules/' + pkg);
    assert.ok(installed.length, 'Package missing: ' + pkg);
    for (const [path, entry] of installed) {
      assert.equal(entry.version, '11.4.14', 'Unpatched package: ' + path);
    }
  }
});

test('redirect client must be patched to prevent cross-origin credential forwarding', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(manifest.overrides['follow-redirects'], '1.16.2');
  const resolved = Object.entries(lock.packages).filter(([path]) =>
    path === 'node_modules/follow-redirects' || path.endsWith('/node_modules/follow-redirects'));
  assert.ok(resolved.length);
  for (const [path, entry] of resolved) {
    assert.equal(entry.version, '1.16.2', 'Unpatched package: ' + path);
  }
});
