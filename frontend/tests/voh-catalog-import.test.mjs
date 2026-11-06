import test from "node:test";
import assert from "node:assert/strict";
import { missingVohStations, parseNextRadio, selectNewEntries } from "../scripts/sync-voh-radios.mjs";

test("VOH importer tracks exactly the eight missing station links", () => {
  assert.equal(missingVohStations.length, 8);
  assert.equal(new Set(missingVohStations.map(([id]) => id)).size, 8);
  assert.ok(missingVohStations.every(([, , filename]) =>
    filename.endsWith(".html") && !filename.includes("/") && !filename.includes("..")));
});

test("VOH Next.js data yields only the active station HLS source", () => {
  const pageData = {
    chanelList: [{ title: "Other radio", radioLive: { url: "https://other.test/playlist.m3u8" } }],
    radioLive: {
      title: "VOH-M FM 92.5 MHz",
      logoPath: "https://image.voh.com.vn/test.png",
      url: "https://stream.test/htvc/vohm/playlist.m3u8",
    },
  };
  const html = '<script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify({ props: { pageProps: { pageData } } }) + '</script>';
  const result = parseNextRadio(html);
  assert.deepEqual(result.urls, ["https://stream.test/htvc/vohm/playlist.m3u8"]);
  assert.equal(result.info.title, "VOH-M FM 92.5 MHz");
  assert.equal(result.reason, "");
});

test("VOH importer handles missing source safely", () => {
  assert.deepEqual(parseNextRadio("<main>no data</main>").urls, []);
  const html = '<script id="__NEXT_DATA__">' +
    JSON.stringify({ props: { pageProps: { pageData: { radioLive: { title: "No audio" } } } } }) + '</script>';
  assert.equal(parseNextRadio(html).reason, "no-stream");
});

test("Only verified, non-duplicate audio streams are appended", () => {
  const original = {
    "voh-fm-95.6-mhz": { title: "VOH FM 95.6", stream: "https://radio.test/a.m3u8" },
  };
  const added = selectNewEntries(original, [
    { slug: "voh-m-fm-92-92-5", verified: true, stream: "https://radio.test/a.m3u8" },
    { slug: "tra-vinh-fm-92-7", verified: false, stream: "https://radio.test/b.m3u8" },
    { slug: "nghe-an-fm-99-6", verified: true, stream: "https://radio.test/c.m3u8",
      title: "Nghệ An", category: "Đài địa phương", page: "https://voh.com.vn/radio/test.html" },
  ]);
  assert.deepEqual(added, ["nghe-an-fm-99-6"]);
  assert.equal(original["voh-m-fm-92-92-5"], undefined);
  assert.equal(original["tra-vinh-fm-92-7"], undefined);
  assert.equal(original["nghe-an-fm-99-6"].stream, "https://radio.test/c.m3u8");
});
