import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

test("Nuxt security patch keeps DevTools and removes vulnerable simple-git 3.x", async () => {
  const [pkgText, nuxtConfig, lockText] = await Promise.all([
    readFile(join(ROOT, "package.json"), "utf8"),
    readFile(join(ROOT, "nuxt.config.ts"), "utf8"),
    readFile(join(ROOT, "package-lock.json"), "utf8"),
  ]);
  const pkg = JSON.parse(pkgText);
  const lock = JSON.parse(lockText);
  const installed = lock.packages;

  assert.equal(pkg.dependencies.nuxt, "4.6.4");
  assert.equal(installed["node_modules/nuxt"]?.version, "4.6.4");
  assert.equal(installed["node_modules/@nuxt/devtools"]?.version, "3.4.4");
  assert.equal(installed["node_modules/@nuxt/nitro-server"]?.version, "4.6.4");
  assert.equal(installed["node_modules/@nuxt/vite-builder"]?.version, "4.6.4");
  assert.equal(installed["node_modules/nitropack"]?.version, "2.13.6");
  assert.equal(installed["node_modules/undici"]?.version, "8.12.3");
  assert.equal(installed["node_modules/node-forge"]?.version, "1.4.3");
  assert.equal(installed["node_modules/simple-git"], undefined,
    "Do not reintroduce vulnerable simple-git 3.x through Nuxt DevTools");
  assert.equal(pkg.overrides?.["simple-git"], undefined,
    "Remove the old dangerous Simple Git 3.x override");
  assert.match(nuxtConfig, /devtools:\s*\{\s*enabled:\s*true\s*\}/,
    "Keep developer tooling enabled now that DevTools is patched");
});
