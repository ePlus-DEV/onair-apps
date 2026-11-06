import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('compact dashboard uses four KPI cards, full-width trend and separate top-station section', async () => {
  const component = await read('components/panel/ListeningStats.vue');
  const page = await read('pages/library.vue');

  assert.match(page, /library-title-icon/);
  assert.match(page, /radio-library-tabs/);
  assert.equal((component.match(/class="stats-kpi stats-kpi-/g) || []).length, 4);
  assert.match(component, /stats-kpi-listening/);
  assert.match(component, /stats-kpi-online/);
  assert.match(component, /stats-kpi-stations/);
  assert.match(component, /stats-kpi-favorite/);
  assert.doesNotMatch(component, /class="stats-mini /, 'no duplicated KPI row');
  assert.match(component, /stats-insights-stack/);
  assert.match(component, /class="stats-insights-stack flex min-w-0 flex-col gap-3"/);
  assert.match(component, /listeningWeekDelta !== null/);
  assert.match(component, /onlineWeekDelta !== null/);
  assert.match(component, /previous > 0 \? Math\.round/, 'no fabricated week growth without baseline');
  assert.match(component, /stations\.length/);
  assert.match(component, /stations\[0\]\.title/);
  assert.equal((component.match(/<svg /g) || []).length, 1, 'one combined chart');
});

test('chart keeps filtering, dual scales, hover, touch and accessible day inspection', async () => {
  const component = await read('components/panel/ListeningStats.vue');
  assert.match(component, /v-for="option in chartFilters"/);
  assert.match(component, /v-for="days in \[7, 30, 90\]"/);
  assert.match(component, /listeningGeometry\.areaPath/);
  assert.match(component, /onlineGeometry\.areaPath/);
  assert.match(component, /listeningGeometry\.linePath/);
  assert.match(component, /onlineGeometry\.linePath/);
  assert.match(component, /role="tooltip"/);
  assert.match(component, /@pointermove="onChartPointerMove"/);
  assert.match(component, /@pointerdown="onChartPointerDown"/);
  assert.match(component, /@keydown\.left\.prevent/);
  assert.match(component, /@keydown\.right\.prevent/);
  assert.match(component, /<details class="stats-day-inspector/);
  assert.match(component, /:value="selectedDayIndex" @input="selectDayAtIndex"/);
  assert.match(component, /formatDuration\(inspectedListeningMs\)/);
  assert.match(component, /formatDuration\(inspectedOnlineMs\)/);
  assert.match(component, /independent_scales/);
});

test('ranking uses real listening share, a bounded top three, and a paginated modal', async () => {
  const component = await read('components/panel/ListeningStats.vue');
  assert.match(component, /const stations = computed\(\(\) =>/);
  assert.match(component, /duration\.stats\.byStation/);
  assert.match(component, /stations\.slice\(0, 3\)/);
  assert.match(component, /stations\.length > 3/);
  assert.match(component, /allStationsOpen = true/);
  assert.match(component, /v-model:open="allStationsOpen"/);
  assert.match(component, /paginateListeningStations/);
  assert.match(component, /stationPageData\.items/);
  assert.match(component, /stationPageData\.totalPages > 1/);
  assert.match(component, /stationQuery/);
  assert.match(component, /stationSort/);
  assert.match(component, /stationPageData\.hasPrevious/);
  assert.match(component, /stationPageData\.hasNext/);
  assert.match(component, /stationImage\(station\.url\)/);
  assert.match(component, /formatStationShare\(station\.ms\)/);
  assert.match(component, /percentOfTotalStation\(station\.ms\)/);
  assert.match(component, /totalRankedMs\.value/);
  assert.match(component, /listening\.library\.recent/);
  assert.match(component, /listening\.library\.favorites/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /library\.listening_empty/);
  assert.match(component, /online_stats\.station_no_results/);
});

test('tracking and delete actions live in settings, not cluttering the trend chart', async () => {
  const [stats, settings] = await Promise.all([
    read('components/panel/ListeningStats.vue'), read('pages/settings.vue'),
  ]);
  assert.match(stats, /<NuxtLink to="\/settings"/);
  assert.doesNotMatch(stats, /setTrackingEnabled\(/);
  assert.doesNotMatch(stats, /clearStatistics\(/);
  assert.match(settings, /duration\.setTrackingEnabled/);
  assert.match(settings, /online\.setTrackingEnabled/);
  assert.match(settings, /duration\.clearStatistics\(\); online\.clearStatistics\(\)/);
  assert.match(settings, /<UModal/);
});

test('style remains route-scoped, container-aware, light/dark and reduced-motion safe', async () => {
  const [app, shell, stats, sidebar] = await Promise.all([
    read('app.vue'), read('assets/css/main.css'),
    read('components/panel/ListeningStats.vue'), read('components/AppSidebar.vue'),
  ]);
  assert.match(app, /'radio-stats-shell': clientReady && route\.path === '\/library' && route\.hash === '#stats'/);
  assert.match(shell, /html\.dark \.radio-shell\.radio-stats-shell/);
  assert.match(shell, /--radio-page-bg: #0e1228/);
  assert.match(stats, /container: listening-stats \/ inline-size/);
  assert.match(stats, /@container listening-stats \(min-width: 760px\)/);
  assert.match(stats, /:global\(html\.dark\) \.stats-kpi-listening/);
  assert.match(stats, /:global\(html\.dark\) \.stats-kpi-online/);
  assert.match(stats, /prefers-reduced-motion: reduce/);
  assert.match(sidebar, /redesign\.library/);
  assert.match(app, /<PlayerSession \/>/, 'player must remain global');
});

test('all seven locales include the reused dashboard and privacy labels', async () => {
  for (const lang of ['vi-VN', 'en-US', 'ja-JP', 'fr-FR', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const copy = JSON.parse(await read('lang/' + lang + '.json'));
    for (const key of [
      'weekly_activity', 'vs_previous_week', 'stations_played',
      'most_listened_station', 'listening_peak', 'online_peak', 'show_all', 'show_less',
      'compare_intro', 'manage_settings', 'independent_scales',
      'station_all_description', 'station_search', 'station_sort',
      'station_sort_most', 'station_sort_least', 'station_sort_name',
      'station_results', 'station_no_results', 'station_pagination',
      'station_previous', 'station_next', 'station_page',
    ]) {
      assert.ok(typeof copy.online_stats[key] === 'string' && copy.online_stats[key].trim(), lang + ': missing ' + key);
    }
    assert.ok(copy.listener_settings.privacy && copy.library.listening_stats, lang + ': missing privacy links');
  }
});
