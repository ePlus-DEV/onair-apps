# Architecture and release gates

- Canonical web source: `ePlus-DEV/radio.eplus.dev`. This repository packages a pinned checkout; never scrape the live website or duplicate catalogs.
- Mobile: Capacitor 7 shell. Desktop: Tauri 2 shell. Both consume `dist/web` generated from the canonical Nuxt app.
- Current web app uses SSR/prerender and client-side HLS. `generate:site` is a **prototype export**, not a validated native application build. Deep-link routes, static asset paths and service availability must be verified.
- Audio: HTML Audio + hls.js is **not** sufficient evidence of iOS/Android background playback. Native media-session/foreground-service adapters are required before store release. Never claim background playback is supported yet.
- Never start audio on initial load. Only explicit listener intent can initiate playback.
- Preserve source fallback ordering, bounded retries, signed URL expiry and the existing Apple/TuneIn restrictions.
- Do not alter web SEO, GA4, canonical tags, station URLs or production deployment in this repository.
- App-specific persistence must not imply cross-device sync. Offline UI does not mean offline live radio.
- Do not release unsigned/unverified installers or commit certificates, provisioning profiles or API keys.

## Local development

1. Clone `radio.eplus.dev` and `onair-apps` as sibling folders.
2. In the web checkout run `npm ci`. In this checkout run `npm install`.
3. Run `npm run sync:web` to generate the static frontend bundle.
4. Mobile: `npx cap add android --config apps/mobile/capacitor.config.ts` or `npx cap add ios --config apps/mobile/capacitor.config.ts`; then `npx cap sync --config apps/mobile/capacitor.config.ts`. Native project generation and real-device verification are required.
5. Desktop: install Rust and Tauri platform prerequisites; run `npm run desktop`. Confirm generated bundle, deep links and audio before packaging.

## Acceptance criteria before production

- Android/iOS physical-device MP3, AAC and HLS playback; lock screen, background, Bluetooth/headset and resume after interruption.
- Windows/macOS/Linux playback, media keys, sleep timer, minimize/restore and tray lifecycle.
- App navigation, search, favorites, translations, theme, artwork and links match canonical web.
- No stream-token leakage, unexpected autoplay, stale HLS resume or duplicated audio engine.
- Signing, icons, platform privacy declarations, third-party stream rights and distribution review.
