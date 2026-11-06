import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const playerPath = join(process.cwd(), "components/player/Player.vue");

test("HLS startup prefers hls.js and waits for manifest readiness", async () => {
  const source = await readFile(playerPath, "utf8");
  const start = source.indexOf("const configureHlsSource");
  const end = source.indexOf("const stopPlaybackFailure", start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const block = source.slice(start, end);
  const supportCheck = block.indexOf("if (!Hls.isSupported())");
  const nativeCheck = block.indexOf('media.canPlayType("application/vnd.apple.mpegurl")');

  assert.ok(
    supportCheck >= 0 && nativeCheck > supportCheck,
    "native HLS must only be considered after hls.js support is checked",
  );

  const manifestParsed = block.indexOf("Hls.Events.MANIFEST_PARSED");
  const manifestPlay = block.indexOf("void tryPlay();", manifestParsed);
  const attachMedia = block.lastIndexOf("hlsInstance.attachMedia(media);");
  const playAfterAttach = block.indexOf("void tryPlay();", attachMedia);

  assert.ok(manifestParsed >= 0 && manifestPlay > manifestParsed);
  assert.ok(attachMedia > manifestParsed);
  assert.equal(
    playAfterAttach,
    -1,
    "do not call play immediately after attachMedia; wait for manifest/media readiness",
  );
});

test("media element errors do not double-retry active hls.js playback", async () => {
  const source = await readFile(playerPath, "utf8");
  const start = source.indexOf("const onMediaError");
  const end = source.indexOf("const onVolumeChange", start);
  const block = source.slice(start, end);

  assert.match(block, /if \(hlsInstance\) return;/);
});
