import { stationOgDeployment, stationSocialImage } from "../utils/station-og-deployment.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isStagingDeployment } from "../utils/seo-deployment.mjs";

// Assert actual generated static HTML, not only metadata in Vue sources.
const origin = (process.env.SEO_EXPECTED_SITE_URL || "https://radio.eplus.dev").replace(/\/$/, "");
const output = ".output/public";
const staging = isStagingDeployment({ siteUrl: origin, noIndex: process.env.NUXT_PUBLIC_NO_INDEX });
async function loadPage(route) {
  const segments = route.split("/").filter(Boolean);
  const candidates = [join(output, ...segments, "index.html"), join(output, ...segments) + ".html"];
  for (const file of candidates) {
    try { return await readFile(file, "utf8"); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  throw new Error("Prerendered HTML missing for " + route + ": " + candidates.join(", "));
}
const metaTags = (html) => [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
function attr(tag, name) {
  // Our attribute names are constant: "name", "property", "content".
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
  return match?.[2] ?? null;
}
function values(html, attribute, key) {
  return metaTags(html).filter(tag => attr(tag, attribute) === key)
    .map(tag => attr(tag, "content")).filter(Boolean);
}
function exactMeta(html, property, expected) {
  const entries = values(html, "property", property);
  if (entries.length !== 1 || entries[0] !== expected) {
    const relevant = metaTags(html).filter(tag =>
      /property=["']og:|name=["'](description|twitter:)/i.test(tag)
    ).slice(0, 24);
    const title = html.match(/<title[^>]*>([^<]*)/i)?.[1] || "(missing title)";
    console.error("Prerendered SEO diagnostics:", JSON.stringify({ title, property, expected, entries, relevant }, null, 2));
  }
  assert.deepEqual(entries, [expected], property + " must be unique and match route; got " + JSON.stringify(entries));
}
function specificMeta(html, property, phrase) {
  const entries = values(html, "property", property);
  assert.equal(entries.length, 1, property + " must occur once; got " + JSON.stringify(entries));
  assert.ok(entries[0].includes(phrase), property + " must describe station, got " + entries[0]);
}
async function assertImage(path, magic) {
  const bytes = await readFile(join(output, path.slice(1)));
  assert.ok(bytes.subarray(0, magic.length).equals(Buffer.from(magic)), "Missing/invalid generated image: " + path);
}
const home = await loadPage("/");
const stationRoute = "/asia/viet-nam/vov-gt-hcm";
const station = await loadPage(stationRoute);
const homeImage = "/brand/social-preview.png";
const policy = stationOgDeployment({ siteUrl: origin });
const share = stationSocialImage({ ...policy, origin, imagePath: "/og/stations/asia/viet-nam/vov-gt-hcm.jpg" });
const stationImage = policy.mode === "shared" ? homeImage : "/og/stations/asia/viet-nam/vov-gt-hcm.jpg";
assert.deepEqual(values(home, "name", "twitter:card"), ["summary_large_image"], "Homepage must contain a single valid Twitter card");
assert.deepEqual(values(station, "name", "twitter:card"), ["summary_large_image"], "Station must contain a single valid Twitter card");
exactMeta(home, "og:image", origin + homeImage);
exactMeta(home, "og:url", origin + "/");
exactMeta(station, "og:image", share.url);
exactMeta(station, "og:url", origin + stationRoute);
specificMeta(station, "og:title", "VOV Giao");
specificMeta(station, "og:description", "VOV Giao thông TPHCM ra đời");
assert.deepEqual(values(station, "name", "twitter:image"), [share.url]);
if (!staging) {
  assert.ok(!values(station, "name", "robots").some(x => x.includes("noindex")), "Production must be indexable");
} else {
  assert.ok(values(station, "name", "robots").some(x => x.includes("noindex")), "Staging must remain noindex");
}
await assertImage(homeImage, [137, 80, 78, 71, 13, 10, 26, 10]);
if (policy.mode !== "external") {
  await assertImage(stationImage, policy.mode === "shared" ? [137, 80, 78, 71, 13, 10, 26, 10] : [255, 216, 255]);
}
console.log(policy.mode === "shared"
  ? "PASS: station pages use the shared Open Graph PNG while image uploads are deferred."
  : policy.mode === "external"
    ? "PASS: station pages reference the separately published Open Graph image set."
    : "PASS: production homepage and station have unique, route-specific OG images and descriptions.");
