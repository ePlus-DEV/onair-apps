import { stationOgDeployment, stationSocialImage } from "../utils/station-og-deployment.mjs";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { stationOgPath } from "./generate-station-og-images.mjs";

// Audit EVERY catalog station against the actual Nuxt prerender output.
// Respect quoted attribute values containing > so valid metadata is not lost.
export const defaultOrigin = "https://radio.eplus.dev";
const metaTags = (html) => {
  const end = html.search(/<\/head\s*>/i);
  return [...(end < 0 ? html : html.slice(0, end)).matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(m => m[0]);
};
const attr = (tag, name) =>
  tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"))?.[2] ?? null;

export function collectMeta(html, attrName, key) {
  return metaTags(html).filter(tag => attr(tag, attrName) === key)
    .map(tag => attr(tag, "content")).filter(value => value !== null);
}
function exact(html, attrName, key, expected) {
  const got = collectMeta(html, attrName, key);
  assert.deepEqual(got, [expected], key + ": expected one " + expected + ", received " + JSON.stringify(got));
}
function present(html, attrName, key) {
  const got = collectMeta(html, attrName, key);
  assert.equal(got.length, 1, key + ": expected one entry, received " + JSON.stringify(got));
  assert.ok(got[0]?.trim(), key + ": empty value");
}
async function readStationHtml(output, route) {
  const segments = route.split("/").filter(Boolean);
  const candidates = [join(output, ...segments, "index.html"), join(output, ...segments) + ".html"];
  for (const path of candidates) {
    try { return await readFile(path, "utf8"); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  throw new Error("Missing prerendered HTML: " + candidates.join(", "));
}
async function readCatalog(root) {
  const catalogRoot = join(root, "public", "radio");
  const list = [];
  for (const area of await readdir(catalogRoot, { withFileTypes: true })) {
    if (!area.isDirectory()) continue;
    const folder = join(catalogRoot, area.name);
    for (const file of await readdir(folder, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue;
      const country = file.name.slice(0, -5);
      const catalog = JSON.parse(await readFile(join(folder, file.name), "utf8"));
      for (const id of Object.keys(catalog)) list.push({ area: area.name, country, id });
    }
  }
  return list;
}
export async function auditAllStationOg({
  root = process.cwd(),
  origin = defaultOrigin,
  concurrency = 12,
  maxFailuresToShow = 20,
  policy = { mode: 'generated', baseUrl: '' },
  fetchImpl = globalThis.fetch,
} = {}) {
  origin = origin.replace(/\/$/, "");
  const stations = await readCatalog(root);
  assert.ok(stations.length, "Empty station catalog");
  const output = join(root, ".output", "public");
  let manifest = null;
  if (policy.mode === "external") {
    const response = await fetchImpl(policy.baseUrl + "/og/stations/manifest.json", { signal: AbortSignal.timeout(15000) });
    assert.ok(response.ok, "Complete external image manifest must be available");
    manifest = await response.json();
    assert.equal(manifest.complete, true, "External image upload is not complete");
  }
  const failures = [];
  const paths = new Set();
  let next = 0, failed = 0, verified = 0;

  async function audit(station) {
    const { area, country, id } = station;
    const route = "/" + area + "/" + country + "/" + id;
    const image = stationOgPath(area, country, id);
    assert.ok(!paths.has(image), "Duplicate station image path: " + image);
    paths.add(image);
    const html = await readStationHtml(output, route);
    const share = stationSocialImage({ ...policy, origin, imagePath: image });
    exact(html, "property", "og:image", share.url);
    exact(html, "property", "og:url", origin + route);
    exact(html, "name", "twitter:image", share.url);
    exact(html, "name", "twitter:card", "summary_large_image");
    exact(html, "property", "og:image:width", "1200");
    exact(html, "property", "og:image:height", "630");
    exact(html, "property", "og:image:type", share.type);
    present(html, "property", "og:title");
    present(html, "property", "og:description");
    present(html, "name", "description");
    if (policy.mode === "external") {
      const entry = manifest.entries?.[image.slice("/og/stations/".length)];
      assert.ok(entry?.bytes > 1000 && /^[a-f0-9]{64}$/.test(entry.sha256), image + ": missing verified external image");
    } else {
      const localImage = policy.mode === "shared" ? "/brand/social-preview.png" : image;
      const filename = join(output, localImage.slice(1));
      assert.ok((await stat(filename)).size > 1000, localImage + ": missing or tiny image");
      const info = await sharp(filename).metadata();
      assert.equal(info.format, policy.mode === "shared" ? "png" : "jpeg", localImage + ": format");
      assert.equal(info.width, 1200, localImage + ": width");
      assert.equal(info.height, 630, localImage + ": height");
    }
  }

  async function worker() {
    while (next < stations.length) {
      const station = stations[next++];
      try { await audit(station); verified++; }
      catch (error) {
        failed++;
        if (failures.length < maxFailuresToShow)
          failures.push({ station: station.area + "/" + station.country + "/" + station.id, error: error.message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), stations.length) }, () => worker()));
  return { stations: stations.length, verified, failed, failures, origin };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const origin = process.env.SEO_EXPECTED_SITE_URL || defaultOrigin;
  const result = await auditAllStationOg({ origin, policy: stationOgDeployment({ siteUrl: origin }) });
  console.log("Station OG audit:", JSON.stringify(result, null, 2));
  if (result.failed) process.exitCode = 1;
}

