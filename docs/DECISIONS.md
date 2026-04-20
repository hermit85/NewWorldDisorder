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
