import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path) => readFile(join(ROOT, path), "utf8");

test("all supported locales include complete static page copy", async () => {
  const locales = [
    "en-US.json",
    "vi-VN.json",
    "ja-JP.json",
    "zh-CN.json",
    "zh-TW.json",
    "fr-FR.json",
    "ru-RU.json",
  ];

  for (const locale of locales) {
    const json = JSON.parse(await read("lang/" + locale));
    assert.ok(json.site_pages?.about?.title, locale + " missing about copy");
    assert.ok(json.site_pages?.privacy?.title, locale + " missing privacy copy");
    assert.ok(json.site_pages?.terms?.title, locale + " missing terms copy");
    assert.ok(json.site_pages?.cookie?.title, locale + " missing cookie copy");
    assert.ok(json.site_pages?.contact?.title, locale + " missing contact copy");
    assert.ok(
      json.site_pages?.statistics?.title,
      locale + " missing statistics copy",
    );
    assert.ok(
      json.site_pages?.error?.not_found_title,
      locale + " missing error page copy",
    );
  }
});

test("statistics page uses build-time catalog counts instead of hard-coded totals", async () => {
  const [page, config, builder] = await Promise.all([
    read("pages/statistics.vue"),
    read("nuxt.config.ts"),
    read("build/radioStats.ts"),
  ]);

  assert.match(page, /radioCatalogStats/);
  assert.match(page, /stats\.byArea/);
  assert.match(config, /const radioCatalogStats = getRadioCatalogStats\(\)/);
  assert.match(config, /radioCatalogStats,/);
  assert.match(builder, /countryFiles\.length/);
  assert.match(builder, /Object\.keys\(catalog\)\.length/);
});

test("static pages share the canonical static-page SEO helper", async () => {
  const pages = [
    "pages/about.vue",
    "pages/privacy-policy.vue",
    "pages/terms-of-use.vue",
    "pages/cookie-policy.vue",
    "pages/contact.vue",
    "pages/statistics.vue",
  ];

  for (const page of pages) {
    const source = await read(page);
    assert.match(source, /useStaticPageSeo\(/, page + " missing SEO helper");
    assert.match(source, /<SitePageHero/, page + " missing shared page hero");
  }

  const seo = await read("composables/useStaticPageSeo.ts");
  assert.match(seo, /ogUrl: canonicalUrl\.value/);
  assert.match(seo, /application\/ld\+json/);
  assert.match(seo, /#website/);
  assert.match(seo, /"@type": "BreadcrumbList"/);
});


test("custom error page is branded and excluded from indexing", async () => {
  const source = await read("error.vue");

  assert.match(source, /site_pages\.error\.not_found_title/);
  assert.match(source, /noindex, nofollow/);
  assert.match(source, /clearError\(\{ redirect: "\/" \}\)/);
});
