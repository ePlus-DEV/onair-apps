import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const VUE_ROOTS = ["components", "pages"];

async function collectVueFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectVueFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".vue")) {
      files.push(path);
    }
  }

  return files;
}

test("theme CSS defines semantic surfaces for Nuxt Color Mode", async () => {
  const css = await readFile(join(ROOT, "assets/css/main.css"), "utf8");

  for (const required of [
    'html.light',
    'html.dark',
    '--radio-page-bg',
    '--radio-surface',
    '--radio-text',
    'body,',
    '#__nuxt',
  ]) {
    assert.ok(css.includes(required), `missing theme primitive: ${required}`);
  }
});

test("site defaults to dark mode with the color brand mark", async () => {
  const [config, header, artwork] = await Promise.all([
    readFile(join(ROOT, "nuxt.config.ts"), "utf8"),
    readFile(join(ROOT, "components/AppHeader.vue"), "utf8"),
    readFile(join(ROOT, "components/StationArtwork.vue"), "utf8"),
  ]);

  assert.match(config, /preference:\s*"dark"/);
  assert.match(config, /fallback:\s*"dark"/);
  assert.match(header, /\/brand\/logo-share\.png/);
  assert.doesNotMatch(header, /dark:invert|logo-black\.svg|logo-white\.svg/);
  assert.match(artwork, /\/brand\/logo-share\.png/);
});

test("Vue templates do not reintroduce legacy light/dark utility pairs", async () => {
  const vueFiles = [
    join(ROOT, "app.vue"),
    ...(
      await Promise.all(
        VUE_ROOTS.map((dir) => collectVueFiles(join(ROOT, dir))),
      )
    ).flat(),
  ];

  const forbidden = [
    /dark:bg-white(?:\b|\/)/,
    /dark:bg-slate-/,
    /dark:text-white\b/,
    /dark:text-slate-/,
    /dark:border-white(?:\b|\/)/,
    /\bbg-gray-/,
    /\btext-gray-/,
    /\bborder-gray-/,
    /(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/,
  ];

  const violations = [];

  for (const file of vueFiles) {
    const source = await readFile(file, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        violations.push(`${file.replace(ROOT, ".")}: ${pattern}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Theme regressions found:\n${violations.join("\n")}`,
  );
});

test("station detail Play/Pause button uses white text and icon in dark mode", async () => {
  const [page, css] = await Promise.all([
    readFile(join(ROOT, "pages/[area]/[country]/[station].vue"), "utf8"),
    readFile(join(ROOT, "assets/css/main.css"), "utf8"),
  ]);

  const action = page.match(/<UButton[^>]*radio-station-detail-action[^>]*>[\s\S]*?<\/UButton>/)?.[0];
  assert.ok(action, "station detail has a dedicated Play/Pause action");
  assert.match(action, /'i-lucide-pause' : 'i-lucide-play'/);
  assert.match(action, /\$t\('player\.pause'\) : \$t\('player\.play'\)/);
  assert.match(css, /html\.dark \.radio-station-detail-action,[\s\S]*?html\[data-theme="dark"\] \.radio-station-detail-action \{\s*color: #fff !important;/);
  assert.match(css, /html\.dark \.radio-station-detail-action \.iconify,[\s\S]*?html\[data-theme="dark"\] \.radio-station-detail-action \.iconify \{\s*color: inherit !important;/);
  assert.doesNotMatch(css, /html\.light \.radio-station-detail-action/);
});
