import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isStagingDeployment } from "../utils/seo-deployment.mjs";

const read = path => readFile(path, "utf8");

test("staging is noindex with the two NUXT_PUBLIC environment variables", () => {
  assert.equal(isStagingDeployment({ siteUrl: "https://stg.radio.eplus.dev" }), true);
  assert.equal(isStagingDeployment({ siteUrl: "https://stg.radio.eplus.dev", noIndex: "false" }), true);
  assert.equal(isStagingDeployment({ siteUrl: "https://new-radio.eplus.dev" }), true);
  assert.equal(isStagingDeployment({ siteUrl: "https://radio-new.eplus.dev", noIndex: "true" }), true);
  assert.equal(isStagingDeployment({ siteUrl: "https://radio-new.eplus.dev" }), true);
  assert.equal(isStagingDeployment({ noIndex: "true" }), true);
  assert.equal(isStagingDeployment({ noIndex: "1" }), true);
  assert.equal(isStagingDeployment({ siteUrl: "https://radio-new.eplus.dev", noIndex: "false" }), true);
});

test("production retains indexing without staging environment variables", () => {
  assert.equal(isStagingDeployment({ siteUrl: "https://radio.eplus.dev" }), false);
  assert.equal(isStagingDeployment({ siteUrl: "https://radio.eplus.dev", noIndex: "false" }), false);
  assert.equal(isStagingDeployment({ siteUrl: "https://maliciousradio-new.eplus.dev" }), false);
  assert.equal(isStagingDeployment({ siteUrl: "https://stg.radio.eplus.dev.evil.example" }), false);
  assert.equal(isStagingDeployment({ siteUrl: "" }), false);
});

test("Nuxt config does not depend on nonstandard deploy environment or branch checks", async () => {
  const config = await read("nuxt.config.ts");
  assert.doesNotMatch(config, /NUXT_DEPLOY_ENV|NUXT_DEPLOY_BRANCH|GITHUB_BASE_REF|GITHUB_REF_NAME|execFileSync/);
  assert.match(config, /noIndex: process\.env\.NUXT_PUBLIC_NO_INDEX/);
  assert.match(config, /siteUrl,/);
});

test("Nuxt SEO output is guarded but radio routes remain prerenderable", async () => {
  const [config, app, robots, staticSeo] = await Promise.all([
    read("nuxt.config.ts"),
    read("app.vue"),
    read("server/routes/robots.txt.ts"),
    read("composables/useStaticPageSeo.ts"),
  ]);
  assert.match(config, /const noIndex = isStagingDeployment/);
  assert.match(config, /...\(!noIndex \? \["@nuxtjs\/sitemap"\] : \[\]\)/);
  assert.match(config, /\.\.\.radioSeoRoutes\.map/);
  assert.match(config, /"\/robots.txt"/);
  assert.match(app, /robots: noIndex .*"noindex, nofollow, noarchive" : "index, follow"/);
  assert.match(app, /link: noIndex \? \[\] : \[/);
  assert.match(app, /script: noIndex \? \[\] : \[/);
  assert.match(robots, /if \(config.public.noIndex\)/);
  assert.match(robots, /return "User-agent: \*\\nAllow: \/\\n"/);
  assert.doesNotMatch(robots, /return "User-agent: \*\\nDisallow: \/\\n"/);
  assert.match(robots, /Sitemap:/);
  assert.match(staticSeo, /script: noIndex \? \[\] : \[/);
  for (const path of ["pages/index.vue", "pages/[area]/index.vue", "pages/[area]/[country]/index.vue", "pages/[area]/[country]/[station].vue"]) {
    const src = await read(path);
    assert.match(src, /script: noIndex \? \[\] : \[/, path);
    assert.match(src, /noIndex/, path);
  }
});
