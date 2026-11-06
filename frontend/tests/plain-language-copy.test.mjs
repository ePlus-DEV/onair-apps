import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const locales = ['en-US', 'vi-VN', 'ja-JP', 'zh-CN', 'zh-TW', 'fr-FR', 'ru-RU'];
const read = async locale => JSON.parse(await readFile(`lang/${locale}.json`, 'utf8'));
const get = (object, key) => key.split('.').reduce((value, part) => value?.[part], object);

const userFacingKeys = [
  'search.loading', 'library.loading', 'player.schedule_loading',
  'site_pages.about.description', 'site_pages.about.sections.playback.body',
  'site_pages.about.sections.availability.title', 'site_pages.about.sections.availability.body',
  'site_pages.about.service.title', 'site_pages.about.service.body',
  'site_pages.privacy.description', 'site_pages.privacy.sections.preferences.title',
  'site_pages.privacy.sections.preferences.body', 'site_pages.privacy.sections.search.body',
  'site_pages.privacy.sections.streams.title', 'site_pages.privacy.sections.streams.body',
  'site_pages.privacy.sections.logs.title', 'site_pages.privacy.sections.logs.body',
  'site_pages.privacy.sections.sharing.body',
  'site_pages.terms.sections.third_party.title', 'site_pages.terms.sections.third_party.body',
  'site_pages.terms.sections.acceptable_use.title', 'site_pages.terms.sections.acceptable_use.body',
  'site_pages.terms.sections.availability.title', 'site_pages.terms.sections.availability.body',
  'site_pages.terms.sections.copyright.body',
  'site_pages.contact.description', 'site_pages.contact.sections.bug.title',
  'site_pages.contact.sections.bug.body', 'site_pages.contact.sections.station.body',
  'site_pages.contact.sections.copyright.body', 'site_pages.contact.support.title',
  'site_pages.contact.support.body', 'site_pages.statistics.eyebrow',
  'site_pages.statistics.description', 'site_pages.statistics.coverage_description',
  'site_pages.statistics.method_title', 'site_pages.statistics.method_body',
  'site_pages.cookie.description', 'site_pages.cookie.sections.essential.body',
  'site_pages.cookie.sections.analytics.title', 'site_pages.cookie.sections.analytics.body',
  'site_pages.cookie.sections.third_party.body', 'site_pages.cookie.sections.choices.body',
  'site_pages.cookie.sections.changes.body',
  'cookie_consent.body', 'cookie_consent.analytics_body',
  'alert.stream_error', 'text.offline',
];

test('listener-facing copy exists and is translated in all seven languages', async () => {
  const english = await read('en-US');
  assert.equal(userFacingKeys.length, 48);
  for (const locale of locales) {
    const content = await read(locale);
    for (const key of userFacingKeys) {
      const value = get(content, key);
      assert.ok(typeof value === 'string' && value.trim(), `${locale} missing ${key}`);
      if (locale !== 'en-US') {
        assert.notEqual(value, get(english, key), `${locale} left ${key} in English`);
      }
    }
  }
});

test('public copy explains actions without displaying internal implementation jargon', async () => {
  const keyPaths = [
    'site_pages.about.sections.playback.body',
    'site_pages.statistics.description',
    'site_pages.statistics.method_body',
    'site_pages.contact.sections.bug.body',
    'site_pages.privacy.sections.logs.body',
    'site_pages.terms.sections.availability.body',
  ];
  for (const locale of locales) {
    const translation = await read(locale);
    for (const key of keyPaths) {
      assert.doesNotMatch(get(translation, key), /\bHLS\b|\bfallback\b|\bcatalog\b|\bmetadata\b|\bCDN\b|\bConsole\b|\bNetwork\b|\bbuild.time\b|\bAPI\b/i,
        `${locale}: technical language in ${key}`);
    }
    const radioOption = get(translation, 'player.source_number');
    assert.match(radioOption, /\{number\}/, `${locale}: player source interpolation lost`);
  }
});

test('cookie notice stays factual about automatic GA4 instead of promising opt-in', async () => {
  for (const locale of locales) {
    const content = await read(locale);
    assert.match(get(content, 'cookie_consent.analytics_body'), /Google Analytics 4/);
    assert.match(get(content, 'site_pages.cookie.sections.analytics.body'), /Google Analytics 4/);
    assert.equal(typeof get(content, 'cookie_consent.accept'), 'string');
    assert.equal(get(content, 'cookie_consent.allow_analytics'), undefined);
  }
});

test('existing translation keys retain their original meanings', async () => {
  const english = await read('en-US');
  const vietnamese = await read('vi-VN');
  assert.equal(english.panel.updating, 'Updating...');
  assert.equal(vietnamese.panel.updating, 'Đang cập nhật...');
  assert.equal(english.player.source, 'Stream source');
  assert.equal(vietnamese.player.source, 'Nguồn phát');
  assert.equal(english.player.stream_format, 'Stream');
  assert.equal(vietnamese.player.stream_format, 'Luồng phát');
  for (const locale of locales) {
    const content = await read(locale);
    for (const key of ['search.loading', 'library.loading', 'player.schedule_loading']) {
      assert.ok(get(content, key), `${locale}: missing context-specific loading key ${key}`);
    }
  }
});

test('search, library, schedule and station-empty messages use the right translation keys', async () => {
  const [search, library, queue, stations, realtime] = await Promise.all([
    readFile('components/search/Box.vue', 'utf8'),
    readFile('pages/library.vue', 'utf8'),
    readFile('components/player/Queue.vue', 'utf8'),
    readFile('components/panel/Station.vue', 'utf8'),
    readFile('composables/useStationRealtime.ts', 'utf8'),
  ]);
  assert.equal((search.match(/search\.loading/g) || []).length, 2);
  assert.doesNotMatch(search, /panel\.updating/);
  assert.match(library, /library\.loading/);
  assert.match(queue, /scheduleLoading[^\n]*player\.schedule_loading/);
  // Missing playlist metadata can still legitimately be "updating".
  assert.match(queue, /panel\.updating/);
  assert.match(realtime, /panel\.updating/);
  assert.match(stations, /panel\.no_channels/);
  assert.doesNotMatch(stations, /panel\.updating/);
});

test('unavailable radio text explains the problem and next steps in each language', async () => {
  const titles = {
    'en-US': "If you can't listen to a radio station",
    'vi-VN': 'Khi không nghe được radio',
    'ja-JP': 'ラジオが聴けないとき',
    'zh-CN': '无法收听广播时',
    'zh-TW': '無法收聽廣播時',
    'fr-FR': "Si vous n'arrivez pas à écouter une station",
    'ru-RU': 'Если не удаётся слушать радио',
  };
  for (const locale of locales) {
    const content = await read(locale);
    assert.equal(get(content, 'site_pages.terms.sections.availability.title'), titles[locale]);
    assert.ok(get(content, 'site_pages.terms.sections.availability.body').length > 40);
  }
});
