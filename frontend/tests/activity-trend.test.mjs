import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildActivityTrend } from '../utils/activity-trend.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('trend geometry uses daily values rather than cumulative totals', () => {
  const points = [
    { key: '2026-11-01', ms: 0 },
    { key: '2026-11-02', ms: 60_000 },
    { key: '2026-11-03', ms: 12_000 },
  ];
  const trend = buildActivityTrend(points);
  assert.equal(trend.maxMs, 60_000);
  assert.equal(trend.hasData, true);
  assert.equal(trend.points.length, 3);
  assert.equal(trend.points[1].y, 8, 'largest daily value reaches the top');
  assert.equal(trend.points[0].y, 88, 'zero daily value stays at baseline');
  assert.equal(trend.points[2].y, 72, 'daily total is positioned by its own scale');
  assert.match(trend.areaPath, /^M/);
  assert.match(trend.areaPath, /Z$/);
  assert.doesNotMatch(trend.linePath, /NaN|Infinity/);
});

test('zero, one-point and invalid samples do not break chart rendering', () => {
  const empty = buildActivityTrend([]);
  assert.equal(empty.hasData, false);
  assert.equal(empty.linePath, '');
  assert.equal(empty.areaPath, '');
  const zeros = buildActivityTrend([{ key: 'a', ms: 0 }, { key: 'b', ms: null }]);
  assert.equal(zeros.hasData, false);
  assert.equal(zeros.points[0].y, 88);
  assert.equal(zeros.points[1].y, 88);
  const single = buildActivityTrend([{ key: 'a', ms: 10 }]);
  assert.equal(single.points[0].x, 160);
  assert.equal(single.points[0].y, 8);
  const invalid = buildActivityTrend([{ key: 'a', ms: -4 }, { key: 'b', ms: Infinity }]);
  assert.equal(invalid.maxMs, 0);
  assert.doesNotMatch(invalid.linePath, /NaN|Infinity/);
});

test('large differences use independent scales so new online data stays visible', () => {
  const listening = buildActivityTrend([{ key: 'day1', ms: 3_600_000 }, { key: 'day2', ms: 900_000 }]);
  const online = buildActivityTrend([{ key: 'day1', ms: 7_000 }, { key: 'day2', ms: 1_000 }]);
  assert.equal(listening.maxMs, 3_600_000);
  assert.equal(online.maxMs, 7_000);
  assert.equal(listening.points[0].y, 8);
  assert.equal(online.points[0].y, 8);
});

test('statistics combines two independently scaled series in one interactive chart', async () => {
  const [ui, docs] = await Promise.all([
    read('components/panel/ListeningStats.vue'),
    read('docs/PROJECT_CONTEXT.md'),
  ]);
  assert.match(ui, /buildActivityTrend\(listeningTrend\.value, 800, 210\)/);
  assert.match(ui, /buildActivityTrend\(onlineTrend\.value, 800, 210\)/);
  assert.match(ui, /:d="listeningGeometry\.linePath"/);
  assert.match(ui, /:d="onlineGeometry\.linePath"/);
  assert.match(ui, /<svg v-if="visibleHasData"/);
  assert.equal((ui.match(/<svg /g) || []).length, 1, 'should display only one chart');
  assert.match(ui, /:aria-pressed="visibleMetric === option"/);
  assert.match(ui, /chartFilters: ChartFilter\[\] = \['both', 'listening', 'online'\]/);
  assert.match(ui, /v-for="days in \[7, 30, 90\]"/);
  assert.match(ui, /@pointermove="onChartPointerMove"/);
  assert.match(ui, /@pointerdown="onChartPointerDown"/);
  assert.match(ui, /role="tooltip"/);
  assert.match(ui, /inspectedDateKey/);
  assert.match(ui, /formatDuration\(inspectedListeningMs\)/);
  assert.match(ui, /formatDuration\(inspectedOnlineMs\)/);
  assert.match(ui, /@keydown\.left\.prevent="moveSelectedDay\(-1\)"/);
  assert.match(ui, /@keydown\.right\.prevent="moveSelectedDay\(1\)"/);
  assert.match(ui, /min="0" :max="Math\.max\(0, listeningTrend\.length - 1\)"/);
  assert.doesNotMatch(ui, /setTrackingEnabled\(/, 'privacy switches belong in Settings');
  assert.doesNotMatch(ui, /clearStatistics\(/, 'delete action belongs in Settings');
  assert.doesNotMatch(ui, /chartScroll|chartMode|ref="chartScroll"/);
  assert.match(docs, /Online presence time versus listening duration/);
});

test('combined chart retains accurate independent values and selected-day inspection', async () => {
  const ui = await read('components/panel/ListeningStats.vue');
  assert.match(ui, /listeningGeometry\.maxMs/);
  assert.match(ui, /onlineGeometry\.maxMs/);
  assert.match(ui, /selectedListeningMs/);
  assert.match(ui, /selectedOnlineMs/);
  assert.match(ui, /tooltipLeft/);
  assert.match(ui, /indexFromPointer/);
  assert.match(ui, /visibleMetric\.value !== 'online'/);
  assert.match(ui, /visibleMetric\.value !== 'listening'/);
});

test('seven translations have complete and distinct explanations', async () => {
  for (const locale of ['en-US', 'vi-VN', 'ja-JP', 'fr-FR', 'ru-RU', 'zh-CN', 'zh-TW']) {
    const copy = JSON.parse(await read('lang/' + locale + '.json')).online_stats;
    for (const key of ['compare_intro', 'manage_settings', 'listening_explanation',
      'online_explanation', 'new_counter_note', 'daily_compare', 'listening_trend',
      'online_trend', 'selected_day', 'select_day', 'independent_scales',
      'filter_both', 'filter_listening', 'filter_online', 'chart_tooltip_hint',
      'scale_max', 'chart_hover_label', 'combined_scales_note']) {
      assert.ok(typeof copy[key] === 'string' && copy[key].trim(), locale + ' missing ' + key);
    }
  }
});
