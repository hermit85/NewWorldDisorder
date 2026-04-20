# Sprint 2 — Submit Spot Flow

Rider can submit a spot; curator reviews a pending queue and approves or rejects. Builds on migration 006 (`spots.status`, `submitted_by`, curator role, RLS).

Migration 006 already allows authenticated clients to `INSERT` a `pending` spot directly and a curator to `UPDATE` it. This sprint wraps those writes in RPCs so the client never has to pick primary keys or wall-clock timestamps, and the proximity + role checks live next to the DML.

---

## 1. Goals

- Rider submits a spot in ≤ 15 seconds from home screen with nothing but a name and a GPS fix.
- Curator (hermit_nwd today) sees pending queue within one tap of home and approves/rejects with one CTA each.
- Submitted spots never appear to other riders until a curator flips them to `active`.
- Duplicate near-by spot submissions are caught and shown to the rider before they hit the queue.

## 2. Non-goals (explicit)

- Photos / attachments on a submission (later sprint — storage bucket + moderation).
- Per-trail submission / calibration UI (that is Sprint 3; here we only materialize the spot row, not its trails).
- Curator role management UI (hermit_nwd is promoted by SQL; no UI yet).
- Map picker for submission location — v1 pins the current GPS position, no manual drag.
- Moderation reason templates or appeal flow.

---

## 3. User stories

### Rider — "nothing around me, I found a new spot"
1. Opens the app, tab bar "Home" — sees copy "Brak spotów w pobliżu" with the CTA "Zgłoś nowy spot".
2. Tap CTA → submit screen with GPS acquiring.
3. GPS locks → form enables. Types "Las Lipowy".
4. Tap "Zgłoś" → toast "Spot zgłoszony, oczekuje zatwierdzenia".
5. Back on home, sees an orange "oczekuje" card in the spots list — greyed out, not tappable as a race arena but readable so the rider remembers what they submitted.

### Curator — "review the queue"
1. On home, sees a banner "Pending spots: 3".
2. Tap banner → `app/spot/pending.tsx` list. Each card: name, submitter username, distance from curator, "Zatwierdź" / "Odrzuć" buttons.
3. "Zatwierdź" → immediate optimistic update, spot disappears from pending list.
4. "Odrzuć" → inline reason input, min 3 chars, then reject. Same optimistic update.

---

## 4. Files

### New

| Path | Purpose |
|---|---|
| `app/spot/new.tsx` | Screen: submission form. GPS panel + name input + submit CTA. (`new` — Expo Router convention for the "create" route.) |
| `app/spot/pending.tsx` | Screen: curator-only pending queue. Redirects riders home. |
| `src/services/spotSubmission.ts` | Glue: duplicate-proximity check, offline queue, RPC invocation. Mirrors `src/services/accountDeletion.ts` shape. |
| `supabase/migrations/007_spot_submission_rpcs.sql` | `submit_spot`, `approve_spot`, `reject_spot` functions. |

### Modified

| Path | Change |
|---|---|
| `app/(tabs)/index.tsx` | (a) Empty state when no active spots in venue list: shows CTA "Zgłoś nowy spot". (b) For curator role: inline banner "Pending spots: N". (c) Render rider's own `pending` spots inline with a greyed "oczekuje" badge. |
| `src/lib/api.ts` | Add `submitSpot`, `listPendingSpots`, `listMyPendingSpots`, `approveSpot`, `rejectSpot`. Return discriminated-union result types (`{ ok: true, … }` / `{ ok: false, code, message }`) — no throws. |
| `src/hooks/useBackend.ts` | Add `usePendingSpots()` (curator only — returns `{ status: 'unauthorized' }` for riders) and `useMyPendingSpots()` (rider's own). |
| `src/constants.ts` | Add `DUPLICATE_RADIUS_M = 500`, `SPOT_NAME_MIN = 3`, `SPOT_NAME_MAX = 80`. |

### Not touched
`src/systems/saveQueue.ts` — we reuse the pattern but the submission queue is a separate AsyncStorage key; the existing run save queue stays focused on runs. A shared abstraction can come later.

---

## 5. Migration 007 — RPC contracts

All three functions are `security definer` with `set search_path = public` to lock down the execution path. Each function does its own auth check against `auth.uid()` — the RPC is the only privileged write path, so RLS policies on `spots` can stay strict.

### `submit_spot(p_name text, p_lat double precision, p_lng double precision)`

Returns: `jsonb` shaped as one of:
- `{ "ok": true, "spot_id": "<text>" }`
- `{ "ok": false, "code": "unauthenticated" }`
- `{ "ok": false, "code": "name_too_short" | "name_too_long" }`
- `{ "ok": false, "code": "duplicate_nearby", "near_spot_id": "<text>", "near_spot_name": "<text>", "distance_m": <int> }`

Behaviour:
1. Reject if `auth.uid()` is null.
2. Trim name; reject on length < 3 or > 80.
3. Proximity check against any `active` OR `pending` spot within `DUPLICATE_RADIUS_M` (500 m) using haversine on `center_lat`/`center_lng`. If hit, return `duplicate_nearby` with the nearest match.
4. Otherwise generate `id` as `submitted-<8-char-nanoid>` (text PK — reserved prefix so we can distinguish user submissions from seeded legacy IDs if they ever come back).
5. Insert row with `status='pending'`, `submitted_by = auth.uid()`, `center_lat`/`lng` from args, `name` trimmed.
6. Return `{ ok: true, spot_id }`.

The proximity check is the reason for an RPC; doing it client-side is a TOCTOU race across concurrent submissions.

### `approve_spot(p_spot_id text)`

Returns: `jsonb`:
- `{ "ok": true }`
- `{ "ok": false, "code": "not_curator" | "not_found" | "not_pending" }`

Behaviour:
1. Require `auth.uid()`'s profile to have `role in ('curator','moderator')` — else `not_curator`.
2. Load target spot; if missing → `not_found`.
3. If `status <> 'pending'` → `not_pending` (prevents re-approving / flipping a rejected spot without going back through submission).
4. `UPDATE spots SET status='active', approved_by=auth.uid(), approved_at=now(), rejection_reason=null WHERE id=p_spot_id`.

### `reject_spot(p_spot_id text, p_reason text)`

Returns: `jsonb`:
- `{ "ok": true }`
- `{ "ok": false, "code": "not_curator" | "not_found" | "not_pending" | "reason_too_short" }`

Behaviour:
1. Curator check as above.
2. `p_reason` trimmed; reject if length < 3.
3. Spot must be in `pending`.
4. `UPDATE spots SET status='rejected', approved_by=auth.uid(), approved_at=now(), rejection_reason=p_reason WHERE id=p_spot_id`.

Approval / rejection could also go through direct `UPDATE` under the existing RLS policy from migration 006. We pick an RPC because it:
- Atomically sets `status` + `approved_by` + `approved_at` + (optional) `rejection_reason`.
- Keeps the "must be pending" state-machine rule next to the write.
- Gives the app a single function to call regardless of which role fields the schema grows later.

### Migration notes
- No new tables; pure `create or replace function` plus one additional RLS policy on `spots` (below).
- `grant execute on function ... to authenticated` for all three.
- No `revoke` on the existing direct-INSERT RLS — RPC coexists with the policy, so anyone experimenting from SQL editor or future tools still works.

### Extra RLS: submitter reads own pending spots

Migration 006's read policies only cover `status='active'` (all riders) and any status (curators). That means a rider cannot `SELECT` their own just-submitted `pending` row — `useMyPendingSpots` would silently return empty. Fix: add

```sql
create policy "Submitter reads own pending spots"
  on public.spots for select
  using (submitted_by = auth.uid());
```

This is additive (Postgres ORs `SELECT` policies), so curators keep their full view and riders still only see active spots plus their own pending/rejected.

---

## 6. API layer — `src/lib/api.ts` additions

All functions return a discriminated union `Result<T>`:
```
type Ok<T>  = { ok: true; data: T }
type Err    = { ok: false; code: string; message?: string; extra?: unknown }
```

- `submitSpot({ name, lat, lng }) → Result<{ spotId }>` — calls `rpc('submit_spot', …)`, surfaces `duplicate_nearby` extra as `{ nearSpotId, nearSpotName, distanceM }`.
- `listPendingSpots() → Result<PendingSpot[]>` — `SELECT` via RLS (curator visibility). For riders this should still work but return `[]` because RLS hides pending rows; we don't rely on that for the permission gate (that's role-based in the hook).
- `listMyPendingSpots() → Result<PendingSpot[]>` — `.eq('submitted_by', auth.uid()).eq('status','pending')`. Riders need this so their own submissions show up before approval.
- `approveSpot(spotId) → Result<void>`
- `rejectSpot(spotId, reason) → Result<void>`

Demo-mode fallback: when `isSupabaseConfigured === false`, all five return `{ ok: false, code: 'demo_mode' }` rather than pretending to succeed (`useBackend.ts` already follows this "never fake an empty state" rule).

---

## 7. Hook layer — `src/hooks/useBackend.ts` additions

- `usePendingSpots(): { status: 'loading'|'data'|'error'|'unauthorized'|'signed-out'; spots?: PendingSpot[]; error?: string }`.
  - `unauthorized` when profile role isn't curator/moderator — pending.tsx uses this to redirect.
  - Refreshes on the `useRefresh` signal after approve/reject mutations.
- `useMyPendingSpots()` — same shape minus `unauthorized`; never filtered by role.
- No dedicated mutation hooks — `submitSpot` / `approveSpot` / `rejectSpot` are called imperatively from screens so the loading state lives in the screen's local state.

---

## 8. `src/services/spotSubmission.ts` responsibilities

- `submitSpotWithQueue({ name, lat, lng })`:
  1. If online → call `api.submitSpot`. Propagate full Result up.
  2. If offline (caught network error from supabase-js, or pre-flight `NetInfo` check) → stash `{ name, lat, lng, attemptedAt }` in `AsyncStorage` under `nwd:pending-submissions` and return `{ ok: true, data: { spotId: null, queued: true } }`.
  3. On app foreground + connectivity restore → drain queue, call `api.submitSpot` for each, surface toast on success/failure. Hook into the same `AppState` listener `saveQueue.ts` uses (no new listener).
- `findDuplicateNearby({ lat, lng })`: optional client-side pre-check against the active-spots list that's already in memory from `useSpots`, so the user gets a warning before even submitting. Server-side check in the RPC is the authoritative gate; this is just UX.

---

## 9. Screen specs

### `app/spot/new.tsx`
**States**: `gps_pending` → `ready` | `manual_entry` → `submitting` → `success` | `error_duplicate` | `error_network` | `error_validation` | `error_permission_denied`.

- `gps_pending`: spinner + "Szukam sygnału…" text. Uses `src/systems/gps.getCurrentPosition` (existing). Below spinner: subdued link "Ręcznie wpisz lokalizację" which transitions directly to `manual_entry`. Timeout 20s → `error_permission_denied` if permission missing, else stays with retry + the same manual link.
- `ready`: shows `{ lat, lng }` in small caption + name `TextInput` (autofocus, maxLength 80). Submit button disabled until name length ≥ 3. A discreet "Użyj innej lokalizacji" link switches to `manual_entry` (same screen, coords become editable).
- `manual_entry`: two small numeric `TextInput`s for lat / lng (comma or dot separator, client-side parsed, range checked `-90..90` / `-180..180`). Name input identical to `ready`. Used when GPS was denied or when the rider is submitting a spot they aren't physically at (e.g. reporting from home). No map picker in v1.
- `submitting`: disabled CTA with spinner.
- `success`: 800ms success toast, then `router.replace('/(tabs)')`. Trigger `useRefresh.triggerRefresh()` so home re-queries `useMyPendingSpots`.
- `error_duplicate`: shows the existing spot's name + distance and a single CTA "Otwórz istniejący" → `router.replace('/spot/:id')`. No "submit anyway" path in v1 (design decision).
- `error_network`: "Brak połączenia. Zapisano na później." → submission already queued → same `router.replace` as success.
- `error_permission_denied`: explanation of why we need GPS, "Otwórz ustawienia" `Linking.openSettings()` button, *and* a prominent "Wpisz ręcznie" link that flips to `manual_entry`. A GPS denial is not a dead end.

### `app/spot/pending.tsx`
- Gate: if `usePendingSpots().status === 'unauthorized'` → `router.replace('/(tabs)')` on mount. Riders cannot reach this screen by URL.
- List: `FlatList` of `PendingSpotCard`. Empty state: "Brak spotów w kolejce".
- Each card: name, submitter username, submitted-at relative time, distance from curator's current position, approve/reject CTA pair.
- Reject CTA: expands inline to a `TextInput` (min 3 chars) + "Odrzuć" confirm. Cancel collapses.
- After approve/reject: optimistic remove from list; on RPC failure, re-insert + toast with error code.

### `app/(tabs)/index.tsx` — modifications only

Three distinct inserts:
1. **Rider, no active spots in current venue**: replace current "pick a venue" block with the `<EmptyState>` component (already exists at `src/components/ui/EmptyState.tsx`) + "Zgłoś nowy spot" CTA → `router.push('/spot/new')`.
2. **Curator, any role**: when `usePendingSpots().spots.length > 0`, render a `<StatusBanner variant="info">` (already exists) near the top: "Pending spots: N" → tap → `/spot/pending`.
3. **Rider's own pending submissions**: `useMyPendingSpots()` list, rendered under the active spots list with a header "Oczekuje na zatwierdzenie" and muted card styling. Cards are not tappable as race arenas.

---

## 10. Edge cases

| Case | Handling |
|---|---|
| GPS permission denied | Submit screen `error_permission_denied` state with an explicit "Wpisz ręcznie" link to `manual_entry`. Permission denial is not a submission blocker. |
| GPS unavailable (airplane / indoors, no fix in 20s) | Retry prompt + "Ręcznie wpisz lokalizację" link to `manual_entry`. Rider can always fall back. |
| Rider submits from off-site (e.g. planning from home) | `manual_entry` state is the supported path — they type lat/lng themselves. Server still runs the duplicate-proximity check on those coords. |
| Offline at submit | `spotSubmission.ts` queues to AsyncStorage; CTA shows "Zapisano na później." Same re-drain as run queue. |
| Duplicate within 500 m | Server RPC returns `duplicate_nearby`. Screen shows the matching spot with "Otwórz istniejący". |
| Name fails validation | Client blocks submit if < 3 chars (CTA disabled). Server still returns `name_too_short` / `name_too_long` as defense in depth. |
| Two curators race on the same pending spot | RPC's `status <> 'pending'` check. Second curator gets `not_pending` and the UI refreshes the list. |
| Approved spot has no trails yet | Home view treats it as a normal active spot; trail list simply empty with an EmptyState until pioneers add trails (Sprint 3 problem). |
| Rider deletes their account while they have a pending spot | Migration 006 set `submitted_by ON DELETE SET NULL`. The pending spot stays for the curator to approve or reject on content merit — we deliberately do not auto-delete orphaned submissions. Pending screen shows "anonim" for null submitters. |
| hermit_nwd is the only curator and also submits a spot | Self-approval is permitted by RPC (no author check in approve). That's fine for single-curator bootstrap; the UGC-policing moderator role comes later. |

---

## 11. RLS summary after Sprint 2

Writes on `spots` table after this sprint:
- RLS direct INSERT (migration 006): still allowed, used by legacy/manual paths.
- RPC `submit_spot`: preferred client path, server-authored `id`, server-side dedup.
- RLS curator UPDATE (migration 006): still allowed for curator.
- RPC `approve_spot` / `reject_spot`: preferred client path, enforces state machine.

No new grants needed beyond `execute` on the three functions for `authenticated`.

---

## 12. Resolved decisions

Captured from review; no longer open. Cross-linked to ADRs in [docs/DECISIONS.md](DECISIONS.md) where relevant.

1. **Spot ID format** → `submitted-<nanoid8>`. Not slug-based (collision risk on repeated names).
2. **"Submit anyway" on duplicate** → out of v1. Duplicate response shows the existing spot with one CTA "Otwórz istniejący". No force flag.
3. **Rejection reason visible to submitter** → yes. Home card shows `Odrzucony: <reason>` with a single "OK rozumiem" dismiss action that marks it locally hidden (AsyncStorage key `nwd:dismissed-rejections:<spot_id>`). No server-side dismissal; if the user reinstalls, the rejection card reappears — acceptable for v1.
4. **Curator push notifications** → out of v1. Home-screen badge "Pending spots: N" is the only surfacing for hermit_nwd.
5. **Rate limit on `submit_spot`** → out of v1. Logged to BACKLOG (§13).
6. **Duplicate-check math** → haversine on `double precision`. PostGIS deferred to Sprint 3 (see ADR-004).

## 13. Backlog (post-Sprint-2)

- Rate-limit / per-user quota on `submit_spot` (e.g. max 5 pending per user, max 20 submissions per day globally).
- Photo attachments + moderation on submissions.
- Curator push notifications for new pending spots.
- Map picker for `manual_entry` instead of raw numeric inputs.
- Server-side dismissal of rejection cards so reinstall doesn't resurface them.
- Appeal / resubmit-with-context flow for rejected spots.

---

Ready to build. Order: migration 007 → `api.ts` + `useBackend.ts` → `spotSubmission.ts` → `app/spot/new.tsx` → `app/spot/pending.tsx` → home wiring.
