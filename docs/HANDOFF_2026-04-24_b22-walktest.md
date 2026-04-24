# Handoff — 2026-04-24, B22 walk-test hotfix + B23 telemetry

Ja-z-poprzedniej-sesji do ja-z-następnej. Przeczytaj to **pierwsze**,
potem `memory/MEMORY.md` pins, potem user zapyta co dalej.

## Gdzie jesteśmy

- Branch `main`, clean tree, in-sync z `origin/main`.
- HEAD: **`b1496c7`** `feat(run): persist gate diagnostics into verification_summary (B23)`.
- Poprzedni commit: **`74b0e8a`** `fix(run): B22 walk-test hotfix — relax gate thresholds`.
- B22 (`2a55622`) na TestFlight, **walk-test failed** — user cytat niżej.
- **B23 build został odpalony** (`eas build --platform ios --profile
  production --auto-submit --non-interactive`) **po** Codex cross-checku
  (verdict: match na root cause, safe to ship warunkowo, telemetry gap
  addressed w `b1496c7`). Jeśli build w toku — monitor na
  `tasks/bbdavw3k0.output`. Jeśli skończony → B23 na TF gotowe do walk-testu.
- Tests: 77/77 jest pass, `npx tsc --noEmit` clean.
- Migration `20260427000000_fetch_scoped_leaderboard.sql` już na prod
  (applied via Supabase MCP w poprzedniej sesji, zarejestrowana jako
  `20260424065913` w prod history — local/remote timestamp drift
  pre-existing, nie nasz problem).

## Co się stało na walk-teście B22

User cytat (tuż przed zrobieniem hotfixu):

> "nagrałem trase ale w zasadzie nie jestem w stanie pojechac
> rankingowo bo timer sie nie odpala. raz chyba sie odpalił nie wiem
> dlaczego. Ten system nie działa od ux po tech. Start jest za duży
> muis miec 1m max (zaskakujaco meta jakos działa). Widze ze jestem
> w spocie na starcie dostaje sygnał gotowy, uzbrajam (co w sumie
> nic chyba nie robi) ide i nic sie nie dzieje kaze zawrócic albo
> randomowo odpala trening nawet nie wiem jak później nie działa
> wyslij wynik."

Evidence z DB (`runs.verification_summary`):

```json
{
  "samplesPerSec": 0.5,
  "avgAccuracyM": 10,
  "corridor": { "inside": 100 },
  "checkpoints": { "total": 4, "passed": 4 },
  "startGate": {
    "entered": false,
    "attempts": 3,
    "lastAttempt": { "velocityOk": false, "headingOk": true,
                     "perpVelocityMps": 0.42, "headingDeltaDeg": 18 }
  },
  "acceptedVia": "manual",
  "gate_auto_started": null
}
```

Czyli: trasę przejechał, checkpoints zaliczone, corridor 100%, ale
**gate crossing engine 3× odrzucił start attempt** bo
`velocityOk=false` przy perp 0.42 m/s. User musiał użyć "manual"
fallbacku. Ranked = broken.

## Co zrobiłem w `74b0e8a` (B22.1 hotfix)

`src/features/run/gates.ts`:
- `GATE_VELOCITY_MIN_MPS`: **1.0 → 0.3** m/s
- `DEFAULT_START_GATE.headingToleranceDeg`: **60° → 90°** (align
  z `GATE_HEADING_TOLERANCE_DEG` z approach navigator, już było 90°
  po B21)
- `DEFAULT_START_GATE.minTriggerSpeedKmh`: **2 → 1** km/h
- `DEFAULT_FINISH_GATE.headingToleranceDeg`: **75° → 90°**
- `DEFAULT_FINISH_GATE.minTriggerSpeedKmh`: **1.5 → 0.8** km/h

`src/features/run/chunk8GateUnification.test.ts`:
- Test 2.4 (`heading misalignment is flagged on an oblique crossing`)
  dostał lokalny override `tightStartGate = { ...startGate,
  headingToleranceDeg: 60 }` bo geometria ≈63° z tym 90° już nie
  trafia w flag. Intent testu to flag mechanism, nie threshold value.

Moja teoria: walkerzy 1.1-1.4 m/s total, non-orthogonal approach
topi perp pod 1.0. Real rower 4-8 m/s → 0.3 nie otwiera cheat hole.
Detector wciąż wymaga sample pair po opposite sides line segment.

## Co się stało po Codex review

Codex verdict: **match na root cause** (progi 1.0 m/s odrzuciły realny
walk-test), **safe to ship B23 warunkowo**. Dwa P1 flagnięte ale oba
do B24 / product decision, nie blokery:

1. **`soft_crossing` path w geometry.ts** (Phase 3, linia 277+) —
   akceptuje punkt w zone `0..6m` przed linią bez sign-change. Moje
   0.3 m/s tam też działa, więc stacjonarny user + GPS drift 2-3 m/s
   mógłby false-startować. Ryzyko UX jitter, nie cheat. → B24.
2. **Manual-ranked → corridor_rescue sprzeczność** —
   `ApproachView.tsx:226` copy mówi "manual nie wejdzie na ranking",
   ale `runFinalization.ts:146` może podnieść ranked manual-start do
   `corridor_rescue`. Product decision. → B24.

UX gripe "start 1m max" — Codex zidentyfikował: **`GATE_APPROACH_READY_M
= 15`** to źródło "GOTOWY" signalu, nie geometria gate'a 4m. Propozycja:
thin 4m gate line + 1m center tick, dim 15m readiness do
semi-transparent. → B24.

## B23 pipeline — CO POSZŁO

Wybrana ścieżka: **B (ship + telemetry patch)** bo ostatni walk-test
zabrał dzień diagnostyki z niczego. Commit `b1496c7` dodaje bez
migracji:

- `gateDiagnostics.startAttempts` / `finishAttempts` — cumulative
  counter crossing eval prób.
- `gateDiagnostics.lastStartAttempt` / `lastFinishAttempt` z:
  - `crossed`, `velocityOk`, `perpMps`, `distanceFromCenterM`, `flags`, `at`
  - **nowe**: `headingDeltaDeg` (rider vs trail bearing)
  - **nowe**: `crossingType` (`'hard' | 'soft' | null`)
- `gateDiagnostics.velocityMinMps` — aktualny próg dla referencji.

Sampling rate już jest w `verification.gpsHealth.samplesPerSec` —
nie duplikuję.

Mutation-after-finalize w `useRealRun.ts` (ten sam pattern co
`verification.gpsHealth`), jsonb column, zero migration cost.

## Walk-test protocol B23 (Codex-approved)

User ma zrobić 3 checkpointy:

1. **Stand-still 20s armed** — postaw się na gate, uzbrój, nie ruszaj
   20s. **Timer NIE powinien wystartować.** Jeśli startuje → soft_crossing
   path firing przez GPS drift, Codex P1 staje się P0.
2. **Slow walk cross** — uzbrój, ruszaj przez gate na walking pace
   (1.1-1.4 m/s). **Timer SHOULD fire.** Jeśli nie → progi dalej za
   ostre albo mamy inny root cause.
3. **Manual fallback honesty check** — jeśli auto-start nie odpali i
   wyłapie się fallback "START RĘCZNY", sprawdź czy wynik po finałce
   trafia na leaderboard czy nie. Codex P1: UI mówi że nie, ale
   server może przyjąć przez `corridor_rescue`. Sprawdź rzeczywistość.

## Jak czytać DB po walk-teście

Jeśli test failuje — pull `runs.verification_summary.gateDiagnostics`
z DB (via Supabase MCP `execute_sql`):

```sql
select
  id, mode, acceptedVia,
  verification_summary->'gateDiagnostics' as diag,
  verification_summary->'gpsHealth'->>'samplesPerSec' as hz
from runs
where user_id = '<user>'
order by started_at desc limit 1;
```

Decision tree:
- `startAttempts = 0` → engine never armed (arming bug, nie threshold).
  Patrz `useRealRun.ts` phase transitions, `livePhaseRef` sync.
- `startAttempts > 0, lastStartAttempt = null` → nie zebrał sample
  pair `recentPoints.length >= 2`. 0.5 Hz GPS + short armed window
  może to powodować.
- `startAttempts > 0, crossed = false, flags = ['soft_crossing']` →
  Phase 3 fallback widoczny ale odrzucony. Nic nie robić.
- `crossed = false, velocityOk = false, perpMps < 0.3` → próg dalej
  zbyt ostry (kolejny tuning).
- `crossed = false, flags.includes('poor_heading')` → heading delta
  przekracza 90°. Pokaże `headingDeltaDeg`.
- `crossed = true, crossingType = 'soft'` → weszło przez Phase 3
  fallback (Codex P1 wypala się naprawdę, trzeba guard).
- `crossed = true, crossingType = 'hard', velocityOk = true` →
  auto-start powinno zadziałać. Jeśli nie → bug w callback routing
  (livePhaseRef, finalizingRef).

## Gotchy do pamiętania

- **RPC naming**: `finalize_seed_run` (NIE `finalize_pioneer_run`).
  Prompts/specs kłamią. Zobacz `memory/rpc_finalize_pioneer_naming.md`.
- **Pioneer line** blokuje trail dla crowd-confirm. Core blocker
  dla async racing. Nie dotyka tego fixu ale nie proponuj nic co
  pogłębi. Memory pin: `crowd_validation_gap.md`.
- **Voivodeship hardcode** (`spots.region` = 16 PL województw) —
  blokuje świat. Memory pin: `world_app_vs_voivodeship.md`. Nie
  dotyka tego fixu.
- **Orphan run lock** — HIGH-sev bug w history screen. Memory pin:
  `bug_orphan_run_lock.md`. Osobna sprawa.
- **UI framing** — wszystko musi czytać się jak gra (quests,
  missions, seasons, pioneer slots), nie utility app.
  Memory pin: `feedback_game_framing.md`.
- **User style**: pisze po polsku, tersely, expecting action nie
  acknowledgment. "sam zrób" / "tak działaj" / "ziomus porażka" =
  go fix it. Respond po polsku (tech terms OK).
- **Git safety**: nie amenduj, nie force-push, nie skip hooks.
  Wszystko explicit per request.

## Rzeczy odroczone (NIE w B23)

- UX fix "start gate visual 1m max" (user gripe z walk-testu).
  Świadomie osobno od B23 żeby mieć clean variable na testach
  thresholdów. Jeśli Codex sekcja 5 przyniesie konkretną propozycję
  — rozważ dla B24.
- Crowd validation RPC (core blocker).
- Voivodeship → Country/Region refactor.
- Orphan run lock bug.
- Row-level memo w history list (perf long tail).

## Plik-checklist dla nowej sesji

Przed odpowiedzią userowi przeczytaj:
1. Ten plik (`docs/HANDOFF_2026-04-24_b22-walktest.md`)
2. `docs/codex-b22-walktest-crosscheck.md` (prompt dla Codexa)
3. `git log --oneline -6` (sanity check że nic nie zaszło w międzyczasie)
4. Memory pins: `memory/MEMORY.md`
5. Jeśli user wklei verdict Codexa → `git show 74b0e8a` (freshen
   pamięć co dokładnie jest w fixie)

Todo list state ostatnia:
- ✅ B22.1 hotfix committed + pushed
- ✅ B23 build canceled
- ✅ Codex cross-check prompt napisany
- 🟡 **in_progress**: wait on user Codex review verdict
- ⏳ pending: rebuild B23 po sign-off
