import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { isStagingDeployment } from "../utils/seo-deployment.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("current and legacy non-production domains remain noindex while production stays indexable", () => {
  for (const siteUrl of ["https://stg.radio.eplus.dev", "https://new-radio.eplus.dev", "https://radio-new.eplus.dev", "https://preview.radio.eplus.dev/pr-preview/pr-375/"]) {
    assert.equal(isStagingDeployment({ siteUrl }), true, siteUrl);
  }
  assert.equal(isStagingDeployment({ siteUrl: "https://radio.eplus.dev" }), false);
  assert.equal(isStagingDeployment({ siteUrl: "https://radio.eplus.dev", noIndex: "true" }), true);
});

test("staging keeps server-rendered social cards without canonical or sitemap", async () => {
  const [app, index, station, country, area, staticSeo, validator] = await Promise.all([
    read("app.vue"),
    read("pages/index.vue"),
    read("pages/[area]/[country]/[station].vue"),
    read("pages/[area]/[country]/index.vue"),
    read("pages/[area]/index.vue"),
    read("composables/useStaticPageSeo.ts"),
    read("scripts/assert-staging-noindex.mjs"),
  ]);

  assert.match(app, /robots: noIndex \? "noindex, nofollow, noarchive" : "index, follow"/);
  assert.match(app, /link: noIndex \? \[\] :/);
  assert.match(app, /script: noIndex \? \[\] :/);
  assert.doesNotMatch(app, /ogImage:/);
  assert.match(index, /ogImage:/);
  assert.doesNotMatch(app, /twitterCard:/);
  assert.match(index, /twitterCard: "summary_large_image"/);
  assert.match(validator, /staging must expose branded og:image/);
  assert.match(validator, /staging must not render production canonical/);
  for (const source of [index, station, country, area, staticSeo]) {
    assert.doesNotMatch(source, /useSeoMeta\(\(\) => noIndex \? \{\} :/);
    assert.match(source, /ogTitle:|property: "og:title"/);
  }
  assert.match(station, /name: "twitter:card", content: "summary_large_image"/);
  assert.match(station, /property: "og:image", content: seoImage\.value/);
  assert.match(station, /stationSocialImage\(\{/);
  assert.match(station, /mode: String\(config.public.stationOgMode\)/);
  assert.match(station, /property: "og:image:width", content: "1200"/);
  assert.match(station, /property: "og:image:type", content: stationShareImage.value.type/);
});

test("staging does not render thousands of station OG images", async () => {
  const [generator, station, validator] = await Promise.all([
    read("scripts/generate-station-og-images.mjs"),
    read("pages/[area]/[country]/[station].vue"),
    read("scripts/assert-route-social-meta.mjs"),
  ]);
  assert.match(generator, /stationOgDeployment/);
  assert.match(generator, /if \(!imagesOnly && policy.mode !== "generated"\) \{/);
  assert.match(generator, /else \{\s*const summary = await generateStationOgImages\(\)/);
  assert.match(station, /config.public.stationOgMode/);
  assert.match(station, /stationSocialImage/);
  assert.match(validator, /const stationImage = policy.mode === "shared" \? homeImage :/);
  assert.match(validator, /isStagingDeployment\(\{ siteUrl: origin, noIndex: process\.env\.NUXT_PUBLIC_NO_INDEX \}\)/);
  assert.match(validator, /if \(!staging\) \{/);
});

