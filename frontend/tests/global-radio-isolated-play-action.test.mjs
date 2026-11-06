import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Global Radio only marks the selected station as connecting; other cards remain selectable', async () => {
  const page = await read('pages/global-radio/apple-music/index.vue');
  assert.match(page, /:disabled="!canListenOnEplus \|\| pendingStationId === station\.id"/);
  assert.match(page, /:aria-busy="pendingStationId === station\.id"/);
  assert.match(page, /pendingStationId === station\.id \? 'i-lucide-loader-circle'/);
  assert.match(page, /pendingStationId === station\.id \? 'global_radio\.connecting_on_eplus'/);
  assert.doesNotMatch(page, /:disabled="!canListenOnEplus \|\| Boolean\(pendingStationId\)"/,
    'one pending lookup must not disable every other station');
});

test('Global Radio station detail links stay discoverable without prefetching all seven routes', async () => {
  const page = await read('pages/global-radio/apple-music/index.vue');
  const links = page.match(/<NuxtLink\b[^>]*\/global-radio\/apple-music\/\$\{station\.id\}[^>]*>/g) || [];
  assert.equal(links.length, 2, 'station title and details links must remain real NuxtLinks');
  for (const link of links) assert.match(link, /:prefetch="false"/);
  assert.match(page, /v-for="station in provider\?\.stations \|\| \[\]"/);
});

test('one click resolves only its station; a later click can abort and replace the pending request', async () => {
  const composable = await read('composables/useAuthorizedGlobalRadioPlayback.ts');
  assert.match(composable, /async function play\(station: GlobalRadioStation\)/);
  assert.match(composable, /activeController\?\.abort\(\)/);
  assert.match(composable, /pendingStationId\.value = station\.id/);
  assert.match(composable, /resolvePublicTuneInStream\(\{ station, corsServer: corsServer\.value, signal: controller\.signal \}\)/);
  assert.match(composable, /if \(controller\.signal\.aborted \|\| !result\.ok\) return/);
  assert.match(composable, /playback\.activateGlobalRadio\(source, station\.listen_url, result\.expiresAt/);
  assert.doesNotMatch(composable, /Promise\.all\(/, 'should not resolve every catalog station in a batch');
});
