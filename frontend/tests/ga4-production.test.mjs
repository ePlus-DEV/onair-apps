import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { GA4_MEASUREMENT_ID, isGa4ProductionBuild, getGa4HeadScripts } from '../utils/ga4-config.mjs';
import { assertGa4Output } from '../scripts/assert-ga4-output.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('GA4 can run only on the canonical production website', () => {
  assert.equal(GA4_MEASUREMENT_ID, 'G-ETDY41KBBJ');
  const production = { nodeEnv: 'production', siteUrl: 'https://radio.eplus.dev', noIndex: false };
  assert.equal(isGa4ProductionBuild(production), true);
  assert.equal(isGa4ProductionBuild({ ...production, noIndex: true }), true,
    'a temporary production Pages noindex must not disable analytics');
  for (const context of [
    { ...production, nodeEnv: 'development' },
    { ...production, nodeEnv: 'test' },
    { ...production, siteUrl: 'http://localhost:3000' },
    { ...production, siteUrl: 'https://stg.radio.eplus.dev' },
    { ...production, siteUrl: 'https://new-radio.eplus.dev' },
    { ...production, siteUrl: 'https://preview.radio.eplus.dev/pr-preview/pr-375/' },
    { ...production, siteUrl: 'https://radio-new.eplus.dev' },
    { ...production, siteUrl: 'https://eplus-dev.github.io/onair-production-pages/' },
    { ...production, siteUrl: 'https://arcade.eplus.dev' },
    { ...production, siteUrl: 'http://radio.eplus.dev' },
    { ...production, siteUrl: 'https://radio.eplus.dev:8443' },
    { ...production, siteUrl: 'https://radio.eplus.dev/fake-path' },
    { ...production, siteUrl: 'not-a-url' },
  ]) assert.equal(isGa4ProductionBuild(context), false, JSON.stringify(context));
});

test('Nuxt includes exactly one guarded GA4 bootstrap in prerendered HTML', async () => {
  const config = await read('nuxt.config.ts');
  assert.match(config, /ga4Enabled = isGa4ProductionBuild\(/);
  assert.match(config, /ga4MeasurementId: ga4Enabled \? GA4_MEASUREMENT_ID : ""/);
  assert.match(config, /script: getGa4HeadScripts\(ga4Enabled\)/);
  assert.doesNotMatch(config, /nuxt-gtag/);
  await assert.rejects(read('plugins/ga4.client.ts'), { code: 'ENOENT' },
    'Never reintroduce the hydration-dependent duplicate tag loader');

  const disabled = getGa4HeadScripts(false);
  assert.deepEqual(disabled, [], 'No analytics tags in staging');
  const scripts = getGa4HeadScripts(true);
  assert.equal(scripts.length, 1);
  const source = scripts[0].textContent;
  assert.match(source, /window\.location\.hostname !== 'radio\.eplus\.dev'/);
  assert.match(source, /window\.gtag\('config', 'G-ETDY41KBBJ'\)/);
  assert.doesNotMatch(source, /send_page_view:\s*false/);
  assert.doesNotMatch(source, /'event',\s*'page_view'/);
  assert.equal((source.match(/googletagmanager\.com\/gtag\/js\?id=/g) || []).length, 1);
});

test('HTML GA4 loader runs before Nuxt hydration on canonical hostname only', () => {
  const source = getGa4HeadScripts(true)[0].textContent;
  const simulate = (hostname) => {
    const scripts = [];
    const window = { location: { hostname } };
    const document = {
      head: { appendChild(script) { scripts.push(script); } },
      createElement(name) { assert.equal(name, 'script'); return {}; },
    };
    runInNewContext(source, { window, document, Date });
    return { window, scripts };
  };
  const live = simulate('radio.eplus.dev');
  assert.equal(live.scripts.length, 1);
  assert.equal(live.scripts[0].async, true);
  assert.equal(live.scripts[0].src,
    'https://www.googletagmanager.com/gtag/js?id=G-ETDY41KBBJ');
  assert.equal(typeof live.window.gtag, 'function');
  // Convert the VM-created array into the host realm before strict equality.
  const commands = Array.from(live.window.dataLayer, (args) => Array.from(args)[0]);
  assert.deepEqual(commands, ['js', 'config']);
  assert.equal(live.window.dataLayer[1][1], 'G-ETDY41KBBJ');
  for (const host of ['stg.radio.eplus.dev', 'new-radio.eplus.dev', 'preview.radio.eplus.dev', 'example.github.io', 'localhost']) {
    const preview = simulate(host);
    assert.deepEqual(preview.scripts, [], host);
    assert.equal(preview.window.gtag, undefined, host);
  }
});

test('generated HTML audit rejects missing, duplicate and preview GA4 tags', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onair-ga4-'));
  const home = join(root, 'index.html');
  const station = join(root, 'asia/viet-nam/vov-gt-hcm/index.html');
  try {
    await mkdir(dirname(station), { recursive: true });
    const bootstrap = getGa4HeadScripts(true)[0].textContent;
    const production = '<html><head><script>' + bootstrap + '</script></head><body></body></html>';
    await writeFile(home, production);
    await writeFile(station, production);
    await assertGa4Output(root, 'production');
    await assert.rejects(assertGa4Output(root, 'staging'), /non-production must not embed Google tag/);
    await assert.rejects(assertGa4Output(root, 'development'), /non-production must not embed Google tag/);

    // HTML end tags can include whitespace and malformed attributes; CodeQL
    // previously flagged a regex that missed these valid parser boundaries.
    for (const endTag of ['</script >', '</script\t\n bar>']) {
      const variant = production
        .replace('<script>', '<script data-example="quoted > value">')
        .replaceAll('</script>', endTag);
      await writeFile(home, variant);
      await writeFile(station, variant);
      await assertGa4Output(root, 'production');
    }

    // Reject an external Google tag as a second installation, including
    // quoted attributes with a > character and multiline start tags.
    const duplicateExternal = production.replace('</head>',
      '<script data-test="quoted > text"\n src="https://www.googletagmanager.com/gtag/js?id=G-ETDY41KBBJ"></script></head>');
    await writeFile(home, duplicateExternal);
    await assert.rejects(assertGa4Output(root, 'production'),
      /no second unconditional Google tag script/);

    await writeFile(home, production);
    await writeFile(station, production);
    const duplicate = production.replace('</head>', '<script>' + bootstrap + '</script></head>');
    await writeFile(home, duplicate);
    await assert.rejects(assertGa4Output(root, 'production'), /missing or duplicate/);

    const staging = '<html><head><title>Staging</title></head><body></body></html>';
    await writeFile(home, staging);
    await writeFile(station, staging);
    await assertGa4Output(root, 'staging');
    await assertGa4Output(root, 'development');
    await assert.rejects(assertGa4Output(root, 'production'), /missing or duplicate/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('tracking notification is informational and cannot gate analytics', async () => {
  const [notice, policy] = await Promise.all([
    read('components/CookieConsent.vue'),
    read('pages/cookie-policy.vue'),
  ]);
  assert.match(notice, /radio:tracking-notice-v2/);
  assert.match(notice, /cookie_consent\.analytics_body/);
  assert.match(notice, /cookie_consent\.accept/);
  assert.match(notice, /localStorage\.setItem\(STORAGE_KEY, 'dismissed'\)/);
  assert.doesNotMatch(notice, /ANALYTICS_CONSENT|allow_analytics|denyAnalytics|essential_only|radio:analytics-consent/);
  assert.doesNotMatch(policy, /AnalyticsPreferences/);
});

test('all seven translations disclose GA4 and contain no opt-in/opt-out choices', async () => {
  for (const locale of ['en-US', 'vi-VN', 'ja-JP', 'zh-CN', 'zh-TW', 'fr-FR', 'ru-RU']) {
    const data = JSON.parse(await read(`lang/${locale}.json`));
    assert.ok(data.cookie_consent.analytics_body.includes('Google Analytics 4'), locale);
    assert.ok(data.site_pages.cookie.sections.analytics.body.includes('Google Analytics 4'), locale);
    for (const key of ['allow_analytics', 'essential_only', 'analytics_preferences', 'analytics_on', 'analytics_off']) {
      assert.equal(Object.hasOwn(data.cookie_consent, key), false, `${locale}: stale toggle ${key}`);
    }
  }
});
