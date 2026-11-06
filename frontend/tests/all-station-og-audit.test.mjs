import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { auditAllStationOg, collectMeta } from "../scripts/assert-all-station-social-meta.mjs";

const origin = "https://radio.eplus.dev";
const meta = (name, content, prop = "property") =>
  '<meta ' + prop + '="' + name + '" content="' + content + '">';
const fixtureHtml = (route, image, overrides = {}) => {
  const imageUrl = overrides.image || origin + image;
  const tags = [
    meta("og:image", imageUrl),
    meta("og:url", origin + route),
    meta("twitter:image", imageUrl, "name"),
    ...(overrides.noCard ? [] : [meta("twitter:card", "summary_large_image", "name")]),
    meta("og:image:width", "1200"),
    meta("og:image:height", "630"),
    meta("og:image:type", "image/jpeg"),
    meta("og:title", "Station Live Radio"),
    meta("og:description", "Listen to the station"),
    meta("description", "Listen to the station", "name"),
  ];
  return '<!doctype html><html><head>' + tags.join("") + '</head><body>Radio</body></html>';
};

async function setupFixture(root, { wrongSecondImage = false, missingCard = false } = {}) {
  const stations = ["vov1", "vov2"];
  const dir = join(root, "public", "radio", "asia");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "viet-nam.json"), JSON.stringify({
    vov1: { title: "VOV 1" }, vov2: { title: "VOV 2" },
  }));
  for (const [i, id] of stations.entries()) {
    const route = "/asia/viet-nam/" + id;
    const image = "/og/stations/asia/viet-nam/" + id + ".jpg";
    const imagePath = join(root, ".output", "public", image.slice(1));
    const htmlPath = join(root, ".output", "public", route.slice(1), "index.html");
    await mkdir(dirname(htmlPath), { recursive: true });
    await mkdir(dirname(imagePath), { recursive: true });
    await writeFile(htmlPath, fixtureHtml(route, image, {
      image: i === 1 && wrongSecondImage ? origin + "/brand/social-preview.png" : undefined,
      noCard: i === 1 && missingCard,
    }));
    await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#c93668" } })
      .jpeg().toFile(imagePath);
  }
}

test("meta parser respects > and quotes inside HTML attribute values", () => {
  const html = [
    "<html><head>",
    '<meta content="RTE Radio 1> Live Radio - Ireland" property="og:title">',
    "<meta name='description' content='An Irish radio station > news'>",
    '<meta content="https://radio.eplus.dev/og/stations/europe/ireland/rte-radio-1-bccbc87b.jpg" property="og:image">',
    "</head></html>",
  ].join("");
  assert.deepEqual(collectMeta(html, "property", "og:title"), [
    "RTE Radio 1> Live Radio - Ireland",
  ]);
  assert.deepEqual(collectMeta(html, "name", "description"), [
    "An Irish radio station > news",
  ]);
  assert.deepEqual(collectMeta(html, "property", "og:image"), [
    "https://radio.eplus.dev/og/stations/europe/ireland/rte-radio-1-bccbc87b.jpg",
  ]);
});

test("meta parser selects only explicit exact property/name matches", () => {
  const html = fixtureHtml("/asia/viet-nam/vov1", "/og/stations/asia/viet-nam/vov1.jpg");
  assert.deepEqual(collectMeta(html, "property", "og:image"), [
    origin + "/og/stations/asia/viet-nam/vov1.jpg",
  ]);
  assert.deepEqual(collectMeta(html, "name", "twitter:card"), ["summary_large_image"]);
  assert.deepEqual(collectMeta(html, "property", "twitter:image"), []);
});

test("all-station audit passes valid pages and detects a wrong OG image on another station", async () => {
  const root = await mkdtemp(join(tmpdir(), "onair-og-audit-"));
  try {
    await setupFixture(root);
    let result = await auditAllStationOg({ root, origin, concurrency: 2 });
    assert.equal(result.stations, 2);
    assert.equal(result.verified, 2);
    assert.equal(result.failed, 0);

    await setupFixture(root, { wrongSecondImage: true });
    result = await auditAllStationOg({ root, origin, concurrency: 2 });
    assert.equal(result.verified, 1);
    assert.equal(result.failed, 1);
    assert.match(result.failures[0].station, /vov2/);
    assert.match(result.failures[0].error, /og:image/);

    await setupFixture(root, { missingCard: true });
    result = await auditAllStationOg({ root, origin, concurrency: 2 });
    assert.equal(result.failed, 1);
    assert.match(result.failures[0].error, /twitter:card/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('site-only audit verifies shared cards and external audit refuses incomplete uploads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onair-og-release-audit-'));
  try {
    await setupFixture(root);
    await mkdir(join(root, '.output/public/brand'), { recursive: true });
    await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#c93668' } })
      .png().toFile(join(root, '.output/public/brand/social-preview.png'));
    for (const id of ['vov1', 'vov2']) {
      const file = join(root, '.output/public/asia/viet-nam', id, 'index.html');
      const html = await readFile(file, 'utf8');
      await writeFile(file, html.replaceAll(origin + '/og/stations/asia/viet-nam/' + id + '.jpg', origin + '/brand/social-preview.png').replaceAll('image/jpeg', 'image/png'));
    }
    const shared = await auditAllStationOg({ root, origin, policy: { mode: 'shared' } });
    assert.equal(shared.verified, 2);
    assert.equal(shared.failed, 0);

    await setupFixture(root);
    const baseUrl = 'https://images.example/complete-commit';
    const manifest = { complete: true, entries: {} };
    for (const id of ['vov1', 'vov2']) {
      const file = join(root, '.output/public/asia/viet-nam', id, 'index.html');
      await writeFile(file, (await readFile(file, 'utf8')).replaceAll(origin + '/og/stations/', baseUrl + '/og/stations/'));
      manifest.entries['asia/viet-nam/' + id + '.jpg'] = { bytes: 2000, sha256: 'a'.repeat(64) };
    }
    const options = { root, origin, policy: { mode: 'external', baseUrl }, fetchImpl: async () => new Response(JSON.stringify(manifest)) };
    assert.equal((await auditAllStationOg(options)).failed, 0);
    delete manifest.entries['asia/viet-nam/vov2.jpg'];
    assert.equal((await auditAllStationOg(options)).failed, 1);
    manifest.complete = false;
    await assert.rejects(auditAllStationOg(options), /not complete/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

