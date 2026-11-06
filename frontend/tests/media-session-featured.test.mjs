import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRadioMediaMetadata } from "../utils/radio-media-session.mjs";
import {
  VIETNAM_FEATURED_STATION_IDS,
  HOMEPAGE_FEATURED_STATION_PATHS,
  selectVietnamFeaturedStations,
  selectHomepageFeaturedStations,
} from "../utils/featured-stations.mjs";

test("Media Session uses song artwork and details before station logo", () => {
  const result = buildRadioMediaMetadata({
    title: "Xin Đừng Nhắc Máy", artist: "B Ray", station: "Rap Việt Radio - Zing MP3",
    artwork: "https://photo-resize-zmp3.zadn.vn/image.jpg",
    fallbackArtwork: "/img/asia/viet-nam/rap-viet-radio-zing-mp3.png",
  }, "https://radio-new.eplus.dev");
  assert.deepEqual(result, {
    title: "Xin Đừng Nhắc Máy",
    artist: "B Ray",
    album: "Rap Việt Radio - Zing MP3",
    artwork: [{ src: "https://photo-resize-zmp3.zadn.vn/image.jpg" }],
  });
});

test("Media Session falls back to local station artwork and ignores invalid schemes", () => {
  const origin = "https://radio-new.eplus.dev";
  assert.deepEqual(buildRadioMediaMetadata({ title: "", station: "VOV Giao Thông TP.HCM", artwork: "data:bad", fallbackArtwork: "/img/asia/viet-nam/vov-giao-thong.png" }, origin), {
    title: "VOV Giao Thông TP.HCM",
    artist: "VOV Giao Thông TP.HCM",
    album: "VOV Giao Thông TP.HCM",
    artwork: [{ src: origin + "/img/asia/viet-nam/vov-giao-thong.png" }],
  });
  assert.deepEqual(buildRadioMediaMetadata({}, origin).artwork, [{ src: origin + "/brand/android-chrome-512x512.png" }]);
});

test("Homepage featured stations contain VOV Giao Thong and Zing only", async () => {
  const catalog = JSON.parse(await readFile("public/radio/asia/viet-nam.json", "utf8"));
  const featured = selectVietnamFeaturedStations(catalog);
  const ids = featured.map(([id]) => id);
  assert.deepEqual(ids, [...VIETNAM_FEATURED_STATION_IDS]);
  assert.equal(ids[0], "vov-gt-hcm");
  assert.equal(ids.length, 8);
  assert.deepEqual(ids.slice(-2), ["c-pop-zing-mp3", "acoustic-radio-zing-mp3"]);
  assert.ok(["kpop-radio-zing-mp3", "bolero-zing-mp3", "cham-radio-zing-mp3"].every(id => !ids.includes(id)));
  assert.ok(ids.slice(1).every(id => id.includes("zing-mp3")));
  for (const unavailable of ["vov1", "vov2", "vov3", "vov5"]) {
    assert.ok(!ids.includes(unavailable), `Do not feature known unavailable station ${unavailable}`);
  }
  assert.deepEqual(selectVietnamFeaturedStations({ "vov1": catalog.vov1 }), []);
});

test("Homepage featured radio includes Heart UK and Power 98 Love Songs with unique country routes", async () => {
  const [vn, uk, sg] = await Promise.all([
    readFile("public/radio/asia/viet-nam.json", "utf8"),
    readFile("public/radio/europe/united-kingdom.json", "utf8"),
    readFile("public/radio/asia/singapore.json", "utf8"),
  ]);
  const featured = selectHomepageFeaturedStations({
    "asia/viet-nam": JSON.parse(vn),
    "europe/united-kingdom": JSON.parse(uk),
    "asia/singapore": JSON.parse(sg),
  });
  assert.equal(HOMEPAGE_FEATURED_STATION_PATHS.length, VIETNAM_FEATURED_STATION_IDS.length + 2);
  assert.equal(HOMEPAGE_FEATURED_STATION_PATHS.length, 10);
  assert.equal(featured.length, 10);
  assert.deepEqual(featured.map(entry => entry.path), [...HOMEPAGE_FEATURED_STATION_PATHS]);
  assert.equal(featured[0].path, "asia/viet-nam/vov-gt-hcm");
  assert.equal(featured.find(entry => entry.id === "heart-uk")?.meta.title, "Heart UK");
  assert.equal(featured.find(entry => entry.id === "power")?.meta.title, "Power 98 Love Songs");
  assert.deepEqual(featured.slice(1, 3).map(entry => entry.path), [
    "europe/united-kingdom/heart-uk",
    "asia/singapore/power",
  ]);
  assert.equal(new Set(featured.map(entry => entry.path)).size, featured.length);
  assert.deepEqual(featured.slice(-2).map(entry => entry.id), ["c-pop-zing-mp3", "acoustic-radio-zing-mp3"]);
  for (const unavailable of ["vov1", "vov2", "vov3", "vov5"]) {
    assert.ok(!featured.some(entry => entry.id === unavailable));
  }
});

test("Homepage curation skips unavailable stations without substituting another country's stream", () => {
  const selected = selectHomepageFeaturedStations({
    "asia/viet-nam": { "vov-gt-hcm": { title: "VOV GT", stream: "https://radio.example/live.mp3" } },
    "europe/united-kingdom": { "heart-uk": { title: "Heart", stream: "" } },
    "asia/singapore": { power: { title: "Power", stream: "https://radio.example/power" } },
  });
  assert.deepEqual(selected.map(entry => entry.path), [
    "asia/viet-nam/vov-gt-hcm",
    "asia/singapore/power",
  ]);
});

test("Featured cards use each station's country metadata for direct playback", async () => {
  const source = await readFile("pages/index.vue", "utf8");
  assert.match(source, /selectHomepageFeaturedStations\(featuredCatalogs\.value/);
  assert.match(source, /area, country, id, meta/);
  assert.match(source, /playback\.activate\(createPlaybackStation\(/);
  assert.match(source, /featuredEntries\.value\.find\(entry =>/);
  assert.match(source, /featuredStations\.value, \{ autoplay: true \}/);
});

test("Featured radio cards toggle play/pause with the global player without leaving the page", async () => {
  const [card, home] = await Promise.all([
    readFile("components/panel/FeaturedStations.vue", "utf8"),
    readFile("pages/index.vue", "utf8"),
  ]);

  // Match station URLs, not only short IDs; the carousel mixes countries.
  assert.match(card, /:key="station\.url \|\| station\.id"/);
  assert.match(card, /station\.url === activeStationUrl/);
  assert.match(home, /:active-station-url="playback\.station\?\.url"/);

  // Keep the direct-play control separate from the station details link.
  assert.match(card, /:to="station\.url"/);
  assert.match(card, /@click="emit\('select-station', station\)"/);
  assert.match(card, /:name="isPlaying\(station\) \? 'i-lucide-pause' : 'i-lucide-play'"/);
  assert.match(card, /:aria-pressed="isPlaying\(station\)"/);

  // Pause the active stream; resume with a play request; otherwise activate the chosen catalog.
  assert.match(home, /playback\.station\?\.url === station\.url && playback\.station\.sources\.length/);
  assert.match(home, /if \(playback\.playing \|\| playback\.waiting\) playback\.pauseRequest \+= 1/);
  assert.match(home, /else playback\.requestStation\(station\.url\)/);
  assert.match(home, /playback\.activate\(createPlaybackStation\([\s\S]*?featuredStations\.value, \{ autoplay: true \}/);
});

test("Missing or unusable featured streams are excluded rather than played", () => {
  const sample = {
    "vov-gt-hcm": { title: "VOV Giao Thong", stream: "" },
    "rap-viet-radio-zing-mp3": { title: "Rap Việt", stream: "https://example.com/radio.m3u8" },
    "edm-radio-zing-mp3": { title: "EDM", stream: "javascript:alert(1)" },
  };
  assert.deepEqual(selectVietnamFeaturedStations(sample).map(([id]) => id), ["rap-viet-radio-zing-mp3"]);
});

test("Player registers iOS track commands as station navigation", async () => {
  const source = await readFile("components/player/Player.vue", "utf8");
  assert.match(source, /nexttrack:\s*\(\) => navigateStation\(1\)/);
  assert.match(source, /previoustrack:\s*\(\) => navigateStation\(-1\)/);
  assert.match(source, /new MediaMetadata\(details\)/);
  assert.match(source, /watch\([\s\S]*?nowPlayingTitle, nowPlayingArtist, nowPlayingArtwork/);
});
