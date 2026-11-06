import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

import { createPlaybackStation } from "../utils/playback-station.mjs";
import { buildPlaybackSources } from "../utils/radio-source-plan.mjs";

const catalog = JSON.parse(
  await readFile(new URL("../public/radio/asia/viet-nam.json", import.meta.url), "utf8"),
);

test("VOH family keeps existing stations without duplicates", () => {
  const ids = [
    "voh-am-610khz",
    "voh-fm-99.9-mhz",
    "voh-fm-95.6-mhz",
    "voh-fm-87.7-mhz",
  ];
  assert.deepEqual(
    Object.keys(catalog).filter((id) => id.startsWith("voh-")).sort(),
    [...ids].sort(),
  );
});

test("VOH FM 95.6 uses the supplied HLS endpoint and official station page", async () => {
  const meta = catalog["voh-fm-95.6-mhz"];
  assert.ok(meta);
  assert.equal(meta.type, "application/x-mpegURL");
  assert.equal(meta.cros, false);
  assert.equal(
    meta.url,
    "https://voh.com.vn/radio/kenh-fm-956-02221123001000956.html",
  );
  assert.match(meta.stream, /^https:\/\/1011337676\.vnns\.net\//);
  assert.match(meta.stream, /\/htvc\/VOH-FM95\.6\.adm\.tms\/playlist\.m3u8$/);
  assert.notEqual(meta.stream, "https://strm.voh.com.vn/radio/channel1/playlist.m3u8");
  assert.equal(meta.features, "/img/asia/viet-nam/voh-fm-95-6.png");
  await access(new URL("../public" + meta.features, import.meta.url));

  const station = createPlaybackStation({
    area: "asia",
    country: "viet-nam",
    id: "voh-fm-95.6-mhz",
    meta,
    corsServer: "https://proxy.example/",
  });
  const sources = buildPlaybackSources(station.sources, "https://proxy.example/");
  assert.equal(sources[0].src, meta.stream);
  assert.ok(sources.every((source) => !source.proxied), "HLS must not use the generic proxy");
  assert.equal(new Set(sources.map((source) => source.src)).size, sources.length);
});
