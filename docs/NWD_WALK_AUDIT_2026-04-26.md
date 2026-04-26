# NWD Walk Audit — 2026-04-26

Branch: `chore/refactor-bug-hunt`
Baseline: `npx tsc --noEmit` pass, `npm test` pass (12 suites, 150 tests) before changes.

Read first:
- `docs/NWD_E2E_AUDIT_2026-04-26.md`
- `CLAUDE.md`
- `git log --oneline -30 main`

Hard boundaries honored:
- Did not touch `app/auth/index.tsx`.
- Did not touch `app.json`, beta version constants, or DB schema.
- Did not add E2E runners or dependencies.

## Findings

### 1. First launch -> onboarding -> guest entry -> home -> trail -> practice

- P1 | `app/onboarding/index.tsx:109` | Repro: finish onboarding/GPS gate on a clean install. Root cause: onboarding still routes to `/auth`; the prior audit says this auth wall is intentionally not fixed in this pass. Suggested fix scope: 15-30 LOC in auth/onboarding routing. Status: wontfix=explicit instruction, `app/auth/index.tsx` untouched.
- P2 | `app/onboarding/index.tsx:126` | Repro: tap "Aktywuj GPS", navigate away while permission sheet is open. Root cause: `handleRequestPermission` sets state after an awaited permission call without a mounted/cancel guard. Suggested fix scope: 8-12 LOC. Status: planned.

### 2. First launch -> auth -> OTP -> profile/leaderboard

- P2 | `src/hooks/useBackend.ts:95` | Repro: switch leaderboard trail/scope quickly while one fetch is slow. Root cause: `useLeaderboard` has no request sequence or cancellation guard, so an older response can overwrite newer trail/scope rows. Suggested fix scope: 20-30 LOC plus hook test. Status: planned.
- P2 | `app/(tabs)/leaderboard.tsx:64` | Repro: leave leaderboard before `AsyncStorage.getItem('@nwd_selected_venue')` resolves. Root cause: the persisted venue effect calls `setSelectedVenueId` after an await-like promise with no cancellation. Suggested fix scope: 8-12 LOC. Status: planned.
- P2 | `app/(tabs)/leaderboard.tsx:50` | Repro: clean install. Root cause from prior audit was no default venue. Current `main` now picks the first active backend spot when available. Suggested fix scope: none. Status: already-fixed-on-main.

### 3. Practice run without login -> GPS unavailable/poor/good -> local result

- P2 | `src/features/permissions/useLocationPermission.ts:72` | Repro: mount permission hook then unmount during foreground permission request. Root cause: the initial effect is guarded, but `requestBackground` starts with `setState` before checking mounted state. Suggested fix scope: 5-8 LOC. Status: planned.
- P3 | `app/run/result.tsx:273` | Repro: saved result resolves before profile XP refresh. Root cause: haptic effect omits `isLevelUp` from deps and fires once, so level-up haptic can be missed even if the level-up card appears later. Suggested fix scope: 10-15 LOC. Status: planned.

### 4. Ranked run without Always Location -> block with correct CTA

- P3 | `app/run/active.tsx:143` | Repro: deny Always, open Settings, return. Root cause from older audits was stale permission state; current code refreshes on foreground and does not silently downgrade ranked to practice. Suggested fix scope: none. Status: already-fixed-on-main.

### 5. Ranked run online -> submit success -> result -> leaderboard refresh

- P2 | `src/systems/runSubmit.ts:174` | Repro: successful submit followed by progression failure. Root cause: progression errors are intentionally swallowed with `console.warn`; user still gets saved result, but Sentry does not capture repeated progression failures. Suggested fix scope: 10-15 LOC. Status: planned.
- P2 | `src/hooks/useBackend.ts:61` | Repro: tap result -> leaderboard while leaderboard fetch from previous trail is still in flight. Root cause: same stale fetch race as scenario 2. Suggested fix scope: 20-30 LOC. Status: planned.

### 6. Ranked run offline -> queued result -> kill app -> restart -> outbox -> reconnect

- P1 | `src/systems/runStore.ts:162` | Repro: create more than 15 finalized runs during a signal-dead weekend, with some `queued`/`failed`; restart. Root cause: retention sliced all runs together, so unsynced runs could be evicted from memory and persistence by saved history. Suggested fix scope: 40-60 LOC with tests. Status: patched=8cc0af4.
- P2 | `src/systems/saveQueue.ts:57` | Repro: restart with a legacy/recovered `offline` run that still has `userId`, `traceSnapshot`, and `verification`. Root cause: queue only retried `queued`/`failed`, while manual result retry allowed `offline`. Suggested fix scope: 20-30 LOC with tests. Status: patched=fa8d6c3.
- P1 | `src/systems/saveQueue.ts:35` | Repro: stay inside the app while network returns; do not background/foreground or tap manual retry. Root cause: queue initializes and listens to AppState, but no NetInfo/connectivity listener is installed. Suggested fix scope: 35-60 LOC; likely needs `@react-native-community/netinfo` or an Expo-supported network signal. Status: planned.

### 7. Pioneer: create spot offline -> queue -> reconnect -> visible success/reject

- P2 | `src/services/spotSubmission.ts:182` | Repro: submit spot offline, reconnect, backend returns duplicate/auth/validation reject. Root cause: hard rejects were dropped from the queue with only a debug event, so home outbox could disappear without a user-visible reason. Suggested fix scope: 60-90 LOC with tests. Status: patched=971d0f0.
- P3 | `src/services/spotSubmission.ts:129` | Repro: `api.submitSpot` throws for a non-network bug. Root cause: all throws are treated as offline and queued. Suggested fix scope: 15-25 LOC if API starts throwing typed errors. Status: planned.

### 8. Cold-start deep link `/run/result?runSessionId=...` before hydration

- P1 | `app/run/result.tsx:218` | Repro: deep-link into result before `hydrateRunStore()` resolves. Root cause from prior audit was synchronous read before hydration. Current code tracks `storeHydrated`, subscribes to store changes, and shows `Odtwarzam zjazd…` until hydration completes. Suggested fix scope: none. Status: already-fixed-on-main.
- P2 | `app/run/result.tsx:338` | Repro: tap manual retry, navigate away before `retryRunSubmit` resolves. Root cause: `handleRetrySave` updates retry state after await without mounted guard. Suggested fix scope: 10-15 LOC. Status: planned.

## Static Sweep

- setState after await: confirmed in `app/onboarding/index.tsx:126`, `app/run/result.tsx:338`, and several backend hooks in `src/hooks/useBackend.ts`. Patched none in this pass because higher-value queue data-loss bugs came first.
- Stale closures/deps: `app/run/result.tsx:273` misses `isLevelUp` in deps; `useLeaderboard` lacks in-flight request ordering.
- Dead code: `ts-prune` is not installed in `node_modules`; used `rg` only. No dead files deleted.
- TODO/FIXME: TODOs remain in `src/data/venues/index.ts:10`, `src/hooks/useBackend.ts:435`, `src/hooks/useVenueContext.ts:62`, `src/systems/runSubmit.ts:248`, and map components. They still describe larger DB/geometry work; not deleted.
- Duplicate logic across `src/systems/`: XP calculation is centralized in `src/systems/xp.ts`, but submit/retry still independently decide when to pass base XP vs snapshot XP. Status: partially fixed on main by XP snapshot; further backend idempotency planned.
- Swallowed errors: `src/lib/api.ts` has empty catches around optional cleanup/read paths; `src/systems/runSubmit.ts` warns on progression failure without Sentry. Status: planned for observability pass.
- Type holes: many `as any` casts remain in API mapping and RN style edge cases. No broad type refactor performed.
- Sentry: `app/_layout.tsx:81` captures ErrorBoundary crashes and wraps root. Queue/retry failure paths mostly use `logDebugEvent`, not `Sentry.captureException`; planned for user-hit network/progression failures after DSN smoke verification.

## Patch Log

- `8cc0af4` — `fix(run): preserve unsynced runs during retention`
- `fa8d6c3` — `fix(sync): retry recoverable offline runs`
- `971d0f0` — `fix(sync): surface rejected spot submissions`

## Verification

- After `8cc0af4`: `npx tsc --noEmit` pass; `npm test` pass (12 suites, 151 tests).
- After `fa8d6c3`: first test run exposed an incomplete test fixture; fixed fixture; `npx tsc --noEmit` pass; `npm test` pass (12 suites, 152 tests).
- After `971d0f0`: `npx tsc --noEmit` pass; `npm test` pass (12 suites, 152 tests).
