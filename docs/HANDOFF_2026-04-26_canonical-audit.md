# Handoff — 2026-04-26, canonical audit (Spots/Profile/Leaderboard)

Ja-z-poprzedniej-sesji do ja-z-następnej. Poprzedni wątek się ubił na image-size limit przed leaderboard capture.

## Gdzie jesteśmy

- Branch `main`, in-sync z `origin/main`. Working tree: tylko `app.json` (iOS buildNumber 29 → 31, niezacommitowane).
- HEAD: **`82a437f`** `chore(voice): emoji removal + onboarding accent decoration fix`.
- Tryb pracy: **comprehensive final audit canonical specs vs implementation** — łazimy po appce w preview, robimy screenshoty, porównujemy z canonical atoms.

## Co już zaudytowane

### ✅ SPOTY tab (canonical 10/10)
- [app/(tabs)/spots.tsx](app/(tabs)/spots.tsx) renderuje:
  - `PageTitle` kicker "SPOTY" + h1 "BIKE PARKI" + subtitle "1 spot · 0 aktywne"
  - Filter pills `WSZYSTKIE/AKTYWNE/NOWE`
  - `SpotRow` — WWA BIKE PARK, 44×44 marker (warn ring + spot icon), name CAPS, "MAZOWIECKIE" sub, NOWY warn pill, chevron
  - `+ DODAJ BIKE PARK` primary pill z accent glow
- Verdict: pass.

### ✅ Spot deeplink fallback
- Fake-id deeplink → "BIKE PARK NIE ZNALEZIONY" + canonical `← Wróć` Btn.
- **Issue minor:** `Btn` label "Wróć" → renderuje "WROC". Diakrytyki giną przy `textTransform: 'uppercase'` na `Rajdhani_700Bold` ([Btn.tsx:143](src/components/nwd/Btn.tsx)).

### ✅ Profile RIDER tab (canonical render)
- Avatar, `hermit_nwd`, level badge, RIDER rank.
- `STATYSTYKI` SectionHead z podium icon + 3-col `StatBox` grid (Zjazdy 10 / Rekordy 7 accent / Najlepsza pozycja #1).
- `AKTYWNOŚĆ` + `OSIĄGNIĘCIA` SectionHeads.
- **Issue 1 (font/diakrytyk bug):** `AKTYWNOŚĆ` renderuje jako `AKTYWNOSC`. Ten sam Rajdhani uppercase glyph drop dla Ś/Ć.
- **Issue 2 (duplikacja):** Dwie etykiety `AKTYWNOŚĆ` na ekranie:
  - mój `SectionHead` w [profile.tsx:317-319](app/(tabs)/profile.tsx)
  - wewnętrzny `sectionTitle` w [ActivityList.tsx:183](src/components/ui/ActivityList.tsx) — duplikat do usunięcia.

### ⏳ Leaderboard — ZACZĘLIŚMY ALE NIE DOSZLIŚMY DO CAPTURE
- [app/(tabs)/leaderboard.tsx](app/(tabs)/leaderboard.tsx) — **częściowo canonical, brak importu `LeaderboardRow`**, renderuje grid manualnie (StyleSheet, posSlot 48px).
- Logika canonical (MEDAL gold/silver/bronze, `RiderAvatar`, `TrustBadge`, `PioneerBadge`), ale layout nie używa atomu.
- **Akcja: refactor na `LeaderboardRow` atom** ([src/components/nwd/LeaderboardRow.tsx](src/components/nwd/LeaderboardRow.tsx)) — bo właśnie po to zostało napisane w `68ae43f`.

## Open issues (po audicie)

### A. Diakrytyk Ś/Ć w Rajdhani (cross-cutting)
- **Symptom:** `WRÓĆ → WROC`, `AKTYWNOŚĆ → AKTYWNOSC`.
- **Root cause:** `Rajdhani_700Bold` font NIE MA glyphs dla wielkich Ś/Ć. Gdy CSS `textTransform: 'uppercase'` (Btn) lub JS `.toUpperCase()` (SectionHead/PageTitle/TopBar/HudPanel) stosuje uppercase, znak nie istnieje w fontcie i fallbackuje na OS default.
- **Skąd dotyczy:** wszystkie atomy używające Rajdhani CAPS — Btn, StatBox, RaceTime, LeaderboardRow, SpotRow name. SectionHead/PageTitle/TopBar/HudPanel używają `Inter_700Bold` w label/kicker — Inter też powinien obsłużyć diakrytyki, ale w SectionHead bug widoczny → zweryfikuj czy Inter naprawdę się ładuje (może fallback do system font który gubi).
- **Rozwiązanie do rozważenia:** (1) wymienić Rajdhani na font z pełnym Latin Extended-A; (2) używać tylko lowercase w UI tam gdzie diakrytyki są krytyczne; (3) sprawdzić `useFonts()` loading dla Inter — czy faktycznie ładuje się jeden z plików `.ttf`.

### B. Duplikat `AKTYWNOŚĆ` w profile
- Akcja: usunąć `sectionTitle` z `ActivityList.tsx:183` (linia z `<Text style={styles.sectionTitle}>AKTYWNOŚĆ</Text>` + całą `<View style={styles.section}>` opakowującą — `SectionHead` w profilu już to wyświetla).

### C. Leaderboard — refactor na LeaderboardRow
- Akcja: zaimportować `LeaderboardRow` z `src/components/nwd/`, usunąć manualny grid w `app/(tabs)/leaderboard.tsx`.

### D. Build 31 (app.json)
- iOS buildNumber bumped z 29 → 31. Niezacommitowany. **Nie pamiętam dlaczego** — prawdopodobnie czeka na zacommitowanie po zakończeniu audit/fixów.

## Canonical atoms reference

Wszystko w `src/components/nwd/`:

| Atom | Uppercase mechanism | Font |
|------|---------------------|------|
| Btn | CSS `textTransform` | `Rajdhani_700Bold` ⚠️ |
| StatBox value | none (numeric) | `Rajdhani_700Bold` |
| StatBox label | JS `.toUpperCase()` | `Inter_700Bold` |
| SectionHead | JS `.toUpperCase()` | `Inter_700Bold` (l.58) |
| PageTitle kicker | JS `.toUpperCase()` (l.33) | `Rajdhani_800ExtraBold` |
| TopBar title | JS `.toUpperCase()` (l.45) | `Inter_700Bold` |
| HudPanel title | JS `.toUpperCase()` (l.72) | `Inter_700Bold` |
| SpotRow name | JS `.toUpperCase()` | `Rajdhani_700Bold` ⚠️ |
| LeaderboardRow | mix | `Rajdhani_700Bold` ⚠️ |

⚠️ = potencjalnie traci diakrytyki na Ś/Ć (do potwierdzenia czy Rajdhani na pewno).

## Następny ruch

1. Capture leaderboardu w preview (preview_screenshot, nie WebFetch — żeby uniknąć image-size limit z poprzedniej sesji).
2. Dokończyć comprehensive final audit (zostało: leaderboard + ewentualnie home/auth).
3. Fix issues A/B/C (lub spawn task per issue jeśli user woli).
4. Zdecydować co z buildNumber 31 (commit + EAS submit, czy revert).

---

## Update — 2026-04-26 PM (post-fix B/C)

### B (duplikat AKTYWNOŚĆ) — ✅ done
- [ActivityList.tsx](src/components/profile/ActivityList.tsx) — usunięty `<Text>AKTYWNOŚĆ</Text>` z empty branch i with-runs branch. Wycięte unused styles (`sectionHeader`, `sectionTitle`, `sectionMeta`).
- SectionHead w profile.tsx pozostaje jedynym tytułem. Expand button dalej pokazuje `POKAŻ WSZYSTKIE (n)` jako count info.
- TS clean.

### C (LeaderboardRow refactor) — ✅ done
- [LeaderboardRow.tsx](src/components/nwd/LeaderboardRow.tsx) extended:
  - `rider: string | ReactNode` — pozwala consumer'owi wstrzyknąć custom row content (badges/tags) zachowując ellipsis na fallback string path.
  - `onLongPress?`, `delayLongPress?` — for `reportRider` long-press.
  - `deltaTone()` rozpoznaje `↑` (accent) i `↓` (danger) obok time-delta `−`/`-`/`+`.
- [leaderboard.tsx](app/(tabs)/leaderboard.tsx) rest section (pos 4+) używa `LeaderboardRow`. Manual grid usunięty. Wycięte unused styles (entry/entryUser/entryRival/entryAccentBar/positionCol/avatarCol/position/deltaCol/deltaUp/deltaDown/deltaFlat/riderCol/riderRow/rankIcon/riderName/timeCol/time/gap).
- Mapping:
  - `position` → `entry.currentPosition`
  - `leading` → `<RiderAvatar size={28}>`
  - `rider` → custom JSX z rankIcon + name (color tinted) + tagi (TY/CEL/GONI) + PioneerBadge
  - `sub` → `+1.4s do lidera` (gapToLeader)
  - `time` → `formatTimeShort`
  - `delta` → `↑3` / `↓2` / null (position change)
  - `self` → isUser
  - `style={rowRival}` → preserved orange highlight dla rival above/below
- Podium (top 3) zostawiony jako custom karty — nie pasuje do row anatomy.
- TS clean, console clean.

### A (Ś/Ć/Ó w uppercase) — NIE WYSTĘPUJE NA WEB
- Sprawdzone w [docs/HANDOFF...](preview_snapshot): `/spot/fake-id-test` → DOM tree to `"← WRÓĆ"` (z pełnymi diakrytykami).
- Body text leaderboard: `"DZIŚ"`, `"ZALOGUJ SIĘ"` — Ś/Ę renderowane poprawnie.
- Rajdhani 700 Bold + Inter 700 Bold mają glyphs dla wszystkich diakrytyków PL (sprawdzone via cmap parser na node_modules ttf-ach).
- **Wniosek:** bug A nie istnieje w kodzie. Albo był to iOS-only rendering quirk (wymaga native build do reprodukcji), albo copy-paste/typo w opisie z poprzedniej sesji.
- **Akcja:** zostawić open until reproduce na iOS native. Jeśli reprodukuje się tylko na iOS, prawdopodobnie issue z faux-bold (`fontWeight: '800'` na Rajdhani 700 — Btn.tsx:142) lub iOS letterSpacing clipping.

### Verification status
- TS: clean (`npx tsc --noEmit`).
- Console: clean (no errors / warnings poza `textShadow*` deprecation pre-existing).
- Visual: signed-out states OK. **Visual verify dla profile RIDER tab + leaderboard rest section wymaga auth — niemożliwe w obecnym preview (no anon login, localStorage empty). Recommend: reprodukować po next iOS build.**

### Niezacommitowane zmiany (po fixach)
- `app.json` (preexisting) — iOS buildNumber 29→31
- `src/components/profile/ActivityList.tsx` — fix B
- `src/components/nwd/LeaderboardRow.tsx` — fix C atom extension
- `app/(tabs)/leaderboard.tsx` — fix C consumer refactor

---

## Update — 2026-04-26 PM (full canonical migration sweep)

User direction: "push dalej all" — przepisać wszystkie pre-canonical
ekrany przed buildem. 8 commits, ~600 LOC delta. Wszystkie TS clean.

### Commits

| Hash | Surface | Change |
|------|---------|--------|
| `272695c` | leaderboard + ActivityList | Fix B+C (rest section → LeaderboardRow, dedup AKTYWNOŚĆ) |
| `aa66888` | help | TopBar/PageTitle/SectionHead/Card/Btn/Pill — dropped ui/SectionHeader + ui/Divider, glyph decorations (✦/?/✉) per § 13.5 |
| `eacfecf` | run/active | Pill (mode badge), RaceTime hero (timer), Btn ghost (cancel) |
| `7d35611` | run/result | ui/SectionHeader → nwd/SectionHead (2 sites, ▲/→ glyphs dropped) |
| `9ddbe64` | spot/new | TopBar+PageTitle+Btn (6 GlowButton sites), inline filter chips dla VOIVODESHIPS |
| `001b5f5` | trail/new | Same pattern — TopBar+PageTitle+Btn (4 GlowButton), inline chips dla DIFFICULTY+TRAIL_TYPE |
| `51a45d7` | ChallengeItem + XPBar | chunk9 alias drop → @/theme tokens (visual parity preserved) |
| `78ea4fd` | profile | ui/Divider drop, whitespace boundary |

### Co teraz canonical

✅ **Pełne canonical** (atom-only):
- spot/[id], trail/[id], auth/index, leaderboard, help, run/active, run/result, spot/new, trail/new, profile (shell), home (Btn/Card/Pill/SectionHead atoms)

⚠️ **Częściowe** — atomy + dziedziczone widgety:
- profile używa `ActivityList` (own composition, canonical theme)
- home używa `ChallengeItem` + `XPBar` (canonical theme po dzisiejszym swap), `StreakIndicator` (już canonical), `HeroCard` (still chunk9)

❌ **Pozostały do migracji** (deferred do next session):
- `HeroCard` + 5 sub-componentów: `Brackets`, `GlowButton`, `PulseDot`, `SegmentLine`, `StatCell`. Razem ~700 LOC. Visual regression risk na home hero — wymaga osobnego sprintu.

### Build

- `app.json` iOS buildNumber `29 → 31` (preexisting bump from user). EAS production profile ma `autoIncrement: true` więc manual bump może kolidować z EAS counter — verify przed submitem.
- HeroCard tree pozostaje pre-canonical, ale działa poprawnie z aktualnymi widgetami (ChallengeItem/XPBar użyte w innych miejscach też).

### Memory pin do uwzględnienia

[game-app framing](memory/feedback_game_framing.md) — wszystkie nowe ekrany czytają się jako game UI (PYTANIA, ZASADY, KONTAKT z SectionHead, Pill ARMED/TRAINING dla mode badge, etc).

## Memory pins do uwagi

- [game-app framing](memory/feedback_game_framing.md) — wszystko musi czytać się jako game UI.
- [crowd validation gap](memory/crowd_validation_gap.md) — CORE BLOCKER, niezwiązane z tym auditem ale highest sev.
