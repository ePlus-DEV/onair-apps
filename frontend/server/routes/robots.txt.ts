// Generated per deployment instead of committed as a static public asset,
// so staging robots.txt cannot accidentally overwrite production during release.
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  setHeader(event, "Content-Type", "text/plain; charset=utf-8");
  if (config.public.noIndex) {
    // IMPORTANT: Google must be able to crawl HTML to discover the noindex
    // meta tag. A robots.txt Disallow: / would prevent that, while still
    // allowing already-discovered staging URLs to appear in search results.
    // Restrict staging access at the hosting edge if privacy is required.
    return "User-agent: *\nAllow: /\n";
  }
  const origin = String(config.public.siteUrl || "https://radio.eplus.dev").replace(/\/$/, "");
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
});
