import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("large station/country listings do not prefetch whole pages on viewport entry", async () => {
  for (const [file, url] of [
    ["components/panel/Station.vue", "station.url"],
    ["components/panel/FeaturedStations.vue", "station.url"],
    ["components/panel/Radio.vue", "country.url"],
  ]) {
    const html = await readFile(file, "utf8");
    assert.match(html, new RegExp("<NuxtLink\\s+:prefetch=\"false\"\\s+:to=\"" + url.replace(".", "\\.") + "\""), file);
    assert.match(html, /loading="lazy"\s+decoding="async"/, file);
    assert.match(html, /<NuxtLink[\s\S]+<\/NuxtLink>/, file);
  }
});

test("favorites and recently played keep normal navigation without bulk prefetch", async () => {
  const source = await readFile("components/panel/ListeningLibrary.vue", "utf8");
  assert.match(source, /<NuxtLink\s+:to="station\.url"\s+:prefetch="false"/);
  assert.match(source, /@click="openStationDetails\(\$event\)"/);
  assert.match(source, /@click="togglePlayback\(station, group\.items\)"/);
});

test("static prerender and OG metadata are preserved in pages", async () => {
  const [station, country, home] = await Promise.all([
    readFile("pages/[area]/[country]/[station].vue", "utf8"),
    readFile("pages/[area]/[country]/index.vue", "utf8"),
    readFile("pages/index.vue", "utf8"),
  ]);
  assert.match(station, /property: "og:image", content: seoImage\.value/);
  assert.match(country, /countryCollectionSchema/);
  assert.match(home, /ogImage:/);
});
