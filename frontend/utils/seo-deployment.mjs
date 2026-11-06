/**
 * Non-production indexability is controlled by build configuration.
 * Recognized staging and development preview hosts also fail closed to
 * noindex if a build accidentally omits NUXT_PUBLIC_NO_INDEX.
 * Production remains indexable when promoted from develop to main.
 */
export function isStagingDeployment({ siteUrl = "", noIndex = "" } = {}) {
  const enabled = /^(?:true|1|yes|on)$/i.test(String(noIndex).trim());
  let stageHost = false;
  try {
    const host = new URL(String(siteUrl)).hostname.toLowerCase();
    stageHost = host === "stg.radio.eplus.dev" || host === "new-radio.eplus.dev" || host === "radio-new.eplus.dev" || host === "preview.radio.eplus.dev";
  } catch { /* Explicit noindex flag remains sufficient without a valid origin. */ }
  return enabled || stageHost;
}
