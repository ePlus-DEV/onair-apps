import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('station modal uses document-root semantic theme palette because Nuxt UI teleports it', async () => {
  const [stats, css] = await Promise.all([
    read('components/panel/ListeningStats.vue'),
    read('assets/css/main.css'),
  ]);
  assert.match(stats, /<UModal v-model:open="allStationsOpen"/);
  assert.match(stats, /radio-station-stats-modal max-w-3xl/);
  assert.match(stats, /radio-station-stats-overlay/);
  assert.match(css, /--radio-station-dialog-bg: #ffffff/);
  assert.match(css, /--radio-station-dialog-bg: #1b2238/);
  assert.match(css, /--radio-station-dialog-field: #f1f5f9/);
  assert.match(css, /--radio-station-dialog-field: #121a2e/);
  assert.match(css, /\.radio-station-stats-modal\s*\{/);
  assert.match(css, /\.radio-station-stats-modal \.stats-station-input\s*\{/);
  assert.match(css, /\.radio-station-stats-modal \.stats-ranking-row:hover/);
  assert.match(css, /\.radio-station-stats-modal \.stats-track/);
  assert.match(css, /\.radio-station-stats-modal \.stats-progress/);
});

test('modal remains accessible, paginated and fully translated without touching local data', async () => {
  const stats = await read('components/panel/ListeningStats.vue');
  assert.match(stats, /:description="\$t\('online_stats\.station_all_description'\)"/);
  assert.match(stats, /type="search"/);
  assert.match(stats, /stationPageData\.items/);
  assert.match(stats, /stationPageData\.totalPages > 1/);
  assert.match(stats, /stationPageData\.hasNext/);
  assert.match(stats, /stationPageData\.hasPrevious/);
  assert.match(stats, /online_stats\.station_search/);
  assert.match(stats, /online_stats\.station_sort/);
  assert.match(stats, /<template #body>/);
  assert.doesNotMatch(stats, /duration\.stats\.byStation\s*=/);
});
