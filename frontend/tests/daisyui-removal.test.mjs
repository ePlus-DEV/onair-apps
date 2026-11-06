import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
async function vueFiles(dir) {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  return (await Promise.all(entries.map(async (item) =>
    item.isDirectory() ? vueFiles(join(dir, item.name)) :
    item.name.endsWith(".vue") ? [join(root, dir, item.name)] : []
  ))).flat();
}

test("DaisyUI is not loaded or retained in the dependency graph", async () => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  const css = await readFile(join(root, "assets/css/main.css"), "utf8");
  assert.equal(pkg.dependencies.daisyui, undefined);
  assert.equal(lock.packages[""].dependencies.daisyui, undefined);
  assert.equal(lock.packages["node_modules/daisyui"], undefined);
  assert.doesNotMatch(css, /@plugin\s+["']daisyui["']/);
});

test("Vue views do not silently depend on DaisyUI component classes", async () => {
  const files = [join(root, "app.vue"), ...(await vueFiles("components")), ...(await vueFiles("pages"))];
  const forbidden = /\b(?:btn-(?:ghost|square|circle)|dropdown-content|tabs-box|tab-active|badge-(?:sm|outline)|input-bordered|select-xs|kbd-xs)\b/;
  const violations = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    if (forbidden.test(content)) violations.push(file.slice(root.length + 1));
  }
  assert.deepEqual(violations, []);
});
