# Backlog — post-B20

Aktualizowane jako luźna lista rzeczy do zrobienia po aktualnym
buildzie. Priorytet rośnie od dołu — najwyższy na górze.

---

## FAZA 3 · Wywal venueConfig, DB single source of truth

**Dlaczego:** F1#10 postawił adapter `resolveVenue` z precedensem
"static wygrywa, DB fallback", ale rejestr statyczny (`_venues` w
`src/data/venueConfig.ts`) jest permanentnie pusty — `registerVenue`
nie jest nigdy wołany w produkcji. Cała gałąź `source: 'static'` to
martwy kod który i tak renderuje się ~18 razy w call siteach (maps,
leaderboard, trail detail, build truth map, venue detection itd.)
jako `venueMatch ? X : Y`.

**Zakres FAZA 3 (równoczesny z globalnym rolloutem — patrz
`world_app_vs_voivodeship.md`):**

1. Usuń `src/data/venueConfig.ts` (VenueConfig interfejs, registry,
   `registerVenue`, `getVenueForTrail`, `getVenue*`).
2. Usuń `src/data/venues/index.ts` barrel.
3. `resolveVenue` spłaszcz do DB-only: wywal gałąź static, zostaw
   tylko `db`/`none`.
4. Wszystkie 16 pozostałych call siteów (`Grep` na
   `getVenueForTrail|venueMatch`) migruj do `resolveVenue` albo
   bezpośrednio na `useTrail` + `useTrailGeometry`.
5. Schema DB musi dostarczyć pola które dziś daje static: czy
   `spots.ranking_enabled` (bool, default true) jest potrzebne?
   Jeśli tak — migracja + UI w `/spot/new` / curator flow.
6. Słotwiny legacy seed — jeśli istnieje w DB, zweryfikuj parity
   przed usunięciem static backupu. Jeśli nie, migracja seed'owa.

**Blokery przed startem:**
- Decyzja produktowa czy `rankingEnabled` to przyszły feature dla
  DB spotów (np. bike park który wyłącza ranking sezonowo) czy nie.
- Potwierdzenie że `_venues` Map jest faktycznie pusta na prod
  (brak `registerVenue(...)` w żadnym test-mode ani storybook).

**Korzyść:** jeden model trailów, krótszy codebase, nie ma już
"static wygrywa" zagadki w code review; odblokowuje refaktor
`voivodeship → Country/Region` z osobnego memo.

**Uwaga:** tego NIE robimy w FAZA 2 — performance/offline. Ten
refactor dotyka trust-critical paths (ranked arm, gate config) i
powinien iść razem z rolloutem globalnym, nie samodzielnie.

---

## B21 — ⚠ P0 · Arm-then-cross flow (field test B20)

**Dlaczego:** największa skarga z walk-in testu B20. Mini-mapka
pokazuje rider w zielonej kropce startu, ale readiness machine
wciąż trzyma go w `near` / `gps_unsure` / `wrong_side`. User słyszy
"przesuń się 5-7m" i wychodzi POZA kropkę. Timer nigdy nie ruszy
sam, a manual fallback ("STARTUJ RĘCZNY") nie odpala w ranked mode
(fallback idzie do `running_practice`, nie `running_ranked`).

**Target flow (z feedbacku):**
1. Jestem w start-circle wizualnie → **UZBRÓJ** tap (explicit CTA)
2. Tap → `armed_ranked` → copy "schowaj telefon i jedź"
3. Pocket → przekraczam linię → gate engine wykrywa crossing →
   timer rusza automatycznie
4. Finisz → liczenie

**Zmiany:**

- **Relax start-circle threshold** — `on_line_ready` detection
  powinno być tolerant do ±15-20m zamiast obecnego ciasnego radius.
  Apple GPS ma ±4-10m jitter w mieście, próg trzymania się ciasno
  powoduje ping-pong między `near` a `on_line`.
  - File: `src/features/run/approachNavigator.ts` (sprawdzić
    ON_LINE_READY_RADIUS_M const)
- **"UZBRÓJ" explicit CTA** zamiast auto-arming. `active.tsx:146`
  (`armRun('ranked')` w `readiness_check`) powinien przestać być
  automatyczny. ApproachView gdy `state.kind === 'on_line_ready'`
  renderuje przycisk "UZBRÓJ RANKED" (primary, duży). Tap → phase
  flip do `armed_ranked`.
- **GPS accuracy gate** złagodzić — `gps_unsure` tylko gdy
  accuracy > 30m (obecnie chyba > 20). W obszarach miejskich
  ±10-15m jest realnym GPS state dla downhill — blokowanie tego
  uniemożliwia jazdę.
- **"Podejdź z kierunku trasy"** pokazywać tylko gdy heading
  delta > 90° (odwrócony). Obecnie triggeruje przy 30-45° bokiem.
- **Manual fallback w ranked mode** — obecnie `onManualStart`
  fires `running_practice` niezależnie od trybu. Jeśli user był
  w `armed_ranked` i klika manual start, powinien wejść w
  `running_ranked` z flag'iem "started_manual" (stracone ranking
  eligibility, ale zachowuje ranked intent).

**Effort:** 4-6h — thresholds + UX CTA + manual-start fix.
**Risk:** niski — wszystkie zmiany są parametryczne albo dodają
state transition. Gate engine logic (sama weryfikacja linii)
nie jest ruszana.

### Pomniejsze z tego samego testu
- **Pioneer "dodaj trasę" CTA po pierwszej trasie** — trzeba tapnąć
  kilka razy zanim routing zadziała. Prawdopodobnie brak
  `Pressable` disabled state podczas submission → race condition
  na re-entry.
- **"Jestem w spocie i nie łapie"** — spot geofence radius może być
  za mały lub `state.lastPoint` nie flush'uje się wystarczająco
  szybko po wejściu w obszar. Sprawdzić `usePrimarySpot` hook +
  spot detection w `useRealRun`.

---

## B21 — Opisy bike parków + tras

**Dlaczego:** bike park i trail mają `description` w DB (`spots.description`,
`trails.description`), ale ani nie są wyświetlane, ani ręcznie
edytowane z appki. Szczególnie pioneer chciałby dodać kontekst
(np. "single track, trochę root roll", "FREE JUMP 2m na końcu").

**Scope:**
- `spot/[id]` render `spot.description` pod identity blockiem.
  Dane już są w DB (`submit_spot_region_description` migracja).
  Tylko UI.
- `trail/new.tsx` — dodać pole opisu (Step 2 lub 3). Rozszerzyć
  `create_trail` RPC o `p_description text`.
- `trail/[id]` render description.
- Edycja post-hoc: pioneer lub curator może zmieniać opis własnego
  trail (nowa RPC `update_trail_description`).

**Risk:** moderacja treści. Dodać basic profanity filter
(`src/services/moderation.ts` już istnieje — reuse `validateUsername`
pattern dla description).

---

## B22 — Usuń trasę

**Dlaczego:** obecnie curator może `usun bike park` (cascade) ale
nie ma ścieżki na usunięcie **jednej trasy** w parku. Pioneer któremu
się spierdolił pierwszy run i trail utknął w `draft` bez sensu —
zostaje na liście na zawsze.

**Scope:**
- Nowa RPC `delete_trail(p_trail_id)`:
  - Soft delete — `trails.deleted_at timestamptz` kolumna, trail
    znika z queries.
  - Policy: curator może wszystko. Pioneer może usunąć swój trail
    gdy `calibration_status IN ('draft', 'calibrating')` AND
    `runs_contributed <= 1` (tylko swój pioneer run się liczy).
    Powyżej — zbyt duża strata dla innych riderów.
- UI: button "usuń trasę" na `trail/[id]` dla curator / pioneer-w-warunkach.
- Cascade: `leaderboard_entries`, `runs` — zostawiamy (historia),
  ale filter `trails.deleted_at IS NULL` wszędzie gdzie trails są
  renderowane.

**Risk:** usuwanie historycznych PB innych userów. Soft delete
pozwala undo + audytowalność. Hard delete tylko dla curator-force.

---

## B23+ — "Plansza tras Forza Horizon style"

**Dlaczego:** user expect — interaktywny rysunek całego bike parku
z markerami każdej trasy, feature points (jumps, berms, checkpoints),
tap-to-race. Wygląda jak menu selekcji trasy w Forza Horizon / Dirt 5.

**Scope (duże):**
- `spot/[id]` nowy widok — przełącznik `LISTA` / `MAPA`
- Widok mapy:
  - Rendering `spots.map_geometry` jako bazowa warstwa (topo / park
    outline)
  - Każda trasa jako overlay polyline (`trails.geometry` JSONB)
  - Kolorowanie po `difficulty` + `trustTier`
  - Markers na start / finish / checkpointach
  - Feature markers (nowy schemat: `trail_features` table — jump,
    berm, drop, gap, technical section) z ikonami
  - Tap na trasie → detail drawer z CTA
- Reuse komponentów z `src/components/map/` (`ArenaMapCustom`,
  `TrailDrawer`, `TruthMap` już istnieją — trzeba wpiąć w spot detail)
- Camera: auto-fit do bounds bike parku + zoom UI

**Risk:** overflow scope. 1-2 tygodnie roboty + mocno iterowany
design. **Nie na jeden build.** Rozbić na fazy:
- Faza 1: lista trails jako markery na statycznej mapie z spot
  centroidem (existing `ArenaMapCustom`)
- Faza 2: trail geometry polylines
- Faza 3: feature markers + custom style
- Faza 4: interactive drawer + camera

---

## Otwarte z field-test B19 (nie w B20)

### Cross-device sync lag (#3 z listy usera)
- Bike park dodany na tel A → tel B widzi dopiero po kilku force-close.
- Pending bike park w ogóle nie widoczny na home.
- **Root cause do sprawdzenia:** cache TTL w `useBackend` hooks vs.
  realtime subscription coverage. Może brakuje channel.on('*') dla
  `spots` / `trails` na home.
- **Dochodzenie:** Supabase realtime policy + frontend `useRefresh`
  signal wiring.

---

## Decyzje czekające

- **Curator queue post-B20:** pending bike parki z założenia teraz
  aktywują się przez pioneer run. Curator queue staje się "flag
  queue" dla problematic spots (moderate post-hoc). Czy zostawić
  `/app/spot/pending.tsx` jako read-only "historia zgłoszeń"?
- **Notifications:** Opcja B' nie wymaga push. Ale gdy dojdziemy
  do crowd-validation / multi-rider races, push będzie potrzebny.
  Kiedy zacząć setup infra (Expo push + backend edge function)?
