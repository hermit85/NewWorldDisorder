# Codex cross-check — B22 walk-test hotfix + root-cause second opinion

## Zasada #1

**NIE MODYFIKUJESZ KODU.** Zero edycji, zero commitów, zero push,
zero `supabase db push`, zero `eas build`. Read-only. Jeśli masz
silną rekomendację zmiany — opisz ją, ale jej nie wykonuj.

## Zasada #2 — drugie zdanie, nie tylko audyt

Ten prompt jest inny niż poprzednie. Nie chcę od Ciebie wyłącznie
"audit mojego fixu". Chcę **dwie rzeczy**:

1. **Niezależna diagnoza** — z dowodu (DB run record) postaw
   własną hipotezę co poszło nie tak na walk-test B22, **zanim
   przeczytasz mój fix**. Chcę cold read. Potraktuj to jak
   incident review: nie wiem co zrobił poprzedni inżynier, mam
   tylko evidence i kod na HEAD~1.
2. **Twoje rozwiązanie** — nawet jeśli zgadzasz się z moim fixem,
   opisz jak **Ty** byś to rozwiązał. Identyczny fix? Inne progi?
   Inna warstwa (np. telemetry przed relaxem, separate walk-mode
   toggle, state-machine refactor)? Jeśli widzisz inny root cause
   niż ja — powiedz i uzasadnij.

Dopiero po (1) i (2) zrób klasyczny audit mojego fixu z (3).

## Kontekst — co się zepsuło

Projekt: React Native + Expo + Supabase ("NWD — gravity race
league"). Core loop: rider → bike park → trail (pioneer line) →
uzbraja → przecina linię startu → timer → linia mety → wynik w
rankingu.

B22 poszło na TestFlight (commit `2a55622`, core fixes w `e0b80e2`
— Codex FAZA2 R2). Walk-test na urządzeniu: **porażka**. User cytat:

> "nagrałem trase ale w zasadzie nie jestem w stanie pojechac
> rankingowo bo timer sie nie odpala. raz chyba sie odpalił nie
> wiem dlaczego. Ten system nie działa od ux po tech. Start jest
> za duży muis miec 1m max (zaskakujaco meta jakos działa). Widze
> ze jestem w spocie na starcie dostaje sygnał gotowy, uzbrajam
> (co w sumie nic chyba nie robi) ide i nic sie nie dzieje kaze
> zawrócic albo randomowo odpala trening nawet nie wiem jak
> później nie działa wyslij wynik."

### Evidence z DB (run z walk-testu, anonymized)

Pulled z `runs.verification_summary` dla ostatniego walk-test run:

```json
{
  "samplesPerSec": 0.5,
  "avgAccuracyM": 10,
  "samples": 142,
  "corridor": { "inside": 100, "outOfCorridor": 0 },
  "checkpoints": { "total": 4, "passed": 4 },
  "startGate": {
    "entered": false,
    "crossed": false,
    "attempts": 3,
    "lastAttempt": {
      "velocityOk": false,
      "headingOk": true,
      "lineCrossingOk": false,
      "perpVelocityMps": 0.42,
      "headingDeltaDeg": 18
    }
  },
  "finishGate": {
    "entered": false,
    "crossed": false,
    "attempts": 1
  },
  "acceptedVia": "manual",
  "gate_auto_started": null,
  "gate_auto_finished": null
}
```

Interpretacja głównych faktów:
- **samplesPerSec = 0.5** (Apple GPS zwalnia na wolnych tempach;
  spec expect 1 Hz).
- **Corridor 100%** i checkpoints 4/4 — user był na trasie.
- **startGate.entered = false, attempts = 3** — engine 3× próbował
  otworzyć gate ale odrzucił. `lastAttempt.velocityOk=false`
  przy `perpVelocityMps=0.42`. `headingOk=true`
  (delta 18°).
- **acceptedVia = "manual"** — user musiał nacisnąć "zapisz mimo
  wszystko", auto-start nigdy się nie zazbroiło.

Pliki do czytania na **HEAD~1** (przed hotfixem):
- `src/features/run/gates.ts`:
  - `GATE_VELOCITY_MIN_MPS = 1.0` (line ~96)
  - `GATE_HEADING_TOLERANCE_DEG = 90` (approach, line ~91)
  - `DEFAULT_START_GATE.headingToleranceDeg = 60`, `minTriggerSpeedKmh = 2`
  - `DEFAULT_FINISH_GATE.headingToleranceDeg = 75`, `minTriggerSpeedKmh = 1.5`
- `src/systems/gateEngine.ts` — `detectGateCrossing()` flags:
  `velocityOk`, `headingOk`, `lineCrossingOk`.
- `src/systems/useRealRun.ts` — callback flow, `livePhaseRef` sync,
  manual-start fallback path.

### Zadanie diagnostyczne (cold read, pre-fix)

Zanim przeczytasz commit `74b0e8a` — odpowiedz w raporcie:

1. **Root cause** — z evidence powyżej, gdzie dokładnie engine
   odrzuca crossing? Konkretny plik:linia.
2. **Twoja diagnoza w 2-3 zdaniach** — co uważasz za prawdziwy
   problem. Thresholdy za ostre na walking speed? Bug w detektorze
   (np. perp velocity liczona źle przy 0.5 Hz sampling)? State
   machine bug (np. `phase` nie w `armed_*` gdy crossing leci)?
   Coś innego?
3. **Twoje proponowane rozwiązanie** — jak Ty byś to naprawił?
   Konkretne wartości / refactor / feature flag / telemetry. Nie
   pisz "zrelaksuj progi" bez liczb — podaj propozycje wartości
   i **uzasadnij dlaczego** te a nie inne (z jakich użytkowników
   / scenariuszy wychodzisz).

## Commit do cross-checku

```
74b0e8a fix(run): B22 walk-test hotfix — relax gate thresholds for walking
```

Diff (wklejone z `git show 74b0e8a`):

**`src/features/run/gates.ts`:**
- `GATE_VELOCITY_MIN_MPS`: **1.0 → 0.3** m/s (perpendicular velocity
  filter w `detectGateCrossing`).
- `DEFAULT_START_GATE.headingToleranceDeg`: **60° → 90°** (teraz
  zgodne z approach navigator `GATE_HEADING_TOLERANCE_DEG` = 90).
- `DEFAULT_START_GATE.minTriggerSpeedKmh`: **2 → 1** km/h.
- `DEFAULT_FINISH_GATE.headingToleranceDeg`: **75° → 90°**.
- `DEFAULT_FINISH_GATE.minTriggerSpeedKmh`: **1.5 → 0.8** km/h.

**`src/features/run/chunk8GateUnification.test.ts`:**
- Test 2.4 (`heading misalignment is flagged on an oblique crossing`)
  — dodany local override `tightStartGate = { ...startGate,
  headingToleranceDeg: 60 }` bo oblique crossing z geometrii testu
  (≈63°) po zmianie globalnej nie trafia w flagę. Intent testu to
  "flag mechanism" a nie "threshold value".

Moje uzasadnienie w commit message:
- Walkerzy 1.1-1.4 m/s total; perp projection często < 1.0 przy
  non-orthogonal approach → 0.3 domyka gap.
- Detector wciąż wymaga sample pair po opposite sides linii, więc
  "stanie na linii" nie wyzwoli.
- Prawdziwy rower na starcie: 4-8 m/s — 0.3 nie otwiera cheat hole.
- headingTolerance 90° align z approach (B21) — rider w approach
  cone powinien być w crossing cone.
- `minTriggerSpeedKmh` schodzi poniżej walking, żeby
  `GATE_VELOCITY_MIN_MPS` był jedynym source of truth.

## Zadania cross-checku

### 1. Uruchom testy

```
npx tsc --noEmit
npx jest
```

Expected: tsc exit=0, jest 77/77 pass.

### 2. Niezależna diagnoza (cold read, patrz wyżej)

Napisz sekcję `## Diagnoza Codexa` **zanim** czytasz mój commit.
Jeśli już przeczytałeś — zaznacz to uczciwie w raporcie.

### 3. Twoje rozwiązanie

Sekcja `## Fix proponowany przez Codexa`:
- Konkretne wartości / struktura fixu.
- Uzasadnienie: jakie persony / scenariusze / metryki.
- Różnica vs. mój fix: identyczny / podobny / inny root cause.
- Czy dokładałbyś telemetry / log / feature flag zanim tuniesz
  progi?

### 4. Audit mojego fixu

Sekcja `## Audit fixu 74b0e8a`. Zweryfikuj:

#### 4a. Anti-cheat holes

- `GATE_VELOCITY_MIN_MPS = 0.3` — czy coasting/pushing bike
  **obok** linii (nie przez) może trafić 0.3 m/s perp przez GPS
  drift i otworzyć fałszywy start? Sprawdź `detectGateCrossing`
  — czy wymaga REAL sample pair na przeciwnych stronach line
  segment, czy tylko bliskość? Evidence jest ok, ale potwierdź
  czytając kod.
- `headingToleranceDeg = 90°` dla finish gate — czy ktoś
  zawracający na końcu trasy (np. zapomniał że meta jest 20m
  dalej, zawraca, wraca) może przejechać metę "do tyłu" i
  wyzwolić auto-finish ze złym kierunkiem? 90° dopuszcza
  dowolny side-cross. Sprawdź czy `lineCrossingOk` sam w sobie
  chroni przed tym.
- `minTriggerSpeedKmh = 0.8` dla finish — czy user stojący na
  mecie (zatrzymał się, sapie, GPS drift 1 m/s okazjonalnie)
  może random-trigger mete z prev run traces? (`livePhaseRef`
  guard powinien blokować, ale pewność.)

#### 4b. Interakcja ze starym kodem

- `GATE_HEADING_TOLERANCE_DEG = 90` (approach navigator) vs
  `DEFAULT_START_GATE.headingToleranceDeg = 90` (crossing) — czy
  teraz można **uzbroić się z tyłu trasy i zjechać** bo oba
  cone'y równe? Scenariusz: rider stoi 30m powyżej mety, app
  widzi "jestem w spocie, mogę uzbroić", uzbrajam, jadę w dół,
  przekraczam metę → `livePhaseRef` mówi `armed_*`, gate_start
  callback sprawdza `armed_*`, ale meta to gate_finish. Czy
  fallback jakkolwiek może to zinterpretować jako start? Sprawdź
  routing w `useRealRun.ts`.
- Czy `manualStart` path (user presses "Start mimo wszystko") ma
  swój guard na `gate_auto_started=false` przy ranked, czy
  server-side `submit_run` RPC odrzuca? Evidence pokazuje
  `acceptedVia: "manual"` — czy to w ogóle powinno się liczyć do
  ranked leaderboard? (Pytanie do produktu, ale zgłoś).

#### 4c. Sampling rate (0.5 Hz)

- Apple GPS na walking dropuje do 0.5 Hz. Sample pair dla
  crossing detektora to interwał 2s. Przy tempo 1.2 m/s to
  delta 2.4m per sample. Linia gate ma `lineWidthM = 4m`. Czy
  detector bierze sample[t] i sample[t+1] i sprawdza czy
  segment między nimi przecina line? Czy wystarczy "jeden point
  w gate zone"?
- Edge case: sample[t] 2m przed linią, sample[t+1] 1m za linią.
  `lineCrossingOk` tak. Ale co jeśli sample[t] 1m przed, drop
  na 2s, sample[t+1] 3m za linią, ale rider akurat w tym
  dropie **zawrócił i znowu przejechał**? Detector zobaczy
  jeden clean cross, evidence "wszystko ok", ale user w
  rzeczywistości dwa razy przekroczył linię. Czy to gate-engine
  już handluje (np. przez checkpoint sequence)?

#### 4d. Test coverage luki

- Czy istnieje test na **perp velocity = 0.3 m/s exactly**
  (boundary)? Jeśli nie — dopisać.
- Czy istnieje test na **oblique approach @ 1.1 m/s total,
  30° off-perpendicular** (typowa walkerowa ścieżka)? Jeśli
  nie — dopisać.
- Mój hack w teście 2.4 (lokal override 60°) — czy to nie
  ukrywa prawdziwego zamiaru testu? Może **dodać drugi test**
  na globalnym 90° sprawdzający "oblique 120° crossing → flag
  jednak się zapala" (żeby produkcyjne progi miały coverage)?

### 5. UX gripe od usera — "start jest za duży, musi być 1m max"

Secondary finding, ale w tym samym walk-teście. User twierdzi,
że wizualny wskaźnik start-gate (okrąg / linia na mapie?) jest
za duży. Twoja robota:

1. Znajdź plik który renderuje gate visual (map layer, trail
   screen, approach view — nie wiem który dokładnie, przeszukaj).
2. Zidentyfikuj skąd bierze radius: czy to `entryRadiusM=10`?
   `GATE_LINE_LENGTH_M=4`? Zone depth `zoneDepthM=6`? Coś
   innego (25m approach cone)?
3. Zaproponuj co user prawdopodobnie chce zobaczyć ("the line
   itself, 4m wide, nie 25m entry cone"). Czy można pokazywać
   dwa layers: cienki 1m marker dokładnej linii + semi-transparent
   większy dla context?

Tylko diagnoza i propozycja. Nie edytuj.

### 6. Format raportu

Struktura:

```
# Codex cross-check — B22 walk-test hotfix

## Tests
- npx tsc --noEmit: [exit code]
- npx jest: [X/Y pass]

## Diagnoza Codexa (cold read, pre-fix)
[Root cause w 2-3 zdaniach + plik:linia.]

## Fix proponowany przez Codexa
[Twoja propozycja z liczbami i uzasadnieniem.]
[Porównanie z moim fixem: same / different / alternate root cause.]

## Audit fixu 74b0e8a
### P0 — <tytuł>
**Plik:linia:** src/…/foo.ts:123
**Co:** …
**Dlaczego krytyczne:** …
**Rekomendacja:** …

### P1 — <tytuł>
…

### P2 — <tytuł>
…

## UX gripe — gate visual "1m max"
[Plik renderujący, źródło radius, propozycja.]

## Verdict
- Root cause mój vs. Twój: match / mismatch (opisz)
- Fix mój — safe to ship B23: TAK / NIE (powód)
- Dodatkowe checkpointy przed B23: [lista albo pusta]
- Telemetry/observability gap: TAK / NIE (co dodać)
```

Priorytety:
- **P0** — blokuje B23 ship (wprowadza regresję, cheat hole,
  trust broken).
- **P1** — realny edge case w głównym flow, do naprawy
  w B23 jeśli szybki, inaczej B24.
- **P2** — kosmetyka / optim / long tail.

## Notatki końcowe

- Poprzednie cross-checki: `docs/codex-faza1-crosscheck.md`,
  `docs/codex-faza2-crosscheck.md`. Ta sesja ich nie powtarza.
- Pipeline stan: B22 canceled, B23 build canceled po Twojej
  prośbie o cross-check. Po Twoim verdict idziemy albo z moim
  fixem, albo z twoim, albo z hybrydą.
- Project memory: `CLAUDE.md` (jeśli istnieje), `memory/MEMORY.md`.
  Pin notka: **Pioneer finalize RPC naming trap**, **Crowd
  validation gap** — nie dotyczą tego fixu, ale warto znać
  kontekst.
- Evidence z DB: wycięte z `runs.verification_summary`. Cała
  tabela `runs` ma RLS read-for-all — mogę przesłać pełny rekord
  jeśli potrzebujesz (ale PII-free).
