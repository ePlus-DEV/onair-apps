import { isStagingDeployment } from './seo-deployment.mjs';

export function stationOgDeployment({
  siteUrl = process.env.NUXT_PUBLIC_SITE_URL,
  noIndex = process.env.NUXT_PUBLIC_NO_INDEX,
  skip = process.env.ONAIR_SKIP_STATION_OG,
  baseUrl = process.env.NUXT_PUBLIC_STATION_OG_BASE_URL || '',
} = {}) {
  if (baseUrl) {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('Station OG base URL must be a public HTTPS directory URL');
    }
    return { mode: 'external', baseUrl: url.href.replace(/\/$/, '') };
  }
  return {
    mode: skip === 'true' || isStagingDeployment({ siteUrl, noIndex }) ? 'shared' : 'generated',
    baseUrl: '',
  };
}

export function stationSocialImage({ mode, baseUrl = '', origin, imagePath }) {
  if (mode === 'shared') return { url: origin + '/brand/social-preview.png', type: 'image/png' };
  if (mode === 'external') return { url: baseUrl + imagePath, type: 'image/jpeg' };
  if (mode === 'generated') return { url: origin + imagePath, type: 'image/jpeg' };
  throw new Error('Invalid station OG mode: ' + mode);
}
