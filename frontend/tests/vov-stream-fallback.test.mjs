import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createPlaybackStation } from "../utils/playback-station.mjs";
import { buildPlaybackSources } from "../utils/radio-source-plan.mjs";

const catalog = JSON.parse(
  await readFile(new URL("../public/radio/asia/viet-nam.json", import.meta.url), "utf8"),
);

const restoredVovIds = ["vov1", "vov2", "vov3", "vov5", "vov-english", "vov-247"];

test("VOV stations prioritize direct HTTPS HLS with source fallbacks", () => {
  for (const id of restoredVovIds) {
    const meta = catalog[id];
    assert.ok(meta, `Missing VOV catalog entry: ${id}`);
    assert.equal(meta.type, "application/x-mpegURL", id);
    assert.equal(meta.cros, false, `HLS must not use the legacy CORS proxy: ${id}`);
    assert.match(meta.stream, /^https:\/\/.+\.m3u8$/i, id);
    assert.ok(meta.streams?.length > 0, `No fallback configured: ${id}`);

    const station = createPlaybackStation({
      area: "asia",
      country: "viet-nam",
      id,
      meta,
      corsServer: "https://proxy.example/",
    });
    const sources = buildPlaybackSources(station.sources, "https://proxy.example/");
    assert.equal(sources[0].src, meta.stream, id);
    assert.equal(sources[0].proxied, false, id);
    assert.equal(new Set(sources.map(source => source.src)).size, sources.length, id);
    assert.ok(
      sources.some(source => source.src !== meta.stream),
      `No distinct playable fallback: ${id}`,
    );
  }
});

test("VOV1 prioritizes listener-confirmed VOV Live while retaining the CDN fallback", () => {
  assert.equal(catalog.vov1.stream, "https://str.vov.gov.vn/vovlive/vov1vov5Vietnamese.sdp_aac/playlist.m3u8");
  assert.equal(catalog.vov1.streams[0].url, "https://stream-cdn.vov.vn/live/vov1-audio_only.m3u8");
  const station = createPlaybackStation({ area: "asia", country: "viet-nam", id: "vov1", meta: catalog.vov1 });
  assert.deepEqual(station.sources.slice(0, 2).map(source => source.src), [
    catalog.vov1.stream,
    catalog.vov1.streams[0].url,
  ]);
  assert.ok(station.sources.every(source => !source.proxied), "VOV1 HLS and MP3 sources should be direct");
});

test("VOV2 retains direct broadcaster HLS and VOV Live fallback pending playback confirmation", () => {
  assert.equal(new URL(catalog.vov2.stream).hostname, "stream-cdn.vov.vn");
  assert.ok(catalog.vov2.streams.some(entry =>
    new URL(entry.url).hostname === "str.vov.gov.vn"
    && entry.type === "application/x-mpegURL"
    && entry.cros === false
  ), "VOV2: missing VOV Live fallback");
});

test("VOV Giao thong regional channels offer independent VOV Live HLS fallbacks", () => {
  const expected = {
    "vov-gt-hcm": "/vovGTHCM.sdp_aac/playlist.m3u8",
    "vov-giao-thong": "/vovGTHN.sdp_aac/playlist.m3u8",
    "vov-mekong": "/vovgtMeKong.sdp_aac/playlist.m3u8",
  };
  for (const [id, path] of Object.entries(expected)) {
    const station = createPlaybackStation({
      area: "asia", country: "viet-nam", id, meta: catalog[id],
      corsServer: "https://proxy.example/",
    });
    assert.equal(station.sources[0].src, catalog[id].stream, id);
    assert.ok(station.sources.some(source =>
      new URL(source.src).hostname === "str.vov.gov.vn"
      && new URL(source.src).pathname.endsWith(path)
      && source.type === "application/x-mpegURL"
      && !source.proxied
    ), `${id}: missing station-specific VOV Live`);
  }
});

test("VOV4 regional options are specific to their area and use HTTPS", () => {
  const areas = {
    "vov4": "vov4hcm",
    "vov4-tay-bac": "vov4tb",
    "vov4-tay-nguyen": "vov4tn",
  };
  for (const [id, suffix] of Object.entries(areas)) {
    assert.ok(catalog[id].streams.some(source =>
      new URL(source.url).protocol === "https:"
      && new URL(source.url).pathname === `/${suffix}`
    ), `${id}: missing regional option`);
  }
  assert.ok(catalog["vov4-tay-nguyen"].streams.some(source =>
    source.url.endsWith("/vov4.TayNguyen.sdp_aac/playlist.m3u8")
    && source.type === "application/x-mpegURL"
  ));
});

test("VOV6 never uses the VOV2 stream as its own audio", () => {
  assert.equal(catalog.vov6.stream, "https://stream.vovmedia.vn/vov6");
  assert.equal(catalog.vov6.type, "audio/mpeg");
  assert.equal(catalog.vov6.cros, false);
});

test("VOV3/VOV5/English sources remain station-specific", () => {
  assert.match(catalog.vov3.stream, /\/vov3\.sdp_aac\/playlist\.m3u8$/);
  assert.match(catalog.vov5.stream, /\/vov5\.sdp_aac\/playlist\.m3u8$/);
  assert.match(catalog["vov-english"].stream, /\/vov247vov5English\.sdp_aac\/playlist\.m3u8$/);
  assert.match(catalog["vov-247"].stream, /\/vov24_7-audio_only\.m3u8$/);
});
