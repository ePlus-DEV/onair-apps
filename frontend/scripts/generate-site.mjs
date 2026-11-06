import { spawnSync } from 'node:child_process';

// npm supplies the CLI path on every supported platform. Keep its pregenerate
// hooks for search/brand assets, but suppress the separate station image build.
if (!process.env.npm_execpath) throw new Error('Use npm run generate:site');
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'generate'], {
  env: { ...process.env, ONAIR_SKIP_STATION_OG: 'true' },
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  // Production-only sitemap exists after prerender. Compact it before the
  // same strict 1 GB GitHub Pages output audit runs in CI and deploy.
  // Staging/PR preview builds have no sitemap and are left untouched.
  const { compactGeneratedSitemap } = await import('./compact-sitemap.mjs');
  await compactGeneratedSitemap('.output/public/sitemap.xml',
    process.env.NUXT_PUBLIC_SITE_URL || 'https://radio.eplus.dev');
}
