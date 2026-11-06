import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_STREAM_ATTEMPTS,
  buildPlaybackSources,
  nextPlaybackIndex,
} from "../utils/radio-source-plan.mjs";

test("does not auto-proxy HLS manifests but keeps proxy fallback for plain streams", () => {
  const result = buildPlaybackSources(
    [
      {
        src: "https://radio.example/live.m3u8",
        type: "application/x-mpegURL",
        source: "primary",
      },
      { src: "https://backup.example/live.mp3", source: "alternative" },
    ],
    "https://cors.example/",
  );

  assert.deepEqual(
    result.map((item) => [item.src, Boolean(item.proxied)]),
    [
      ["https://radio.example/live.m3u8", false],
      ["https://backup.example/live.mp3", false],
      ["https://cors.example/https://backup.example/live.mp3", true],
    ],
  );
});

test("does not proxy a source that is already proxied", () => {
  const result = buildPlaybackSources(
    [
      {
        src: "https://cors.example/https://radio.example/live.mp3",
        proxied: true,
      },
    ],
    "https://cors.example/",
  );

  assert.equal(result.length, 1);
});

test("deduplicates sources and proxy variants", () => {
  const result = buildPlaybackSources(
    [
      { src: "https://radio.example/live.mp3" },
      { src: "https://radio.example/live.mp3" },
    ],
    "https://cors.example/",
  );

  assert.equal(result.length, 2);
});

test("keeps a single direct HLS candidate when the catalog marks it direct", () => {
  const result = buildPlaybackSources(
    [
      {
        src: "https://multi-playlist.example/live/index.m3u8",
        type: "application/x-mpegURL",
        proxied: false,
      },
    ],
    "https://cors.example/",
  );

  assert.deepEqual(result, [
    {
      src: "https://multi-playlist.example/live/index.m3u8",
      type: "application/x-mpegURL",
      proxied: false,
    },
  ]);
});

test("cycles playback candidates while the global retry budget remains", () => {
  assert.equal(nextPlaybackIndex(0, 4), 1);
  assert.equal(nextPlaybackIndex(3, 4), 0);
  assert.equal(nextPlaybackIndex(0, 0), -1);
  assert.equal(MAX_STREAM_ATTEMPTS, 6);
});
