/**
 * Browser-tab/site titles are environment-specific; production SEO stays the
 * original ePlus OnAir title unless explicitly configured by its environment.
 * Use the exact host, not a branch name or NODE_ENV (prerender uses production).
 */
export function resolveDeploymentSiteName({
  siteUrl = '',
  configuredName = '',
  isPrPreview = false,
} = {}) {
  const configured = String(configuredName || '').trim();
  if (configured) return configured;

  if (isPrPreview) return 'ePlus OnAir — Preview';

  let host = '';
  try { host = new URL(String(siteUrl)).hostname.toLowerCase(); } catch {}

  if (host === 'preview.radio.eplus.dev') return 'ePlus OnAir — Preview';
  if (['stg.radio.eplus.dev', 'new-radio.eplus.dev', 'radio-new.eplus.dev'].includes(host)) {
    return 'ePlus OnAir — Staging';
  }
  return 'ePlus OnAir';
}
