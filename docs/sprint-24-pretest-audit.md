# Sprint 24 — Final Pre-Test Audit + Scripted Test Plan

---

## 1. FINAL PRE-TEST AUDIT

### 1.1 Executive Verdict

**What is strong:**
- Run lifecycle integrity: one run → one finish → one verify → one save. Idempotency guard on finish. Mounted checks on all state updates. GPS cleanup on unmount.
- Result truth: every run end path (valid, invalidated, missing geo) writes a FinalizedRun record before navigating to result. Result screen reads from store, subscribes to live updates for save resolution.
- Venue/start detection geometry: uses correct seed data, haversine distance, proper radius-based geofencing. Start zones derived from real trail geo.
- Error/empty/loading distinction: leaderboard, profile, venue activity, result impact all have explicit `loading | ok | empty | error` states. Backend failures show error UI, not fake empty states.
- Debug instrumentation: structured event system across venue, gps, run, save, fetch, auth. Simulation overrides for 6 dimensions. Debug drawer with state/events/sim tabs.
- Type safety: `tsc --noEmit` clean.
- Scoped boards: today/weekend/all_time leaderboards with correct scope labels. Result impact shows scoped position chips.

**What is still fragile:**
- Background behavior during run (iOS foreground-only tracking, no background task registration)
- Real-world GPS accuracy under tree cover (untestable until mountain)
- Network failure recovery is catch-and-show, no retry-with-backoff
- Trail context partially lost on result → leaderboard (passes trailId+scope in params but leaderboard falls back to dzida-czerwona if param invalid)
- Profile write-side truth (best_position never updated from backend, favorite_trail_id unused)

**Current readiness:**
- ✅ READY for internal scripted testing
- ⚠️ GO WITH CAUTION for mountain field testing (see P1 items below)

---

### 1.2 Remaining Blockers (P0)

**NONE FOUND.** No hard blockers that prevent field testing.

All previous P0s from Sprint 22 (broken geometry, fake empty states, missing finalized run, tsc failures) are confirmed fixed.

---

### 1.3 Important Risks (P1)

**P1-A: App backgrounding during active run has no recovery**
- **Issue:** If iOS suspends the app during `running_ranked`/`running_practice`, GPS tracking stops. On resume, `useVenueContext` fires `app_resumed` but `useRealRun` has no background resume logic. The timer keeps counting (setInterval survives brief suspensions) but GPS points stop.
- **Impact:** Run verification will likely fail due to missing points / large gaps. Rider sees normal timer but run data is garbage.
- **Does it block?** Degrades test quality. Workaround: tell testers to keep app in foreground.
- **Files:** `src/systems/useRealRun.ts`, `src/systems/gps.ts`

**P1-B: No network retry on save failure**
- **Issue:** `submitToBackend` does one try. If it fails (network timeout, Supabase 502), the run is marked `failed` permanently. No retry button on result screen.
- **Impact:** Rider finishes a valid run, gets "ZAPIS NIE POWIÓDŁ SIĘ", no way to retry. Sync-fail explanation card is good but lacks actionable recovery.
- **Does it block?** Doesn't block testing but may lose real test data.
- **Files:** `app/run/result.tsx`, `src/systems/useRealRun.ts`

**P1-C: `bestPosition` on profile is never updated from actual leaderboard data**
- **Issue:** `useProfile` reads `best_position` from the profiles table, but nothing writes it after run completion. Home screen shows `NAJLEPSZA POZ.` as stale or zero.
- **Impact:** Misleading rider status. Shows `—` even after placing on the board.
- **Does it block?** Cosmetic lie but doesn't break flow.
- **Files:** `src/hooks/useBackend.ts`, `src/lib/api.ts`

**P1-D: Trail page mixes scoped position with all-time PB label**
- **Issue:** In `trail/[id].tsx` line 113, the position comes from `boardScope` (could be today/weekend) but line 123 always says `PB · WSZECHCZASÓW`. If you're viewing the `day` scope, your position is for today but the PB is all-time — semantically confusing.
- **Impact:** Rider sees "#3 DZIŚ" next to "PB · WSZECHCZASÓW 2:34.5" and may think #3 is their all-time position.
- **Does it block?** Semantic confusion only. Noted in Sprint 22 scope.

---

### 1.4 Tuning Risks (P2)

- **P2-A:** Start-zone radius (35m for `isAtStart`, 200m for `isNearStart`) — may need real-world adjustment. Under tree cover, GPS drift could cause false positives/negatives at the gate.
- **P2-B:** Ambiguity threshold (60m) — trails Galgan and Dookola start zones are close. Real GPS might place rider in ambiguous zone more often than expected.
- **P2-C:** GPS readiness thresholds (>30m weak, >15m good, ≤15m excellent) — mountain accuracy varies. May need wider "good" band.
- **P2-D:** Venue geofence radius (1500m) — covers full venue but may fire too early on approach road.
- **P2-E:** Finish-zone auto-detect — relies on `isInZone(point, finishZone)` on every GPS callback. If GPS skips the zone due to point spacing (5m minimum + 1s interval), rider may miss auto-finish.
- **P2-F:** Polling interval (5s for venue context) — may be too slow for start-zone detection if rider walks quickly toward gate.

### 1.5 Blind Spots

1. **Real GPS under heavy tree cover** — simulation gives perfect coordinates; real accuracy will be 10-40m
2. **App kill/restart during run** — no persistence; run is lost completely
3. **Supabase connection quality at mountain** — cell coverage may be weak
4. **Battery drain during extended tracking** — BestForNavigation accuracy is power-hungry
5. **Concurrent runs** — no guard against starting a second run while one is finishing
6. **Time zone edge cases** — today/weekend scoped boards depend on server time, not local

---

## 2. SCRIPTED INTERNAL TEST PLAN

### Instructions
- Use web preview (port 8085) for UI-only tests
- Use iOS simulator for GPS/tracking tests
- Open debug drawer: 5-tap bottom-right corner
- Enable test mode: SIM tab → toggle "Test Mode Active"
- Watch debug events: EVENTS tab
- Filter events by category as needed

### Test Matrix

#### AUTH / ENTRY

| ID | Scenario | Setup | Actions | Expected Behavior | Debug Events | Pass/Fail |
|----|----------|-------|---------|-------------------|--------------|-----------|
| A1 | Signed out + cold open | Clear storage, reload | Open app | Home shows ZALOGUJ pill, DOŁĄCZ DO LIGI card, trail list with BEZ WYNIKU. No rider status card. | `auth:unauthenticated` | ✅ if no ranked data shown, no crashes |
| A2 | Signed in + cold open | Log in, reload | Open app | Home shows rank pill with username, TWÓJ STATUS card with stats, leaderboard entry if available | `auth:session_found`, `auth:authenticated`, `fetch:profile_ok` | ✅ if profile loads, stats truthful |
| A3 | Signed out + try ranked | Signed out | Tap trail → JEDŹ RANKINGOWO → readiness → tap ranked | Should redirect to /auth | `run:readiness_check_start` | ✅ if auth gate works, no crash |
| A4 | Signed in + browsing only | Signed in | Navigate home → spot → trail → leaderboard → profile | All pages load, no crashes, correct data states | Multiple `fetch:*_start/ok` events | ✅ if all pages render, no empty lies |

#### LOCATION / VENUE

| ID | Scenario | Setup | Actions | Expected Behavior | Debug Events | Pass/Fail |
|----|----------|-------|---------|-------------------|--------------|-----------|
| L1 | No location | SIM: location=`no_location` | Open home | No start-zone prompt. No venue arrival card. Venue card shows normally (static data). | `gps:sim_no_location` | ✅ if no false venue prompts |
| L2 | Denied location | SIM: location=`denied` | Open home, try run/active | Venue context status=denied. Run readiness shows "Wymagane uprawnienia lokalizacji" | `gps:permission_denied` | ✅ if permission error shown, not stuck |
| L3 | Venue detected | SIM: venue=`at_venue` | Open home | Venue arrival card appears: "Jesteś w Słotwiny Arena". No start prompt. | `venue:state_changed` with insideVenue=true | ✅ if arrival card shows, no false start |
| L4 | Near venue | SIM: venue=`near_start` | Open home | No venue cards, no start prompts | `venue:context_computed` with insideVenue=false | ✅ if no false positive venue detection |
| L5 | At clear start zone | SIM: venue=`at_start_clear` | Open home | START ZONE card: "JESTEŚ PRZY STARCIE" + trail name + JEDŹ RANKINGOWO / TRENING buttons | `venue:state_changed` with isAtStart=true, ambiguous=false | ✅ if correct trail shown, both CTAs work |
| L6 | At ambiguous start | SIM: venue=`at_start_ambiguous` | Open home | AMBIGUOUS card: "JESTEŚ PRZY STARCIE" + "Wybierz trasę" + list of alternatives with distances | `venue:state_changed` with ambiguous=true | ✅ if multiple trails shown, distances correct |
| L7 | GPS temporarily null | SIM: location=`no_location`, then switch to `real` after 10s | Watch home | Should degrade to no_location, clear stale context. On resume, should re-detect. | `gps:position_null` then `venue:state_changed` | ✅ if no stale start prompts persist |
| L8 | Weak GPS | SIM: location=`weak_gps` | Enter run/active, tap readiness | GPS quality should show weak/orange. Ranked should be gated. Practice available. | `run:readiness_check_start` | ✅ if GPS quality reflected in readiness |

#### RUN FLOW

| ID | Scenario | Setup | Actions | Expected Behavior | Debug Events | Pass/Fail |
|----|----------|-------|---------|-------------------|--------------|-----------|
| R1 | Ranked run starts | iOS sim, signed in, at venue | trail → JEDŹ RANKINGOWO → readiness → tap ranked → tap start | Phase progression: idle → readiness_check → armed_ranked → running_ranked. Timer counts. GPS indicator shows. | `run:readiness_check_start`, `run:armed`, `run:started` | ✅ if smooth phase progression |
| R2 | Practice run starts | Same | trail → readiness → TRENING → tap start | Same progression but armed_practice → running_practice | `run:armed` with mode=practice, `run:started` | ✅ if practice mode correct |
| R3 | startTracking failure | SIM: tracking=`fail_start` | trail → JEDŹ RANKINGOWO → readiness | Should show "[SIM] GPS tracking failure" message. TRENING button available. | `run:sim_tracking_fail` | ✅ if degradation shown, practice still available |
| R4 | Finish path succeeds | iOS sim, complete a run | Tap finish during running | Phase: running → finishing → verifying → completed_verified/unverified. Timer stops. Verification result shown. | `run:finishing`, `run:verifying`, `run:finalized` | ✅ if phase progression clean, result truthful |
| R5 | Finish with missing geo | Set geo to null in trail data (not easily simulated) | Finish run | Should hit invalidated path. "Brak danych trasy" error. Still writes finalized run. | `run:finalize_no_trace` | ✅ if fallback works, run store has record |
| R6 | App background during run | Start run on sim, press home button | Background, wait 5s, foreground | Timer continues counting (may be off). GPS points stop. On resume, tracking should still be subscribed (foreground tracking). | `venue:app_backgrounded`, `venue:app_resumed` | ⚠️ KNOWN RISK: GPS gap. Pass if no crash, degraded gracefully |
| R7 | Cancel during readiness | Start readiness check | Press ← WRÓĆ | Should cancel cleanly, stop GPS tracking, return to previous screen. Phase resets to idle. | No specific event (cancel doesn't log yet) | ✅ if clean return, no leaked subscription |
| R8 | Double-tap finish | During running phase | Tap finish twice rapidly | Idempotency guard: `finalizingRef.current` prevents second finish. Only one verification pass. | Only one `run:finishing` event | ✅ if no double finalization |

#### SAVE / RESULT

| ID | Scenario | Setup | Actions | Expected Behavior | Debug Events | Pass/Fail |
|----|----------|-------|---------|-------------------|--------------|-----------|
| S1 | Save succeeds | Signed in, Supabase configured | Complete ranked run | Result shows ✓ ZAPISANO W LIDZE. Position shown. XP awarded. | `save:submit_start`, `save:submit_ok` | ✅ if save status truthful, position shown |
| S2 | Save delayed | SIM: save=`delay_3s` | Complete ranked run | Result first shows "ZAPISUJĘ DO LIGI..." spinner. After 3s, resolves to saved. | `save:sim_delay`, then `save:submit_ok` or `save:submit_error` | ✅ if spinner shown during delay |
| S3 | Save fails | SIM: save=`fail` | Complete ranked run | Result shows "ZAPIS NIE POWIÓDŁ SIĘ" + sync fail explanation card for ranked verified runs. | `save:sim_save_fail` | ✅ if failure truthful, explanation card shown |
| S4 | Result impact succeeds | Signed in, save succeeded | Navigate to result | WPŁYW NA LIGĘ section with DZIŚ/WEEKEND/WSZECHCZASÓW chips showing positions | `fetch:result_impact_start`, `fetch:result_impact_ok` | ✅ if scoped impact shown correctly |
| S5 | Result impact fails | SIM: fetch resultImpact=`fail` | Navigate to result | Impact section should not show (graceful absence). Rest of result intact. | `fetch:result_impact_sim_fail` | ✅ if no crash, no misleading data |
| S6 | Missing runSession | Navigate to /run/result without valid runSessionId | Direct URL | "Brak danych zjazdu" fallback with STRONA GŁÓWNA button. | None | ✅ if fallback shown, button works |

#### LEAGUE / DATA

| ID | Scenario | Setup | Actions | Expected Behavior | Debug Events | Pass/Fail |
|----|----------|-------|---------|-------------------|--------------|-----------|
| D1 | Home live signals load | Signed in, SIM: fetch all=`real` | Open home | Venue activity shows ZJAZDÓW DZIŚ/RIDERÓW DZIŚ if data exists. RUCH W LIDZE section if signals present. | `fetch:venue_activity_ok`, `fetch:leaderboard_ok` | ✅ if truthful numbers, no fake-live |
| D2 | Home venue activity fails | SIM: fetch venueActivity=`fail` | Open home | Venue card shows "— BRAK DANYCH" instead of fake live numbers. | `fetch:venue_activity_sim_fail` | ✅ if error state shown, not fake zeros |
| D3 | Leaderboard all scopes load | Open leaderboard tab | Switch DZIŚ / WEEKEND / WSZECHCZASÓW | Each scope loads independently. Correct labels. | `fetch:leaderboard_start/ok` for each scope | ✅ if scopes switch cleanly, labels correct |
| D4 | Leaderboard fetch fails | SIM: fetch leaderboard=`fail` | Open leaderboard | "NIE UDAŁO SIĘ ZAŁADOWAĆ" + "Tablica wyników jest teraz niedostępna" + PONÓW button | `fetch:leaderboard_sim_fail` | ✅ if error state shown with retry |
| D5 | Venue activity empty | SIM: fetch venueActivity=`empty` | Open home | Venue card shows "— CISZA DZIŚ" (truthful empty) | No venueActivity events (empty sim bypasses fetch) | ✅ if quiet copy, no fake-live |
| D6 | Profile fetch fails | SIM: fetch profile=`fail` | Open profile tab | Should show error state, not fake user data | `fetch:profile_sim_fail` | ✅ if error visible, no phantom data |

---

## 3. FIELD-TEST CHECKLIST

### 3.1 Pre-Ride Setup

| Item | Check | Notes |
|------|-------|-------|
| Device charged | ☐ ≥80% battery | BestForNavigation GPS is power-hungry |
| App version | ☐ Latest dev build installed | |
| Signed in | ☐ Authenticated with test account | Verify profile loads |
| Location permissions | ☐ "Always" or "While Using App" granted | Check in iOS Settings |
| Network state | ☐ Note cellular signal strength at parking | Check on each run |
| Debug mode | ☐ Open debug drawer (5-tap bottom-right) | Verify STATE tab shows auth + venue |
| Reset state | ☐ No active simulation overrides | SIM tab → RESET ALL |
| Screen timeout | ☐ Set to "Never" during testing | Prevent screen lock during runs |
| Weather | ☐ Note conditions | Affects GPS + phone usability |

### 3.2 Arrival / Venue Detection

| What to observe | How to check | Pass | Needs Tuning | Blocker |
|----------------|-------------|------|-------------|---------|
| Venue detection timing | Note when "Jesteś w Słotwiny Arena" appears while approaching | Triggers within 200m of venue center | Triggers >500m away (too early) or <100m (too late) | Never triggers at venue |
| Correct venue name | Read the arrival card | Shows "Słotwiny Arena" | — | Shows wrong venue or no name |
| No false positive away from venue | Check app at hotel/parking far away | No venue cards shown | — | Start-zone prompt shown far from venue |
| Debug event verification | EVENTS tab → venue category | `venue:state_changed` with insideVenue=true | — | No venue events firing |

### 3.3 Start-Zone Detection

| What to observe | How to check | Pass | Needs Tuning | Blocker |
|----------------|-------------|------|-------------|---------|
| Correct trail detection | Walk to Dzida Czerwona start gate | "JESTEŚ PRZY STARCIE — Dzida Czerwona" | Wrong trail name shown | No start detection at all |
| Detection distance | Note when start prompt appears (meters from gate) | Within 35m of actual gate | Too early (>50m) or too late (<10m) | Prompt after rider already started |
| False positive rate | Walk around venue, not at any start | No start prompts | Occasional false start (tolerable) | Persistent false start prompts |
| Ambiguity handling | Walk between Galgan and Dookola starts | "Wybierz trasę" with both options | Shows one trail when both are near | Stuck/crashed state |
| Near-start prompt | Walk toward start from 200m away | "BLISKO STARTU" card with distance | Distance inaccurate but trend correct | No near-start ever shown |
| Debug verification | EVENTS tab | `venue:context_computed` with correct trailId, distances | — | Events not firing or wrong data |

### 3.4 Run Entry

| What to observe | How to check | Pass | Needs Tuning | Blocker |
|----------------|-------------|------|-------------|---------|
| Ranked/Training choice clear | Tap JEDŹ RANKINGOWO from trail page | Phase shows "RANKING — DOTKNIJ ABY RUSZYĆ" | Copy unclear but functional | Can't tell which mode you're in |
| GPS readiness shown | Check readiness panel | GPS indicator matches actual signal | Inaccurate GPS label | Stuck on "Łączenie z GPS..." |
| Start gate check | Start from actual gate | `rankedEligible=true` in readiness | Eligible too far from gate | Never eligible at gate |
| Practice fallback works | Tap TRENING when GPS is weak | Can start practice mode immediately | — | Practice mode blocked |
| Debug verification | EVENTS tab | `run:readiness_check_start`, `run:armed`, `run:started` in sequence | — | Missing start events |

### 3.5 During Run

| What to observe | How to check | Pass | Needs Tuning | Blocker |
|----------------|-------------|------|-------------|---------|
| Timer counting | Watch the big timer during ride | Timer counts smoothly in real-time | Minor lag (acceptable) | Timer stops or jumps wildly |
| GPS quality indicator | Watch GPS dots during ride | Reflects actual signal quality | Doesn't change (shows stale) | Always shows "no GPS" during ride |
| Checkpoint passing | Watch CP counter | CPs increment as you ride through | CP missed despite riding through | All CPs shown as passed at once |
| Auto-finish at gate | Ride through finish gate | Run auto-finishes at finish zone | Slight delay (few seconds) | Never auto-finishes |
| Manual finish works | Tap screen during ride | Run finishes on tap | — | Tap doesn't register |
| No crashes | Complete full ride | App stays responsive throughout | — | App crashes during ride |
| Debug event count | After finish, check EVENTS tab | Multiple GPS points logged in `run` category | — | Zero events during ride |

### 3.6 Finish / Result

| What to observe | How to check | Pass | Needs Tuning | Blocker |
|----------------|-------------|------|-------------|---------|
| Run finalizes correctly | Watch phase transition | finishing → verifying → completed_verified | Slow transition (>5s) | Stuck on finishing/verifying |
| Verification truthful | Check verification badge | ZWERYFIKOWANO for valid run, correct status for invalid | Wrong status shown | Always shows invalidated |
| Save succeeds | Watch save status | "✓ ZAPISANO W LIDZE" appears within few seconds | Slow save (>10s) but succeeds | Save always fails at venue |
| Time displayed correctly | Compare perceived time with displayed | Time matches subjective experience | Off by <2s (GPS timing) | Wildly wrong time |
| Board position shown | Check rank card | Position and delta make sense | Position not shown (impact fetch slow) | Wrong position / crash |
| League impact visible | Check WPŁYW NA LIGĘ section | DZIŚ / WEEKEND / WSZECHCZASÓW chips with positions | Some scopes missing | Section never loads |
| PB detection | Beat your previous time | NOWY REKORD card shown | — | PB not detected |
| Debug verification | EVENTS tab | `run:finalized`, `save:submit_ok`, `fetch:result_impact_ok` | — | Missing finalize or save events |

### 3.7 After Run

| What to observe | How to check | Pass | Needs Tuning | Blocker |
|----------------|-------------|------|-------------|---------|
| Leaderboard context | Tap TABLICA from result | Opens leaderboard on correct trail/scope | Falls back to Dzida Czerwona (if different trail) | Crashes or shows wrong data |
| Run Again works | Tap JEDŹ PONOWNIE | Goes to active screen for same trail | — | Wrong trail or crash |
| Home re-engagement | Go to home after result | RUCH W LIDZE shows relevant signals | Signals stale or generic | Signals about other riders' data |
| Loop feels motivating | Subjective | Rider wants to go again | Feels disconnected | Rider confused about what happened |

### 3.8 Environmental Notes Template

```
Run #: ___
Trail: _______________
Time: ___:___
Weather: ☐ Clear ☐ Cloudy ☐ Rain ☐ Snow
Tree cover: ☐ None ☐ Light ☐ Heavy
GPS signal: ☐ Strong ☐ Okay ☐ Weak ☐ Lost
Cell signal: ☐ LTE ☐ 3G ☐ Weak ☐ None
Lift area behavior: _______________
Any confusion moments: _______________
Venue detection triggered at: _______________
Start detection triggered at: _______________
Auto-finish triggered: ☐ Yes ☐ No ☐ Manual tap
Save result: ☐ Saved ☐ Failed ☐ Slow
Debug events of note: _______________
```

---

## 4. GO / NO-GO FRAMEWORK

### Issue Severity Definitions

#### 🔴 GO BLOCKERS (must fix before mountain test)
Examples that would block:
- False start-zone prompt appears in wrong location reliably
- No reliable run finalization (stuck on finishing)
- Result lies about save/rank consequence
- Ranked flow breaks under normal use
- App regularly gets stuck in stale venue/start context
- tsc or runtime errors on common paths

**CURRENT STATUS: ZERO GO BLOCKERS FOUND**

#### 🟡 GO WITH CAUTION (acceptable for testing, monitor closely)
Found items:
- P1-A: Background during run loses GPS data (tell testers: keep app foreground)
- P1-B: Save failure has no retry (tell testers: note when saves fail for manual re-entry)
- P1-C: bestPosition never updated (ignore during test, not field-critical)
- P1-D: Scoped position mixed with all-time PB label (note confusion if observed)

#### 🟢 POST-TEST TUNING (expected to need real-world calibration)
- Start-zone radius (35m / 200m)
- Ambiguity threshold (60m)
- GPS readiness thresholds (15m / 30m)
- Venue geofence radius (1500m)
- Finish-zone auto-detect timing
- Polling interval (5s)
- Copy tone and timing of prompts

### Final Recommendation

## **GO WITH CAUTION** ✅

**Rationale:**
1. All hard blockers from Sprint 22 are confirmed fixed
2. Run lifecycle has integrity guards (idempotent finish, mounted checks, GPS cleanup)
3. Every critical flow has structured debug instrumentation for diagnosis
4. Error states are truthful and explicit (no silent lies)
5. Simulation mode lets us test all major failure paths before mountain
6. Known risks (P1-A through P1-D) are understood, bounded, and have workarounds

**Conditions for GO:**
- Testers must keep app in foreground during runs (P1-A workaround)
- Note any save failures manually (P1-B workaround)
- Debug drawer must be available on test devices
- Minimum 3 runs per trail to validate thresholds
- Note environmental conditions on each run (template provided)
- First test session should be low-stakes: practice mode + debug drawer open

**What the mountain test will answer that we cannot answer now:**
1. Are GPS thresholds right under tree cover?
2. Do start zones trigger at the correct physical location?
3. How often does auto-finish work at the finish gate?
4. What is real save latency at the venue?
5. Does the ride loop (start → ride → result → go again) feel motivating?

---

## 5. LIGHT FIXES APPLIED

No code changes in this sprint. Analysis-only. All findings documented for reference.

**Intentionally deferred:**
- P1-B retry button on save failure → Sprint 25 candidate
- P1-C bestPosition update → Sprint 25 candidate
- P1-D trail page scope/PB label fix → Sprint 25 candidate
- Run cancel/background debug events → low priority
- Concurrent run guard → edge case, deferred
