import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stationCountryKey, queueCountryKey } from '../utils/queue-station-country.mjs';

const featured = [
  { id: 'vov-gt-hcm', url: '/asia/viet-nam/vov-gt-hcm', title: 'VOV Giao Thông TP.HCM' },
  { id: 'heart-uk', url: '/europe/united-kingdom/heart-uk', title: 'Heart UK' },
  { id: 'power', url: '/asia/singapore/power', title: 'Power 98 Love Songs' },
];

test('queue country names are derived per station, not the currently playing station', () => {
  assert.equal(stationCountryKey(featured[0].url), 'world.asia.viet_nam');
  assert.equal(stationCountryKey(featured[1].url), 'world.europe.united_kingdom');
  assert.equal(stationCountryKey(featured[2].url), 'world.asia.singapore');
  assert.equal(queueCountryKey(featured), '', 'a mixed-country queue cannot carry a Vietnam badge');
});

test('country queue badge is shown only for a homogeneous and valid queue', () => {
  assert.equal(queueCountryKey([featured[0]]), 'world.asia.viet_nam');
  assert.equal(queueCountryKey([featured[1], featured[1]]), 'world.europe.united_kingdom');
  assert.equal(queueCountryKey([]), '');
  assert.equal(queueCountryKey([{ id: 'missing-url' }]), '');
  assert.equal(queueCountryKey([featured[0], { id: 'missing-url' }]), '');
  assert.equal(stationCountryKey(undefined), '');
  assert.equal(stationCountryKey('https://example.com/asia/viet-nam/vov-gt-hcm'), '');
  assert.equal(stationCountryKey('/asia/viet-nam'), '');
  assert.equal(stationCountryKey('/asia/viet-nam/vov-gt-hcm?source=featured'), 'world.asia.viet_nam');
});

test('Global Apple queue labels resolve to provider, never a bogus country translation', () => {
  const entries = [
    { url: '/global-radio/apple-music/apple-music-1' },
    { url: '/global-radio/apple-music/apple-music-hits' },
  ];
  assert.equal(stationCountryKey(entries[0].url), 'global_radio.title');
  assert.equal(queueCountryKey(entries), 'global_radio.title');
  assert.equal(queueCountryKey([entries[0], featured[0]]), '');
  assert.equal(stationCountryKey('/global-radio/apple-music/'), '');
});

test('queue UI renders individual country labels and uses route URL for active station', async () => {
  const [queue, player, homepage, en, vi] = await Promise.all([
    readFile('components/player/Queue.vue', 'utf8'),
    readFile('components/player/Player.vue', 'utf8'),
    readFile('pages/index.vue', 'utf8'),
    readFile('lang/en-US.json', 'utf8'),
    readFile('lang/vi-VN.json', 'utf8'),
  ]);
  assert.match(queue, /stationCountryLabel\(station\)/);
  assert.match(queue, /queueCountryKey\(props\.stations\)/);
  assert.match(queue, /v-if="queueCountryLabel"/);
  assert.doesNotMatch(queue, /\{\{ countryName \|\| stationName \}\}/);
  assert.match(queue, /station\.url === props\.activeStationUrl/);
  assert.equal((player.match(/:active-station-url="stationUrl"/g) || []).length, 2,
    'desktop and mobile queue must use full station URL');
  assert.match(homepage, /selectHomepageFeaturedStations/);
  const english = JSON.parse(en), vietnamese = JSON.parse(vi);
  assert.equal(english.world.europe.united_kingdom, 'United Kingdom');
  assert.equal(english.world.asia.singapore, 'Singapore');
  assert.equal(vietnamese.world.asia.viet_nam, 'Việt Nam');
});
