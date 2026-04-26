# Architecture Decision Records

Short records of non-obvious choices so future contributors (and future-us) don't have to reverse-engineer the intent from the code.

Format: each ADR has **Status**, **Context**, **Decision**, **Consequences**. Keep each under ~30 lines. When a decision is later reversed, add a new ADR that supersedes the old one rather than editing the original.

---

## ADR-001 — Account deletion implemented via Edge Function + cascade FKs

**Status**: Accepted (2026-03 — implicit from migration 005 + supabase/functions/delete-account).

**Context**: App Store Guideline 5.1.1(v) requires in-app account deletion. Supabase RLS alone cannot delete `auth.users`, and naive cascades are easy to miss.

**Decision**: Dedicated Edge Function `delete-account` performs (a) avatar storage wipe, (b) explicit deletes on every dependent table ordered child → parent, (c) `auth.admin.deleteUser`. Migration 005 adds `ON DELETE CASCADE` on every `profiles(id)` edge as defense in depth.

**Consequences**: Two code paths (cascade + explicit delete) stay in sync by convention. Any new table that references `profiles(id)` must update both migration 005 and the explicit-delete list in the Edge Function.

---

## ADR-002 — Curators have full status-transition control in MVP

**Status**: Accepted (2026-04, Sprint 2).

**Context**: `spots.status` can be `pending` / `active` / `rejected`. We could restrict transitions (e.g. rejected cannot return to pending, active cannot be un-approved) with a CHECK constraint or a state-machine RPC. For an MVP with one curator (hermit_nwd) and a small pending volume, the extra guardrails cost more than they save.

**Decision**: Curators can move a spot between any two statuses. The only enforced rules are (a) `submit_spot` RPC always writes `pending`, (b) `approve_spot` and `reject_spot` RPCs require the current status to be `pending` (prevents double-approving), (c) direct `UPDATE` via RLS has no state-machine check and is considered an operator escape hatch.

**Consequences**: Curator mistakes (flipping an active spot back to rejected) are recoverable but produce audit noise. If we grow to multiple curators or adversarial UGC, introduce a state-machine table + trigger and supersede this ADR.

---

## ADR-003 — Leaderboard gating lives in app layer, not the DB

**Status**: Accepted (2026-04, Sprint 2 — deferral).

**Context**: A ranked run should only count on a trail whose `calibration_status` is `verified` or `locked` (see migration 006). We could enforce this with a trigger on `runs` or a CHECK across tables via a deferred constraint. Same is true for "run's spot must be active."

**Decision**: Enforcement stays in the client submission path (`src/systems/runSubmit.ts` + `useRealRun.ts`). The DB allows any `insert` that passes RLS; it does not cross-reference `trails.calibration_status` or `spots.status` at run time.

**Consequences**: A malicious client (or a buggy one) can inject runs on draft trails; `counted_in_leaderboard` must be set by server RPC in a future sprint before that flag is load-bearing. For now it already is an app-written boolean, so we accept the risk. When we add a `submit_run` RPC, move the checks there and supersede this ADR.

---

## ADR-004 — PostGIS deferred until Sprint 3 calibration

**Status**: Accepted (2026-04, Sprint 2).

**Context**: Spot submission needs a proximity check (any pending/active spot within 500 m?) and trail calibration will eventually need distance-along-path and on-corridor math. PostGIS would be the right tool. Cost: extension install on Supabase, new tooling for the team, and a migration path for existing `double precision` lat/lng columns.

**Decision**: For Sprint 2's 500 m duplicate check, plain haversine over `double precision` columns is accurate to well under a metre at the latitudes we care about — good enough for a coarse dedup. Trails' `geometry` column is `jsonb` of `{lat,lng,altitude}` points for now; this is the simplest thing that can feed the existing client-side gate engine unchanged.

**Consequences**: No spatial indexes, so the proximity check is a sequential scan. Fine at O(10–100) spots; revisit at O(10 000). When Sprint 3 starts calibration work requiring on-path distance / corridor math, enable PostGIS, convert `trails.geometry` to `geography(LINESTRING)`, and supersede this ADR.

---

## ADR-009 — Bike park terminology (2026-04-20)

**Status**: Accepted (2026-04-20, post Sprint 3 MVP).

**Context**: Sprint 3 UI shipped with mixed user-facing terms: `ośrodek`, `spot`, `SPOT`, `POZA OŚRODKIEM`. `Ośrodek` (Polish for bike park) collides with resort / spa / wellness — ambiguous to a first-time user. `Spot` is international MTB jargon (Strava, Trailforks) but too generic for screen labels and alien to the Polish audience we target. The rest of the product (Phase 0–3 positioning) is bike-parks-first.

**Decision**: User-facing copy uses **`bike park`** as the single canonical term. Internal code, DB schema, API function names, routes, filenames retain `spot` as the legacy identifier. Split the surface (user-visible) from the implementation (developer-visible).

**Unchanged**: routes (`/spot/[id]`, `/spot/new`, `/spot/pending`), vars (`spotId`, `useSpot`, `activeSpots`), tables (`spots`), APIs (`submitSpot`, `approveSpot`, `deleteSpot`), filenames (`app/spot/*.tsx`), migration names.

**Changed**: every Polish user-facing string across the mobile app — titles, kickers, breadcrumbs, form labels, status pills, error copy, alerts. See the hotfix commit `fix(sprint-3): delete RPC + error propagation + bike park copy cleanup (ADR-009)` for the full list.

**Consequences**: a dev reading `spotId` in code and `bike park` on the screen needs to know they refer to the same thing. The header comments next to `Spot.submissionStatus` and in `deleteSpot` explain this. Accepted — full rename of the DB/API surface is a large cost for a naming win alone. Reopen if the dual vocabulary starts producing bugs (e.g. copy drift as the product grows).

---

## ADR-010 — Trailforks GPX/KML import REJECTED

**Context:** Briefly considered Trailforks as pre-calibration
data source to bypass physical Pioneer model bottleneck.

**Decision:** REJECTED. Not viable.

**Reason 1 — Commercial license:** Trailforks data is not
commercially usable without partnership agreement. Unauthorized
import = IP violation + legal risk.

**Reason 2 — Product model conflict:** Even if licensed,
auto-import breaks Pioneer tier system (ADR-005). Pioneer
status earns value from physical effort, not pre-existing
database lookup. Country First / Territory mechanics collapse
if trails pre-exist.

**Reason 3 — Community motivation:** Founding Pioneers Program
depends on scarcity + personal stake in calibration. Pre-loaded
trails eliminate both.

**Alternative paths kept open:**
- Solo founder calibration Phase 0 (current)
- Founding Pioneers recruitment Phase 1
- Official park partnerships Phase 3 (parks provide their own
  canonical data with permission)

**Status:** Locked. Do not revisit without written license
from Trailforks.

---

## ADR-011 — Orbitron → Rajdhani font swap

**Status**: Accepted (2026-04-20, post-MVP hotfix).

**Context**: Orbitron (Google Fonts build shipped via `@expo-google-fonts/orbitron`) has incomplete Polish Latin Extended-A coverage. Of the nine lowercase diacritics the app uses (ą ć ę ł ń ó ś ź ż) only `ó`/`Ó` are in the cmap — `ą ć ę ł ń ś ź ż` + caps are all missing. iOS falls back silently to a generic glyph, which on some renderers shows as `¬`. A trail named `Gałgan` rendered as `Ga¬gan`; HUD labels like `ZAKOŃCZ`, `KALIBRACJĘ`, `PIERWSZĄ`, `ODRZUĆ` were all affected. The app serves a Polish MTB community — broken trail names are a ship-blocker.

**Decision**: Replace Orbitron with **Rajdhani** everywhere the display font is used (`hudTypography.*`, `typography.timeHero` / `h1` / `h2`, plus every inline `fontFamily: 'Orbitron_*'`). Inter stays for body text, labels that already used it, and every `TextInput` (see `typography.input`).

**Rajdhani rationale**:
- Full Latin Extended-A coverage confirmed via `fontTools.ttLib` (all 18 Polish diacritics present in 400/500/600/700 weights).
- Sci-fi / tech aesthetic consistent with the existing game-HUD direction.
- Condensed proportions fit longer Polish words on the narrow phone layouts without forcing line breaks.
- SIL OFL license, distributed via `@expo-google-fonts/rajdhani`, drop-in compatible with the existing `useFonts()` pattern.

**Unchanged**:
- Inter for body + inputs (Polish-safe, humanist for readability at small sizes).
- The `typography.input` / `hudTypography.input` canonical pick from the preceding hotfix.
- `@expo-google-fonts/orbitron` removed from `package.json`.

**Consequences**: A small visual shift — Rajdhani is narrower than Orbitron at the same point size, so HUD headings look slightly more condensed. Acceptable trade-off for correctness; if the proportions read wrong in specific screens we can bump sizes locally. Reopen the decision only if Rajdhani itself turns out to be missing glyphs we need.

**Regression guard**: `app/__dev/polish-test.tsx` (route `/__dev/polish-test`, `__DEV__` only) renders every `typography.*` and `hudTypography.*` style with a full Polish sample + a live TextInput; used to verify on-device after the swap and guards against future font regressions.

---

## ADR-012 — Route identity, geometry, and leaderboard standard

**Status**: Accepted (2026-04-26). Supersedes the implicit "first pioneer wins, geometry pinned forever" model from migration 008 + 20260423180000.

**Context**: The pre-ADR-012 model treated `trail.official_name` (case-insensitive, exact match per spot) as the only anti-duplicate key, and the first pioneer's GPS trace as canonical geometry forever (`pioneer_user_id` immutable, `geometry` jsonb pinned on `finalize_pioneer_run`). This produced two incompatible failure modes:

1. **Naming sprawl** — `Kometa`, `Kometa 2`, `Kometa V2`, `Kometa bis`, `Kometa poprawna` all pass the exact-match check, fragmenting a single physical line across multiple leaderboards.
2. **Frozen wrong geometry** — a pioneer with weak GPS, missed gate, or pocketed phone ships an incorrect line. Subsequent riders ride the same physical trail but their corrected GPS doesn't fix the canonical geometry; their only escape is to create `Kometa 2`, looping back to failure 1.

The TrustBadge UI ("trasa próbna · czasy tymczasowe dopóki społeczność nie potwierdzi") promised crowd verification; the backend had no RPC that would actually flip a trail to verified — see [crowd_validation_gap memory pin](memory/crowd_validation_gap.md).

**Decision** — North star:

> One public trail name. Versioned geometry. Versioned gates. Runs count only after crossing official start and finish gates and matching the route corridor.

### Core principles

1. Trail identity is not geometry. `trails` carries the public name + lifecycle; `trail_geometry_versions` carries the line.
2. A pioneer run creates a candidate, not permanent truth.
3. Trail name is stable; geometry is corrected and versioned in place.
4. Start and finish are gates (center + radius + direction vector), not GPS points.
5. Leaderboards are computed views: `runs WHERE trail_id=X AND matched_geometry_version_id=current_geometry_version_id AND counted_in_leaderboard=true`. No separate `leaderboard_versions` table — historical rankings reconstruct from raw traces against any geometry version.
6. Raw GPS traces persist in `run_points` (one row per fix); enables recompute against future geometry corrections.
7. Duplicate prevention is two-tier: deterministic name normalization + geo-overlap detection. **Geometry is the final arbiter, name is only a filter.**
8. Wrong geometry is fixed through correction flow, never by creating duplicate trail names.

### Naming — two deterministic keys

- `normalized_name` (hard unique per spot): lowercase, trim, strip diacritics, remove punctuation, collapse whitespace. `KÓMĘTA!!! → kometa`.
- `duplicate_base_key` (soft warn / redirect): same as normalized_name plus strip garbage suffixes — trailing digits, `v\d+`, `bis`, `copy`, `new`, `poprawna`, `prawdziwa`, year suffixes. `Kometa 2 → kometa`, `Kometa V2 → kometa`, `Kometa bis → kometa`, `Kometa 2025 → kometa`.

**Do not strip semantic route suffixes** (`elite`, `pro`, `black`, `beginner`, `blue`, `red`, `flow`, `dh`, `jump`). They may be real variants — let geometry decide. `Kometa Pro` passes both name keys; if its geometry overlaps `Kometa` ≥85%, geo-overlap auto-merges the run.

### Variants

Materially different physical lines (`Kometa Elite`, `Kometa Beginner`, `Kometa Black`) are **separate trails** with separate leaderboards, connected only via aliases for discovery. No `runs.line_variant` model — mixing different lengths/drops/profiles in one leaderboard is unsound for gravity racing.

### Lifecycle

`trails.status`: `draft → provisional → verified` plus side states `disputed | merged | archived`. No `locked` for now (use admin flag if needed later).

`trail_geometry_versions.status`: `candidate | canonical | superseded`. Soft-delete via `archived_at`/`rejection_reason` instead of an explicit `rejected` state.

Visibility is computed from trail status, not stored: `draft → owner-only`, `provisional → deeplink + "Do potwierdzenia" section`, `verified → public hub`, `disputed → hidden+warned`, `merged → redirect`, `archived → hidden`.

### Verification — three tracks

- **Track A (crowd auto-verify):** ≥3 unique riders + match_score ≥0.80 + start/finish gate consensus + zero conflicts → auto promote provisional → verified.
- **Track B (time + admin nudge):** after 30 days + ≥1 confirm + zero conflicts → admin queue for 1-click verify. Without this, low-traffic trails would die in `provisional`.
- **Track C (curator GPX):** curator/admin uploads GPX → starts as `verified`, skips provisional.

### Pioneer + correction flow

`finalize_pioneer_run` runs `check_trail_overlap(spot_id, geometry)` against existing trails in the same spot:

| Overlap | Action |
|---|---|
| ≥85% | auto-merge: run lands in existing trail's leaderboard; no new trail created |
| 60–85% | candidate / review queue |
| <60% | new provisional trail, current pioneer claims |

Correction runs (explicit `recording_mode='correction'`) and passive correction candidates (`normal_run` with match_score 0.60–0.85) feed the `trail_geometry_versions` queue. Weights: passive normal 1.0×, explicit correction 1.5×, trusted rider 1.5–2.0×, curator GPX 5.0× / instant canonical.

### Anti-gaming guards (mandatory with crowd verification)

- 1 correction proposal per rider per trail per 24h.
- Minimum account age / reputation for correction weight to count.
- Shortcut detection: candidate `distance_m` < canonical by >5–8% → never auto-promote, always admin queue.
- Candidates that materially shorten the canonical line require explicit admin approval regardless of supporter count.

### Direction

`trail_geometry_versions.direction_type`: `descending | ascending | loop_cw | loop_ccw | bidirectional`. Bike park default `descending`. Run validation rejects reverse crossings (start gate after finish gate timestamp).

### Timing

Time is **never** wall-clock from START tap to STOP tap. Time = `finish_gate.crossed_at − start_gate.crossed_at`. Copy must instruct: "Włącz nagrywanie przed startem. Zatrzymaj się dopiero po mecie. Czas policzymy automatycznie po przecięciu bramek."

### Implementation phases

| Phase | Scope | Goal |
|---|---|---|
| **1** | Step 0, normalized_name + duplicate_base_key, trail_name_aliases, correction mode, raw trace (run_points), trail_geometry_versions, check_trail_overlap RPC, geo-overlap auto-merge in finalize_pioneer_run | Base stops rotting |
| **2** | match_score, unique-rider confirmations, passive correction consensus, Track A/B/C verification, TrustBadge wired to backend | Trails actually verify |
| **3** | start_gate / finish_gate as gates (not points), crossing-based timing, route corridor, recompute from raw_trace, leaderboard as query over geometry_version | Honest racing |
| **4** | Curator GPX import, admin review queue, merge/split, dispute resolution, full anti-gaming guards | Scale + ops |

**Consequences**: Larger refactor than any prior ADR — touches `trails`, `runs`, `finalize_pioneer_run`, the trail/new flow, the leaderboard query, and ships new tables (`trail_geometry_versions`, `run_points`, `trail_name_aliases`, `route_review_queue`). Each phase ships independently and delivers value alone, but Phase 1 is non-negotiable before any further user growth — without `normalized_name` + geo-overlap auto-merge, every new rider adds entropy to the trail catalog faster than Phase 2+ can clean it.

Pre-ADR data: existing 4 Słotwiny trails (Gałgan / Dookoła Świata / Kometa / Dzida) keep their adhoc geometry as Phase 1 ships, then re-enter the lifecycle as `provisional` once the verification tracks land. Curator GPX import (Track C) is the long-term right answer; until then, pioneer + crowd verification carries the load.

---

## ADR-013 — E2E framework: Detox over Playwright (with Playwright reserved for the web preview)

**Status**: Accepted (2026-04-26, audit follow-up).

**Context**: Audit identified a hard gap — zero E2E tests cover the most failure-prone paths of NWD: anon → onboarding → auth → first ride → submit → leaderboard, Pioneer geo-overlap auto-merge (Phase 1.3), Smart Suggest two-tier reject (Phase 1.4), crowd-verify Track A flip (Phase 2.2), crossing-based timing (Phase 3), curator import + merge + admin queue (Phase 4). All five flows touch native modules (background location, foreground GPS sampling, haptics, secure auth, deep link callbacks, AsyncStorage hydration). The unit suite + RPC mocks pin business logic but do not catch native-bridge regressions or layout shifts on real device chrome.

**Two candidates**:

1. **Playwright** — Microsoft's web-and-mobile e2e tool. Mature, parallel by default, excellent debugging UX, widely adopted outside RN. Native-mobile support via Appium / WebDriver bridge.
2. **Detox** — Wix's e2e tool purpose-built for React Native. Synchronous-by-default test runner that waits on RN's bridge / Reanimated frames automatically. Drives the real iOS Simulator + Android Emulator.

**Decision**: Adopt **Detox as primary** for the iOS app (and later Android). Reserve **Playwright for the `nwd-web` preview** if/when web ever ships as a real surface (today it is dev-only).

**Rationale (Detox over Playwright for the mobile app)**:
- *Native-bridge awareness*. Detox knows when the RN bridge is busy (Reanimated frame in flight, fetch pending, AsyncStorage write debounced). Playwright via Appium polls; Detox waits. NWD relies on Reanimated for the gate/HUD animations, the run timer's tabular-nums hero, and the pulsing armed dot — Playwright introduces flake on these.
- *Real iOS Simulator coverage*. Detox runs against the same simulator we use during development (already booted in this session). Playwright/Appium needs a separate WebDriver session and re-installs the app on each suite. With our Sentry session-replay + native frames tracking, identical simulator surface matters.
- *Background location story*. Phase 1 shipped `armRankedWithPreflight` (always-location permission preflight). This is a native modal. Detox can detect + auto-accept system dialogs via `device.launchApp({ permissions: { location: 'always' } })`. Playwright via Appium can do this too but with brittle selectors.
- *Maintainer alignment*. Detox is RN-native; the project tracks Expo SDK upgrades. Playwright's mobile path is a Microsoft side-project — RN compatibility is best-effort.
- *Setup cost is the same*. Both need a CI matrix with iOS Simulator. Detox additionally needs a debug build of the app (we already produce one for Expo Go testing).

**Why Playwright doesn't disappear entirely**: the `nwd-web` preview at port 8089 is real and sometimes ships UI fixes that the audit can verify in-browser (we used it in this session for /admin/queue auth gate, /trail/new Step 0 dialog scaffolding, /help canonical migration). When the web preview becomes a public surface (rider invite landing, season recap pages), Playwright is the right tool there. Until then it's a "we know how to add it later" reservation.

**Phase plan (Detox)**:
1. Install Detox + a single smoke spec (anon → /onboarding → tap "WEJDŹ DO LIGI" 3× → /auth) within an iOS dev build. Goal: prove the harness works end to end.
2. Add Pioneer happy-path: /trail/new → fill Step 1 → tap "ZACZNIJ ZJAZD" → mock GPS via `device.setLocation` → finish_gate cross → /run/result.
3. Add the auto-merge regression: prep DB with a canonical Kometa, replay GPS that hits Kometa's line within 25 m → assert `auto_merged=true` payload + DB `runs.matched_geometry_version_id` points at Kometa.
4. Two-tier name guard: `Kometa 2` → Smart Suggest dialog visible → "TO INNA TRASA" → re-fire with forceCreate=true.
5. Crowd-verify Track A: prepare 3 distinct rider sessions (3 simulator profiles), each rides → assert trust_tier flips from `provisional` to `verified`.

**Consequences**: ~1 day setup (Detox config + iOS Simulator pinned via xcrun simctl), ongoing CI cost ~2-3 minutes per spec on a green run. Each new ADR phase carries a "+1 e2e spec" expectation in its definition of done. The unit tests (currently 150) still cover business logic; Detox covers native-bridge and integration. Playwright stays parked as `docs/decisions` reference until a public web surface ships.
