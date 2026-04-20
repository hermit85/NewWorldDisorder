# Sprint 3 — Pioneer trail flow

The first rider on an active spot carves the trail: they create a trail row, record the line with GPS, and their run becomes the ground-truth geometry future riders race against. Builds on migration 006 (`trails.calibration_status`, `pioneer_user_id`, `geometry`), Checkpoint B's app-layer `FinalizedRun.spotId`, and Checkpoint C's empty gate-corridor state.

---

## 1. Goals

- A rider in an active spot with zero trails can tap one CTA and within 2 minutes have a trail pinned to the spot, a recorded line in `trails.geometry`, and their time as #1 on the leaderboard.
- Any rider can add subsequent trails to an active spot; the first person to complete a verified run on a `draft` trail becomes its Pioneer (locked).
- Recording is resilient: GPS hiccups, app backgrounding, or accidental phone locks don't destroy the in-flight trace.
- Leaderboard opens for a trail only after calibration crosses a trustworthy bar — until then only the pioneer run counts.

## 2. Non-goals (explicit)

- Ghost rider / replay animation (backlog).
- Split times / intermediate checkpoints (backlog).
- Editing a trail's geometry after the pioneer run (backlog; re-record flow separate).
- Auto-promotion from `calibrating` → `verified` (curator manual flip in Sprint 3; automation later).
- Trail difficulty auto-adjustment from recorded times (backlog).
- Social sharing (backlog).
- Audio cues during recording (see §9, Q3).

---

## 3. User stories

### Story 1 — Add First Trail (Pioneer in an empty spot)
1. Rider opens `/spot/[id]` where `trails.length === 0` (Jano pawlowo today, any newly approved spot in general).
2. The familiar empty line "Brak tras — czekamy na Pioniera" is replaced by a **hero CTA** "DODAJ PIERWSZĄ TRASĘ" with a Pioneer-badge glyph above it. `EmptyMapPlaceholder` stays below the fold as context.
3. Tap → `/trail/new?spotId=<id>`:
   - **Nazwa trasy** — text, 3–60 chars.
   - **Trudność** — segmented: `easy` / `medium` / `hard` / `expert`.
   - **Typ** (optional) — `downhill` / `flow` / `tech` / `jump`. Defaults to `flow`.
4. Submit → RPC `create_trail` → new trail row with `calibration_status='draft'`, `pioneer_user_id = null`, `geometry = null`, `is_active = false` (not yet visible in normal listings).
5. Redirect to `/trail/[newTrailId]` with a single CTA "ROZPOCZNIJ NAGRYWANIE" (dark/accent style).
6. Tap START → GPS permission flow (if not granted, system prompt + fallback copy).
7. **Arming screen** `/run/recording` with a 3-second countdown, haptic tick per second (see Q4).
8. Recording active: GPS records every 1s (see Q-sampling), altitude where available, distance-filtered 2m dedup.
9. Rider rides. Screen stays minimal (see Q1).
10. Tap STOP → finalize flow:
    - Build `geometry` jsonb from the buffered points (normalize, downsample if needed per §6).
    - Call RPC `finalize_pioneer_run(run_id, trail_id, geometry_jsonb)` which atomically:
      - Writes the run row.
      - Sets `trails.geometry`, `trails.pioneer_user_id = auth.uid()`, `trails.pioneered_at = now()`, `trails.calibration_status = 'calibrating'`, `trails.is_active = true`.
      - Writes `trails.runs_contributed = 1`.
      - Creates the first leaderboard_entry for `period_type='all_time'`.
11. Redirect to `/run/result` with the usual time card plus a dedicated **"PIERWSZY PIONIER"** badge above the PB badge.
12. Spot screen now shows this trail; `/trail/[id]` now shows the pioneer at position #1.

### Story 2 — Add Subsequent Trail (non-Pioneer, spot already has trails)
1. On `/spot/[id]` with `trails.length > 0`, the hero stays as the existing trail list. A smaller secondary CTA "+ DODAJ TRASĘ" sits at the bottom of the strip.
2. Form + recording flow identical to Story 1.
3. Trail row created same way (`draft`, pioneer_user_id null) — **the person who adds the trail is not automatically the pioneer**; whoever finishes the first verifiable run via `finalize_pioneer_run` locks the pioneer slot.
4. This means: rider Alice adds "Loop 3" → loop sits as draft → rider Bob happens to finish first → Bob is pioneer. Alice can still race later, counted as #2+.

### Story 3 — Cancel Recording
Rider taps START, then wants to bail (crash, misread trail, cramp):
1. Recording screen has a persistent "ZATRZYMAJ I ODRZUĆ" button (secondary styling, top-right).
2. Tap → confirm modal "Odrzucić nagranie? Trasa zostanie, ale ten zjazd nie zostanie zapisany."
3. Confirm → GPS buffer flushed, no `runs` row created, trail row stays as `draft`, no geometry written.
4. Redirect back to `/trail/[id]` with the "ROZPOCZNIJ NAGRYWANIE" CTA available again.
5. The trail can now be re-attempted by anyone — pioneer slot is still open.

### Story 4 — Low GPS Quality Warning (during recording)
During active recording:
- If `accuracy > 20 m` continuously for >30 seconds → show a top banner "SŁABY SYGNAŁ GPS — wynik może być niewiarygodny". Non-blocking.
- Banner persists until accuracy improves or the rider hits STOP.
- **For a non-pioneer run**, a weak-signal finalisation lands as `verification_status='weak_signal'` with the usual warning copy on `/run/result`.
- **For a pioneer run**, the server rejects the finalisation — see Story 5.

### Story 5 — Weak-Signal Pioneer Rejected (Retry)
Pioneer quality bar is strict because the pioneer run becomes the canonical geometry every future rider is verified against. Noisy GPS would poison every later race.

1. Rider finishes their pioneer run and taps STOP.
2. Client computes `median_accuracy_m` from buffered points.
3. `finalize_pioneer_run` RPC rejects with `{ ok: false, code: 'weak_signal_pioneer' }` if median accuracy > 20 m OR the client-computed verification status is `weak_signal`.
4. UI on `/run/result`:
   - Dominant headline: "Słaby sygnał GPS. Trasa wymaga ponownej próby."
   - Sub-copy: "Pierwszy zjazd wyznacza linię dla wszystkich — nie chcemy, żeby szum w GPS zniekształcił tor."
   - Two primary CTAs side by side:
     - **"SPRÓBUJ ZNOWU"** → `/run/recording?trailId=<same-id>` (trail still `draft`, pioneer slot still open).
     - **"ODŁÓŻ NA PÓŹNIEJ"** → back to `/trail/[id]`, `draft` state, CTA unchanged.
5. Trail row untouched (still `draft`, `pioneer_user_id = null`, `geometry = null`). Run row **not** inserted — the failed attempt is discarded.
6. The user's own GPS trace for the attempt is kept in the local `recordingStore` buffer for debug / support but is never uploaded.

---

## 4. Technical scope — files

### New

| Path | Purpose |
|---|---|
| `app/trail/new.tsx` | Create-trail form. 3 inputs + submit. Accepts `?spotId=` query. |
| `app/run/recording.tsx` | Active-recording screen (countdown + live state + STOP + cancel). |
| `src/features/recording/useGPSRecorder.ts` | Hook owning the GPS polling, buffering, accuracy stats. |
| `src/features/recording/geometryBuilder.ts` | Pure functions: buffer → normalized geometry jsonb; distance/descent math. |
| `src/features/recording/recordingStore.ts` | AsyncStorage persistence for in-flight buffer — survives app kill. |
| `supabase/migrations/008_pioneer_trail_flow.sql` | 2 RPCs: `create_trail`, `finalize_pioneer_run`. |

### Modified

| Path | Change |
|---|---|
| `app/spot/[id].tsx` | When `trails.length === 0`: replace "Brak tras…" with the Pioneer hero CTA. When `trails.length > 0`: append secondary "+ DODAJ TRASĘ" to the trail strip. |
| `app/trail/[id].tsx` | When `calibration_status === 'draft'` and `geometry === null`: replace race-mode CTA with "ROZPOCZNIJ NAGRYWANIE". Hide leaderboard section (empty). |
| `src/lib/api.ts` | `createTrail({ spotId, name, difficulty, trailType })`, `finalizePioneerRun(...)`. Both return `ApiResult<T>`. |
| `src/hooks/useBackend.ts` | Thin imperative wrappers if needed; otherwise screens call `api.*` directly. |
| `src/systems/runSubmit.ts` | Branch: if the target trail's `calibration_status === 'draft'`, route through `finalize_pioneer_run` instead of the normal `submitRun` path. |
| `src/features/run/gates.ts` | **Sprint 3 rehydration.** Given a trail id, fetch the trail's `geometry` (cached) and synthesize a `TrailGateConfig` on the fly. Replaces the Checkpoint B empty-corridor stub. |
| `app/run/result.tsx` | Detect `backendResult.isPioneer === true` and render the **"PIERWSZY"** Pioneer badge above the PB card. **Distinct visual from PB**: PB uses the standard gold/accent pill; Pioneer uses a neon-green (`colors.accent`) glow ring + Orbitron "PIERWSZY" label. This is a lifetime achievement — it must never get confused with a same-day PB and should remain visually dominant even next to a PB. Also: render the `weak_signal_pioneer` rejection layout (Story 5) when `finalize_pioneer_run` returns that code. |
| `src/services/accountDeletion.ts` | Update the confirmation copy to reflect the Sprint 3 promise that trail geometry survives the rider (Q8). New copy: *"Usunąć konto? Twoje konto, profil i PB zostaną trwale usunięte. Twoje trasy i czasy zostaną zachowane anonimowo jako część publicznej historii tras (bez twojego imienia)."* No behaviour change in the function itself — migration 006's `ON DELETE SET NULL` on `trails.pioneer_user_id` already does the right thing. |

### Not touched in Sprint 3
- `src/hooks/useVenueContext.ts` — still interim no-op. Venue detection from DB is a separate piece.
- Map components (`ArenaMap`, `TrailMarkers`, etc.) — still in Checkpoint C stub state. Pioneer trail does not need a rendered map for MVP; visualising the recorded line is a Sprint 4 concern.

---

## 5. Migration 008 — RPC contracts

Both RPCs `security definer`, `set search_path = public`, `grant execute … to authenticated`.

### `create_trail(p_spot_id text, p_name text, p_difficulty text, p_trail_type text)`
Return: `jsonb`
- `{ "ok": true, "trail_id": "pioneer-<nanoid10>" }`
- `{ "ok": false, "code": "unauthenticated" | "spot_not_found" | "spot_not_active" | "name_too_short" | "name_too_long" | "invalid_difficulty" | "invalid_trail_type" | "duplicate_name_in_spot" }`

Behaviour:
1. `auth.uid()` present.
2. Spot exists and has `status = 'active'`.
3. Name trimmed; 3 ≤ length ≤ 60.
4. Difficulty ∈ {easy, medium, hard, expert}.
5. Trail type ∈ {downhill, flow, tech, jump}. Default `flow` if null.
6. No existing trail in the same spot with case-insensitive same name.
7. Generate id `pioneer-<10-char-nanoid>` (distinct prefix from submitted spots).
8. Insert with `calibration_status='draft'`, `pioneer_user_id=null`, `geometry=null`, `is_active=false`, `is_race_trail=true`, `sort_order = (current max in spot) + 1`.

### `finalize_pioneer_run(p_trail_id text, p_run_payload jsonb, p_geometry jsonb)`
Combines the run insert + pioneer claim + trail activation in **one transaction** to prevent partial states.

`p_run_payload` shape:
```json
{
  "spot_id": "...", "started_at": "...", "finished_at": "...",
  "duration_ms": 142300, "mode": "ranked",
  "verification_status": "verified",
  "verification_summary": { ... }, "gps_trace": { ... },
  "quality_tier": "perfect" | "valid" | "rough",
  "median_accuracy_m": 4.8
}
```

(`weak_signal` is **rejected** on the pioneer path — see step 5.)

Return: `jsonb`
- `{ "ok": true, "run_id": "uuid", "is_pioneer": true, "trail_status": "calibrating", "leaderboard_position": 1 }`
- `{ "ok": false, "code": "unauthenticated" | "trail_not_found" | "trail_not_draft" | "already_pioneered" | "spot_mismatch" | "invalid_geometry" | "weak_signal_pioneer" }`

Behaviour:
1. Lock trail row `for update`.
2. If `calibration_status <> 'draft'` → `trail_not_draft`.
3. If `pioneer_user_id is not null` → `already_pioneered` (race winner already claimed).
4. Validate `p_geometry`: version=1, points array with **≥ 30 entries** (~30 s @ 1 Hz after dedup), each `{lat,lng,t}` present, strictly increasing `t`, lat/lng in sensible ranges. Reject on shape failure with `invalid_geometry`.
5. **Weak-signal gate (Q12)**: if `p_run_payload.median_accuracy_m > 20` OR `p_run_payload.verification_status == 'weak_signal'` → reject with `weak_signal_pioneer`. The pioneer line becomes the canonical geometry; noisy GPS would poison every future race. Trail stays `draft`, rider retries.
6. Insert into `runs` with `user_id = auth.uid()`, `counted_in_leaderboard = true`, `is_pb = true` (first run ever on this trail — always a PB by definition).
7. Update `trails`:
   - `pioneer_user_id = auth.uid()`
   - `pioneered_at = now()`
   - `geometry = p_geometry`
   - `calibration_status = 'calibrating'`
   - `is_active = true`
   - `runs_contributed = 1`
8. Create leaderboard_entry (`period_type='all_time'`, `rank_position=1`, `best_duration_ms`, `run_id`).
9. Return payload.

Notes:
- Advisory lock (`pg_advisory_xact_lock(hashtext(p_trail_id))`) is a lighter alternative, but row-level FOR UPDATE is enough for this volume.
- No separate `submit_run` path needed for pioneer — this function is the pioneer path and the normal `submitRun` path handles everyone else after `calibrating`.

### Bonus migration content
- `CHECK` constraint on `trails.difficulty in ('easy','medium','hard','expert')`.
- Index `idx_trails_draft_by_spot on trails(spot_id) where calibration_status='draft'`.

---

## 6. GPS recording parametrization

| Parameter | Decision | Rationale |
|---|---|---|
| **Sampling rate** | 1 Hz (1 sample / s) | High fidelity for future split-time analysis; 30 min run = 1800 samples ≈ 110 KB JSON — well within jsonb comfort. Battery cost on modern phones is acceptable for <30 min sessions. |
| **iOS accuracy** | `Location.Accuracy.BestForNavigation` | Matches existing `useRealRun.ts` pattern. |
| **Android accuracy** | `Location.Accuracy.BestForNavigation` (maps to high accuracy + high freq) | Same. |
| **Distance filter** | 2 m | Drops stationary noise (waiting at gate, tree pause). Applied at buffer time, not at GPS subscription. |
| **Altitude** | Optional per point | iOS populates it, some Android skip. `alt: null` is allowed in the jsonb schema. |
| **Total timeout** | 30 min baseline, extendable 3× | At 30 min a 5 s full-screen countdown appears with a prominent "KONTYNUUJ (+10 min)" button and haptic tick. No tap → auto-stop fires (run either finalises or discards based on rider's last intent — see §9). Tap → recording continues for 10 min. Max 3 extensions → hard cap 60 min. Prevents the "forgot to stop" overnight drain while respecting legitimate long enduro lines. |
| **Background behaviour** | Foreground-only for MVP | Matches current run engine. If iOS locks / user tabs away, buffer freezes (continues on resume). Document in UI copy. |
| **Persisted buffer key** | `nwd:recording-buffer` | Single-key AsyncStorage; rider can only record one trail at a time. |

## 7. `trails.geometry` jsonb format

Versioned on day one so Sprint 4+ can add fields without a migration.

```json
{
  "version": 1,
  "points": [
    { "lat": 49.4103, "lng": 19.4521, "alt": 1054, "t": 0.0 },
    { "lat": 49.4104, "lng": 19.4523, "alt": 1052, "t": 1.2 }
  ],
  "meta": {
    "totalDistanceM": 1250.4,
    "totalDescentM": 180.5,
    "durationS": 142.3,
    "pioneerRunId": "uuid",
    "medianAccuracyM": 4.8
  }
}
```

- `t` in seconds since recording start (not wall clock — keeps the row stable if clocks drift).
- `alt` optional (null / missing both acceptable).
- `meta.pioneerRunId` is the run id that carved the geometry — lets future tooling trace provenance.

**Storage strategy**: store **every raw sampled point** after the 2 m distance filter. At 1 Hz × 30 min × ~60 B/point = ~110 KB max. jsonb deduplicates keys internally; Postgres will compress on-disk. We do **not** aggressively downsample — fidelity matters for gate geometry and future ghost replay. If measured growth ever becomes a problem, add a nightly job to LTTB-downsample rows older than N days.

Duplication concern: `runs.gps_trace` already holds the pioneer run's sampled points. This is fine — `runs.gps_trace` is the rider's personal record (raw-ish), `trails.geometry` is the canonical line future riders race against. Same data, two purposes. See Open Q8.

---

## 8. Leaderboard gating — state transitions

| `calibration_status` | What counts? | UI on `/trail/[id]` leaderboard section |
|---|---|---|
| `draft` | Nothing (no runs allowed) | Replaced by START RECORDING CTA. |
| `calibrating` | Only pioneer run visible | 1 row (pioneer). Label "TRWA KALIBRACJA · Następni pojedziesz jak kurator zweryfikuje trasę". |
| `verified` | All runs | Full leaderboard. |
| `locked` | All runs; no new curator edits | Same as verified, no curator actions. |

**Transition rules (Sprint 3):**
- `draft → calibrating`: inside `finalize_pioneer_run` RPC (atomic).
- `calibrating → verified`: curator-only action (UI in `/spot/pending` gets a "Verify trails" tab; out of this sprint's UI scope but the RPC should exist). Set to **manual-only** for Sprint 3; auto-promotion rules (e.g. after 3 runs within 30% of pioneer's time) are deferred.

**Gate engine rehydration** (`src/features/run/gates.ts`): takes a trail id, calls `fetchTrail(id)`, reads `geometry`, builds a corridor on the fly. Cache by `trail_id + geometry hash`. If `geometry` is null → returns the empty-corridor config (runs finalise as 'unverified', same as Checkpoint B). This means: a spot with an `active` curator-approved trail but still `draft` status won't gate correctly — exactly what we want (only pioneer's run can ever finalise correctly on a draft trail, and they go through `finalize_pioneer_run` not the normal gate engine).

---

## 9. Edge cases

| Case | Handling |
|---|---|
| App killed mid-recording | `recordingStore.ts` persists buffer + trail_id every 10 s. On next app launch, if a non-empty buffer with `attemptedAt` < 1 hour exists, show a restore prompt "Kontynuować nagranie trasy X lub odrzucić?". >1 hour → silently discard. |
| GPS signal lost mid-run | Keep recording; subsequent points flagged `interpolated: false` but with `accuracy: null` when the platform returned nothing. No interpolation in Sprint 3 — straight line from last known to next known is misleading; we just save gaps. |
| START tapped without a trail row | Guard in recording screen: if `?trailId` param missing or `fetchTrail` fails → show error "Najpierw dodaj trasę" with a back button to `/trail/new`. |
| Concurrent Pioneer race | Two riders both finishing `finalize_pioneer_run` within seconds. RPC is single-transaction with `FOR UPDATE` row lock; loser gets `already_pioneered` code. Loser's run row is NOT inserted (the whole RPC is atomic). UI shows "Ktoś cię wyprzedził! Zjedź jeszcze raz — będziesz #2." with a retry CTA. |
| Trail created but pioneer never runs | `draft` trail rows are orphans. Cleanup policy: after 30 days of no runs, cleanup job deletes. Out of scope here; just note it. |
| Rider creates a trail then deletes account | `trails.pioneer_user_id` FK ON DELETE SET NULL (already in migration 006). Trail stays, pioneer slot re-opens on next eligible run? No — Sprint 3 behaviour: trail stays pioneered, `pioneer_user_id = null` means "author deleted", still `calibrating`/`verified`. |
| Pioneer run weak-signal | RPC rejects with `weak_signal_pioneer` (Q12). Trail stays `draft`, pioneer slot still open. Rider sees Story 5 retry screen. Run row not inserted. |
| Low battery → phone suspends GPS | OS-level decision. Our buffer captures whatever arrives. Rider warned only if accuracy crosses the 20 m threshold. Battery optimisation toasts (e.g. Samsung) are out of scope. |
| Trail geometry shorter than 30 points on finalize | RPC rejects with `invalid_geometry` (Q11 — 30 samples after 2 m dedup ≈ 30 s ride minimum). User sees "Zbyt krótkie nagranie — zjedź dłużej i spróbuj ponownie." Trail row stays draft for retry. |
| 30 min auto-stop countdown (Q13) | At 30 min elapsed: full-screen 5 s countdown with prominent "KONTYNUUJ (+10 min)" button. No tap → auto-STOP. Tap → +10 min. Max 3 extensions = 60 min hard cap. Each extension fires a haptic confirmation. After the 60 min cap the app stops unconditionally and routes the buffer to normal finalisation. |
| User edits trail name after creation | Not supported in Sprint 3. Name is locked once created. |

---

## 10. UI / UX details — **decisions needed**

### Q1: Recording screen layout
**Option A (full-data)**: large timer, current speed (km/h), current altitude, GPS accuracy dot (green/yellow/red), STOP fullscreen button at bottom.
**Option B (minimal)**: huge timer only, tiny GPS accuracy dot in a corner, STOP takes the whole bottom half of the screen. Speed/altitude hidden — rider's not looking at the phone.

Spec recommendation: **Option B**. Rider is MTB — one glance, huge STOP area. Speedometer is a distraction and Apple's Health already does it better.

### Q2: Haptic feedback during recording
- **On start**: heavy tap (armed feeling).
- **On stop**: heavy tap + success notification pattern.
- **During recording**: nothing. No per-10s ticks — feels like an alarm and jars the ride.

Spec recommendation: **on-start + on-stop only**. Questions mid-ride haptics — reject.

### Q3: Audio feedback
**Option A**: no audio at all (current proposal).
**Option B**: subtle beep on start + stop (ear feedback even when phone is in jersey pocket).
**Option C**: spoken "Recording" / "Stopped" (accessibility angle).

Spec recommendation: **Option A — silent**. iOS audio session wrangling in the middle of a run is fragile, riders wear headphones with their own music, and a random app beep is rude. Accessibility (Option C) can be added in a follow-up once Voice Over support is considered properly.

### Q4: Countdown length before recording starts
**3 s** or **5 s**?
- 3 s matches the "tap, look up, go" flow. Rider already armed at start gate.
- 5 s is overly cautious — they'll tap early and wait.

Spec recommendation: **3 s** with per-second haptic ticks, big number on screen.

### Q5: Live GPS track on screen during recording
**Option A**: no map at all.
**Option B**: minimal line drawn on a clean dark canvas (no base tiles) showing just the path so far.
**Option C**: full map with tiles.

Spec recommendation: **Option A**. Rationale: battery (map rendering = GPU wake-up every frame), distraction (rider should be looking at the trail), and we don't have map tiles that respect the dark aesthetic off-line. Option B is nice-to-have but adds a new render path; Option C is a no.

---

## 11. Success criteria (Sprint 3 exit)

1. From a fresh install, a rider on an empty active spot can hit one CTA → fill one form → record → see their time + Pioneer badge. End-to-end in under 3 minutes total (excluding actual riding).
2. `trails.geometry` is populated for the newly-pioneered trail; the jsonb is valid v1 shape; Postgres doesn't choke.
3. `gates.ts` successfully rehydrates a corridor from `trails.geometry` for the pioneer's own future race run (so their second lap does verify normally).
4. Leaderboard on `/trail/[id]` shows the pioneer at #1 with their time.
5. Second rider on the same trail: their run completes, verification uses rehydrated corridor, their position is #2 if slower / #1 if faster than pioneer. Leaderboard ordering correct.
6. Concurrent pioneer attempts (two devices) — exactly one is recorded as pioneer, the other gets a clean "somebody beat you to it" message and can immediately re-race.
7. `tsc --noEmit` green. Sprint 1 (auth + profile + avatar) and Sprint 2 (submit spot, curator approve) flows unchanged.
8. Manual QA pass on a real walk outside with GPS — not just simulator.

---

## 12. Out of scope — Sprint 4+ backlog

- **Ghost rider**: render the pioneer's line + live rival line during a ranked race.
- **Split times**: auto-detect intermediate checkpoints (25% / 50% / 75% of distance).
- **Leaderboard period filters**: `day` / `weekend` / `season` scopes beyond `all_time` (schema already supports it via `period_type`).
- **Auto-promotion** `calibrating → verified` after N validated runs within tolerance.
- **Difficulty calibration** from actual recorded times (machine-tunes easy/medium/hard).
- **Social share**: share-sheet with auto-generated card (track preview + time).
- **Replay animation**: playback of your run as animated dot over the trail geometry.
- **Re-record pioneer**: curator can reset a trail to `draft` and let a new pioneer run; data migration for existing runs TBD.
- **Offline recording queue**: recording in Airplane Mode, sync on reconnect (runSubmit queue handles retry today, but pioneer path is more complex).
- **Rate limits** on `create_trail` (MVP: curator moderation is the throttle).

---

## 13. Resolved decisions

All prior open questions resolved in review. Summarised here so the spec is self-contained; the text above is already consistent with these answers.

| # | Decision | Applied in |
|---|---|---|
| Q1 | Recording screen layout = **minimal** (huge timer + huge STOP, nothing else). | §9 (now implicit), impl in `/run/recording.tsx`. |
| Q2 | Haptics = start tick (×3 countdown) + stop tick. No mid-ride haptics. | §3 Story 1 step 7; impl in `useGPSRecorder.ts`. |
| Q3 | Audio = silent. Accessibility deferred to backlog (§12). | §9. |
| Q4 | Countdown = **3 s** with per-second haptic tick. | §3 Story 1 step 7. |
| Q5 | No live GPS track during recording. Visualisation lives in `/run/result` (future Sprint). | §9; impl. |
| Q6 | Trail ID prefix = **`pioneer-<nanoid10>`**. Distinct from `submitted-<nanoid8>` (spots). | §5 `create_trail`. |
| Q7 | Pioneer run auto `is_pb = true` (first run ever on this trail). | §5 `finalize_pioneer_run` step 6. |
| Q8 | `trails.geometry` survives pioneer account deletion. FK already `ON DELETE SET NULL` on `pioneer_user_id`. Geometry is trail's property, not rider's. | §4 `accountDeletion.ts` copy update; migration 006 behaviour unchanged. |
| Q9 | Draft trail name uniqueness = **per-spot, case-insensitive**. | §5 `create_trail` step 6. |
| Q10 | Un-pioneer / reject-trail RPCs **deferred**. Sprint 4 when state machine is clearer. | §12 backlog. |
| Q11 | Minimum points for valid pioneer run = **30** (≈30 s @ 1 Hz after 2 m dedup). Was 20 in draft. | §5 step 4; §9 edge cases. |
| Q12 | Weak-signal pioneer runs = **blocked** with explicit `weak_signal_pioneer` error code. Pioneer geometry is canonical; noisy GPS would poison every future race. Non-pioneer runs still allowed to finalise as `weak_signal`. | §5 step 5; Story 5 in §3; §9 edge cases. |
| Q13 | 30 min timeout = **hard stop with grace**. 5 s full-screen countdown with "KONTYNUUJ (+10 min)" tap, max 3 extensions → 60 min hard cap. | §6 parameter table; §9 edge cases. |
| Q14 | Sampling rate = **1 Hz baseline** (adaptive deferred). | §6 parameter table. |
| Q15 | RPC name = `finalize_pioneer_run`. | §5. |

---

Ready to build on approval. Order: migration 008 → `api.ts` + hooks → `recordingStore.ts` → `useGPSRecorder.ts` → `geometryBuilder.ts` → `/trail/new.tsx` → `/run/recording.tsx` → `/spot/[id].tsx` + `/trail/[id].tsx` wiring → `runSubmit.ts` branch + `gates.ts` rehydration → `/run/result.tsx` pioneer badge + Story 5 rejection layout → `accountDeletion.ts` copy update.
