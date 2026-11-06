import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("Back to top is not hidden on mobile and does not rely on Font Awesome", async () => {
  const source = await readFile(join(process.cwd(), "components/AppFooter.vue"), "utf8");
  const start = source.indexOf('v-show="showTop"');
  const end = source.indexOf("</button>", start);
  const block = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  const classMatch = block.match(/class="([^"]+)"/);
  assert.ok(classMatch, "Back-to-top button class not found");
  assert.match(classMatch[1], /\bflex\b/);
  assert.doesNotMatch(classMatch[1], /(?:^|\s)hidden(?:\s|$)/);
  assert.match(block, /<svg/);
  assert.doesNotMatch(block, /<fa\b/);
});

test("Breadcrumb current item exposes aria-current", async () => {
  const source = await readFile(join(process.cwd(), "components/Breadcrumbs.vue"), "utf8");
  assert.match(source, /aria-current="page"/);
  assert.match(source, /buildBreadcrumbItems/);
});
