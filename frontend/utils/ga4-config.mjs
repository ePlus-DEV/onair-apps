/**
 * Enable GA4 only for the canonical production origin. No GA4 on staging.
 *
 * Check BOTH the build origin and the browser hostname: preview deployments
 * may be built with NODE_ENV=production (and even production SITE_URL).
 * Bootstrap in the HTML head so that the initial page_view does not depend on
 * Nuxt hydration. Enhanced Measurement handles SPA history page views.
 */
export const GA4_MEASUREMENT_ID = 'G-ETDY41KBBJ';

export function isGa4ProductionBuild({ nodeEnv = '', siteUrl = '' } = {}) {
  if (nodeEnv !== 'production') return false;
  try {
    const url = new URL(String(siteUrl));
    return url.origin === 'https://radio.eplus.dev'
      && (url.pathname === '/' || url.pathname === '')
      && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/**
 * One official gtag.js installation per HTML document, before Nuxt hydration.
 * The hostname check also protects production-built PR previews.
 *
 * gtag('config') sends the initial page_view; GA4 Enhanced Measurement sends
 * history-based page_view events on SPA navigation. Avoid another manual
 * page_view emitter or a second gtag.js installation.
 */
export function getGa4HeadScripts(enabled) {
  if (!enabled) return [];
  return [{
    key: 'onair-ga4-bootstrap',
    textContent: [
      '(function () {',
      "  if (window.location.hostname !== 'radio.eplus.dev') return;",
      '  window.dataLayer = window.dataLayer || [];',
      '  window.gtag = function () { window.dataLayer.push(arguments); };',
      "  window.gtag('js', new Date());",
      `  window.gtag('config', '${GA4_MEASUREMENT_ID}');`,
      "  var tag = document.createElement('script');",
      '  tag.async = true;',
      `  tag.src = 'https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}';`,
      '  document.head.appendChild(tag);',
      '}());',
    ].join('\n'),
  }];
}
