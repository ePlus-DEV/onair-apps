import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveDeploymentSiteName } from '../utils/deployment-site-name.mjs';
import { buildPlaybackTitleTemplate } from '../utils/playback-tab-title.mjs';

test('production keeps the existing brand and SEO/browser title by default', () => {
  assert.equal(resolveDeploymentSiteName({ siteUrl: 'https://radio.eplus.dev' }), 'ePlus OnAir');
  assert.equal(resolveDeploymentSiteName({ siteUrl: 'https://radio.eplus.dev', configuredName: 'ePlus OnAir' }), 'ePlus OnAir');
  assert.equal(buildPlaybackTitleTemplate('', 'ePlus OnAir'), '%s | ePlus OnAir');
});

test('staging and preview have clearly distinct document titles, even without Environment variables', () => {
  for (const origin of ['https://stg.radio.eplus.dev', 'https://new-radio.eplus.dev', 'https://radio-new.eplus.dev']) {
    const name = resolveDeploymentSiteName({ siteUrl: origin });
    assert.equal(name, 'ePlus OnAir — Staging');
    assert.equal(buildPlaybackTitleTemplate('', name), '%s | ePlus OnAir — Staging');
  }
  const name = resolveDeploymentSiteName({ siteUrl: 'https://preview.radio.eplus.dev/pr-preview/pr-384/' });
  assert.equal(name, 'ePlus OnAir — Preview');
  assert.equal(buildPlaybackTitleTemplate('Heart UK', name)('About'), '▶ Heart UK | ePlus OnAir — Preview');
});

test('each GitHub Environment can configure its own title without leaking another tier', () => {
  assert.equal(resolveDeploymentSiteName({ siteUrl: 'https://stg.radio.eplus.dev', configuredName: 'ePlus OnAir [STG]' }), 'ePlus OnAir [STG]');
  assert.equal(resolveDeploymentSiteName({ siteUrl: 'https://preview.radio.eplus.dev/pr-preview/pr-1/', configuredName: 'ePlus OnAir [PR Preview]' }), 'ePlus OnAir [PR Preview]');
  assert.equal(resolveDeploymentSiteName({ isPrPreview: true, siteUrl: 'https://radio.eplus.dev' }), 'ePlus OnAir — Preview');
  assert.equal(resolveDeploymentSiteName({ siteUrl: 'https://not-stg.radio.eplus.dev' }), 'ePlus OnAir');
});

test('Nuxt title uses the environment-specific site name; route SEO copy remains unchanged', () => {
  const config = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8');
  const preview = readFileSync(new URL('../.github/workflows/pr-preview-pages.yml', import.meta.url), 'utf8');
  const deploy = readFileSync(new URL('../.github/workflows/deploy-github-pages.yml', import.meta.url), 'utf8');
  assert.match(config, /resolveDeploymentSiteName\(/);
  assert.match(config, /titleTemplate: `%s \| \$\{siteName\}`/);
  assert.match(config, /siteName,/);
  assert.match(preview, /NUXT_PUBLIC_SITE_NAME: \$\{\{ needs\.preview_config\.outputs\.site_name \}\}/);
  assert.match(deploy, /NUXT_PUBLIC_SITE_NAME: \$\{\{ vars\.NUXT_PUBLIC_SITE_NAME \}\}/);
});
