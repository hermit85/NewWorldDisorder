# FAZA 1 — review (trust w timingu)

Post-FAZA 0 hotfixów, FAZA 1 celowała w trust: algorytm wyznaczania
eligibility (#7), transparencja decyzji (#8), permission preflight
ranked arm (#6), server-side re-validation (#9), oraz adapter
źródeł venue (#10).

5 commitów na `main`, wszystkie z pełnym test run (63/63
run-related) + typecheck clean.

---

## Commity

| F1# | Commit    | Plik(i) główne                                            | Skala       |
| --- | --------- | --------------------------------------------------------- | ----------- |
| #7  | `af7eff4` | `src/systems/realVerification.ts`                         | +32/-3      |
| #8  | `ad25bb7` | `app/run/result.tsx`                                      | +67         |
| #6  | `3e58b2c` | `app/run/active.tsx`                                      | +49/-3      |
| #9  | `5546bfc` | `supabase/migrations/…submit_run…`, `src/lib/api.ts`      | +245/-68    |
| #10 | `2b32144` | `src/features/run/resolveVenue.ts`, `app/run/active.tsx`  | +142/-35    |

---

## F1#7 — korytarz point-to-segment

**Problem:** `evaluateCorridor()` mierzyła odległość GPS pointa do
najbliższego **wierzchołka** polilinii. Na trasach z rzadko
rozłożonymi punktami rider jadący dokładnie po linii mógł odczytać
dziesiątki metrów odchyłki od najbliższego wierzchołka — zawyżając
deviation i wywalając coverage check.

**Fix:** odległość point-to-segment z lokalną projekcją planarną
(meters-per-degree korygowane szerokością geograficzną środka
segmentu). Fallback na `distanceMeters` dla jedno-punktowej linii.

**Ryzyko:** metoda planarna jest przybliżeniem. Dokładność <1m dla
segmentów do kilku km — dla bike parków bez problemu. Dla globalnego
world rollout (bardzo długie trasy enduro 20km+) trzeba by
zweryfikować albo przejść na Vincenty.

**Co nie zostało zrobione:** brak nowego unit testa specyficznie dla
`evaluateCorridor` z widely-spaced polyline. Istniejące 23 testy
`chunk8GateUnification.test.ts` przechodzą, ale nie sprawdzają tego
konkretnego regresiona.

---

## F1#8 — audit trail korytarza na result screen

**Problem:** gdy ranked run verifikował się przez `corridor_rescue`
(bramka nie odczytała, ale trasa OK), rider widział tylko "Verified"
bez powodu. Wątpliwe UX w rankingach — rider nie wie dlaczego akurat
ten bieg zaliczył a inny nie.

**Fix:** karta `rescueCard` rendered tylko gdy
`v.acceptedVia === 'corridor_rescue'`. Trzy rider-readable warunki:

- Checkpointy X/Y
- Korytarz Z% pokrycia · maks. odchyłka W m
- Sygnał GPS śr. N m

**Co nie zostało zrobione:**
- Brak visual preview — nie można sprawdzić w przeglądarce bez
  prawdziwego ranked runu z gate miss + corridor success. Kolory
  (`colors.accent` border, zielony bullet) są zgadywane.
- Nie ma testu jednostkowego.
- Copy PL tylko. Globalny rollout wymaga i18n.

---

## F1#6 — ranked background-permission preflight

**Problem:** arm ranked nie sprawdzał "Always" location permission.
Rider z "When In Use" armuje ranked, wkłada telefon do kieszeni, iOS
kasuje subskrypcję GPS, timer zamiera → stracona próba bez feedbacku.

**Fix:** helper `armRankedWithPreflight` w `active.tsx`. Trzy ścieżki:
- `granted` → arm ranked
- `undetermined` → iOS prompt → branch na wyniku
- `denied` → Alert z: "Ustawienia" (deep-link) / "Jedź jako trening"
  (demotion) / "Anuluj"

Wpięte w oba arm entry points (readiness tap L154 + ApproachView onArm
L379).

**Ryzyko:**
- Android nie ma rozróżnienia "WIU vs Always" na API 29+ — hook traktuje
  je jako jeden. Nieprzetestowane co mówi `canRecordInBackground` na
  Android przy WIU-only grant. Może dawać false positive.
- Na iOS jeśli user wybierze "Allow Once", `requestBackground()`
  zwróci `denied` natychmiast. Demotion na trening zadziała, ale
  Alert nie rozróżnia tego od klasycznego denied.

**Co nie zostało zrobione:** brak testu e2e / snapshot — native
permission flow. Tylko smoke test że kompiluje.

---

## F1#9 — server-side `submit_run` RPC

**Problem:** klient pisał `counted_in_leaderboard` wprost w INSERT.
Zmanipulowany klient mógł ustawić flagę + `duration_ms=1` i wylądować
#1 na każdej tablicy. Trust model w całości na JS.

**Fix:**
1. Migracja `20260425000000_submit_run_server_validation.sql`:
   SECURITY DEFINER `public.submit_run(…)` który:
   - waliduje `duration_ms ∈ [5000, 14_400_000]` i `|finished_at -
     started_at - duration_ms| ≤ 2000ms`
   - mirror'uje progi klienta: coverage ≥70%, avgAccuracy ≤20m,
     `checkpointsPassed === checkpointsTotal`, `acceptedVia ∈
     {gate_cross, corridor_rescue}`, status=`verified`
   - sam decyduje `counted_in_leaderboard` i `is_pb` (czyta
     leaderboard_entries dla PB)
   - anotuje `verification_summary.serverValidation = {eligible,
     reasons, validatedAt}` na run row
   - wola `upsert_leaderboard_entry` gdy eligible
2. RLS hardening: policy `"Users can insert own runs"` dostaje
   `with check (… and counted_in_leaderboard = false)`. Bezpośredni
   INSERT nie może już zaznaczyć ranked.
3. `src/lib/api.ts#submitRun` przełączony na `rpc('submit_run', …)`.

**Ryzyko:**
- **Migracja nie jest zapushowana na Supabase.** Dopóki nie zrobisz
  `supabase db push`, wszystkie ranked save'y po tej zmianie klienta
  dostaną null (RPC nie istnieje) i polecą na `saveStatus='queued'`.
  Offline queue retry tego nie rozwiąże — RPC musi być na serwerze.
- Tolerancja 2000ms na timestamp mismatch: jeśli client-side trace
  `durationMs` jest liczony inaczej niż `finishedAt - startedAt`
  (co się może dziać przy pauzach / grace phase), ranked zostanie
  odrzucony. **Nieprzetestowane na prawdziwym traceie.** Jeśli
  reject rate jest niezerowy, trzeba albo podnieść tolerancję,
  albo zmienić `trace.finishedAt`/`startedAt` żeby się zgadzały.
- `incrementProfileRuns`, `updateProfileXp`, `updateBestPosition`,
  `updateFavoriteTrail` zostały client-side. XP może być
  manipulowane. Audyt kazał tak — to nie jest trust-critical
  (leaderboard był), ale warto zanotować.

**Co nie zostało zrobione:**
- Brak testu RPC (nie ma pgtap w repo). Weryfikacja tylko manualnym
  staging-test przed prod pushem.
- Invalidation reasons wpadają w `verification_summary.serverValidation`
  ale nie są czytane w UI — klient dostaje tylko `ok: true/false`.
  Jeśli server odrzuci ranked (mimo że klient go chciał), rider
  zobaczy `saveStatus='saved'` + run w historii bez miejsca w
  rankingu — bez wyjaśnienia. F1#8-style audit card dla tego case'a
  to oddzielny task.

---

## F1#10 — `resolveVenue` adapter

**Problem:** ~18 plików open-code'owało "spróbuj static venueConfig,
fall back na DB" blob. Rejestr static był empty w produkcji, ale każdy
konsument sprawdzał `venueMatch` jakby nie był.

**Fix:** pure function `resolveVenue({trailId, trailName, dbTrail,
pioneerGeometryRaw})` w `src/features/run/resolveVenue.ts` zwraca
`{source: 'static'|'db'|'none', spotId, rankingEnabled, trailGeo,
gateConfig}`. Precedens fixed: static wygrywa gdy populated, DB
fallback, none default.

Migracja tylko `app/run/active.tsx` jako pierwszy konsument. 16
pozostałych (`Grep getVenueForTrail|venueMatch`) czeka na inkrementalną
migrację.

**Backlog:** FAZA 3 wywala venueConfig w całości (patrz BACKLOG.md).

**Co nie zostało zrobione:**
- Brak testu jednostkowego `resolveVenue`. Prosta funkcja, ale
  fallback sequence powinien mieć pokrycie.
- `trail/[id].tsx`, `leaderboard`, map komponenty nadal własnoręcznie
  branch'ują venueConfig. Migracja inkrementalna w FAZA 2/3.

---

## Co NIE jest w FAZA 1

- ❌ Client-side XP trust (świadoma decyzja — nie leaderboard-critical)
- ❌ Migracja na Supabase live push (wymaga ręcznego `db push`)
- ❌ e2e test ranked full-loop (lack of CI infra)
- ❌ Offline queue retry testing z nowym RPC
- ❌ Pozostałe F1#10 consumer migrations (16 plików)
- ❌ i18n copy (PL only)

---

## Deployment checklist przed B22

1. **`supabase db push`** — wymuś migrację `20260425000000`
2. Smoke test: ranked run → zapisz → sprawdź
   `verification_summary.serverValidation.eligible = true`
3. Negative test: edytuj payload w DevTools, ustaw
   `duration_ms=1` → RPC ma odrzucić `counted_in_leaderboard`
4. Permission preflight: fresh install → spróbuj armed ranked bez
   Always grant → Alert powinien się pokazać
5. Corridor rescue regression: ranked run z brakującą bramką →
   result screen pokaże `rescueCard` z 3 rzędami

---

## Wnioski

FAZA 1 zamyka audyt P0 trust gapu. Server-side validation to
największa pojedyncza zmiana (245+/68-), reszta to lokalne fixy.

Największe nietesty: RPC na staging (#9), permission flow na iOS i
Android (#6), corridor edge case na długich polyliniach (#7).
Rekomendacja przed TestFlight: pushnąć migrację na staging Supabase,
uruchomić `chunk8GateUnification.test.ts` i `npx tsc --noEmit`,
zaprosić Codex do cross-check (patrz `codex-faza1-crosscheck.md`).
