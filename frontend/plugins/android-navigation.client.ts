import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

export default defineNuxtPlugin(() => {
  if (Capacitor.getPlatform() !== 'android') return;

  const router = useRouter();
  App.addListener('backButton', ({ canGoBack }) => {
    // Give open dialogs and popovers a chance to close before leaving a page.
    if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    if (canGoBack) router.back();
    else void App.minimizeApp();
  });

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>('a[target="_blank"][href]');
    if (!link || link.hasAttribute('download')) return;
    let url: URL;
    try { url = new URL(link.href, window.location.href); } catch { return; }
    if (!['https:', 'http:'].includes(url.protocol)) return;
    event.preventDefault();
    void Browser.open({ url: url.href });
  }, true);
});
