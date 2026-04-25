# Claude Code Handoff

## Sentry

Sentry React Native has been added for the Expo Router app.

- Installed `@sentry/react-native` with `npx expo install`, currently pinned by Expo to `~7.11.0`.
- Added the Expo config plugin in `app.json` via the installer.
- Added `metro.config.js` using `getSentryExpoConfig(__dirname)` so source maps include Sentry metadata.
- Initialized Sentry in `app/_layout.tsx` with error monitoring, tracing, profiling, session replay, logs, React Navigation instrumentation, and native frames tracking guarded for Expo Go.
- Wrapped the root layout with `Sentry.wrap(RootLayout)`.
- Forwarded the existing `AppErrorBoundary` errors to `Sentry.captureException`.

Required environment/secrets:

- `EXPO_PUBLIC_SENTRY_DSN` for runtime event capture.
- `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` for release/source-map uploads in local native builds or EAS/CI.
- Keep `SENTRY_AUTH_TOKEN` in local or CI/EAS secrets only. Do not commit it.

Verification:

- Run `npm test -- --runTestsByPath __tests__/features/validators.test.ts` or the full `npm test` for repo health.
- Start a native/dev build after setting `EXPO_PUBLIC_SENTRY_DSN`.
- Trigger `Sentry.captureException(new Error('Sentry smoke test'))` from a temporary button or console path and confirm it appears in Sentry Issues.
- Session Replay, native crashes, native frames, and TTID need a native build; Expo Go is limited.
