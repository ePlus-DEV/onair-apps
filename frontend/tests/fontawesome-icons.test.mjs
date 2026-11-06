import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  brandIcons,
  freeSolidIcons,
} from "../config/fontawesome-icons.mjs";

const ROOT = process.cwd();
const VUE_ROOTS = ["components", "pages"];

async function walkVueFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkVueFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".vue")) {
      files.push(fullPath);
    }
  }

  return files;
}

test("all Font Awesome UI icons are Free and centrally registered", async () => {
  const registered = new Set(freeSolidIcons);
  const used = new Set(["bars", "xmark", "sun", "moon", "desktop"]);

  const vueFiles = [
    join(ROOT, "app.vue"),
    ...(await Promise.all(VUE_ROOTS.map((dir) => walkVueFiles(join(ROOT, dir))))).flat(),
  ];

  for (const file of vueFiles) {
    const source = await readFile(file, "utf8");

    for (const match of source.matchAll(/\['fas',\s*'([^']+)'\]/g)) {
      used.add(match[1]);
    }

    assert.doesNotMatch(
      source,
      /\['(?:fal|fad|fat|fass|fasl|fasr|fast)',/,
      `Pro Font Awesome prefix found in ${file.replace(ROOT, ".")}`,
    );
  }

  const missing = [...used].filter((icon) => !registered.has(icon)).sort();
  assert.deepEqual(missing, [], `Unregistered Free Solid icons: ${missing.join(", ")}`);

  assert.deepEqual(
    [...brandIcons].sort(),
    ["facebook-f", "x-twitter"],
  );
});

test("Nuxt and npm config do not depend on Font Awesome Pro/private registry", async () => {
  const [nuxtConfig, packageJson] = await Promise.all([
    readFile(join(ROOT, "nuxt.config.ts"), "utf8"),
    readFile(join(ROOT, "package.json"), "utf8"),
  ]);

  assert.doesNotMatch(nuxtConfig, /proIcons\s*:/);
  assert.doesNotMatch(packageJson, /@fortawesome\/(?:pro-|sharp-)/);
  assert.equal(existsSync(join(ROOT, ".npmrc")), false);
});
