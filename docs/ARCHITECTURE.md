# Architecture and release gates

- The application frontend and its catalog are maintained in `frontend/` in this repository.
- Catalog data and the OnAir logo are bundled. Station and country artwork under `/img/` is fetched from the public OnAir host; artwork requires connectivity.
- Mobile: Capacitor 7 shell. Desktop: Tauri 2 shell. Both consume `dist/web` generated from the canonical Nuxt app.
- Current web app uses SSR/prerender and client-side HLS. `generate:site` is a **prototype export**, not a validated native application build. Deep-link routes, static asset paths and service availability must be verified.
- Android uses a Media3 playback service, HLS decoder and media session, with the UI tracking playback state through a Capacitor bridge. Its background playback and interruptions still require device verification. iOS continues to use HTML Audio and has no verified native background playback.
- Never start audio on initial load. Only explicit listener intent can initiate playback.
- Preserve source fallback ordering, bounded retries, signed URL expiry and the existing Apple/TuneIn restrictions.
- Do not alter web SEO, GA4, canonical tags, station URLs or production deployment in this repository.
- App-specific persistence must not imply cross-device sync. Offline UI does not mean offline live radio.
- Some catalog stations provide only HTTP streams; Android allows cleartext traffic so those stations can be attempted. Their traffic is not encrypted.
- Optional public CORS, provider resolver and Zing endpoint settings can be supplied as `NUXT_PUBLIC_*` environment variables when generating the app; the Android workflow reads matching repository variables. Empty settings leave dependent provider metadata or playback unavailable. Never put private credentials in these public values.
- Do not release unsigned/unverified installers or commit certificates, provisioning profiles or API keys.

## Local development

1. Clone `onair-apps`.
2. Run `npm ci` in both the repository root and `frontend/`.
3. Run `npm run sync:web` to generate the static frontend bundle.
4. Mobile: native projects are tracked in `android/` and `ios/`. Run `npx cap sync` after generating the bundle, then open them with Android Studio or Xcode. Real-device verification is required. The generated launcher art is a placeholder, not final branding.
5. Desktop: install Rust and Tauri platform prerequisites; run `npm run desktop`. Confirm generated bundle, deep links and audio before packaging.

## Acceptance criteria before production

- Android/iOS physical-device MP3, AAC and HLS playback; lock screen, background, Bluetooth/headset and resume after interruption.
- Windows/macOS/Linux playback, media keys, sleep timer, minimize/restore and tray lifecycle.
- App navigation, search, favorites, translations, theme, artwork and links match canonical web.
- No stream-token leakage, unexpected autoplay, stale HLS resume or duplicated audio engine.
- Signing, icons, platform privacy declarations, third-party stream rights and distribution review.
