# Backlog — post-B20

Aktualizowane jako luźna lista rzeczy do zrobienia po aktualnym
buildzie. Priorytet rośnie od dołu — najwyższy na górze.

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
