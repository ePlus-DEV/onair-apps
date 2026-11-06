import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("country page feeds its catalog to shared playback and PanelStation", async () => {
  const source = await readFile(
    join(process.cwd(), "pages/[area]/[country]/index.vue"),
    "utf8",
  );

  assert.match(source, /playback\.activate\(createPlaybackStation\(/);
  assert.match(source, /stations\.value, \{ autoplay, onlyIfIdle: !autoplay \}/);
  assert.doesNotMatch(source, /<Player\s/);

  assert.match(
    source,
    /<PanelStation[\s\S]*?:stations="stations"[\s\S]*?:active-station-id="activeStationId"[\s\S]*?:country-name="countryName"/,
  );

  assert.doesNotMatch(
    source,
    /<PanelStation\s*\/>/,
    "PanelStation must not fall back to an empty station list on the country page",
  );
});

test("station cards keep details navigation separate from instant playback", async () => {
  const [stationPanel, featuredPanel] = await Promise.all([
    readFile(join(process.cwd(), "components/panel/Station.vue"), "utf8"),
    readFile(join(process.cwd(), "components/panel/FeaturedStations.vue"), "utf8"),
  ]);

  for (const source of [stationPanel, featuredPanel]) {
    assert.match(source, /<NuxtLink[\s\S]*:to="station\.url"/);
    assert.match(source, /<button[\s\S]*emit\('select-station', station\)/);
    assert.doesNotMatch(source, /<NuxtLink[\s\S]*@click="onSelect/);
  }
});



test("station cards marquee long titles and show Play/Pause without hover", async () => {
  const [stationPanel, marquee, countryPage, stationPage] = await Promise.all([
    readFile(join(process.cwd(), "components/panel/Station.vue"), "utf8"),
    readFile(join(process.cwd(), "components/CountryMarquee.vue"), "utf8"),
    readFile(join(process.cwd(), "pages/[area]/[country]/index.vue"), "utf8"),
    readFile(join(process.cwd(), "pages/[area]/[country]/[station].vue"), "utf8"),
  ]);
  // The same measured marquee as the country cards: single line, moves only on overflow.
  assert.match(stationPanel, /<CountryMarquee :text="station\.title" \/>/);
  assert.doesNotMatch(stationPanel, /line-clamp-2 text-sm font-semibold leading-5/);
  assert.match(marquee, /overflowPixels > 1/);
  assert.match(marquee, /prefers-reduced-motion: reduce/);

  // The action is visible on touch screens, separated from the station detail link.
  const button = stationPanel.match(/<button\s+type="button"[\s\S]*?<\/button>/)?.[0];
  assert.ok(button, "station cards need an instant-play button");
  assert.match(button, /h-11 w-11/);
  assert.match(button, /:aria-pressed="isPlaying\(station\)"/);
  assert.match(button, /:aria-label="\$t\(isPlaying\(station\) \? 'player\.pause' : 'player\.play'\)/);
  assert.match(button, /@click="emit\('select-station', station\)"/);
  assert.match(button, /isPlaying\(station\) \? 'i-lucide-pause' : 'i-lucide-play'/);
  assert.doesNotMatch(button, /(?:^|\s)opacity-0\b|group-hover:opacity-100|(?:^|\s)scale-95\b/);
  assert.match(stationPanel, /station\.id === props\.activeStationId && \(playback\.playing \|\| playback\.waiting\)/);

  // Both pages pause the active station instead of restarting its audio stream.
  for (const page of [countryPage, stationPage]) {
    assert.match(page, /const playSelected = \(station: RadioStationOption\): void => \{\s*if \(playback\.station\?\.url === station\.url && \(playback\.playing \|\| playback\.waiting\)\) \{\s*playback\.pauseRequest \+= 1;\s*return;/);
    assert.match(page, /@select-station="playSelected"/);
  }
  assert.match(stationPage, /:active-station-id="playingStationId"/);
});
