import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("desktop radio sidebar is part of the app shell without hiding the Nuxt page", async () => {
  const app = await readFile("app.vue", "utf8");
  assert.match(app, /<AppSidebar\s*\/>/);
  assert.match(app, /<NuxtPage\s*\/>/);
  assert.match(app, /xl:grid-cols-\[224px_minmax\(0,1fr\)\]/);
  assert.match(app, /id="main-content"/);
});

test("sidebar only appears at desktop widths, routes to existing radio areas, and opens global search", async () => {
  const sidebar = await readFile("components/AppSidebar.vue", "utf8");
  const header = await readFile("components/AppHeader.vue", "utf8");
  assert.match(sidebar, /hidden xl:block/);
  assert.match(sidebar, /worldData/);
  assert.match(sidebar, /radio:open-search/);
  assert.match(header, /addEventListener\("radio:open-search", openSearch\)/);
  assert.match(header, /removeEventListener\("radio:open-search", openSearch\)/);
});

