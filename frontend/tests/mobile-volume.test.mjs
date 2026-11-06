import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { usesSystemVolumeControls } from "../utils/mobile-volume.mjs";

test("iOS and desktop-class iPadOS use system volume controls", () => {
  const iosAgents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148",
  ];
  for (const userAgent of iosAgents) {
    assert.equal(usesSystemVolumeControls({ userAgent }), true, userAgent);
  }
  assert.equal(usesSystemVolumeControls({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", platform: "MacIntel", maxTouchPoints: 5 }), true);
});

test("Android, desktop and unrecognized platforms retain working web volume sliders", () => {
  assert.equal(usesSystemVolumeControls({ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) Chrome/131.0", platform: "Linux armv8l", maxTouchPoints: 5 }), false);
  assert.equal(usesSystemVolumeControls({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", platform: "MacIntel", maxTouchPoints: 0 }), false);
  assert.equal(usesSystemVolumeControls({ userAgent: "Mozilla/5.0 (Windows NT 10.0)" }), false);
  assert.equal(usesSystemVolumeControls(undefined), false);
});

test("mobile player hides unsupported slider and makes supported range touch friendly", async () => {
  const src = await readFile("components/player/Player.vue", "utf8");
  assert.match(src, /v-if="!systemVolumeOnly" type="range"/);
  assert.match(src, /v-if="systemVolumeOnly" role="note"/);
  assert.match(src, /player\.ios_volume_hint/);
  assert.match(src, /radio-volume-mobile h-11/);
  assert.match(src, /media\.volume = nextVolume/);
  assert.match(src, /usesSystemVolumeControls\(navigator\)/);
});

test("all seven locales include the system-volume guidance", async () => {
  for (const locale of ["en-US", "vi-VN", "ja-JP", "zh-CN", "zh-TW", "fr-FR", "ru-RU"]) {
    const data = JSON.parse(await readFile(`lang/${locale}.json`, "utf8"));
    assert.ok(data.player.ios_volume_hint?.length > 20, `${locale} missing translated device volume guidance`);
  }
});

test("iOS volume guidance coexists with Media Session station controls", async () => {
  const player = await readFile("components/player/Player.vue", "utf8");
  assert.match(player, /systemVolumeOnly\.value = usesSystemVolumeControls\(navigator\)/);
  assert.match(player, /nexttrack:\s*\(\) => navigateStation\(1\)/);
  assert.match(player, /previoustrack:\s*\(\) => navigateStation\(-1\)/);
  assert.match(player, /seekforward:\s*\(\) => navigateStation\(1\)/);
  assert.match(player, /seekbackward:\s*\(\) => navigateStation\(-1\)/);
  assert.match(player, /new MediaMetadata\(details\)/);
});
