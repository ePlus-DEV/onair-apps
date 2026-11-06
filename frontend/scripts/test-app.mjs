import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Product checks applicable to the app; web deployment and SEO are separate.
const prefixes = [
  'country-station-', 'featured-station-', 'global-radio-player-', 'i18n-translation-',
  'library-', 'listener-', 'listening-', 'mobile-', 'playback-', 'player-', 'queue-station-',
  'restore-selected-', 'sidebar-library-', 'sleep-timer', 'station-modal-',
  'station-navigation', 'station-polling', 'station-prefetch-', 'station-realtime-',
  'station-route-', 'station-schedule', 'station-search', 'vietnam-schedules',
];
const files = readdirSync('tests').filter(name => name.endsWith('.test.mjs') && prefixes.some(prefix => name.startsWith(prefix)))
  .map(name => `tests/${name}`);
if (!files.length) throw new Error('No app tests found');
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
