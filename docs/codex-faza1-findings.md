# Codex cross-check — FAZA 1 findings (2026-04-24)

Codex review returned cross-check on commits `af7eff4`, `ad25bb7`,
`3e58b2c`, `5546bfc`, `2b32144`. Raw summary below; fixes tracked
in this branch.

---

## P0 (blokery)

### P0.1 · `drainBackgroundBuffer` stale state in `useRealRun.ts`
Processing backlog synchronously advances `lastProcessedTsRef` past
samples that were evaluated against a stale `stateRef.current`. On a
deep backlog (long background window), the finish gate can be missed
because the phase transition from `armed_ranked` → `running_ranked`
happens mid-drain but the remaining samples in the same tick still
see `isArmed=true`.

Fix options:
- Local synchronous state machine in `processSample` that mirrors the
  phase flag, updated per-sample rather than via `setState`.
- Or: break drain after start-crossing fires and re-schedule the rest
  on the next tick after state commits.

Files: `src/systems/useRealRun.ts:330,333,397,435`

### P0.2 · Duration from wall-clock `Date.now()`, not gate crossings
`traceCapture.beginTrace/finishTrace` write `Date.now()` for both
timestamps. F1#9 server RPC validates
`|finished_at - started_at - duration_ms| ≤ 2000ms` — but all three
come from the same wall-clock source, so this check proves nothing.
Real ranked duration should be
`finishCrossing.crossingTimestamp - startCrossing.crossingTimestamp`
(gate engine already carries both).

Files: `src/systems/useRealRun.ts:504,514`, `src/systems/traceCapture.ts:32,50`,
`src/features/run/useRunGateEngine.ts:238,303`.

---

## P1

### P1.1 · AppState active listener for permission refresh
After the Alert deep-links to Settings and rider grants Always
permission, nothing calls `permission.refresh()` on return. Rider
sees stale denied state until remount.

File: `app/run/active.tsx` — add AppState `change` listener calling
`permission.refresh()` when `next === 'active'`.

### P1.2 · `finalize_seed_run` RLS — require `submitted_by = auth.uid()`
For pending spots, curator/moderator bypass is fine, but regular
caller should match the run's owner. New migration needed.

---

## P2 (backlog)

- `GET DIAGNOSTICS row_count` check in `20260423190000` migration L162
  — prove single update occurred.
- Pre-arm UI mode derived from `canRank` instead of `state.mode`.
- Boundary tests for `GATE_VELOCITY_MIN_MPS` (walk-speed reject,
  committed-rider accept).

---

## Fix order (agreed 2026-04-24)

1. P0.2 — gate timestamps (most trust-critical; tightens F1#9 check)
2. P0.1 — drain refactor
3. P1.1 — permission refresh
4. P1.2 — RLS finalize_seed_run
5. P2 → backlog

---

## Positives (Codex noted)

- F1#7 math is correct — local planar projection with cos(lat) is
  appropriate for bike-park segment lengths.
- F1#8 UI copy is rider-readable.
- F1#9 RLS hardening (with check on counted_in_leaderboard) is the
  correct layering.
- F1#10 adapter boundary is clean; precedence is documented.
