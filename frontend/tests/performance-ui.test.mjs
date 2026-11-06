import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { observeCountrySize } from '../utils/shared-country-resize.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('search index is fetched only after search focus/intent, not on Header mount', async () => {
  const [composable, box, header] = await Promise.all([
    read('composables/useStationSearchIndex.ts'),
    read('components/search/Box.vue'),
    read('components/AppHeader.vue'),
  ]);
  assert.match(header, /<SearchBox ref="headerSearch" inline/);
  assert.match(composable, /const load = \(\): Promise<void> =>/);
  assert.doesNotMatch(composable, /onMounted\(async \(\) =>/);
  assert.match(composable, /if \(requested\) return requested/);
  assert.match(composable, /loaderFor\(searchUrl\)\(\)/);
  assert.match(composable, /return \{ index, loading, error, load \}/);
  assert.match(box, /load: loadLocalIndex \} = useStationSearchIndex\(\)/);
  assert.match(box, /const openResults = \(\): void => \{\s*resultsOpen\.value = true;\s*void loadLocalIndex\(\)/);
  assert.match(box, /@focusin="openResults"/);
  assert.match(box, /const focus = \(\): void => \{\s*openResults\(\)/);
  assert.match(box, /resultsOpen\.value \|\| !inline\.value/);
  assert.match(box, /const usingLocal = computed/);
  assert.match(box, /onBeforeUnmount/);
});

test('country labels share a ResizeObserver and do not attach per-card resize listeners', async () => {
  const component = await read('components/CountryMarquee.vue');
  assert.match(component, /observeCountrySize\(viewport\.value, measureOverflow\)/);
  assert.match(component, /stopObserving\?\.\(\)/);
  assert.doesNotMatch(component, /new ResizeObserver\(/);
  assert.doesNotMatch(component, /window\.addEventListener\("resize"/);
  assert.match(component, /animation-play-state: paused/);
  assert.match(component, /animation-play-state: running/);
  assert.match(component, /prefers-reduced-motion/);
});

test('shared observer dispatches only to relevant elements and cleans up', () => {
  const previous = { window: globalThis.window, ResizeObserver: globalThis.ResizeObserver };
  const listeners = [];
  const instances = [];
  class FakeResizeObserver {
    constructor(callback) { this.callback = callback; this.observed = new Set(); instances.push(this); }
    observe(element) { this.observed.add(element); }
    unobserve(element) { this.observed.delete(element); }
    disconnect() { this.disconnected = true; }
    notify(element) { this.callback([{ target: element }]); }
  }
  globalThis.window = {
    addEventListener: (...args) => listeners.push(args),
    removeEventListener: () => {},
  };
  globalThis.ResizeObserver = FakeResizeObserver;
  try {
    const a = {}, b = {};
    let aCount = 0, bCount = 0;
    const aOff = observeCountrySize(a, () => aCount++);
    const bOff = observeCountrySize(b, () => bCount++);
    assert.equal(instances.length, 1, 'one shared observer for two elements');
    assert.equal(listeners.length, 0, 'no window resize listener when ResizeObserver exists');
    assert.equal(instances[0].observed.size, 2);
    instances[0].notify(a);
    assert.deepEqual([aCount, bCount], [1, 0]);
    instances[0].notify(b);
    assert.deepEqual([aCount, bCount], [1, 1]);
    aOff();
    assert.equal(instances[0].observed.has(a), false);
    bOff();
    assert.equal(instances[0].disconnected, true);
  } finally {
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window;
    if (previous.ResizeObserver === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = previous.ResizeObserver;
  }
});

test('resize listener fallback is shared and removed once when no observer is supported', () => {
  const previous = { window: globalThis.window, ResizeObserver: globalThis.ResizeObserver };
  let subscribed = 0, removed = 0, handler;
  globalThis.window = {
    addEventListener: (name, callback) => { if (name === 'resize') { subscribed++; handler = callback; } },
    removeEventListener: name => { if (name === 'resize') removed++; },
  };
  delete globalThis.ResizeObserver;
  try {
    let called = 0;
    const stopA = observeCountrySize({}, () => called++);
    const stopB = observeCountrySize({}, () => called++);
    assert.equal(subscribed, 1);
    handler();
    assert.equal(called, 2);
    stopA();
    assert.equal(removed, 0);
    stopB();
    assert.equal(removed, 1);
  } finally {
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window;
    if (previous.ResizeObserver === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = previous.ResizeObserver;
  }
});
