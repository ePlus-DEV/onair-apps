import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("CI owns PR validation, including lightweight radio sync bot checks", async () => {
  const ci = await read(".github/workflows/build.yml");
  assert.match(ci, /name: "CI"/);
  assert.match(ci, /^  pull_request:/m);
  assert.match(ci, /"\.github\/workflows\/\*\*"/);
  assert.match(ci, /"public\/img\/\*\*"/);
  assert.match(ci, /bot\/instant-audio-sync/);
  assert.match(ci, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(ci, /node --check scripts\/sync-instant-audio\.mjs/);
  assert.match(ci, /run: npm test/);
  assert.match(ci, /run: npm run generate/);
  assert.match(ci, /run: node scripts\/assert-sitemap-xml\.mjs/);
});

test("radio sync remains manually runnable and does not duplicate PR checks", async () => {
  const sync = await read(".github/workflows/instant-audio-sync.yml");
  assert.match(sync, /^  workflow_dispatch:/m);
  assert.doesNotMatch(sync, /^  pull_request:/m);
  assert.doesNotMatch(sync, /^  schedule:/m);
  assert.doesNotMatch(sync, /^  validate:/m);
  assert.match(sync, /name: "Live sync — manual"/);
  assert.match(sync, /gh pr create/);
});

test("retired workflows are deleted but Dependabot's weekly update config remains", async () => {
  const files = await readdir(new URL("../.github/workflows/", import.meta.url));
  for (const retired of [
    "changelog.yml",
    "voh-missing-radio-import.yml",
    "dependabot-auto-merge.yml",
  ]) {
    assert.ok(!files.includes(retired), retired + " must not trigger new jobs");
  }
  assert.ok(files.includes("build.yml"));
  assert.ok(files.includes("instant-audio-sync.yml"));
  const dependabot = await read(".github/dependabot.yml");
  assert.match(dependabot, /package-ecosystem: "github-actions"/);
  assert.match(dependabot, /interval: "weekly"/);
});
