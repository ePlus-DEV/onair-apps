# ePlus OnAir Apps

Cross-platform application for [ePlus OnAir](https://radio.eplus.dev/). The app frontend and station catalog live in `frontend/` in this repository.

Android is under development. The debug build and emulator checks are for testing; a signed production release and physical-device validation are still required.

## Technology stack

| Area | Current implementation |
| --- | --- |
| App UI | Nuxt 4, Vue 3, TypeScript, Nuxt UI 4, Tailwind CSS 4 and Pinia; source in `frontend/` |
| Mobile shell | Capacitor 7; Android project in `android/` and iOS project in `ios/` |
| Android playback | Java, AndroidX Media3 ExoPlayer and MediaSession, connected to the UI via a Capacitor plugin |
| Desktop shell | Tauri 2; scaffold in `apps/desktop/` |
| Tooling | Node.js 24.15.0, npm, JDK 21, Android SDK / Gradle; see lockfiles for exact installed versions |
| Testing and CI | Node test runner, Android unit and instrumentation tests, and GitHub Actions emulator checks; Playwright is available for UI tests |

Android debug builds are tested in CI. iOS and desktop are scaffolds with additional implementation and device testing required; they are not production-ready releases. The frontend is maintained in this repository and its native build is generated into `dist/web` before Capacitor sync. See [architecture and release gates](docs/ARCHITECTURE.md) [development notes](docs/DEVELOPMENT.md), and [contributor rules](AGENTS.md).

## Repository layout

- `frontend/`: app UI, translations, radio catalog and frontend tests.
- `android/`, `ios/`: platform projects and Android native playback.
- `apps/desktop/`: desktop shell.
- `scripts/`, `tests/`: app build tooling and root checks.
- `docs/`: architecture, configuration and production acceptance criteria.

## Android development

1. Install Node 24 and JDK 21, then run `npm ci` at the repository root and in `frontend/`.
2. Run `npm run sync:web` at the root, followed by `npx cap sync android`.
3. Open `android/` in Android Studio or run the Gradle debug build with an Android SDK installed.

Run `npm run check` at the root and `npm test` in `frontend/` for app-focused checks. The copied website's deployment and SEO checks remain available separately as `npm run test:upstream-web`; some require website-only files. The Android workflow also builds the debug APK, runs Java tests, and checks startup and native playback on an emulator.

The catalog is bundled; station artwork uses the public OnAir host. Optional public CORS, Zing, and authorized-provider endpoints can be supplied through the `NUXT_PUBLIC_*` build environment variables described in [the architecture notes](docs/ARCHITECTURE.md).

### Download a debug APK

To publish a debug APK, open **Actions → Android debug build → Run workflow**, select the `main` branch, enable **Publish the tested debug APK as a GitHub prerelease**, and run it. Once the build and emulator checks pass, download `onair-debug.apk` directly from the new prerelease on the repository's Releases page. Each run creates a separate prerelease; this APK is signed with the Android debug key and is for testing only. GitHub Actions artifacts remain available as ZIP downloads for seven days.
