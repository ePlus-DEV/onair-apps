import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pageSkeletonKind } from "../utils/page-skeleton.mjs";

test("all public page families have route-specific skeletons", () => {
  for (const [path, variant] of [
    ["/", "home"],
    ["/europe", "area"],
    ["/asia/", "area"],
    ["/asia/viet-nam", "country"],
    ["/asia/viet-nam/vov-gt-hcm", "station"],
    ["/europe/united-kingdom/heart-uk", "station"],
    ["/library", "library"],
    ["/library#favorites", "library"],
    ["/statistics", "statistics"],
    ["/about", "info"],
    ["/contact", "info"],
    ["/privacy-policy", "info"],
    ["/terms-of-use", "info"],
    ["/cookie-policy", "info"],
    ["/unexpected/other/route/extra", "info"],
  ]) {
    assert.equal(pageSkeletonKind(path), variant, path);
  }
});

test("skeleton component mirrors real page layouts, remains noninteractive and screen-reader friendly", async () => {
  const source = await readFile("components/PageSkeleton.vue", "utf8");
  for (const variant of ["home", "area", "country", "station", "library", "statistics"]) {
    assert.ok(source.includes("variant === '" + variant + "'"), variant);
  }
  assert.match(source, /role="status"/);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /sr-only/);
  assert.doesNotMatch(source, /<NuxtLink|<button|<img|\\$fetch|createPlaybackStation/);
  assert.match(source, /grid-cols-2/);
  assert.match(source, /lg:grid-cols-/);
});

test("app skeleton is client-only, delayed, cancels on route failures and keeps global player mounted", async () => {
  const source = await readFile("app.vue", "utf8");
  assert.match(source, /<NuxtPage\s*\/>/);
  assert.match(source, /<PageSkeleton v-if="pageIsLoading" :path="pendingPagePath"/);
  assert.match(source, /v-show="!pageIsLoading"/);
  assert.match(source, /:inert="pageIsLoading"/);
  assert.match(source, /router\.beforeEach/);
  assert.match(source, /to\.path === from\.path/);
  assert.match(source, /setTimeout\(\(\) => \{ pageIsLoading\.value = true; \}, 140\)/);
  assert.match(source, /nuxtApp\.hook\("page:finish", stopPageSkeleton\)/);
  assert.match(source, /router\.onError\(stopPageSkeleton\)/);
  assert.match(source, /onBeforeUnmount/);
  assert.match(source, /<PlayerSession\s*\/>/);
  assert.doesNotMatch(source, /v-if="!pageIsLoading"[\s\S]*?<NuxtPage/);
});

test("shimmer supports light/dark themes and disables animation for reduced motion", async () => {
  const css = await readFile("assets/css/main.css", "utf8");
  assert.match(css, /@keyframes radio-skeleton-shimmer/);
  assert.match(css, /var\(--radio-surface-soft\)/);
  assert.match(css, /var\(--radio-border-strong\)/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?\.radio-skeleton\s*\{\s*animation: none/);
});
