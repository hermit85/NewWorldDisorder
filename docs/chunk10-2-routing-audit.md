# Chunk 10.2 — Routing + Dead-End Audit

**Branch:** `feat/chunk10-2-pioneer-routing-fix` · **Trigger:** Darek
reported "nie mogę wrócić na home w symulatorze" + two trails stuck in
DB draft status after chunk 10.1 shipped.

## 1. Pioneer routing fix (commit 1)

### Root cause

`app/trail/new.tsx` Step 3 CTA called:

```ts
router.replace({
  pathname: '/run/active',
  params: { trailId, pioneer: '1', trailName },
});
```

- `/run/active` is the **ranked/training** run screen. It assumes the
  trail already has Pioneer geometry and runs the approach navigator +
  gate engine over it. A freshly-created draft trail has no geometry,
  so the gate engine never arms → rider can't start → `finalize_pioneer_run`
  is never called.
- `pioneer=1` param was **dead code** — nothing in `active.tsx` reads it.
- Missing `spotId` — recording requires it, active does not.

### Canonical Pioneer path (discovered in `app/trail/[id].tsx:131`)

```ts
router.push(`/run/recording?trailId=${trail.id}&spotId=${trail.spotId}`);
```

`/run/recording` uses `useGPSRecorder`, gates readiness, on stop
navigates to `/run/review?trailId=X&spotId=Y`. Review screen fires
`api.finalizePioneerRun(...)`.

### Fix

`app/trail/new.tsx` now replaces to `/run/recording` with `{trailId,
spotId}` params. Dropped the `pioneer=1` and `trailName` params
(neither read). `spotId` was already in scope from the screen's own
`useLocalSearchParams`.

## 2. Dead-end audit (commit 2)

All screens under `app/` except route groups and tab roots were
scanned for an interactive back-navigation affordance.

| Screen | Back nav | Notes |
|---|---|---|
| `app/+not-found.tsx` | ✓ | Auto-redirects to `/` |
| `app/__dev/approach-preview.tsx` | **✗ → fixed** | Pre-fix: `onBack={() => undefined}`. Now wires to router.back with replace-to-root fallback. Darek's reported dead-end. |
| `app/__dev/empty-states.tsx` | **✗ → fixed** | Pre-fix: only mock "← Wróć" Text. Now renders a real Pressable "← Wróć" pill at the top. |
| `app/__dev/mock-hero-on.tsx` | ✓ | Auto-redirects to /(tabs) |
| `app/__dev/polish-test.tsx` | ✓ | Pressable ← WRÓĆ → router.back |
| `app/auth/index.tsx` | ✓ | skip button + redirect on success |
| `app/help/index.tsx` | ✓ | Pressable → router.back |
| `app/onboarding/index.tsx` | ⚠️ | No mid-flow skip; final CTA redirects to /(tabs). Not a dead-end but single-exit. |
| `app/run/[id].tsx` | ✓ | Always-visible back (chunk 10.1 C-G) |
| `app/run/active.tsx` | ✓ | Exit handling via useNavigation |
| `app/run/recording.tsx` | ✓ | Stop CTA routes to /run/review; Alert on missing params |
| `app/run/rejected.tsx` | ✓ | Retry + back CTAs |
| `app/run/result.tsx` | ✓ | Always-visible back (chunk 10.1 C-G) |
| `app/run/review.tsx` | ✓ | Back + finalize CTAs |
| `app/settings/delete-account.tsx` | ✓ | Cancel + back |
| `app/spot/[id].tsx` | ✓ | Back arrow, fallback `/` |
| `app/spot/new.tsx` | ✓ | Header Wróć + per-step "← Krok N" |
| `app/spot/pending.tsx` | ✓ | Back to list |
| `app/trail/[id].tsx` | ✓ | Back |
| `app/trail/new.tsx` | ✓ | Header Wróć + per-step back |

### Interactive nav targets of `router.push`/`router.replace` — sweep

Every `router.push` / `router.replace` call in the codebase lands on
one of the screens above. All destinations now render a back affordance
or an auto-redirect, so chunk 10.2 resolves every known dead-end.

## 3. Not fixed here

- `app/onboarding/index.tsx` has no per-card skip — only the end-of-flow
  button progresses. This is a UX polish item, not a lock. Deferred.
