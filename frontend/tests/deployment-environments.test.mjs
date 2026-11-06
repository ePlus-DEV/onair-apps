import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isStagingDeployment } from '../utils/seo-deployment.mjs';
import { isGa4ProductionBuild } from '../utils/ga4-config.mjs';

const deploy = readFileSync(new URL('../.github/workflows/deploy-github-pages.yml', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../.github/workflows/pr-preview-pages.yml', import.meta.url), 'utf8');

test('the only indexable site and GA4 build is production', () => {
  for (const origin of ['https://stg.radio.eplus.dev', 'https://preview.radio.eplus.dev/pr-preview/pr-375']) {
    assert.equal(isStagingDeployment({ siteUrl: origin }), true, origin);
    assert.equal(isGa4ProductionBuild({ nodeEnv: 'production', siteUrl: origin }), false, origin);
  }
  assert.equal(isStagingDeployment({ siteUrl: 'https://radio.eplus.dev', noIndex: 'false' }), false);
  assert.equal(isGa4ProductionBuild({ nodeEnv: 'production', siteUrl: 'https://radio.eplus.dev' }), true);
});

test('production and staging remain isolated by branch, Pages repository and hostname', () => {
  assert.match(deploy, /branches: \[develop, main\]/);
  assert.match(deploy, /github\.ref_name == 'main' && 'ePlus-DEV\/onair-production-pages' \|\| 'ePlus-DEV\/onair-staging-pages'/);
  assert.match(deploy, /github\.ref_name == 'main' && 'radio\.eplus\.dev' \|\| 'stg\.radio\.eplus\.dev'/);
  assert.match(deploy, /github\.ref_name == 'main' && 'production' \|\| 'staging'/);
  assert.match(deploy, /NUXT_PUBLIC_NO_INDEX:.*github\.ref_name == 'develop'/);
});

test('staging has an independent Environment with opt-in migration and an explicit legacy fallback', () => {
  assert.match(deploy, /vars\.PAGES_STAGING_READY == 'true' && 'staging' \|\| 'development'/);
  assert.match(deploy, /vars\.PAGES_STAGING_READY == '' && vars\.PAGES_DEV_READY == 'true'/);
  assert.match(deploy, /github\.ref_name == 'main' && 'production'/);
});

test('development preview is isolated from staging and cannot load production analytics', () => {
  assert.match(preview, /PREVIEW_TARGET_REPOSITORY: ePlus-DEV\/onair-pr-previews/);
  assert.match(preview, /PREVIEW_SITE_ORIGIN: https:\/\/preview\.radio\.eplus\.dev/);
  assert.match(preview, /NUXT_PUBLIC_NO_INDEX: 'true'/);
  assert.match(preview, /NUXT_PUBLIC_SITE_URL: https:\/\/preview\.radio\.eplus\.dev\/pr-preview\/pr-/);
  assert.match(preview, /NUXT_APP_BASE_URL: \/pr-preview\/pr-/);
  assert.match(preview, /node scripts\/assert-ga4-output\.mjs \.output\/public development/);
  assert.match(preview, /node scripts\/check-pages-build\.mjs \.output\/public development/);
  assert.match(preview, /vars\.PAGES_PREVIEW_READY == 'true' && 'preview' \|\| 'development'/);
  assert.match(preview, /vars\.PAGES_PREVIEW_READY == '' && vars\.PAGES_DEV_READY == 'true'/);
  assert.match(preview, /site_name: \$\{\{ steps\.public\.outputs\.site_name \}\}/);
  assert.match(preview, /NUXT_PUBLIC_SITE_NAME: \$\{\{ needs\.preview_config\.outputs\.site_name \}\}/);
  assert.match(preview, /EXPECTED_HEAD/);
  assert.match(preview, /preview-commit\.txt/);
});

test('untrusted PR builds cannot receive publishing credentials', () => {
  assert.match(preview, /persist-credentials: false/);
  assert.match(preview, /name: "Build isolated preview \(no secrets\)"/);
  assert.match(preview, /PAGES_DEPLOY_TOKEN: \$\{\{ secrets\.PAGES_DEPLOY_TOKEN \}\}/);
  const buildSection = preview.split('  build:')[1]?.split('  publish:')[0];
  assert.ok(buildSection, 'expected an independent build job');
  assert.doesNotMatch(buildSection, /secrets\.PAGES_DEPLOY_TOKEN/);
  assert.doesNotMatch(buildSection, /\n\s*environment:/, 'PR code must not receive any GitHub Environment');
});
