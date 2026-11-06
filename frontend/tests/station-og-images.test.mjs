import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

import { stationOgPath, renderStationOg, generateStationOgImages } from "../scripts/generate-station-og-images.mjs";

test("station OG paths are stable and cannot escape the public directory", () => {
  assert.equal(stationOgPath("asia", "viet-nam", "vov1"), "/og/stations/asia/viet-nam/vov1.jpg");
  for (const invalid of ["../secrets", "..", "vov/1", "/tmp", ""]) {
    assert.throws(() => stationOgPath("asia", "viet-nam", invalid), /Invalid station OG path/);
  }
});

test("build creates distinct crawlable JPEGs from station logos and a safe missing-logo fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "onair-station-og-"));
  try {
    const catalogDir = join(root, "public", "radio", "asia");
    const logoDir = join(root, "public", "img", "asia", "viet-nam");
    await mkdir(catalogDir, { recursive: true });
    await mkdir(logoDir, { recursive: true });
    await sharp({
      create: { width: 160, height: 160, channels: 4, background: "#d42a5f" },
    }).png().toFile(join(logoDir, "vov1.png"));

    await writeFile(join(catalogDir, "viet-nam.json"), JSON.stringify({
      vov1: { title: 'VOV 1 & <Live> "Radio"', features: "/img/asia/viet-nam/vov1.png" },
      vov2: { title: "VOV 2 - missing local logo", features: "https://invalid.example/image.png" },
    }));
    const summary = await generateStationOgImages({ root, limit: 2 });
    assert.equal(summary.count, 2);
    assert.equal(summary.generated, 2);
    assert.equal(summary.reusedLocal, 0);
    assert.equal(summary.fallback, 1);
    assert.ok(summary.bytes > 1000);

    const first = join(root, "public", "og", "stations", "asia", "viet-nam", "vov1.jpg");
    const second = join(root, "public", "og", "stations", "asia", "viet-nam", "vov2.jpg");
    for (const name of [first, second]) {
      const meta = await sharp(name).metadata();
      assert.equal(meta.width, 1200);
      assert.equal(meta.height, 630);
      assert.equal(meta.format, "jpeg");
    }
    assert.notDeepEqual(await readFile(first), await readFile(second));

    const cached = await generateStationOgImages({ root, limit: 2, cacheBaseUrl: "" });
    assert.equal(cached.count, 2);
    assert.equal(cached.generated, 0, "unchanged station cards must not be re-rendered");
    assert.equal(cached.reusedLocal, 2);
    assert.equal(cached.fallback, 1);

    // A renamed station must invalidate only its own image.
    await writeFile(join(catalogDir, "viet-nam.json"), JSON.stringify({
      vov1: { title: "A renamed VOV radio station", features: "/img/asia/viet-nam/vov1.png" },
      vov2: { title: "VOV 2 - missing local logo", features: "https://invalid.example/image.png" },
    }));
    const renamed = await generateStationOgImages({ root, limit: 2, cacheBaseUrl: "" });
    assert.equal(renamed.generated, 1);
    assert.equal(renamed.reusedLocal, 1);

    // Changing logo pixels (without changing its path) also invalidates cache.
    await sharp({
      create: { width: 160, height: 160, channels: 4, background: "#159a75" },
    }).png().toFile(join(logoDir, "vov1-replacement.png"));
    await writeFile(join(logoDir, "vov1.png"), await readFile(join(logoDir, "vov1-replacement.png")));
    const relogo = await generateStationOgImages({ root, limit: 2, cacheBaseUrl: "" });
    assert.equal(relogo.generated, 1);
    assert.equal(relogo.reusedLocal, 1);
    const manifest = JSON.parse(await readFile(join(root, "public/og/stations/manifest.json"), "utf8"));
    assert.equal(Object.keys(manifest.entries).length, 2);
    assert.ok(manifest.entries["asia/viet-nam/vov1.jpg"].sha256);
    // Corrupt local cached JPEGs must be replaced, never shipped as-is.
    await writeFile(first, Buffer.from("corrupt"));
    const repaired = await generateStationOgImages({ root, cacheBaseUrl: "", limit: 2 });
    assert.equal(repaired.generated, 1);
    assert.equal(repaired.reusedLocal, 1);

    const regenerated = await renderStationOg({
      root, area: "asia", country: "viet-nam", stationId: "vov1",
      meta: { title: "A distinctly different radio name", features: "/img/asia/viet-nam/vov1.png" },
    });
    assert.equal(regenerated.logoFound, true);
    assert.equal(regenerated.path, "/og/stations/asia/viet-nam/vov1.jpg");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("station SEO points at generated image while station JSON-LD keeps logo artwork", async () => {
  const source = await readFile(new URL("../pages/[area]/[country]/[station].vue", import.meta.url), "utf8");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(source, /\/og\/stations\/\$\{area\.value\}\/\$\{slug\.value\}\/\$\{stationSlug\.value\}\.jpg/);
  assert.match(source, /image: stationArtwork\.value/);
  assert.match(source, /property: "og:image:width", content: "1200"/);
  assert.match(source, /property: "og:image:height", content: "630"/);
  assert.match(source, /property: "og:image:type", content: stationShareImage.value.type/);
  assert.match(source, /name: "twitter:image", content: seoImage\.value/);
  for (const step of ["prebuild", "pregenerate", "predev"]) {
    assert.match(pkg.scripts[step], /generate-station-og-images\.mjs/);
  }
});

test("a fresh deployment restores unchanged thumbnails from previous published manifest", async () => {
  const previous = await mkdtemp(join(tmpdir(), "onair-og-prev-"));
  const next = await mkdtemp(join(tmpdir(), "onair-og-next-"));
  try {
    const file = "public/radio/asia/viet-nam.json";
    const logo = "public/img/asia/viet-nam/vov1.png";
    for (const root of [previous, next]) {
      await mkdir(join(root, "public/radio/asia"), { recursive: true });
      await mkdir(join(root, "public/img/asia/viet-nam"), { recursive: true });
      await writeFile(join(root, file), JSON.stringify({
        vov1: { title: "Unchanged VOV1", features: "/img/asia/viet-nam/vov1.png" },
        vov2: { title: "Unchanged VOV2", features: "https://example.invalid/logo.png" },
      }));
      if (root === previous) {
        await sharp({
          create: { width: 130, height: 130, channels: 4, background: "#c42e56" },
        }).png().toFile(join(root, logo));
      } else {
        await writeFile(join(root, logo), await readFile(join(previous, logo)));
      }
    }
    const original = await generateStationOgImages({ root: previous, cacheBaseUrl: "" });
    assert.equal(original.generated, 2);

    const fetchImpl = async (url) => {
      const pathname = new URL(url).pathname;
      try {
        const bytes = await readFile(join(previous, "public", pathname.slice(1)));
        return new Response(bytes, { status: 200 });
      } catch { return new Response(null, { status: 404 }); }
    };
    const reused = await generateStationOgImages({
      root: next, cacheBaseUrl: "https://previous-build.example", fetchImpl, limit: 2,
    });
    assert.equal(reused.generated, 0);
    assert.equal(reused.reusedRemote, 2);
    assert.equal(reused.count, 2);
    assert.equal(reused.remoteCacheAvailable, true);
    assert.deepEqual(
      await readFile(join(previous, "public/og/stations/asia/viet-nam/vov1.jpg")),
      await readFile(join(next, "public/og/stations/asia/viet-nam/vov1.jpg")),
    );

    // If remote JPEG bytes were tampered with, regenerate instead of trusting it.
    const corrupted = await mkdtemp(join(tmpdir(), "onair-og-corrupt-"));
    try {
      await mkdir(join(corrupted, "public/radio/asia"), { recursive: true });
      await mkdir(join(corrupted, "public/img/asia/viet-nam"), { recursive: true });
      await writeFile(join(corrupted, file), await readFile(join(next, file)));
      await writeFile(join(corrupted, logo), await readFile(join(next, logo)));
      const corruptFetch = async (url) => new URL(url).pathname.endsWith(".jpg")
        ? new Response(Buffer.from("not a jpeg"), { status: 200 })
        : fetchImpl(url);
      const safe = await generateStationOgImages({
        root: corrupted, cacheBaseUrl: "https://previous-build.example",
        fetchImpl: corruptFetch, limit: 2,
      });
      assert.equal(safe.generated, 2);
      assert.equal(safe.reusedRemote, 0);
      assert.equal(safe.remoteFailures, 2);
    } finally { await rm(corrupted, { recursive: true, force: true }); }
  } finally {
    await rm(previous, { recursive: true, force: true });
    await rm(next, { recursive: true, force: true });
  }
});

