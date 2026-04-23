# Codex review — pre-Build-21 sanity check (round 2)

## Zasada #1

**NIE MODYFIKUJESZ KODU.** Zero edycji, zero commitów, zero push.
Twoja rola: czytać, uruchamiać testy (read-only), zgłaszać znalezione
problemy w raporcie. Jeśli masz silną rekomendację zmiany — opisz ją,
ale jej nie wykonuj.

## Round 2 delta

Pierwsza runda (commit `dd4e63a`) zgłosiła 3 P0 + 3 P1. Wszystkie
P0 + P1.1 zamknięte w commicie `37fb9e0`. P1.2 (background GPS dla
ranked runs) zamknięte w commicie `b94cb79`. Tym razem szczególny
focus na:

1. **`b94cb79` — background GPS parallel-delivery.** Nowe moduły
   `src/systems/realRunBackgroundBuffer.ts` + `realRunBackgroundTask.ts`
   oraz zmiany w `src/systems/gps.ts` + `src/systems/useRealRun.ts`.
   Sprawdź:
   - dedup (lastProcessedTsRef + timestamp monotonic)
   - czy ring buffer nie rośnie bez granic (MAX_BUFFER_SIZE trim)
   - czy startTracking poprawnie startuje / stopuje TaskManager task
   - czy AppState → 'active' drain dzieje się w rozsądnym czasie
     (aktualnie tylko reaktywnie: pierwszy foreground sample uruchamia
     drainBackgroundBuffer — czy jest to wystarczające?)
   - czy brak Always permission nie wywala startTracking
   - race condition: co jeśli user cancel'uje podczas gdy task
     wciąż pisze do buffera?

2. **`37fb9e0` — Codex round 1 fixes.** Te szczególnie warto
   re-verify:
   - P0.1 ranked routing w `app/run/active.tsx` — czy warunek
     `canRank = !isTrainingOnly && isAuthenticated && state.readiness.rankedEligible`
     nie ma luk
   - P0.2 manualStart + markManualStart + finishRun manual-ranked
     path — czy spójne
   - P0.3 migracja `20260423190000_seed_run_self_active_flow.sql`
     — czy atomic flip spotu jest idempotentny, czy race condition
     między dwoma concurrent pioneer runs nie istnieje
   - P2.1 makeInitialState factory + cancel() — czy permissionDenied
     preservation nie pozwala na dziwne stany

## Kontekst

Projekt: React Native + Expo + Supabase app ("NWD — gravity race
league"). Core loop: rider dodaje bike park → tworzy trail (pioneer
line) → uzbraja → jedzie przez linię startu → timer odlicza →
przecina linię mety → wynik ląduje w rankingu.

Build 20 został wysłany do TestFlight po ostatnich poprawkach.
Field-test wykazał że **timer nie odpala się po przekroczeniu linii
startu w trybie rankingowym**. Naprawa weszła w commit `dd4e63a`
(explicit UZBRÓJ CTA + relaxed navigator thresholds). Przed B21 chcemy
niezależne oko.

Główne obszary podejrzeń:
1. Gate engine (wykrywanie przejazdu przez linię startu i mety) —
   user zgłasza że "core który już działał, sami go zepsuliśmy".
2. Stan armed vs. phase machinery w `useRealRun` — callbacks gate
   engine odrzucają crossing gdy phase != armed_*. Czy to się
   konsekwentnie wpina?
3. Ostatnia migracja `20260423180000_pioneer_self_active_flow.sql`
   (submitter-self-active flow) — czy jest spójna z RLS, nie
   wprowadza data races, idempotentna.
4. Testy — czy pokrywają krytyczne scenariusze czy tylko happy path.

## Zadania (w kolejności)

### 1. Uruchom testy

```
npx tsc --noEmit
npx jest
```

Oczekiwane: tsc exit=0, jest "75 passed, 75 total".
Jeśli cokolwiek się sypie — zatrzymaj się i zgłoś.

### 2. Code review — gate engine + arm flow

Przeczytaj te pliki w pełni, nie skanuj:

- `src/features/run/useRunGateEngine.ts` — engine wykrywający
  crossing linii. Zweryfikuj:
  - czy `processPoint` poprawnie rozróżnia `isRunning` vs `isArmed`
  - czy `startCrossing` detekcja działa tylko w armed phase (nie
    wycieka do running — to byłby double-fire)
  - czy `finishCrossing` ma guard uruchamiania dopiero po
    `hasPassedFirstCheckpoint`
  - czy velocity floor (GATE_VELOCITY_MIN_MPS = 1.0) nie filtruje
    legit przejazdu rowerem (rider na starcie często robi 1-2 m/s
    pierwszy krok)

- `src/systems/useRealRun.ts` — lifecycle (idle → readiness_check →
  armed_* → running_* → finishing → completed). Zweryfikuj:
  - `gateStartCallbackRef.current` w linii ~365 — czy guard
    `phase !== 'armed_ranked' && phase !== 'armed_practice' return`
    nie blokuje legitimate crossing
  - `manualStart()` — czy poprawnie skip'uje gate detection i
    ustawia phase na running_*
  - `startRunInternal` — czy timer startuje przy tym samym
    event-loop tick co `setState({ phase: running_* })` (żadnego
    lag'u w timer vs phase)
  - Czy `addPoint` i checkpoint update dzieją się w tym samym
    reducer cycle (brak race condition między pozycją a checkpointem)

- `src/features/run/approachNavigator.ts` — 5-state machine dla
  ApproachView. Zweryfikuj:
  - Kolejność check'ów jest poprawna (gps_unsure → far → near →
    wrong_side → on_line_ready)
  - `APPROACH_UNSURE_ACCURACY_M = 20` nie koliduje z gate
    engine'owym `GATE_ACCURACY_REQUIRED_M = 5`
  - Boundary cases (accuracy 20.0 vs 20.1 — czy są testy?)

- `src/features/run/gates.ts` — constants + config builder.
  Zweryfikuj:
  - `GATE_LINE_LENGTH_M = 4` — wąska bramka, zgodnie ze spec
  - `GATE_APPROACH_READY_M = 3` — on_line_ready radius
  - `DEFAULT_START_GATE` i `DEFAULT_FINISH_GATE` — czy mają
    sensowne defaulty (line width, tolerance, heading)
  - `buildTrailGateConfigFromPioneer` — poprawnie derywuje
    bearing start/finish z pioneer geometry

- `src/components/run/ApproachView.tsx` — nowy UZBRÓJ CTA.
  Zweryfikuj:
  - `onArm` + `armed` prop flow do OnLineReadyContent i NearContent
  - Button renderuje się tylko gdy `!armed && onArm`
  - Copy nie myli ("UZBRÓJ" zawsze w dopełniaczu itd. po polsku)

- `app/run/active.tsx` — integracja. Zweryfikuj:
  - `onArm` callback decyduje między `armRun('ranked')` vs
    `armRun('practice')` — czy logika `isTrainingOnly ||
    !isAuthenticated || state.mode === 'practice'` ma luki
  - `armed` prop sourcuje z `state.phase === 'armed_ranked' ||
    state.phase === 'armed_practice'`
  - Legacy full-screen Pressable (`<Pressable style={styles.fullscreen}
    onPress={handleTap}>`) nadal działa — nie pochłania kliknięć
    na UZBRÓJ button

### 3. Code review — pioneer self-active flow

- `supabase/migrations/20260423180000_pioneer_self_active_flow.sql`:
  - `create_trail` gate'owanie — czy warunki `if v_spot_status =
    'active' OR (pending AND submitter=user)` pokrywają edge cases
    (rejected, inny submitter, anon caller)
  - `finalize_pioneer_run` atomic spot flip — czy ma race condition
    gdy dwóch riderów jednocześnie finalize'uje pioneer runs dla
    różnych trails na tym samym pending spot? (Prawdopodobnie nie,
    bo trail row jest zalokowany FOR UPDATE, ale spot nie — sprawdź
    czy jest tam drugi lock albo czy race jest benigny)
  - RLS policy `"Trails on active or own pending spots"` — czy nie
    otworzyła się jakaś dziura (ktoś może teraz insertować trails
    na chute'ach innych userów?)

- `src/lib/api.ts` — `fetchSpots()` rozszerzone do `in('status',
  ['active', 'pending'])`. RLS policy w `006_curator_and_spot_submission.sql`
  ogranicza pending do submittera — ale czy na pewno? Ściezka:
  - Migration 006 policy "Users can see own pending/rejected spots"
    vs "Everyone sees active spots" — czy się nie wykluczają

- `app/spot/new.tsx` SuccessCard — routing `/trail/new?spotId=X`.
  Czy spotId zawsze jest nie-null gdy przycisk renderuje się?
  (`canChainToTrail = !queued && spotId !== null`)

- `app/trail/new.tsx` — usunięty guard na `spot.submissionStatus !==
  'active'`. Czy API error handling obsłuży `spot_not_active` z
  serwera gracefully gdy ktoś jednak trafi na rejected spot przez
  deep-link? Znajdź ścieżkę errora.

### 4. Szukaj bugów — kategorie

Dla każdego poniższego tematu: przeczytaj relevant fragment kodu,
zgłoś znalezione problemy z line-number citation.

#### 4a. Race conditions
- Równoległy `finalize_pioneer_run` — dwóch riderów, ten sam trail
- Timer lag: `setState({ phase: running_* })` vs `setInterval` start
- `refreshSignal` vs `fetchSpots` — czy pending spot dociera w czasie
- AsyncStorage w `useBetaFlow` vs bootstrap timing

#### 4b. Auth / RLS luki
- Anon user + deep-link do `/trail/new` — czy trail/new poprawnie
  redirectuje zanim render
- Kurator usuwa spot submitter's — czy trails też idą
- JWT expiry mid-run — czy run się zapisuje lokalnie i retry'uje

#### 4c. GPS / timing edge cases
- Cold start GPS (accuracy 99m pierwsze 10s) — czy coś crashuje
- Phone backgrounded podczas run — background task handler OK?
  (`src/features/recording/backgroundLocationTask.ts`)
- Timer overflow — długa jazda > 24h (niemożliwa ale…)

#### 4d. UX stan lockout
- `armed_ranked` → app freeze / crash → orphan run state
- User cancels mid-run — czy state wraca clean
- Multiple tap UZBRÓJ — czy nie dwukrotnie armRun'uje

#### 4e. Spec-level niespójność
- `currentRank` + `xpThreshold` math w profile.tsx
- Challenge reset — czy `formatChallengeCountdown` jest timezone-aware
- Voivodeships hardcode PL — czy poza PL nie crashuje (memory note:
  to jest znany blocker, spisz ponownie jeśli zauważysz)

### 5. Raport

Format markdown, struktura:

```
# Codex review — output

## Test run
- tsc: PASS / FAIL [output]
- jest: 75/75 / FAIL [failing tests]

## Krytyczne znaleziska (P0 — blokery pre-Build-21)
### [Tytuł]
- Plik: path:line
- Problem: ...
- Ryzyko: ...
- Sugestia (NIE implementowana): ...

## Znaczące (P1 — przed następnym buildem)
...

## Drobne / cleanup (P2)
...

## Obszary które wymagają designerskiej decyzji (nie bugów)
...

## Pozytywne
(Co dobrze wygląda, co doceniasz)
```

Bądź konkretny. Cytuj line numbers. Jeśli coś wygląda OK — powiedz
że OK, nie lej wody. Jeśli czegoś nie mogłeś zweryfikować (np.
brak dostępu do prod DB) — spisz co dokładnie. Cel: dostać listę
bugów do fixu + potwierdzenie że core flow jest poprawny.

**Once more: NIE ZMIENIASZ KODU.** Tylko raport.
