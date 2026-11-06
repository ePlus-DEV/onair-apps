import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const read = (path) => readFile(join(process.cwd(), path), "utf8");

test("production sitemap emits standard XML without a deprecated XSLT stylesheet", async () => {
  const [nuxt, robots] = await Promise.all([
    read("nuxt.config.ts"),
    read("server/routes/robots.txt.ts"),
  ]);
  const sitemapConfig = nuxt.slice(nuxt.lastIndexOf("\n  sitemap: {"));

  assert.match(sitemapConfig, /\bxsl:\s*false\b/);
  assert.match(sitemapConfig, /\bautoLastmod:\s*false\b/);
  assert.match(sitemapConfig, /\bautoI18n:\s*false\b/);
  assert.match(sitemapConfig, /urls:\s*noIndex\s*\?\s*\[\]\s*:\s*\[/);
  assert.match(sitemapConfig, /\.\.\.radioSeoRoutes\.map/);
  assert.match(sitemapConfig, /\.\.\.staticSeoRoutes\.map/);
  assert.match(nuxt, /\.\.\.\(!noIndex \? \["@nuxtjs\/sitemap"\] : \[\]\)/);
  assert.match(nuxt, /\.\.\.\(!noIndex \? \["\/sitemap\.xml"\] : \[\]\)/);
  assert.match(robots, /Sitemap: \$\{origin\}\/sitemap\.xml/);
  assert.match(robots, /if \(config\.public\.noIndex\)/);
});

test("radio catalogs yield canonical, unique, count-limited sitemap paths", async () => {
  const root = join(process.cwd(), "public/radio");
  const paths = ["/", "/about", "/statistics", "/contact",
    "/privacy-policy", "/terms-of-use", "/cookie-policy"];
  let stations = 0;
  let countries = 0;

  for (const area of await readdir(root, { withFileTypes: true })) {
    if (!area.isDirectory()) continue;
    const countryRoot = join(root, area.name);
    const jsonFiles = (await readdir(countryRoot, { withFileTypes: true }))
      .filter((x) => x.isFile() && x.name.endsWith(".json"));
    if (!jsonFiles.length) continue;

    paths.push("/" + area.name);
    for (const file of jsonFiles) {
      const country = file.name.slice(0, -5);
      const countryPath = "/" + area.name + "/" + country;
      paths.push(countryPath);
      countries++;
      const data = JSON.parse(await readFile(join(countryRoot, file.name), "utf8"));
      for (const slug of Object.keys(data)) {
        assert.ok(slug && !slug.includes("/") && !slug.includes("?") && !slug.includes("#"),
          "Invalid station slug: " + slug);
        paths.push(countryPath + "/" + slug);
        stations++;
      }
    }
  }

  assert.ok(stations > 0 && countries > 0, "Country and station collections are required");
  assert.ok(paths.length <= 50000, "The sitemap exceeds the per-file URL limit");
  assert.equal(new Set(paths).size, paths.length, "Sitemap would contain duplicate URLs");
  assert.ok(paths.every((x) => x.startsWith("/") && !x.startsWith("//") &&
    !x.includes("?") && !x.includes("#")), "Sitemap paths must be canonical");
  assert.ok(!paths.includes("/library"), "Device-local library must stay out of the sitemap");
});
