import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("music cards use responsive square artwork without removing navigation", async () => {
  for (const file of ["components/panel/Radio.vue", "components/panel/Station.vue"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /radio-station-card/);
    assert.match(source, /aspect-square/);
    assert.match(source, /focus-visible:ring-rose-500/);
    assert.match(source, /<NuxtLink/);
    assert.match(source, /loading="lazy"/);
  }
});

test("music cards respect both semantic color tokens and reduced motion preferences", async () => {
  const css = await readFile("assets/css/main.css", "utf8");
  assert.match(css, /\.radio-station-card\s*\{/);
  assert.match(css, /background:\s*var\(--radio-surface\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
