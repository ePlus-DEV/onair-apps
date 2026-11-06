import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPagesBuild } from '../scripts/check-pages-build.mjs';

const read = file => readFile(file, 'utf8');

test('custom-domain full-site deployments preserve separate Production and Staging destinations', async () => {
  const workflow = await read('.github/workflows/deploy-github-pages.yml');
  assert.ok(workflow.includes('branches: [develop, main]'));
  assert.ok(workflow.includes('ePlus-DEV/onair-staging-pages'));
  assert.ok(workflow.includes('ePlus-DEV/onair-production-pages'));
  assert.ok(workflow.includes("name: ${{ github.ref_name == 'main' && 'production' || (vars.PAGES_STAGING_READY == 'true' && 'staging' || 'development') }}"),
    'Staging uses its own Environment after the explicit opt-in migration');
  assert.ok(workflow.includes("vars.PAGES_STAGING_READY == 'true' ||"),
    'Staging must have an independent readiness gate');
  assert.ok(workflow.includes("vars.PAGES_STAGING_READY == '' && vars.PAGES_DEV_READY == 'true'"),
    'Staging legacy fallback must work only while the new flag is absent');
  assert.ok(workflow.includes('NUXT_PUBLIC_SITE_URL: ${{ vars.NUXT_PUBLIC_SITE_URL }}'));
  assert.ok(workflow.includes('SEO_EXPECTED_SITE_URL: ${{ vars.NUXT_PUBLIC_SITE_URL }}'));
  assert.ok(workflow.includes("github.ref_name == 'main' && 'radio.eplus.dev' || 'stg.radio.eplus.dev'"));
  assert.ok(workflow.includes('NUXT_APP_BASE_URL: /'));
  assert.ok(workflow.includes('https://$TARGET_DOMAIN'));
  assert.doesNotMatch(workflow, /\beplus-dev\.github\.io\b/i,
    'legacy GitHub Pages host must never be present in deployment workflow');
  assert.ok(workflow.includes("NUXT_PUBLIC_NO_INDEX: ${{ github.ref_name == 'develop' && 'true' || 'false' }}"),
    'staging must be noindex, while production must stay indexable');
  assert.ok(workflow.includes("TARGET_KIND: ${{ github.ref_name == 'main' && 'production' || 'staging' }}"),
    'Pages output validation must reject noindex production bundles');
  assert.ok(!workflow.includes("NUXT_PUBLIC_NO_INDEX: 'true'"),
    'never force noindex on production');
  assert.ok(!workflow.includes("TARGET_KIND: 'staging'"),
    'production deploy must use the production SEO audit');
  assert.ok(workflow.includes('if [ "$TARGET_KIND" = staging ]; then'),
    'only staging runs noindex-only audit');
  assert.ok(workflow.includes('NUXT_APP_BASE_URL:'));
  assert.ok(workflow.includes('PAGES_DEV_READY'));
  assert.ok(workflow.includes("(github.ref_name == 'main')"),
    'trusted main pushes must trigger a production release');
  assert.ok(!workflow.includes('vars.PAGES_PROD_READY'),
    'unset readiness flags must not silently skip production deploys');
  assert.ok(workflow.includes('".github/workflows/deploy-github-pages.yml"'),
    'workflow release fixes must trigger the deploy workflow');
  assert.ok(workflow.includes('PAGES_DEPLOY_TOKEN'));
  assert.ok(workflow.includes('ls-remote --exit-code'));
  assert.ok(workflow.includes('repo.permissions?.push !== true'));
  assert.ok(workflow.includes('rsync -a --delete'));
  assert.ok(workflow.includes("--exclude='/README.md'"),
    'public Pages repository README must survive incremental publishing');
  assert.ok(workflow.includes('.output/public'));
  assert.ok(workflow.includes('.nojekyll'));
  assert.ok(workflow.includes('printf \'%s\\n\' "$TARGET_DOMAIN" > "$target/CNAME"'));
  assert.ok(!workflow.includes('rm -f "$target/CNAME"'));
  assert.ok(workflow.includes('assert-project-pages-output.mjs .output/public custom-domain'));
  assert.ok(workflow.indexOf('Verify exact Pages repository and PAT') <
    workflow.indexOf('Install dependencies'), 'preflight must precede heavy build');
  assert.ok(!workflow.includes('ePlus-DEV/ePlus-DEV.github.io'));
  assert.ok(!workflow.includes('PAGES_DEV_SITE_URL'), 'no stale custom-domain variable');
  assert.ok(!workflow.includes('process.stdout.write(url.hostname'));
  assert.ok(!workflow.includes('pull_request:'), 'PAT cannot run on untrusted PR');
  assert.ok(!workflow.includes('push -f') && !workflow.includes('--force'),
    'do not force-push generated Pages history');
});

test('Pages bundle audit checks noindex, sitemap, source maps and limits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onair-pages-'));
  try {
    await mkdir(join(root, '_nuxt'));
    await writeFile(join(root, '_nuxt', 'app.js'), 'console.log("ok");');
    await writeFile(join(root, 'index.html'), '<html><head><meta name="robots" content="noindex, nofollow"></head></html>');
    await writeFile(join(root, 'robots.txt'), 'User-agent: *\\nAllow: /\\n');
    assert.equal((await checkPagesBuild(root, 'staging')).count, 3);
    assert.equal((await checkPagesBuild(root, 'development')).count, 3);
    await assert.rejects(checkPagesBuild(root, 'production'), /robots metadata/);

    await writeFile(join(root, '_nuxt', 'app.js.map'), '{}');
    await assert.rejects(checkPagesBuild(root, 'staging'), /source maps/);
    await assert.rejects(checkPagesBuild(root, 'development'), /source maps/);
    await rm(join(root, '_nuxt', 'app.js.map'));
    await writeFile(join(root, 'index.html'), '<html><head><meta name="robots" content="index, follow"></head></html>');
    await writeFile(join(root, 'robots.txt'), 'User-agent: *\\nAllow: /\\nSitemap: https://radio.eplus.dev/sitemap.xml\\n');
    assert.equal((await checkPagesBuild(root, 'production')).count, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
