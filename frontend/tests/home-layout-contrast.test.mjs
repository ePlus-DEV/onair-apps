import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function luminance(hex) {
  const channels = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const rgb = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('homepage promotes featured stations ahead of personalized sections', async () => {
  const source = await read('pages/index.vue');
  assert.ok(source.indexOf('id="featured-radio"') > source.indexOf('class="radio-hero'));
  assert.ok(source.indexOf('id="featured-radio"') < source.indexOf('<PanelResumeCard'));
  assert.ok(source.indexOf('id="featured-radio"') < source.indexOf('<PanelListeningLibrary compact'));
  assert.ok(source.indexOf('id="explore-radio"') > source.indexOf('<PanelListeningLibrary compact'));
  assert.match(source, /text-rose-700 dark:text-rose-300/);
});

test('compact Favorites / Recently played omit empty sections without removing full-library empty guidance', async () => {
  const source = await read('components/panel/ListeningLibrary.vue');
  assert.match(source, /<div v-if="groups.length" class="space-y-7">/);
  assert.match(source, /\(!props\.compact \|\| group\.items\.length > 0\)/);
  assert.match(source, /group\.key === 'recent'/);
  assert.match(source, /<p v-else class="rounded-2xl border border-dashed/);
  assert.match(source, /@click="togglePlayback\(station, group\.items\)"/);
});

test('restored dark palette and informative badges have clear contrast', async () => {
  const css = await read('assets/css/main.css');
  const dark = css.match(/html\.dark,\s*html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(dark, 'dark color tokens defined');
  const token = name => {
    const value = dark.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1];
    assert.ok(value, `Missing token: ${name}`);
    return value;
  };
  const surface = token('radio-surface');
  const muted = token('radio-text-muted');
  const primary = token('radio-text');
  assert.ok(contrast(muted, surface) >= 4.5, 'secondary text meets WCAG AA');
  assert.ok(contrast(primary, surface) >= 7, 'main text should remain legible');
  assert.notEqual(token('radio-page-bg'), surface, 'cards must separate from the page background');
  assert.equal(token('radio-page-bg'), '#101119', 'original dark page tone restored');
  assert.equal(surface, '#1a1b26', 'original dark card tone restored');
  assert.equal(token('radio-surface-soft'), '#111827', 'original muted surface tone restored');
  const chipBg = token('radio-badge-bg');
  const chipText = token('radio-badge-text');
  assert.ok(contrast(chipText, chipBg) >= 4.5, 'badge text meets WCAG AA');
  assert.ok(contrast(chipBg, surface) >= 1.4, 'badge fill remains perceptibly distinct from the card');
  assert.match(dark, /--radio-badge-border:\s*rgb\(148 163 184 \/ 0\.4\)/);
});

test('country, station and queue count chips use the shared badge treatment', async () => {
  const [styles, countries, stations, queue, featured] = await Promise.all([
    read('assets/css/main.css'),
    read('components/panel/Radio.vue'),
    read('components/panel/Station.vue'),
    read('components/player/Queue.vue'),
    read('components/panel/FeaturedStations.vue'),
  ]);
  assert.match(styles, /\.radio-count-badge,/);
  assert.match(styles, /\.radio-neutral-badge\s*\{/);
  assert.match(styles, /background:\s*var\(--radio-badge-bg\)/);
  assert.ok((countries.match(/radio-count-badge/g) || []).length >= 2, 'country section and compact station counts share chips');
  assert.match(stations, /radio-count-badge/);
  assert.match(queue, /radio-count-badge/);
  assert.match(featured, /'radio-neutral-badge'/);
});


test('compact country list stays in two mobile columns while long names marquee on one line', async () => {
  const [country, css, homepage, marquee] = await Promise.all([
    read('components/panel/Radio.vue'),
    read('assets/css/main.css'),
    read('pages/index.vue'),
    read('components/CountryMarquee.vue'),
  ]);
  assert.match(homepage, /<PanelRadio compact\s*\/>/);
  assert.match(country, /<CountryMarquee :text="\$t\(country\.name\)" \/>/);
  assert.doesNotMatch(country, /whitespace-normal break-words text-sm font-semibold/);
  assert.match(country, /v-if="!compact"/);
  assert.match(css, /\.radio-country-compact > div:last-child \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 8px; \}/);
  assert.match(css, /\.radio-country-compact \.radio-themed-artwork \{[^}]*width: 42px; height: 44px;/);
  assert.match(css, /@media \(min-width: 1024px\) \{ \.radio-country-compact > div:last-child \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \} \}/);
  assert.match(marquee, /scrollWidth - viewport\.value\.clientWidth/);
  assert.match(marquee, /ResizeObserver/);
  assert.match(marquee, /overflowPixels > 1/);
  assert.match(marquee, /country-marquee-slide/);
  assert.match(marquee, /prefers-reduced-motion: reduce/);
  assert.match(marquee, /text-overflow: ellipsis/);
});
