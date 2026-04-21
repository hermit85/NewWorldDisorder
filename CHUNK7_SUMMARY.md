# Chunk 7 — Background Location Recording

Branch: `feat/chunk7-background-location`
Target: `main` @ `c2eaf0c` (post Chunk 6 v3 merge + design polish)
Status: feature-complete, pending walk-test + App Store submission

## Mission

Enable Pioneer recording to survive the phone being in a pocket, on a
handlebar, or with the screen off. Walk-test v2 surfaced this as the
single biggest UX blocker for real MTB use — a rider on a gravity trail
cannot hold the phone and look at it simultaneously.

## Commit log

| SHA | Scope | Phase |
|---|---|---|
| `8876fdf` | chore(deps): install expo-task-manager ~55.0.15 | pre-2 |
| `39578f0` | feat(recording): 2-stage location permission + Always explainer | 2 |
| `e9abb87` | feat(recording): TaskManager background location | 3 |
| `82c9d3f` | chore(build): confirm pure Expo managed workflow | 3.5 Step 0 |
| `bb8adc4` | fix(recording): serialize AsyncStorage mutations + sessionId fencing | 3.5 Step 1 (C1+C2) |
| `fc7c16c` | fix(recording): propagate storage errors + abort start on fail | 3.5 Step 2 (S3) |
| `0cfc831` | fix(recording): monotonic timestamp ordering in appendSamples | 3.5 Step 3 (S2) |
| `209f04a` | fix(recording): preserve original startedAt on stop handoff | 3.5 Step 4 (S4) |
| `def50c6` | fix(recording): expose session metadata in peekRestorable | 3.5 Step 5 (N2) |
| `a50f3fa` | feat(recording): session resume prompt + AppState drain | 4 |
| `6f18100` | feat(recording): Always-denied fallback banner + Settings deep link | 5 |
| TBD | chore(recording): Phase 6 AppState permission refresh + verification sweep | 6 |

**11 commits** excluding the Phase 6 squash.

## LOC delta

| File | +/- |
|---|---|
| `app.json` | +6 / -3 |
| `app/_layout.tsx` | +8 / -0 |
| `app/run/recording.tsx` | +493 / -25 |
| `package.json` + `package-lock.json` | +21 / -0 |
| `src/features/permissions/useLocationPermission.ts` | +152 (new) |
| `src/features/recording/backgroundLocationTask.ts` | +110 (new) |
| `src/features/recording/recordingStore.ts` | +261 / -37 |
| `src/features/recording/useGPSRecorder.ts` | +392 / -174 |
| `src/features/recording/useGpsWarmup.ts` | +29 / -24 |

**Net branch total: ~+1498 / -237 LOC, 2 new files, 8 modified.**

## Architecture — what changed

### Before Chunk 7 (Sprint 3 + Chunk 6)

```
recording screen → useGPSRecorder hook
                     ↓
                   watchPositionAsync (foreground only)
                     ↓
                   bufferRef (useRef in React component)
                     ↓
                   recordingStore.saveBuffer every 10s
```

Recording died the moment the screen locked or the app backgrounded.
No resume after app kill. No signal to the rider that foreground was
required beyond a passive footer.

### After Chunk 7

```
App init (app/_layout.tsx)
    └→ backgroundLocationTask.ts side-effect import
         └→ TaskManager.defineTask(NWD_BACKGROUND_LOCATION, handler)

Recording screen
    ├→ useLocationPermission hook — 2-stage WIU/Always flow
    ├→ useGpsWarmup hook — pre-flight readiness (foreground only)
    └→ useGPSRecorder hook
         ├→ resume detection on mount → offer "Kontynuować?" prompt
         ├→ enterRecording / resumeSession
         │    └→ Location.startLocationUpdatesAsync
         │         └→ (headless) task handler
         │              └→ recordingStore.appendSamples
         │                   (mutex-serialised, sessionId-fenced)
         └→ drainToState on 500ms tick + AppState 'active' trigger
              └→ recordingStore.drainAndSettle
                   └→ React state → UI
```

### Preserved semantics from pre-Chunk-7

- 3s countdown → recording phase
- 30-min timeout + 5s grace + up to 3×10-min extensions
- Weak-signal hysteresis (>20m accuracy for 30s → flag)
- BufferedPoint shape unchanged
- Stop criteria (user tap / timeout / cancel / subscription error)
- Warmup hook stays on `watchPositionAsync` (foreground-only)
- Chunk 5 MotivationStack + Chunk 6 validators untouched

### New in Chunk 7

- iOS Always permission with contextual ask (explainer → prompt)
- iOS blue-bar indicator during background recording
- Background task survives app suspension, lock screen, pocket
- AsyncStorage buffer persistence with mutex + sessionId fencing
- Session resume prompt after app kill + relaunch
- Foreground-denied blocking UI with Settings deep link
- Always-denied non-blocking banner with Settings deep link
- Monotonic timestamp ordering + pre-start sample rejection
- Startup storage-failure surface with retry CTA

### Codex review hardening (Phase 3.5)

Five post-Phase-3 issues caught before they hit the rider:

- **C1** Mutation chain serialises all AsyncStorage writes
- **C2** sessionId fencing prevents cross-session buffer pollution
- **S2** Monotonic timestamp ordering rejects iOS backfill noise
- **S3** Storage errors propagate + surface retryable UI
- **S4** Original `startedAt` preserved through stop handoff

## Known limitations (Phase 7+ backlog)

1. **`src/systems/gps.ts` Rider flow still uses `watchPositionAsync`** —
   Chunk 7 scoped to Pioneer only. Rider flow (`app/run/active.tsx` via
   `useRealRun`) remains foreground-only. Separate chunk for parity.
2. **`distanceInterval: 5m` coarser than pre-Chunk-7's 2m haversine** —
   platform-native dedup replaces client-side. Chunk 6 validators
   satisfied but Sprint 6 Chunk 8 (route-progress gates) may need
   denser geometry; revisit then.
3. **Extension count not persisted** — a rider who extended to 50
   minutes, backgrounded, resumed, restarts at baseline 30-min budget.
   If real elapsed > 30 min, drops straight into grace. Correct
   behavior but not obvious to the rider.
4. **`peekRestorable` 1-hour age gate coincides with `MAX_EXTENSIONS`
   ceiling** — 60 min = 60 min. Theoretical edge where a 59:59
   recording stops mid-grace and can't be restored post-stop. In
   practice the task writes every 5m of movement, so `lastSavedAt`
   refreshes constantly; never observed. Flag for Sprint 5 if it
   surfaces.
5. **iOS Settings round-trip requires foreground return to refresh
   permission state** — handled by Phase 6 AppState.refresh wiring,
   but covers only the recording screen. Other screens (e.g. trail
   detail) don't re-read permission state on return; could confuse
   a rider who fixes Always from a non-recording screen. Low
   priority — Always denial UX is already explicit on recording.
6. **App Store review risk** — Always permission rejection rate is
   non-trivial. Submission notes (in separate file) justify
   ride-timer use-case + same-pattern-as-Strava-Garmin-Trailforks.

## Walk-test v3 checklist

Run on a real iPhone (simulator can't fake true background
location). Each scenario should be verified on a device, not just
the simulator.

### Permission flow

- [ ] First-launch recording screen → WIU prompt fires → accept → warm-up shows searching/warm/armed progression
- [ ] Tap START while armed → Always explainer modal appears → tap KONTYNUUJ → iOS Always prompt fires
- [ ] Accept Always → countdown → recording → iOS blue bar appears at top of screen
- [ ] Decline Always → countdown → recording → amber banner "NAGRYWANIE TYLKO GDY APKA OTWARTA" visible at top + USTAWIENIA button

### Background survival (Always granted)

- [ ] Recording → lock screen → wait 30s → unlock → timer advanced accurately + point count increased
- [ ] Recording → swipe to home screen → wait 30s → return to app → AppState fires drain → UI catches up without waiting 500ms tick
- [ ] Recording → phone in pocket, walk 100m → stop → review screen shows ~100m distance + reasonable polyline

### Foreground-only (Always denied)

- [ ] Banner visible throughout countdown + recording + timeout_grace
- [ ] Lock screen mid-recording → return 30s later → sample gap visible in polyline (expected, banner warned rider)
- [ ] Tap USTAWIENIA in banner → iOS Settings opens to NWD page → toggle Always → return to app → banner disappears (Phase 6 refresh)

### Session resume

- [ ] Start recording, capture ~50 samples, force-quit app via swipe-up
- [ ] Re-open app, navigate to same trail's recording screen
- [ ] "NIEDOKOŃCZONY ZJAZD" prompt appears with point count + age
- [ ] Tap KONTYNUUJ → resume; timer continues from original startedAt; new samples append to existing buffer
- [ ] Tap ODRZUĆ → buffer cleared, warm-up flow starts fresh

### Resume edge cases

- [ ] Mount recording screen for Trail A when a buffer for Trail B exists → silent cleanup, no prompt, idle UI
- [ ] Mount recording screen with a 90-minute-old buffer → silent cleanup (age > 1h)
- [ ] Mount recording screen with buffer containing < 10 points → "STARE DANE" prompt with WYCZYŚĆ only

### Storage failure

- [ ] Fill device storage to near capacity (iOS Settings → General → iPhone Storage)
- [ ] Tap START → initial `saveBuffer` fails → "NIE MOŻNA ROZPOCZĄĆ" card appears with SPRÓBUJ PONOWNIE + ANULUJ

### Concurrency (hard to reproduce intentionally)

- [ ] Tap START, immediately tap ANULUJ, immediately tap START again within 1 second
- [ ] Expected: first session's late task callbacks get sessionId-fenced and dropped; second session's buffer stays clean
- [ ] Verify by inspecting `nwd:recording-buffer` via Expo dev tools after — sessionId should be the SECOND session's

### Finalize path

- [ ] Long recording (>30s, >150m, >15 points) → tap STOP → review screen renders with correct duration, distance, point count
- [ ] Duration on review matches wall-clock (Phase 3.5 S4 fix — no drift from handoff)

## Ready to merge?

**Yes, pending walk-test v3 on real device.**

Static analysis green (tsc + targeted greps). No known regressions.
Branch is 11 commits atop `main`; clean fast-forward possible or
`--no-ff` merge commit for audit trail preservation.

Merge command:

```
git checkout main
git merge --no-ff feat/chunk7-background-location \
  -m "Merge Chunk 7: background location + session resume"
git push origin main
```

After merge, bump `buildNumber` in `app.json` once more and kick off
an EAS TestFlight build. Include submission notes justifying Always
permission (separate file) with the App Store review request.
