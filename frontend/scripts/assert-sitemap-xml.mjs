// Validate the generated sitemap, not just its Nuxt source configuration.
// Called after "nuxt generate" on CI; staging must have no sitemap at all.
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { isStagingDeployment } from "../utils/seo-deployment.mjs";
import { decodeTextEntitiesOnce } from "../utils/markup-text.mjs";

const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || "https://radio.eplus.dev").replace(/\/$/, "");
const noIndex = isStagingDeployment({ siteUrl, noIndex: process.env.NUXT_PUBLIC_NO_INDEX });
const sitemapPath = join(process.cwd(), ".output/public/sitemap.xml");
let xml = "";

try {
  xml = await readFile(sitemapPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

if (noIndex) {
  assert.equal(xml, "", "Staging must not publish /sitemap.xml");
  console.log("Staging sitemap policy verified: no sitemap was generated.");
} else {
  assert.ok(xml.length, "Production must generate /sitemap.xml");
  assert.ok(Buffer.byteLength(xml, "utf8") <= 50 * 1024 * 1024, "Sitemap exceeds 50 MB");
  assert.match(xml, /<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.doesNotMatch(xml, /<\?xml-stylesheet\b/i, "Deprecated XSLT instruction must not be present");
  assert.doesNotMatch(xml, /<xhtml:link\b/, "Non-prefix locale routes must not emit hreflang alternatives");

  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    decodeTextEntitiesOnce(m[1]));
  assert.ok(locations.length > 0 && locations.length <= 50000, "Invalid sitemap URL count");
  assert.equal(new Set(locations).size, locations.length, "Duplicate <loc> entries found");
  assert.ok(locations.includes(siteUrl + "/"), "Canonical home URL missing");

  for (const loc of locations) {
    const url = new URL(loc);
    assert.equal(url.origin, siteUrl, "Non-canonical sitemap origin: " + loc);
    assert.ok(!url.hash && !url.search, "Sitemap URL must be canonical: " + loc);
    assert.notEqual(url.pathname, "/library", "Device-local library must not be indexed");
  }

  // Sitemap <loc> entries correspond to prerendered pages; the XML protocol
  // does not require browser stylesheet, lastmod, priority or changefreq.
  console.log("Production sitemap validated:", locations.length, "canonical URLs (no XSLT).");
}
