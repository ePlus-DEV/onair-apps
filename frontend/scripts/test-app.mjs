import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Product checks applicable to the app; web deployment and SEO are separate.
const prefixes = [
  'app-redesign', 'app-shell', 'brand-onair', 'breadcrumbs', 'catalog-performance',
  'daisyui-removal', 'fontawesome-icons', 'global-radio-isolated-play-', 'global-radio-provider',
  'global-radio-tunein-history', 'hls-song-metadata', 'home-layout-', 'home-redesign', 'language-dropdown',
  'live-track', 'local-duration-snapshot', 'markup-text-security', 'media-session-featured',
  'music-cards', 'navigation-ui', 'online-duration', 'page-skeletons', 'performance-ui',
  'personal-radio', 'plain-language-copy', 'radio-source-plan', 'sidebar-light-theme', 'surprise-radio',
  'theme-consistency', 'theme-palette', 'vov-stream-fallback',
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
