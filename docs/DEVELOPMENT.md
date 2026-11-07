# Development notes

## Current platform status

- Android uses the native Media3 service and a Capacitor bridge. CI builds a debug APK and exercises startup, playback and selected interactions on an emulator. Test actual streams, long background sessions, audio interruptions, Bluetooth and lock-screen controls on physical devices before considering production.
- iOS and desktop projects exist, but their playback, platform integration and distribution are not validated to the same extent. Do not describe them as production-ready.
- The app has a launch splash with the OnAir logo. A first-run welcome/onboarding flow has not been established as a current feature; verify the implementation before documenting one.

## Build and downloads

The authoritative commands and requirements are in the [README](../README.md). The mobile frontend build sets `ONAIR_NATIVE_APP=true`, generates into `frontend/.output/public` and copies it to `dist/web` before Capacitor sync. Run the sync again after changing frontend assets.

The manually triggered Android workflow can publish a **debug prerelease** with a directly downloadable APK after the build and emulator checks pass. Actions artifacts are ZIP archives and have a seven-day retention. Debug APKs use a debug signing key; successive CI builds may have different signatures and may require uninstalling an earlier build before installing another. Uninstalling may remove local app data. A production release requires a separately managed signing process.

## Configuration and connectivity

The station catalog is bundled. Station artwork is fetched from the public OnAir host, and live radio requires a network connection. Optional public endpoint variables are listed in [architecture notes](ARCHITECTURE.md); their values are compiled into the client and must not contain secrets.

## CI troubleshooting

If a workflow fails, inspect the failed job and its logs and distinguish build failures from emulator or application failures. A previous Android run passed the build but failed a VOV search assertion and later reported an app input timeout; a rerun passed. The underlying intermittent cause was not confirmed. Do not assume a rerun alone fixes it; retain diagnostics and investigate repeated failures.

For UI changes, verify the smallest supported portrait and landscape viewports, touch targets, system bars, player and menu stacking, both themes and translations. Automated emulator checks do not substitute for testing on a physical phone.
