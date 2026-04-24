# Codex cross-check — FAZA 1 (trust w timingu)

## Zasada #1

**NIE MODYFIKUJESZ KODU.** Zero edycji, zero commitów, zero push,
zero `supabase db push`. Twoja rola: czytać, uruchamiać testy
(read-only), zgłaszać znalezione problemy w raporcie. Jeśli masz
silną rekomendację zmiany — opisz ją, ale jej nie wykonuj.

## Kontekst

Projekt: React Native + Expo + Supabase ("NWD — gravity race
league"). Core loop: rider → bike park → trail (pioneer line) →
uzbraja → przecina linię startu → timer → linia mety → wynik w
rankingu.

Post-audit (AUDIT_REPORT.md) 4-fazowy plan. **FAZA 0** (hotfixy
correctness) i **FAZA 1** (trust w timingu) zamknięte. Ten review
targetuje wyłącznie FAZA 1 — 5 commitów na `main` po commicie
`147893f` (koniec FAZA 0):

```
2b32144 refactor(run): resolveVenue adapter over two trail-context sources (F1#10)
5546bfc feat(trust): server-validated submit_run RPC (F1#9)
3e58b2c feat(run): ranked background-permission preflight (F1#6)
ad25bb7 feat(result): corridor_rescue audit trail on result screen (F1#8)
af7eff4 fix(verification): corridor uses point-to-segment distance (F1#7)
```

Pełny self-review: `docs/FAZA1_REVIEW.md`. Przeczytaj go PIERWSZY —
zawiera listę ryzyk które autor sam zidentyfikował. Twoje zadanie:
znaleźć to, czego autor nie zauważył, albo podważyć te, które autor
uznał za bezpieczne.

## Zadania (w kolejności)

### 1. Uruchom testy

```
npx tsc --noEmit
npx jest
```

Oczekiwane: tsc exit=0, wszystkie jest pass (ostatni known-good:
63/63 run-related, pełna suita powinna być wyższa). Jeśli cokolwiek
się sypie — zatrzymaj się i zgłoś.

### 2. Code review — po commicie

Czytaj każdy commit osobno (`git show <hash>`), wypisz problemy per
commit, użyj line-number citations. Nie rób bulk reviewu.

#### F1#7 — `af7eff4` — point-to-segment

Plik: `src/systems/realVerification.ts`

Zweryfikuj:
- Czy `distanceToSegmentM` correctness — napisz na kartce test case
  (punkt znany, segment znany, dystans policzony ręcznie) i porównaj
  z funkcją. Projekcja planarna z `mPerLat = 111320` i `mPerLng =
  111320 * cos(latRef)` — czy to nie myli się o rząd wielkości dla
  polskich współrzędnych (~50° N)?
- Segment degenerate case (a ≈ b) — `lenSq < 1e-6` wykrywa to, ale
  `Math.hypot(px, py)` zwraca dystans do `a`. Czy to jest
  bezpieczne gdy `a === b === p`?
- Czy for-loop `j < officialLine.length - 1` jest poprawny gdy
  `length === 1` (idziemy do wcześniejszego if) albo `length === 2`
  (pojedynczy segment, OK)?
- Czy deviation classification (shortcut >150, major >80, minor ≤80)
  poprawnie działa gdy point-to-segment daje mniejsze wartości niż
  point-to-vertex? Wcześniejsze progi mogły być kalibrowane na
  overstated vertex distances — nowe wartości mogą klasyfikować
  major'y jako minor'y. Policz co-by-było na fixture polskim GPS
  tracku jeśli masz, albo zgłoś że to nieprzetestowane i obarczone
  ryzykiem regresji oceny.
- Cost: O(points × segments). Dla 1000 pointów × 50 segmentów = 50k
  iteracji — OK. Ale co dla long-enduro 10k pointów × 200 segmentów
  = 2M? Zgłoś jeśli to problem.

#### F1#8 — `ad25bb7` — rescue audit card

Plik: `app/run/result.tsx`

Zweryfikuj:
- Warunek renderowania: `isVerified && v?.acceptedVia ===
  'corridor_rescue'`. Czy `isVerified = vStatus === 'verified'` i
  czy `runFinalization.ts` ustawia `verification.status = 'verified'`
  RAZEM z `acceptedVia = 'corridor_rescue'` — żeby warunek nigdy
  nie spudłował (acceptedVia ustawione, ale status jeszcze nie)?
- `v.corridor.coveragePercent` i `v.avgAccuracyM` — czy są zawsze
  obecne na `VerificationResult` w momencie rendera? (Guards na
  `v?` są tylko dla outer, nie dla zagnieżdżonych pól.) Sprawdź
  `verificationTypes.ts` definicję.
- `Math.round(v.corridor.coveragePercent)` — corridor percent to
  0-100 czy 0-1? Sprawdź w `evaluateCorridor` co zwraca.
- Czy karta nie koliduje z quality badge (render order między
  linią 552 a 580) przy runie verified+corridor_rescue+qualityTier —
  czy dwie karty nie walczą o tę samą semantykę?
- `chunk9Colors` vs `colors` (result.tsx używa `colors` + `radii` +
  `spacing` — sprawdź że `colors.accent + '40'` to valid hex
  opacity notation w React Native stylesheet).

#### F1#6 — `3e58b2c` — background-permission preflight

Plik: `app/run/active.tsx`

Zweryfikuj:
- `permission.backgroundStatus === 'undetermined'` check jako
  warunek na `requestBackground`. Co jeśli status jest `denied`
  ALE hook jeszcze nie odpalił stage 1 (mount effect pending)?
  Wtedy `backgroundStatus` w `INITIAL_STATE` to `undetermined`, ale
  foreground też `undetermined` — iOS może pokazać dziwny prompt
  albo odmówić. Race condition między mount i tap?
- `void armRankedWithPreflight()` — callback zwraca Promise,
  handleTap nie czeka. Czy to OK gdy rider taknie jeszcze raz
  między promptem a resolvem? Phase wciąż `readiness_check`,
  `armRun` może być wywołany podwójnie.
- Android: `requestBackgroundPermissionsAsync` na Android API 29+
  może podnieść `"Location always"` rationale. Czy Alert path
  ("Ustawienia / Trening / Anuluj") pokrywa granted-always-but-WIU
  pre-existing state? Chociaż to raczej Android issue — zgłoś
  jeśli widzisz, ale nie blok.
- `Linking.openSettings()` — bez error handling. Na Android może
  wyrzucić jeśli intent unavailable. Czy zgodne ze stylem apki
  (ekran settings gdzie indziej w kodzie?).
- Demotion UX: `armRun('practice')` z denied ranked — czy dobrze
  pokazuje się że to jest trening a nie ranked? Czy `state.phase`
  poprawnie wpada w `armed_practice` a nie w `armed_ranked` z
  flagą?

#### F1#9 — `5546bfc` — server-side submit_run — **NAJWAŻNIEJSZY**

Pliki:
- `supabase/migrations/20260425000000_submit_run_server_validation.sql`
- `src/lib/api.ts` (funkcja `submitRun`)

Zweryfikuj migrację:
- **Krytyczne:** czy `public.submit_run` SECURITY DEFINER pomija
  hardened INSERT RLS policy (`counted_in_leaderboard = false`)?
  Jeśli tak — dobrze. Jeśli nie — cały migration jest bezzębny.
  Sprawdź docs Postgres RLS dla SECURITY DEFINER functions.
- Thresholds mirroring: w kliencie coverage jest `coveragePercent`
  (0-100), w SQL `p_verification_summary->'corridor'->>'coveragePercent'
  ::numeric >= 70`. Zweryfikuj że jednostki się zgadzają (nie 0-1
  gdzieś vs 0-100 gdzie indziej).
- `acceptedVia not in ('gate_cross', 'corridor_rescue')` —
  `verificationTypes.ts` ma też `'manual'` jako legal value dla
  practice. Dla ranked rider nie może być `manual` — ale czy klient
  wysyła `manual` dla ranked w jakimś edge case (manual start po
  gate miss)? Sprawdź `runFinalization.ts` które `acceptedVia` może
  przypisać ranked.
- `v_invalidation` array i `v_eligible = array_length IS NULL`:
  poprawna PL/pgSQL idiom? Zweryfikuj że pusta tablica daje null
  (nie 0) w `array_length`.
- `v_is_pb and v_eligible` w INSERT `is_pb` — czy to nie da `null`
  gdy oba są false (SQL three-valued logic)? Powinno `coalesce`
  albo po prostu bool `and`.
- `v_elapsed_ms := extract(epoch from (p_finished_at - p_started_at)) * 1000`
  cast na integer — jeśli >2^31 (24.8 dni), overflow. Guard
  duration_too_long i tak blokuje, ale warto zgłosić.
- **Tolerancja 2000ms timestamp mismatch:** czy `trace.finishedAt` w
  kliencie jest wyliczany w tym samym clockzie co Date.now przy
  `startedAt`? Jeśli trace startuje w `useRealRun` przy gate cross
  a `finishedAt` w `traceCapture`, może być drift. Klucz: sprawdź
  czy 2000ms wystarczy na legit runy, albo czy niektóre dropną.
- Grant `authenticated` vs revoke `public` — czy anon caller dostaje
  403, nie 400?
- RLS drop+recreate: `drop policy if exists …` i `create policy …`
  — czy nie ma polbi po środku które `authenticated` cachuje
  (unlikely, ale warto zgłosić).
- Czy `v_lb jsonb` pozostaje null gdy `v_eligible=false`? Tak, bo
  if guard. OK. Ale sprawdź że klient to obsługuje w `result.leaderboard
  ? … : null`.

Zweryfikuj klienta:
- `submitRun` w api.ts — wywala bezpośredni INSERT, całkowicie
  polega na RPC. Co jeśli RPC zwróci `{ ok: false, code: 'invalid_mode' }`?
  Klient loguje warn i zwraca null, `runSubmit.ts` marks `saveStatus='queued'`.
  Queue retry ponowi wywołanie — ale invalid_mode nie zniknie.
  Infinite queue? Sprawdź retry loop w systems/runSubmit lub queue
  path.
- `result.leaderboard.previous_position` snake_case (SQL) vs klient
  używa `leaderboardResult.previousPosition` camelCase. Czy w kodzie
  jest `previous_position` (snake) do `previousPosition` mapping —
  sprawdź linię 533 w api.ts.
- Usunięta logika client-side "existingBest" (sprawdzenie isPb) —
  teraz server decyduje. Czy klient w międzyczasie (save queued)
  pokazuje "PB!" na podstawie wyjaśnienia z runStore? Sprawdź
  `result.tsx` jak odczytuje isPb.

#### F1#10 — `2b32144` — resolveVenue adapter

Plik: `src/features/run/resolveVenue.ts`

Zweryfikuj:
- Precedens: static wygrywa nawet jeśli DB też istnieje dla tego
  trailId. Zamierzone per design note, ale czy w testach /
  storybook / dev-mode ktoś wkiedyś zarejestruje venue static a DB
  będzie miała inną spot? Nazwa spot'u musiałaby być zgodna.
- Return type: czy `'none'` source z empty spotId + trailGeo=null
  poprawnie blokuje downstream (useRealRun gdy geo null)? Sprawdź
  `active.tsx` path gdy resolveVenue daje none.
- Migracja `active.tsx`:
  - `isTrainingOnly = venue.source === 'static' && !venue.rankingEnabled`.
    DB venues implicit `rankingEnabled = true` — zgodnie z plannem.
    Ale co gdy DB pionier zwraca seed z flagą "test-only"? Brak
    takiego pola w DB dziś — OK, ale flag to przyszły feature.
  - `useTrailGeometry(trailId || null)` — było `venueMatch ? null :
    trailId` (skip fetch gdy static), teraz zawsze fetch. Regresja?
    Dla currently-empty static registry: brak efektu. Dla
    re-seedowanej static: niepotrzebny fetch. Zgłoś jako minor.
  - Guard Alert: `venue.source !== 'static' && trailStatus === 'empty'`
    — wcześniej `!venueMatch && trailStatus === 'empty'`. Semantic
    parity zachowany. OK.

### 3. Szukaj bugów — kategorie

#### 3a. Trust gaps pozostałe

- Client-side XP update (`updateProfileXp` po submit): czy
  cheater może wysłać bonus 10000 XP? Tak, ale XP nie wpływa na
  leaderboard. Zgłoś dla FAZA 2 roadmapy.
- `incrementProfileRuns` z `isPb` z kliencie — server już zna
  `isPb`, ale klient używa RPC response'a. Czy może manipulować
  TOTAL_runs / pb_count w profile'u? Prześledź RPC
  `increment_profile_runs`.
- Czy jest RPC który pozwala SET konkretną wartość na profilu
  (update_profile) bez walidacji? Szukaj `update.*profile` w
  migracjach i `api.ts`.

#### 3b. Race conditions

- User taknie "Uzbrój" 2x w szybkim teście — `armRankedWithPreflight`
  startuje 2x, każdy awaituje `requestBackground`, który resolve'uje
  raz — drugi dostaje from-cache status. Czy `armRun('ranked')`
  zostanie wywołany 2x? Sprawdź idempotency useRealRun.
- Server submit_run + client-side progression (challenges,
  achievements, best_position) — jeśli submit_run się uda ale
  lokalny progression pipe zawiedzie (network blip), state w DB
  rozjedzie się z state w profile. Czy jest reconciliation?

#### 3c. Offline / queue

- Run queued → klient offline → przychodzi online → retry:
  `submitRun` wysyła ten sam `started_at/finished_at`. Server
  policzy `serverValidation.validatedAt = now()` — różne od
  started_at o minuty/godziny. Czy to nie wywala `timestamp_mismatch`?
  Nie — sprawdzamy `finished_at - started_at` vs `duration_ms`, nie
  `now - …`. OK ale zgłoś jeśli masz wątpliwość.
- 2x offline queue retry tego samego run (duplikat) — `submit_run`
  nie ma idempotency key. Dwa entries w runs + podwójny upsert
  leaderboard. Sprawdź czy client prevents duplicate (runSubmit.ts
  `_submittingSessionIds`).

#### 3d. RLS & Security

- Czy klient może bezpośrednio wywołać `upsert_leaderboard_entry`
  RPC z dowolnym run_id? Sprawdź grants migracji 001 — czy jest
  `grant execute … to authenticated`. Jeśli tak, to rider może
  wymanipulować leaderboard bez wywoływania submit_run. Dziura.
- `counted_in_leaderboard = false` w new INSERT policy — ale nie ma
  zmiany w UPDATE policy. Czy rider może INSERT z `counted=false` a
  potem UPDATE na `counted=true`? Policy update w 001 daje "own runs"
  — tak, może. Dziura. Zgłoś.

#### 3e. Migrations sanity

- Plik `20260425000000` — czy jest nowszy od ostatniego (timestamp
  2026-04-25 > 2026-04-24)? Format OK.
- `begin`/`commit` — czy `drop policy if exists` + `create policy`
  w jednej transakcji nie wywali się na Supabase pool? Zwykle OK,
  ale zweryfikuj.

### 4. Smoke test RPC (tylko jeśli masz staging Supabase)

**Nie pushuj migracji.** Jeśli masz lokalny Supabase (`supabase
start`), zaaplikuj migrację tam i zweryfikuj:

```sql
-- Jako auth'd user:
select public.submit_run(
  p_spot_id => 'test-spot',
  p_trail_id => 'test-trail',
  p_mode => 'ranked',
  p_started_at => now() - interval '10 seconds',
  p_finished_at => now(),
  p_duration_ms => 10000,
  p_verification_status => 'verified',
  p_verification_summary => '{
    "isLeaderboardEligible": true,
    "corridor": {"coveragePercent": 95, "maxDeviationM": 5},
    "avgAccuracyM": 8,
    "checkpointsPassed": 3,
    "checkpointsTotal": 3,
    "acceptedVia": "gate_cross"
  }'::jsonb,
  p_gps_trace => '{}'::jsonb,
  p_xp_awarded => 100
);
-- expect: { "ok": true, "eligible": true, "is_pb": …, … }

-- Malicious attempt:
select public.submit_run(
  …,
  p_duration_ms => 1,  -- 1ms time!
  p_verification_summary => '{"isLeaderboardEligible": true, …full eligible summary…}'::jsonb,
  …
);
-- expect: { "ok": true, "eligible": false, "invalidation_reasons": ["duration_too_short"] }
```

Jeśli drugi wywołanie daje `eligible: true` albo pisze
`counted_in_leaderboard = true` do runs — krytyczny bug, zgłoś
natychmiast.

### 5. Format raportu

Dla każdego P (priorytet) w jednym bloku, maksymalnie 3-5 zdań:

```
## P0 — <tytuł bugu>
**Commit:** <hash>
**Plik:linia:** src/…/foo.ts:123
**Co:** 1-2 zdania opis.
**Dlaczego krytyczne:** 1 zdanie.
**Rekomendacja:** 1 zdanie.
```

Priorytety:
- **P0** — trust-critical, user-visible breakage, data loss,
  security hole. Blokuje B22.
- **P1** — regresja funkcji, race condition z realną
  prawdopodobieństwem trigger, UX broken w głównym flow. Do
  naprawy przed B22.
- **P2** — kosmetyka, edge case, improvement. Backlog.

Ostatnia sekcja:

```
## Verdict
- Tests: pass/fail
- Trust: OK/compromised (z listą)
- Ready for B22 TestFlight: TAK / NIE (powód)
```

## Notatki końcowe

- Pełny self-review autora: `docs/FAZA1_REVIEW.md`. Tam są znane
  ryzyka — nie trać czasu na potwierdzanie ich, **szukaj nowych**.
- Jeśli widzisz że commit robi więcej niż opisuje (scope creep),
  zgłoś. Audyt oryginalny sugerował konkretny zakres — widziałem że
  F1#9 rozciągnął RPC o annotation summary i RLS hardening, ale to
  było intencjonalne i udokumentowane. Inne scope creepy — flaga.
- Nie ma CI. Lokalny `npx jest` + `npx tsc --noEmit` to cała
  weryfikacja automatyczna.
- Miej na uwadze `CLAUDE.md` project memory jeśli istnieje —
  feedback tam często jest kluczowy.
