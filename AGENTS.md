# Project instructions

These rules apply to the entire repository. Read the README and `docs/ARCHITECTURE.md` before changing platform behavior.

## Scope and sources

- This repository owns its app frontend and catalog in `frontend/`; do not assume changes to `radio.eplus.dev` are automatically synchronized here or vice versa.
- Check the relevant platform implementation before claiming parity or support. Android is under development; iOS and desktop are not validated production apps.
- Prefer focused changes on a branch and a reviewable PR. Preserve unrelated user changes and do not rewrite branch history.
- Update the README or architecture notes when changing setup, platform capabilities, behavior, build, or release steps. Describe limitations and actual validation accurately.

## UI and accessibility

- Design for real app screens in portrait and landscape, including small screens and system insets. Ensure player, navigation, dialogs and controls do not overlap, clip, or obstruct touch targets.
- Keep the established OnAir colors, typography, icons and brand assets unless a redesign is requested. Do not remove or silently change the existing font configuration during a refactor.
- Preserve dark and light themes, keyboard and screen-reader labels, focus visibility and natural translations in all supported locales. Add locale keys consistently; do not hard-code English or Vietnamese UI strings.
- Do not claim visual or device verification without actually checking it. Record screen sizes and untested scenarios in the PR.

## Playback and data

- Keep one authoritative playback engine and synchronize UI state with native playback. Do not autoplay on launch or reload without explicit listener intent.
- Preserve background audio, media-session controls, interruptions, source fallback, bounded retries, playback restoration and listening-time semantics when touching audio.
- Never include signed stream URLs, session tokens or credentials in logs, analytics, screenshots or public artifacts. Respect existing provider restrictions.
- Preserve local favorites, history and settings unless an intentional migration is supplied. Local storage is not cross-device sync; bundled station data does not make live streams available offline.
- Android currently allows HTTP for catalog streams that require it. Do not broaden network access, permissions, exported components or cleartext policy without a documented need and review.
- `NUXT_PUBLIC_*` values are embedded in the app and are public; never put secrets in them. Keep keys, keystores and provisioning files out of git.

## Build, checks and release

- Use Node.js 26.13.0 LTS, pinned consistently in CI and `frontend/package.json`; review upgrades to the latest stable LTS and validate builds before updating, install dependencies with `npm ci` in root and `frontend/`, and respect both lockfiles.
- Generate app assets with `npm run sync:web` at the root before `npx cap sync android`; edit source files rather than generated output.
- Run checks relevant to the change: `npm run check` in the root, `npm run test:app` in `frontend/`, and Android build/unit and emulator checks for native or app integration changes. Run UI checks when layout or interaction changes; test small portrait and landscape sizes and disclose physical-device gaps.
- Do not weaken or skip a failing check to make CI green. Investigate failures, distinguish flaky infrastructure from application defects, and state any unresolved issue.
- GitHub Actions artifacts download as ZIP. The opt-in Android workflow can publish a debug APK as a prerelease after checks pass; it is for testing, not a production-signed release.
- Do not publish a production build before the release gates in `docs/ARCHITECTURE.md` are met, including signing and real-device validation.
