import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppAsset } from '../frontend/utils/public-site-path.mjs';

test('native app uses public station artwork while keeping catalog and branding local', () => {
  assert.equal(resolveAppAsset('/img/asia/flags/viet-nam.png', '/', true), 'https://radio.eplus.dev/img/asia/flags/viet-nam.png');
  assert.equal(resolveAppAsset('/radio/asia/viet-nam.json', '/', true), '/radio/asia/viet-nam.json');
  assert.equal(resolveAppAsset('/brand/logo-share.png', '/', true), '/brand/logo-share.png');
  assert.equal(resolveAppAsset('/img/europe/flags/france.png', '/preview/', false), '/preview/img/europe/flags/france.png');
  assert.equal(resolveAppAsset('https://example.com/image.png', '/', true), 'https://example.com/image.png');
});
