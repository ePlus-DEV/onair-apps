import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Use the original committed ON AIR artwork without regenerating PNG files at build time.
const output = '.output/public';
const files = [
  ['brand/logo-share.png', null, null],
  ['brand/favicon-16x16.png', 16, 16],
  ['brand/favicon-32x32.png', 32, 32],
  ['brand/apple-touch-icon.png', 180, 180],
  ['brand/android-chrome-192x192.png', 192, 192],
  ['brand/android-chrome-512x512.png', 512, 512],
  // Existing Windows tile is 270px despite its legacy 150x150 filename.
  ['brand/mstile-150x150.png', 270, 270],
];

for (const [name, width, height] of files) {
  const png = await readFile(output + '/' + name);
  assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG: ' + name);
  const actualWidth = png.readUInt32BE(16);
  const actualHeight = png.readUInt32BE(20);
  assert.ok(actualWidth > 0 && actualHeight > 0, 'Empty image: ' + name);
  if (width !== null) assert.equal(actualWidth, width, 'Wrong width: ' + name);
  if (height !== null) assert.equal(actualHeight, height, 'Wrong height: ' + name);
}
for (const file of ['brand/favicon.ico', 'favicon.ico']) {
  const icon = await readFile(output + '/' + file);
  assert.equal(icon.readUInt16LE(2), 1, 'Invalid ICO: ' + file);
}
// Browsers may request /favicon.ico directly even with explicit PNG links.
// Never ship Nuxt's scaffold icon alongside the branded ON AIR icons.
assert.deepEqual(
  await readFile(output + '/favicon.ico'),
  await readFile(output + '/brand/favicon.ico'),
  'Root favicon must match the official ePlus OnAir favicon',
);
const html = await readFile(output + '/index.html', 'utf8');
assert.match(html, /ePlus OnAir/);
assert.match(html, /Listen Beyond Borders/);
assert.doesNotMatch(html, /Radio ePlus/i);
assert.doesNotMatch(html, /onair-share\.png/);
assert.match(html, /\/favicon\.ico\?v=onair-20261012/, 'Missing explicit branded ICO link');
assert.match(html, /\/brand\/favicon-32x32\.png\?v=onair-20261012/, 'Missing branded PNG favicon link');

const manifest = JSON.parse(await readFile(output + '/brand/site.webmanifest', 'utf8'));
assert.equal(manifest.short_name, 'ePlus OnAir');
assert.ok(manifest.icons.every(icon => !icon.src.includes('onair-mark.svg')));

console.log('PASS: ePlus OnAir copy, original ON AIR logo, favicon/PWA assets and prerendered homepage');
