/**
 * iOS/iPadOS WebKit does not permit scripts to control HTMLMediaElement.volume.
 * Prefer device/Control Center guidance to a slider that cannot change audio.
 *
 * iPadOS desktop-class browsing reports MacIntel with a multi-touch screen.
 * This is a platform-specific capability guard, not a viewport-width check:
 * Android and desktop browsers keep the web volume slider.
 */
export function usesSystemVolumeControls(platform) {
  if (!platform) return false;
  const ua = String(platform.userAgent || "");
  return /iPad|iPhone|iPod/i.test(ua)
    || (platform.platform === "MacIntel" && Number(platform.maxTouchPoints) > 1);
}
