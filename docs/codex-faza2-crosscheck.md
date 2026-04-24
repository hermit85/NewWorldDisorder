# Codex cross-check — FAZA 1 follow-ups + B21 + FAZA 2

## Zasada #1

**NIE MODYFIKUJESZ KODU.** Zero edycji, zero commitów, zero push,
zero `supabase db push`. Read-only. Jeśli masz silną rekomendację
zmiany — opisz ją, ale jej nie wykonuj.

## Kontekst

Projekt: React Native + Expo + Supabase ("NWD — gravity race
league"). Core loop: rider → bike park → trail (pioneer line) →
uzbraja → przecina linię startu → timer → linia mety → wynik w
rankingu.

FAZA 1 (trust w timingu) + pierwszy cross-check zamknięty. W tym
oknie zaadresowano 4 Codex findings (2×P0, 2×P1), dowieziono B21
(arm-then-cross field-test feedback) i FAZA 2 (perf/offline).

Review target: **7 commitów od `aa5cf40` (FAZA 1 review) do HEAD**:

```
7730b28 perf: FAZA 2 hot-path allocation + bounded fetch + debounced persist
b9051a7 fix(run): suppress whole-screen auto-arm when ApproachView is up (B21)
1a45807 fix(run): relax approach thresholds for real-world GPS (B21)
f4a882f fix(db): finalize_seed_run rejects non-owner on pending spot (Codex P1.2)
a87d578 fix(run): refresh location permission on foreground return (Codex P1.1)
1831ab8 fix(run): synchronous phase mirror for drain-loop gate routing (Codex P0.1)
ad2a451 fix(run): ranked duration from gate crossings, not wall-clock (Codex P0.2)
```

Pierwszy cross-check raport (P0/P1 które zostały naprawione): patrz
commit messages + `docs/codex-faza1-findings.md`. Twoje zadanie: nie
powtarzaj co już naprawione, szukaj **nowych** problemów w:
1. Tych 4 naprawach (czy nie wprowadziły regresji),
2. Zmianach B21 (progi, auto-arm flow),
3. FAZA 2 perf (array identity, leaderboard cap, debounced persist).

## Zadania (w kolejności)

### 1. Uruchom testy

```
npx tsc --noEmit
npx jest
```

Oczekiwane: tsc exit=0, jest 77/77 pass. Jeśli cokolwiek się sypie
— zatrzymaj się i zgłoś.

### 2. Code review — po commicie

Czytaj każdy commit osobno (`git show <hash>`), użyj line-number
citations.

#### Codex P0.2 — `ad2a451` — gate-crossing timestamps

Pliki:
- `src/systems/traceCapture.ts` — rozszerzone sygnatury
  `beginTrace(…, startedAt?)` i `finishTrace(finishedAt?)`.
- `src/systems/useRealRun.ts` — `autoFinishTimestampRef`,
  `startRunInternal(autoStarted, startedAtMs?)`, finalize effect
  przekazuje `autoFinishTimestampRef.current` do `finishTrace`.

Zweryfikuj:
- Czy `startedAtMs` faktycznie przychodzi z
  `crossing.crossingTimestamp` (gateStartCallbackRef) a nie wall-clock?
  Co jeśli gate engine zwróci `crossed=true` ale
  `crossingTimestamp=null` (edge case w gateEngine.ts)? Fallback
  `?? undefined` → Date.now() w startRunInternal. OK dla practice,
  ale dla ranked to regresja tolerance gate (±2000ms). Sprawdź czy
  gateEngine GUARANTEES non-null timestamp na `crossed=true`.
- `elapsedMs = startedAt ? Date.now() - startedAt : 0` w timerze
  (useRealRun linia ~598). Teraz `startedAt` to crossing timestamp,
  ale `Date.now()` to wall-clock. Drift w tle (iOS suspend/resume)
  może dać ujemny elapsed albo skok. Sprawdź.
- Ranked manual-start (`manualStart` → `startRunInternal(false)`):
  brak `startedAtMs` → wall-clock. To OK bo manual i tak
  `gateAutoStarted=false`. Ale czy server tolerance check (2000ms)
  nie odrzuci tego bo trace.startedAt ≠ server `p_started_at`?
  Prześledź jak `runFinalization.ts` składa `startedAt`/`finishedAt`
  przy submit.
- `finishTrace(autoFinishTimestampRef.current ?? undefined)` —
  jeśli ref jest `null` (manual finish path), trace.finishedAt
  = Date.now() w finishTrace. Wall-clock vs gate-timestamp na
  startedAt: niespójność. Czy to blokuje ranked? Nie — ranked
  z manual-start nie jest eligible. OK.
- Przetestuj: run 10s, startowany o 12:00:00.000 na zegarze gate,
  finishedAt 12:00:10.000. Server sprawdza
  `|finished - started - duration| <= 2000`. Jeśli trace startedAt
  to teraz 12:00:00.000 (z crossingTimestamp) a duration_ms to
  10000, to pass. Ale sprawdź jak `duration_ms` jest liczone w
  `runFinalization.ts` — z `Date.now() - startedAt`, z
  `finishedAt - startedAt` trace, czy z gate engine
  `getElapsedMs()`?

#### Codex P0.1 — `1831ab8` — livePhaseRef

Plik: `src/systems/useRealRun.ts`

Zweryfikuj:
- `livePhaseRef.current` aktualizowany w: armRun, startRunInternal,
  gate callbacks (start/finish), finishRun, cancel. Czy każdy
  setState na phase też pisze do ref? Grep `phase:` i porównaj.
- `processSample` czyta `livePhaseRef.current`. Co jeśli sample
  wchodzi podczas finalize (livePhaseRef='finishing', ale
  `finalizingRef=true`)? processSample nadal robi addPoint +
  updatedCps. Trace dostaje punkty poza running phase. Sprawdź czy
  to jest OK w finalize path (może wręcz pożądane — trace do
  samego crossing).
- Cancel path: `livePhaseRef.current = 'idle'` — ale czy po
  ukończonym (completed_*) runie też wraca do 'idle'? Jeśli nie,
  następny armRun restartuje ref. Sprawdź useEffect cleanup i
  początkowy state.
- Readiness check → armed transitions: czy są race'y między
  React-committed phase a livePhaseRef gdy dwa armRun'y
  przylecą jeden po drugim (double tap na UZBRÓJ — co w B21
  ograniczono ale nie wyłączono w whole-screen path dla
  ReadinessPanel)?

#### Codex P1.1 — `a87d578` — permission refresh on foreground

Plik: `app/run/active.tsx`

Zweryfikuj:
- AppState listener wywołuje `void refreshPermission()`. Jeśli hook
  nie jest jeszcze zamontowany (np. screen w stack, ale nie focused),
  `permission.refresh` może być stale closure. Sprawdź.
- Na każdy foreground transition refresh — nawet gdy user nie był w
  Settings. Cheap? Sprawdź `useLocationPermission` implementation
  (jeśli robi dwa getXxxPermissionsAsync za każdym razem, to kilka
  ms × N transitions = minor battery). Prawdopodobnie OK, ale
  zgłoś jeśli masz wątpliwość.

#### Codex P1.2 — `f4a882f` — finalize_seed_run pending-spot owner

Plik: `supabase/migrations/20260426000000_finalize_seed_run_pending_spot_owner.sql`
(w Supabase history landed as `20260424065913` — patrz notatka
poniżej o migration drift).

Zweryfikuj:
- Gate: `v_spot_status = 'pending' AND NOT v_is_curator AND
  v_spot_submitter IS DISTINCT FROM v_user_id` → return
  `pending_spot_forbidden`. Co jeśli `v_spot_status` jest NULL (spot
  usunięty w racing condition między select a check)? `= 'pending'`
  z NULL daje NULL (nie true), więc gate się nie odpali, dalej
  leci pioneer insert. Czy to OK, czy powinno być
  `IS NOT DISTINCT FROM 'pending'`?
- `v_spot_submitter` vs `submitted_by` w spots table — zweryfikuj
  że to ta sama kolumna i że RLS na spots pozwala SELECT z pozycji
  SECURITY DEFINER (powinno, bo funkcja jest DEFINER).
- Submitter-self-flip (linie 178-187) — czy `v_spot_status =
  'pending' AND v_spot_submitter = v_user_id` jest spójne z
  wcześniejszym gate? Tak: curator nie flipuje (jeśli curator jest
  submitterem, to flipuje — OK). Edge case: curator flipuje swój
  własny spot — czy to nie wprowadza "orphan pioneer" scenario
  z przeciwnej strony?
- Nowy error code `pending_spot_forbidden` — czy klient `api.ts`
  ma mapping na PL error copy? Grep `pending_spot_forbidden` w
  kodzie.

#### B21 threshold relax — `1a45807`

Pliki:
- `src/features/run/gates.ts` (3 stałe)
- `src/features/run/approachNavigator.ts` (komentarze)
- `src/features/run/approachNavigator.test.ts` (10 testów
  zaktualizowanych)

Zweryfikuj:
- `GATE_APPROACH_READY_M = 15` — field test feedback, ale czy
  gate engine's own crossing detection (perpendicular distance)
  jest niezależne od tego? Sprawdź `gateEngine.ts` — jeśli
  używa tej stałej, to 15m może otworzyć fałszywe crossingi. Jeśli
  nie (ma własny `lineWidthM`/`zoneDepthM`), OK.
- `APPROACH_UNSURE_ACCURACY_M = 30` — czy `GATE_ACCURACY_REQUIRED_M
  = 5` nadal działa jako drugi gate-level filter? Co jeśli rider ma
  ±25m accuracy, navigator pokazuje GOTOWY, ale crossing dostaje
  odrzucone bo accuracy > 5m? UX: pokazujemy arm CTA, po tapnięciu
  timer nigdy nie rusza. Prześledź crossing path w gateEngine —
  gdzie jest accuracy gate.
- `GATE_HEADING_TOLERANCE_DEG = 90` — komentarz mówi że per-gate
  `headingToleranceDeg` (60°/75°) jest unchanged. Zweryfikuj w
  `gates.ts` default config.
- Testy: 10 przypadków zaktualizowanych. Sprawdź czy nie zgubiono
  pokrycia — np. case z accuracy=20m (dawniej boundary) mógł nie
  mieć odpowiednika w 30m progu. Na szybko: policz ile testów
  sprawdza NEAR→READY boundary, ile WRONG_SIDE boundary, ile
  GPS_UNSURE boundary — po 2-3 w każdej kategorii powinno wystarczyć.

#### B21 auto-arm suppression — `b9051a7`

Plik: `app/run/active.tsx`

Zweryfikuj:
- `handleTap` case `readiness_check`: `if (showApproachPreRun)
  break;`. Co jeśli rider zamknie nagle GPS (lastPoint → null),
  `showApproachPreRun` flip na false w trakcie readiness_check?
  Wtedy whole-screen tap znów armuje → racy UX. Zgłoś.
- `showApproachPreRun` = `canShowApproach && phase in
  [readiness_check, armed_ranked, armed_practice]`. Readiness_check
  jest pokryty, więc jeśli ApproachView aktywny to tap na screenie
  NIE armuje. Ale jeśli rider tapnie UZBRÓJ (ApproachView onArm)
  — czy wchodzi w armed_ranked? Tak (armRankedWithPreflight).
  OK. Ale czy ApproachView CTA jest pokazany tylko gdy
  `state.kind === 'on_line_ready'`? Tak, w
  `OnLineReadyContent` — ale `showApproachPreRun` jest true dla
  wszystkich pre-run states (far/near/ready/wrong/unsure). Jeśli
  rider jest w `far` i tapnie screen, whole-screen nie armuje
  (good), ApproachView nie pokazuje UZBRÓJ (good) — rider musi
  podejść. OK.
- Training-only venue: `armRun('practice')` pod `if
  (isTrainingOnly)` jest za gate'em `showApproachPreRun`. Czy
  training venues mają gateConfig (→ ApproachView)? Jeśli tak,
  tap na ekranie nic nie zrobi, a OnLineReadyContent pokaże
  UZBRÓJ → training flow działa. Jeśli nie mają gateConfig,
  ApproachView nie renderuje, legacy ReadinessPanel w działaniu,
  whole-screen tap armuje practice. OK. Ale potwierdź.
- Explicit CTA path — `onArm` w active.tsx (~414) ma swoją
  pre-flight logikę (canRank, armRankedWithPreflight, practice
  fallback). Duplikuje logikę z `handleTap` case readiness_check.
  DRY violation? Minor, ale jeśli jedna rozjedzie się z drugą,
  bug. Zgłoś jako P2.

#### FAZA 2 #1/#2/#3 — `7730b28`

Pliki:
- `src/systems/useRealRun.ts` — checkpoint array identity
- `app/run/active.tsx` — `useMemo(userPosition)`, `useMemo(approachState)`
- `src/lib/api.ts` — `SCOPED_LEADERBOARD_RAW_CAP=500`,
  `SCOPED_LEADERBOARD_TOP_N=50`
- `src/systems/runStore.ts` — debounced `persistToStorage` +
  `flushRunStorePersistence`

Zweryfikuj #1:
- `flipped` guard w checkpoints map — czy tablica faktycznie
  zachowuje identity? Tak, jeśli żaden cp.passed nie flip'nął,
  zwracamy `s.checkpoints` (ref original). Ale `updatedCps` jest
  zbudowany i wyrzucany. GC pressure. Lepsze byłoby short-circuit
  w pętli. Zgłoś jako P2 optim.
- Memoized `userPosition`: deps to
  `[state.lastPoint?.latitude, state.lastPoint?.longitude]`.
  Jeśli lat/lng się nie zmieni między samplami (rider
  nieruchomo), userPosition zachowa identity. OK. Ale
  `state.lastPoint` jako obiekt wciąż się zmienia (gps
  readiness, speed, heading pola). Parent render ma nową
  `state.lastPoint` referencję, ale `userPosition` przez `useMemo`
  nadal stabilne. OK.
- Memoized `approachState`: deps zawierają
  `state.lastPoint?.accuracy`. Jeśli accuracy fluktuuje
  ±0.1m na każdym sample, approachState rebuild'uje się
  i tak. Czy to problem? `computeApproachState` to czysta
  funkcja, tanie. OK, ale zgłoś jeśli widzisz jak ApproachView
  re-renderuje co sample mimo memo.

Zweryfikuj #2:
- `SCOPED_LEADERBOARD_RAW_CAP=500`: bike park z 100 riderami
  robiącymi 5 ranked runs dziennie = 500 rows. Edge case tight.
  Co jeśli najlepsi riderzy mają rundy wcześnie, nowi ciągną
  średnich czasów do tailu — top-50 zmieści się w 500? Tak
  (sort by duration_ms ASC, top-50 to pierwsze 50 user'ów
  z unikalnymi duration'ami). Ale jeśli 500 rows to 400
  unikalnych userów, dedup + slice(0, 50) OK.
- `leaderTime = sorted[0]?.duration_ms ?? 0` — po slice nadal
  bierze pierwszy z top-50. OK.

Zweryfikuj #3:
- `persistToStorage` teraz synchroniczna (void return) debounced.
  Call sites wszystkie fire-and-forget (nie await'owały wcześniej).
  Czy nikt nie polegał na Promise dla error handling? Grep
  `await persistToStorage`.
- `_persistTimer` jest global let — jeśli dwa moduły importują
  runStore, Node/jest ma shared module cache → jeden timer.
  OK dla RN (singleton hot module).
- Test leak: jest warning "worker failed to exit gracefully"
  pojawiał się intermittently. Pending timer po teście. Czy
  potrzebujemy test-only reset? Minor. Zgłoś jeśli reprodukuje
  się u Ciebie.
- `flushRunStorePersistence` — exported ale nikt nie wola.
  Dead code? Zostawiony jako escape hatch dla hydration-style
  sekwencji. Zgłoś jeśli uznajesz za YAGNI.

### 3. Szukaj bugów — kategorie

#### 3a. Trust regressions

- Czy ranked manual-start po B21 auto-arm suppression dalej
  jest eligible/non-eligible zgodnie z B21 spec? Sprawdź
  `assessRunQuality` path dla `gateAutoStarted=false` +
  `mode='ranked'`.
- `autoFinishTimestampRef` czyszczone w cancel/initial — ale czy
  w startRunInternal też się resetuje przy nowym run? Jeśli stary
  ref zostanie, drugi run z tym samym hookiem dostanie cudzą
  crossingTimestamp. Zgłoś.

#### 3b. Race conditions

- B21 whole-screen suppression działa tylko gdy
  `showApproachPreRun`. Jeśli rider tapnie ekran w ten sam tick
  co `state.lastPoint` → null (GPS lost), React batch'uje
  render, `showApproachPreRun` flip — arm może się odpalić.
  Unlikely ale reproducible.
- FAZA 2 debounce + flush — jeśli app jest killed mid-debounce
  (process.exit), ostatnie 150ms zmian nie trafi na disk.
  Hydration recovery przechodzi, ale user może zobaczyć
  "starszy" saveStatus. Acceptable? Zgłoś jako P2.

#### 3c. Migrations sanity

- `20260426000000_finalize_seed_run_pending_spot_owner.sql`
  landed on prod as `20260424065913` (MCP apply_migration
  auto-timestamp). Local file name ≠ remote version. Pre-existing
  migration history drift (9 of 14 remote-only migrations są tym
  samym SQL co local ale z innymi timestampami). Czy to blokuje
  przyszłe `supabase db push`? Tak — trzeba repair albo pull.
  Zgłoś jako deployment tech debt.

#### 3d. Perf regressions

- FAZA 2 #1: checkpoint guard. Co jeśli rider przejedzie
  checkpoint dokładnie na boundary i GPS jitter flip'a
  passed=true/false między samplami? `updatedCps` buduje się
  każdy raz, ale `flipped` zostaje true tylko jeśli
  `!cp.passed && distance <= radius`. Raz passed, pozostaje
  passed (guard `if (cp.passed) return cp`). OK, nie ma flip
  back.
- FAZA 2 #2: `.limit(500)` w scoped leaderboard. Czy Supabase
  index na `runs(trail_id, counted_in_leaderboard, started_at,
  duration_ms)` istnieje? Jeśli nie, full scan z sort. Sprawdź
  migracje.

### 4. Format raportu

Dla każdego P w jednym bloku, maks 3-5 zdań:

```
## P0 — <tytuł>
**Commit:** <hash>
**Plik:linia:** src/…/foo.ts:123
**Co:** 1-2 zdania.
**Dlaczego krytyczne:** 1 zdanie.
**Rekomendacja:** 1 zdanie.
```

Priorytety:
- **P0** — trust-critical, user-visible breakage, data loss,
  security. Blokuje B22 ship.
- **P1** — regresja funkcji, realny race condition, UX broken
  w głównym flow. Do naprawy przed B22.
- **P2** — kosmetyka, edge case, optim. Backlog.

Ostatnia sekcja:

```
## Verdict
- Tests: pass/fail (liczby)
- Trust: OK/compromised (z listą)
- Perf claims wiarygodne: TAK / NIE (co nie)
- Ready for B22 TestFlight: TAK / NIE (powód)
```

## Notatki końcowe

- Pierwszy cross-check: `docs/codex-faza1-crosscheck.md` +
  znalezione P0/P1 rozwiązane w commitach ad2a451/1831ab8/
  a87d578/f4a882f. Nie powtarzaj.
- FAZA 1 self-review: `docs/FAZA1_REVIEW.md`. Nadal aktualny.
- B21 backlog entry: `docs/BACKLOG.md:51` (spec pola-testowy).
- Migration drift: pre-existing deployment tech debt, nie blokuje
  code review. Notatka w FAZA 2 commit message.
- Project memory: `CLAUDE.md` (jeśli istnieje) zawiera memory
  pins — przeczytaj zanim zgłosisz coś jako nieznane gotcha.
- Smoke test device ranked run zaznaczony w todos ale jeszcze nie
  wykonany — jeśli masz urządzenie, potwierdź
  `verification_summary.serverValidation.eligible=true` na real
  ranked. Inaczej zostaw jako niezweryfikowane w verdict.
