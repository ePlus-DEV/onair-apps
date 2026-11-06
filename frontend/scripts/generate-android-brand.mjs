import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use the same OnAir artwork as the app, with room for Android's adaptive mask.
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resources = resolve(frontend, '../android/app/src/main/res');
const logo = resolve(frontend, 'public/brand/logo-share.png');
const background = '#101119';
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(densities)) {
  const dir = resolve(resources, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  const legacyLogo = await sharp(logo).resize(Math.round(size * 0.8), Math.round(size * 0.8), { fit: 'contain' }).png().toBuffer();
  const legacy = await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: legacyLogo, gravity: 'centre' }]).png().toBuffer();
  await sharp(legacy).toFile(resolve(dir, 'ic_launcher.png'));
  await sharp(legacy).toFile(resolve(dir, 'ic_launcher_round.png'));
  const adaptiveSize = Math.round(size * 108 / 48);
  const adaptiveLogo = await sharp(logo).resize(Math.round(adaptiveSize * 0.6), Math.round(adaptiveSize * 0.6), { fit: 'contain' }).png().toBuffer();
  await sharp({ create: { width: adaptiveSize, height: adaptiveSize, channels: 4, background: '#00000000' } })
    .composite([{ input: adaptiveLogo, gravity: 'centre' }]).png().toFile(resolve(dir, 'ic_launcher_foreground.png'));
}
await sharp(logo).resize(288, 288, { fit: 'contain' }).png().toFile(resolve(resources, 'drawable/launch_icon.png'));
