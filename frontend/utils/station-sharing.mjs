import { stationIdentity } from './listening-library.mjs';

export function stationShareUrl(path) {
  if (!stationIdentity({ url: path, title: 'station' })) return '';
  // Share the public station page, never the current route, stream or autoplay intent.
  return `https://radio.eplus.dev${path}`;
}

export function stationReportUrl(path, title, reason) {
  const url = stationShareUrl(path);
  if (!url) return '';
  const params = new URLSearchParams({
    title: `Station playback problem: ${String(title || '').slice(0, 150)}`,
    body: `Station: ${url}\nObserved state: ${reason}\n\nPlease describe what happened, your browser/device, and whether another source worked.\n\n`,
  });
  return `https://github.com/ePlus-DEV/radio.eplus.dev/issues/new?${params}`;
}

export async function shareStation({ url, title }, browser) {
  if (!url) return 'failed';
  if (browser.share) {
    try { await browser.share({ url, title }); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  try {
    if (!browser.clipboard?.writeText) return 'manual';
    await browser.clipboard.writeText(url);
    return 'copied';
  } catch { return 'manual'; }
}
