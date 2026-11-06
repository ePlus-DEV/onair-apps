import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Featured station cards reuse overflow-only single-line marquee without hiding Play/Pause', async () => {
  const [featured, marquee] = await Promise.all([
    readFile('components/panel/FeaturedStations.vue', 'utf8'),
    readFile('components/CountryMarquee.vue', 'utf8'),
  ]);

  assert.match(featured, /<CountryMarquee :text="station\.title" \/>/);
  assert.doesNotMatch(featured, /line-clamp-2 text-sm font-semibold leading-5/);
  assert.match(featured, /min-h-\[4\.25rem\] min-w-0 items-center/);
  assert.match(featured, /min-w-0 flex-1 text-sm font-semibold leading-5/);
  assert.match(featured, /px-3 py-3 pr-14/);
  assert.match(featured, /class="absolute bottom-4 right-3 flex h-9 w-9/);
  assert.match(featured, /:aria-pressed="isPlaying\(station\)"/);
  assert.match(featured, /@click="emit\('select-station', station\)"/);
  assert.match(featured, /isPlaying\(station\) \? 'i-lucide-pause' : 'i-lucide-play'/);

  assert.match(marquee, /overflowPixels > 1/);
  assert.match(marquee, /content\.value\.scrollWidth - viewport\.value\.clientWidth/);
  assert.match(marquee, /ResizeObserver/);
  assert.match(marquee, /prefers-reduced-motion: reduce/);
  assert.match(marquee, /animation: none/);
});
