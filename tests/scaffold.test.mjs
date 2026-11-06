import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const json = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
test('mobile and desktop share a generated local web bundle', () => {
  const desktop = json('../apps/desktop/src-tauri/tauri.conf.json');
  assert.equal(desktop.build.frontendDist, '../../../dist/web');
  const mobile = readFileSync(new URL('../apps/mobile/capacitor.config.ts', import.meta.url), 'utf8');
  assert.match(mobile, /webDir: '\.\.\/\.\.\/dist\/web'/);
  assert.doesNotMatch(mobile, /server:\s*\{/);
});
