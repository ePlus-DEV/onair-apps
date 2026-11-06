import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("home discovery actions link to real on-page sections", async () => {
  const page = await readFile("pages/index.vue", "utf8");
  const css = await readFile("assets/css/main.css", "utf8");
  assert.match(page, /href="#featured-radio"/);
  assert.match(page, /id="featured-radio"/);
  assert.match(page, /href="#explore-radio"/);
  assert.match(page, /id="explore-radio"/);
  assert.match(page, /radio-hero/);
  assert.match(css, /\.radio-hero\s*\{/);
  assert.match(await readFile("app.vue", "utf8"), /<PlayerSession\s*\/>/);
  assert.match(page, /<PanelFeaturedStations\s/);
  assert.match(page, /<PanelRadio\s+compact\s*\/>/);
});

