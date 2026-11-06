import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

const read = (path) => readFile(join(ROOT, path), "utf8");

test("country pages prerender station links instead of waiting for onMounted", async () => {
  const source = await read("pages/[area]/[country]/index.vue");

  assert.match(source, /await useAsyncData<CountryCatalogPayload>/);
  assert.match(source, /if \(import\.meta\.server\)/);
  assert.match(source, /readFile/);
  assert.match(source, /const stations = computed<RadioStationOption\[]>/);
  assert.match(source, /<PanelStation[\s\S]*?:stations="stations"/);
  assert.doesNotMatch(source, /const fetchData = async/);
});

test("dynamic SEO pages expose structured data and hard 404 guards", async () => {
  const [area, country, station] = await Promise.all([
    read("pages/[area]/index.vue"),
    read("pages/[area]/[country]/index.vue"),
    read("pages/[area]/[country]/[station].vue"),
  ]);

  assert.match(area, /buildBreadcrumbSchema/);
  assert.match(area, /buildCollectionPageSchema/);
  assert.match(area, /statusCode: 404/);

  assert.match(country, /buildBreadcrumbSchema/);
  assert.match(country, /buildCollectionPageSchema/);
  assert.match(country, /statusCode: 404/);

  assert.match(station, /buildBreadcrumbSchema/);
  assert.match(station, /buildRadioStationSchema/);
  assert.match(station, /statusCode: 404/);
  assert.match(station, /property: "og:image:alt"/);
  assert.match(station, /name: "twitter:image:alt"/);
});

test("global metadata includes canonical social and organization identity", async () => {
  const source = await read("app.vue");

  assert.match(source, /rel: "canonical"/);
  assert.match(source, /"@type": "WebSite"/);
  assert.match(source, /"@type": "Organization"/);
  assert.match(source, /ogLocale:/);
  assert.match(source, /ogSiteName:/);
  assert.doesNotMatch(source, /twitterCard:/);
  assert.doesNotMatch(source, /ogImage:/);
});

test("sitemap avoids fake deployment-time lastmod values", async () => {
  const source = await read("build/radioRoutes.ts");

  assert.doesNotMatch(source, /statSync/);
  assert.doesNotMatch(source, /mtimeMs/);
  assert.doesNotMatch(source, /lastmod:\s*new Date/);
});


test("route discovery ignores asset-only folders under public/radio", async () => {
  const source = await read("build/radioRoutes.ts");

  assert.match(source, /const countryFiles = readdirSync\(areaDir/);
  assert.match(source, /if \(countryFiles\.length === 0\) continue;/);
});

test("sitewide static navigation points to implemented pages", async () => {
  const [header, footer, config] = await Promise.all([
    read("components/AppHeader.vue"),
    read("components/AppFooter.vue"),
    read("nuxt.config.ts"),
  ]);
  const navigation = `${header}\n${footer}`;
  const pages = {
    "/about": "pages/about.vue",
    "/statistics": "pages/statistics.vue",
    "/contact": "pages/contact.vue",
    "/privacy-policy": "pages/privacy-policy.vue",
    "/terms-of-use": "pages/terms-of-use.vue",
    "/cookie-policy": "pages/cookie-policy.vue",
  };

  for (const [route, file] of Object.entries(pages)) {
    await access(join(ROOT, file));
    assert.match(
      navigation,
      new RegExp(`["']${route.replaceAll("/", "\\/")}["']`),
      `sitewide navigation should expose implemented page ${route}`,
    );
    assert.match(
      config,
      new RegExp(`loc: ["']${route.replaceAll("/", "\\/")}["']`),
      `static page ${route} should be explicitly prerendered and indexed`,
    );
  }
});

test("Romania artwork lives in the canonical image tree", async () => {
  const catalog = await read("public/radio/europe/romania.json");

  assert.match(catalog, /\/img\/europe\/romania\//);
  assert.doesNotMatch(catalog, /\/radio\/romania\//);

  await access(join(ROOT, "public/img/europe/romania/europa-fm.png"));
  await assert.rejects(access(join(ROOT, "public/radio/romania")));
});

test("social sharing uses a generated 1200x630 image instead of the icon", async () => {
  const [app, home, staticSeo, config, pkg, svg] = await Promise.all([
    read("app.vue"),
    read("pages/index.vue"),
    read("composables/useStaticPageSeo.ts"),
    read("nuxt.config.ts"),
    read("package.json"),
    read("public/brand/social-preview.svg"),
  ]);
  assert.match(svg, /viewBox="0 0 1200 630"/);
  assert.match(svg, /Live radio from around the world/);
  assert.match(home, /\/brand\/social-preview\.png/);
  assert.match(home, /ogImageWidth: 1200/);
  assert.match(home, /ogImageHeight: 630/);
  assert.match(home, /ogImageType: "image\/png"/);
  assert.match(home, /twitterCard: "summary_large_image"/);
  assert.doesNotMatch(app, /twitterCard:/);
  assert.doesNotMatch(app, /ogImage:/);
  assert.doesNotMatch(app, /ogTitle:/);
  assert.match(staticSeo, /\/brand\/social-preview\.png/);
  assert.match(config, /"@nuxt\/image"/);
  const scripts = JSON.parse(pkg).scripts;
  assert.match(scripts.prebuild, /generate-social-preview\.mjs/);
  assert.match(scripts.pregenerate, /generate-social-preview\.mjs/);
});
