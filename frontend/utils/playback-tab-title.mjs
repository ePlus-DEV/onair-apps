// Only the active browser tab's title changes; SSR/prerender SEO stays route-specific.
// Prefer current-song metadata where the provider supplies it, otherwise show the station.
export function buildPlaybackTitleTemplate(activeStationTitle, siteName, liveTrack = null) {
  const brand = String(siteName || 'ePlus OnAir').trim() || 'ePlus OnAir';
  const station = String(activeStationTitle || '').trim();
  if (!station) return `%s | ${brand}`;

  const title = typeof liveTrack?.title === 'string' ? liveTrack.title.trim() : '';
  const artist = typeof liveTrack?.artist === 'string' ? liveTrack.artist.trim() : '';
  const label = title ? `${title}${artist ? ` — ${artist}` : ''} · ${station}` : station;
  return () => `▶ ${label} | ${brand}`;
}
