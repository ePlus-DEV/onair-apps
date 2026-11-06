import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const read = path => readFile(path, "utf8");
const isFile = async path => {
  try { return (await stat(path)).isFile(); } catch { return false; }
};

const output = ".output/public";
const [home, robots] = await Promise.all([
  read(`${output}/index.html`),
  read(`${output}/robots.txt`),
]);

assert.ok(/<meta(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex)[^>]*>/i.test(home), "staging must render a robots noindex meta");
assert.doesNotMatch(home, /<link[^>]*rel=["']canonical["']/i, "staging must not render production canonical");
assert.doesNotMatch(home, /application\/ld\+json/i, "staging must not embed JSON-LD");
// Inspect parsed tags individually. On failure, show only relevant meta tags
// instead of dumping 200 KB of prerendered CSS and HTML into CI logs.
const metaTags = [...home.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]);
const selectMeta = (attribute, value) =>
  metaTags.filter(tag => new RegExp(`\\b${attribute}=["']${value}["']`, "i").test(tag));
const images = selectMeta("property", "og:image");
const twitterCards = selectMeta("name", "twitter:card");
assert.ok(
  images.some(tag => tag.includes("/brand/social-preview.png") && /content=["\']https?:/i.test(tag)),
  `staging must expose branded og:image; observed: ${JSON.stringify(images)}`,
);
assert.ok(
  twitterCards.some(tag => /content=["']summary_large_image["']/i.test(tag)),
  `staging should provide Twitter card; observed: ${JSON.stringify(twitterCards)}`,
);
assert.match(robots, /^User-agent: \*\s*\nAllow: \/\s*$/i, "staging robots.txt must allow crawlers to read the noindex meta");
assert.doesNotMatch(robots, /^Disallow: \/\s*$/im, "staging robots.txt must not block crawlers from discovering noindex");
assert.doesNotMatch(robots, /Sitemap:/i, "staging robots.txt must not announce a sitemap");
assert.equal(await isFile(`${output}/sitemap.xml`), false, "staging must not generate sitemap.xml");
console.log("PASS: staging HTML has robots noindex and social previews, but no canonical/JSON-LD/sitemap.");
