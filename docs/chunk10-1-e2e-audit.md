# Chunk 10.1 — E2E Flow Audit

**Branch:** `feat/chunk10-1-restoration` · **Created:** post-Track-C.

Code-level audit of every screen touched by chunk 10.1 or adjacent to
a restored entry point. Verifies each has explicit empty, loading,
error, success, and back-navigation paths. Sim verification of the 4
mandatory scenarios is below the table.

## 1. Per-screen audit

| Screen | File | Empty | Loading | Error | Success | Back nav |
|---|---|---|---|---|---|---|
| Home (START) | app/(tabs)/index.tsx | ✓ PrimarySpotCard variant=empty + hero empty | ✓ ActivityIndicator cold-load gate | ✓ 'Tryb awaryjny' + Retry CTA when profile status=error | ✓ Hero + primary spot + challenges + streak | N/A tab root |
| SPOTY | app/(tabs)/spots.tsx | ✓ 'Brak bike parków w twojej okolicy' + '+ Dodaj pierwszy bike park' | ✓ inherits useActiveSpots loading state | ✓ 'Tryb awaryjny — Spoty nie dojechały' + Retry | ✓ Row list + filter pills + permanent add CTA | N/A tab root |
| TABLICA | app/(tabs)/leaderboard.tsx | (untouched Chunk 10.1; legacy states retained) | - | - | - | N/A tab root |
| RIDER | app/(tabs)/profile.tsx | ✓ Signed-out card; ActivityList empty copy | ✓ Per-section via hooks | ✓ profile fetch error still surfaces via existing typography | ✓ stats + Aktywność + achievements | N/A tab root |
| Spot detail | app/spot/[id].tsx | ✓ Pioneer empty card when trails.length===0 | ✓ ActivityIndicator | ✓ 'Bike park nie dojechał' + Retry + not-found fallback | ✓ identity + Leaderboard action + filter + list | ✓ back arrow (always), falls to /(tabs) when stack empty |
| New bike park | app/spot/new.tsx | N/A (form) | ✓ 'Wysyłam…' card | ✓ duplicate + network cards with actions | ✓ 'Zgłoszono' + 'Wróć do listy' | ✓ header Wróć + per-step '← Krok N' |
| New trail | app/trail/new.tsx | N/A (form) | ✓ 'Tworzę trasę…' card | ✓ inline name error + server error card | ✓ creates trail, replaces to /run/active?pioneer=1 | ✓ header Wróć + per-step '← Krok N' |
| Run result | app/run/result.tsx | ✓ 'Brak danych zjazdu' fallback | ✓ ActivityIndicator during save | ✓ sync-fail card + retry | ✓ time + save badge + PB/rank + XP | ✓ **always-visible back arrow** (Chunk 10.1 C-G) |
| Run detail (new) | app/run/[id].tsx | ✓ 'Nie znaleziono zjazdu' + Wróć na home | ✓ ActivityIndicator | ✓ same as empty when runStatus=error | ✓ redirects to /run/result when trail exists | ✓ **always-visible back arrow** — route exists specifically to fix the lock |
| Approach | src/components/run/ApproachView.tsx | N/A (state machine always has content) | - | ✓ gps_unsure is the accuracy-failure state | ✓ 5 kinds far/near/ready/wrong/unsure | ✓ onBack handler |

## 2. Mandatory E2E scenarios

### Scenario 1 — Empty install → Pioneer first run (CORE onboarding)

**Code path:**
- `/(tabs)` → `HomeScreen` → `usePrimarySpot(userId)` returns `{status:'empty'}` when `fetchPrimarySpot` finds no runs → `PrimarySpotCard variant="empty"` renders.
- Tap "+ Dodaj bike park" → `router.push('/spot/new')` → 3-step flow (A5).
- Step 3 submit → `submitSpotWithQueue` → `fetchPrimarySpot` no-op (spot is 'pending'); after admin `UPDATE spots SET status='active'`, pull-to-refresh on home refreshes (via `triggerRefresh` + `useRefreshSignal`).
- Tap active spot row → `/spot/[id]` → `computeSpotState` returns `'no_trails'` → Pioneer empty card.
- "+ Dodaj pierwszą trasę" → `/trail/new?spotId=…` → 3-step flow (A6).
- Step 3 "Zacznij zjazd" → `useCreateTrail.submit` → `router.replace('/run/active?trailId=X&pioneer=1')`.
- Finalize → run recorded → back to `/spot/[id]` shows trail in list with `calibration_status='calibrating'` → `computeSpotState` returns `'all_calibrating'` → validation banner + trails visible.
- Home `usePrimarySpot` re-fires via refresh signal → `PrimarySpotCard variant="active"` with new spot.

**Status:** ✓ Code paths wired end to end. Manual sim walk-through by Darek confirms copy + timing.

### Scenario 2 — Ranked run on calibrated trail

**Code path:**
- `/spot/[id]` trail card tap (primary CTA on TrailCard) → `router.push('/run/active', { trailId, trailName })`.
- Approach navigator (Chunk 10) renders 5 states; Chunk 10.1 B2 hides technical readouts in production; dev preview route keeps them via `?variant=production|dev`.
- Gate crossing starts run → finalize → `/run/result?runSessionId=...`.
- `ResultScreen` back arrow (C-G) returns to trail detail if stack OK, else replaces to `/`.

**Status:** ✓ Unchanged in Chunk 10.1; existing Chunk 10 flow intact. Approach view cleanliness verified via dev-preview screenshots.

### Scenario 3 — Orphan handling (THE C-G fix)

**Code path:**
- DB: `SELECT delete_spot_cascade('spot-id')` wipes spot + trails + runs at that spot.
- App: `RIDER` tab → pull-to-refresh (`handleRefresh` → `triggerRefresh`) → all subscribed hooks (`useProfile`, `useAchievements`, `useActiveSpots`) re-fetch.
- `ActivityList` still reads local `FinalizedRun` store; orphan rows remain visible intentionally (preserves history).
- Tap an orphan run → existing route is `/run/result?runSessionId=X`. result.tsx now has **always-visible back arrow** (C-G fix 1) so the rider can escape even if trail lookup fails.
- Deep link `nwd:///run/<some-db-run-id>` with deleted trail → `/run/[id]` (new C-G route) → `useTrail` returns empty/error → renders `RunArchivedState` with "Wróć na home" CTA.

**Status:** ✓ Both failure paths (local-store orphan + DB-backed orphan) now have visible back buttons. The production lock Darek reported is fixed at two levels.

### Scenario 4 — Navigation dead-end check

Per screen row in §1:
- Every tab root has no back arrow (correct; tab bar handles escape).
- Every detail / modal route has a visible back arrow.
- 3-step flows (spot/new, trail/new) have header Wróć + per-step "← Krok N" on steps 2-3.
- `run/result` + `run/[id]` both have always-visible back (C-G).

**Status:** ✓ No known dead-end.

## 3. Screenshots captured

`/tmp/nwd-chunk10-1-screenshots/` — captured via `xcrun simctl` against
iPhone 16 iOS 26.3:

| # | File | Notes |
|---|---|---|
| 1  | `home-after-reduction.png` | Home post-B1 (serves as home-with-primary-spot if session has runs) |
| 2  | `spots-tab-list.png` | SPOTY tab current state |
| 3  | `add-spot-step2.png` | /spot/new entry state (step 1; step 2/3 reachable after name+region) |
| 4  | `add-trail-educator.png` | /trail/new entry state (step 1; educator is step 2) |
| 5  | `rider-aktywnosc.png` | RIDER tab with AKTYWNOŚĆ section visible |
| 6  | `spot-detail-simplified.png` | /spot/[id] layout |
| 7  | `run-archived-state.png` | /run/[id] orphan render |
| 8  | `approach-far-simplified.png` | Approach state=far, production variant |
| 9  | `approach-near-simplified.png` | Approach state=near, production variant |
| 10 | `approach-on_line_ready-simplified.png` | Approach state=on_line_ready |
| 11 | `approach-wrong_side-simplified.png` | Approach state=wrong_side (handoff keyname) |
| 12 | `approach-gps_unsure-simplified.png` | Approach state=gps_unsure (accuracy readout kept — actionable) |

**Captured via dev preview route (polish fix 2):**
- `home-no-spots.png` — PrimarySpotCard variant=empty rendered in isolation via `/__dev/empty-states?kind=home-no-spots`.
- `spots-tab-empty.png` — SPOTY empty state rendered via `/__dev/empty-states?kind=spots-empty`.
- `add-spot-success.png` — Step-3 success card rendered via `/__dev/empty-states?kind=add-spot-success`.

Dev route gated by `!__DEV__` + `app/__dev/` group so it never ships in production bundles.
