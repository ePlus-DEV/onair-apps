import { useOnlineDurationStore } from '~/stores/onlineDuration';
import { createOnlineDurationTracker, ONLINE_IDLE_MS } from '~/utils/online-duration.mjs';

/**
 * Run once in the global app shell, not on routed pages or in the audio player.
 * A foreground, focused, connected browser tab counts as online even if audio is paused.
 * Radio can keep playing in a hidden tab without adding online presence time.
 */
export function useOnlinePresence() {
  const online = useOnlineDurationStore();
  let cleanup: (() => void) | null = null;
  onMounted(() => {
    online.hydrate();
    const tracker = createOnlineDurationTracker({
      onDuration: (ms: number, endDate: Date) => online.record(ms, endDate),
    });
    let ticks = 0;
    let lastEngagementAt = performance.now();
    const eligible = () => online.enabled && navigator.onLine
      && document.visibilityState === 'visible' && document.hasFocus();
    const sync = () => {
      if (!eligible() || performance.now() - lastEngagementAt >= ONLINE_IDLE_MS) {
        if (online.enabled) tracker.stop();
        else tracker.discard();
      } else tracker.start();
      online.setLivePreview(tracker.pendingMs);
    };
    const activity = () => {
      if (!eligible()) return;
      lastEngagementAt = performance.now();
      tracker.activity();
    };
    const reset = () => {
      tracker.discard();
      online.setLivePreview(0);
      sync();
    };
    const tick = () => {
      sync();
      ticks += 1;
      if (ticks % 5 === 0) tracker.flush();
      online.setLivePreview(tracker.pendingMs);
    };
    const onChange = () => sync();
    const onForeground = () => {
      if (eligible()) activity();
      sync();
    };
    const onPageHide = () => { tracker.stop(); online.setLivePreview(0); };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);
    for (const name of ['blur', 'online', 'offline']) window.addEventListener(name, onChange);
    for (const name of ['pointerdown', 'keydown', 'touchstart', 'scroll']) window.addEventListener(name, activity, { passive: true });
    window.addEventListener('radio:online-duration-reset', reset);
    window.addEventListener('pagehide', onPageHide);
    const timer = window.setInterval(tick, 1000);
    sync();
    cleanup = () => {
      window.clearInterval(timer);
      tracker.stop();
      online.setLivePreview(0);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
      for (const name of ['blur', 'online', 'offline']) window.removeEventListener(name, onChange);
      for (const name of ['pointerdown', 'keydown', 'touchstart', 'scroll']) window.removeEventListener(name, activity);
      window.removeEventListener('radio:online-duration-reset', reset);
      window.removeEventListener('pagehide', onPageHide);
    };
  });
  onBeforeUnmount(() => cleanup?.());
}
