# NWD Audit Report — 2026-04-24

## Executive Summary
- 🟢 Naprawione do tej pory: 11.
- 🟡 Do zatwierdzenia: 28 (po KROK 4 — performance, cache, koszt Supabase).
- 🔴 Po KROK 5: 4 strategiczne decyzje (trust model, crowd validation, region taxonomy, monetization path).
- 🔴 Do dyskusji strategicznej: 4 (trust model / crowd validation / PL-only region / monetization path).
- Aplikacja mobilna faktycznie działa na Expo Router + React Native + Supabase; osobny `website/` to Next.js landing/legal, nie core produktu.
- Core flow ridera jest obecny: wybór bike parku/trasy → pre-ride → auto-start ranked/practice → wynik → retry/offline save.
- Flow Pioneer/kalibracji też istnieje: zgłoszenie bike parku → tworzenie traila → nagranie linii → review → `finalizePioneerRun`.
- Statyczny registry aren (`src/data/venues`) jest obecnie celowo pusty; kod nadal ma kilka ścieżek zależnych od `getVenueForTrail()`.
- Nie ma Mapboxa; mapy są na `react-native-maps`, SVG/custom mapach i web fallbackach.
- Offline jest częściowo zaadresowany: kolejka zapisów runów, kolejka zgłoszeń bike parków, lokalny run store, background location dla runów i Pioneer recording.
- Największy obszar ryzyka do dalszego sprawdzenia: ranking/timing i gate/corridor rescue, bo każde zachowanie tam wpływa na zaufanie do ligi.
- Krok 2: nie znalazłem aktywnych `supabase.channel()` realtime subskrypcji do posprzątania; realtime ryzyko jest dziś bardziej produktem przyszłym niż obecnym bugiem.

## Krok 1 — Inwentaryzacja

### Mapa ekranów

| Route / plik | Funkcja |
|---|---|
| `/` — `app/index.tsx` | Bootstrap: sprawdza onboarding i konfigurację backendu, potem przenosi do appki. |
| root stack — `app/_layout.tsx` | Ładuje fonty, auth, globalny error boundary, background tasks i debug drawer. |
| `/(tabs)` — `app/(tabs)/index.tsx` | Home/lobby ridera: profil, XP, wyzwania, primary bike park i entry do dalszych flow. |
| `/(tabs)/spots` — `app/(tabs)/spots.tsx` | Lista bike parków z filtrami i wejściem do zgłoszenia nowego miejsca. |
| `/(tabs)/leaderboard` — `app/(tabs)/leaderboard.tsx` | Ranking per arena/trasa/okres, z podium, pozycją ridera i kontekstem trust. |
| `/(tabs)/profile` — `app/(tabs)/profile.tsx` | Profil ridera: avatar, XP/ranga, achievements, aktywność, pomoc, wylogowanie, usunięcie konta. |
| `/auth` — `app/auth/index.tsx` | Logowanie OTP i tworzenie profilu. |
| `/onboarding` — `app/onboarding/index.tsx` | Intro + prośba o lokalizację. |
| `/spot/[id]` — `app/spot/[id].tsx` | Szczegóły bike parku: status, trail list, mapa/CTA, akcje curator/pioneer. |
| `/spot/new` — `app/spot/new.tsx` | Zgłoszenie nowego bike parku z kolejką offline. |
| `/spot/pending` — `app/spot/pending.tsx` | Kolejka curatorów do zatwierdzania/odrzucania zgłoszeń. |
| `/trail/[id]` — `app/trail/[id].tsx` | Szczegóły trasy, statystyki, leaderboard slice, start ranked/practice/Pioneer. |
| `/trail/new` — `app/trail/new.tsx` | Utworzenie traila dla bike parku i przejście do nagrania kalibracyjnego. |
| `/run/active` — `app/run/active.tsx` | Główny pre-ride i live timer dla ranked/practice z gate engine. |
| `/run/recording` — `app/run/recording.tsx` | Pioneer recording: nagrywa geometrię trasy w tle i prowadzi do review. |
| `/run/review` — `app/run/review.tsx` | Review nagranej geometrii Pioneer i finalizacja traila/runu. |
| `/run/rejected` — `app/run/rejected.tsx` | Ekran odrzucenia nagrania, głównie słaby sygnał. |
| `/run/result` — `app/run/result.tsx` | Wynik przejazdu: czas, save status, ranking, XP, PB, retry zapisu. |
| `/run/[id]` — `app/run/[id].tsx` | Deep link do wyniku/runu; przekierowuje do result albo fallbacku. |
| `/help` — `app/help/index.tsx` | FAQ, zasady, linki legal/support. |
| `/settings/delete-account` — `app/settings/delete-account.tsx` | Usunięcie konta zgodne z App Store flow. |
| `app/__dev/*` | Dev-only preview/regression screens: polish fonts, empty states, approach preview, mock hero. |

### Core user flows

| Flow | Co daje userowi | Główne pliki |
|---|---|---|
| First run | Rider rozumie appkę, zakłada profil i trafia na lobby bez konfiguracji ręcznej. | `app/onboarding/index.tsx`, `app/auth/index.tsx`, `app/(tabs)/index.tsx` |
| Bike park → trail → ride | Rider wybiera miejsce i trasę, odpala przejazd ranked lub trening. | `app/(tabs)/spots.tsx`, `app/spot/[id].tsx`, `app/trail/[id].tsx`, `app/run/active.tsx` |
| Ranked timing | Auto-only ranked start, gate detection, finish, weryfikacja i zapis wyniku. | `app/run/active.tsx`, `src/systems/useRealRun.ts`, `src/features/run/*`, `src/systems/runFinalization.ts` |
| Offline save | Przejazd ma zostać zachowany lokalnie i wysłany później, gdy wróci sieć. | `src/systems/runStore.ts`, `src/systems/saveQueue.ts`, `src/systems/runSubmit.ts`, `src/systems/retrySubmit.ts` |
| Pioneer calibration | Rider/curator tworzy trail przez fizyczne nagranie linii, potem appka buduje geometrię/gates. | `app/trail/new.tsx`, `app/run/recording.tsx`, `app/run/review.tsx`, `src/features/recording/*` |
| Leaderboard loop | Rider widzi pozycję, rywali, PB i powód powrotu na kolejną próbę. | `app/(tabs)/leaderboard.tsx`, `app/run/result.tsx`, `src/lib/api.ts` |

### Stack faktycznie używany

| Obszar | Faktyczny stack |
|---|---|
| Mobile app | React Native 0.83, React 19, Expo 55, Expo Router. |
| Backend | Supabase JS v2, RLS/migrations/RPC, Edge Function `delete-account`. |
| Storage lokalny | AsyncStorage dla sesji, run store, save queue, spot submission queue, recording buffer. |
| Lokalizacja/timing | `expo-location`, `expo-task-manager`, foreground `watchPositionAsync`, background `startLocationUpdatesAsync`, custom gate engine. |
| Mapy | `react-native-maps`, SVG/custom maps, web fallback; brak Mapboxa. |
| UI | Native StyleSheet, custom theme, Rajdhani + Inter, `expo-linear-gradient`, `react-native-svg`, Reanimated. |
| Website | Next.js 14 + React 18 w `website/`, głównie public/legal/support. |
| Testy | Jest + ts-jest + react-test-renderer, testy RPC/run/gate/validators. |

### Rozbieżności między założeniem a kodem

| Założenie | Co jest w kodzie | Kategoria |
|---|---|---|
| Arena Słotwiny jako aktywna konfiguracja statyczna | `src/data/venues/index.ts` eksportuje pusty registry; komentarz mówi, że źródłem ma być DB/Pioneer geometry. | 🟡 |
| `TrailGateConfig` z areny jako stabilne źródło dla rankingów | `app/run/active.tsx` buduje config z Pioneer geometry z DB, a statyczny fallback zależny od venue zwykle nie zadziała przy pustym registry. | 🟡 |
| Trail picker / bottom sheet jako główny entry | W kodzie główny picker to lista bike parków + `spot/[id]` + `trail/[id]`; komponent `TrailDrawer` istnieje, ale główny flow nie jest klasycznym bottom sheetem mapowym. | 🟡 |
| Mapbox cost/risk | Mapbox nie jest używany, więc koszt Mapbox = 0; koszt/ryzyko map dotyczy raczej `react-native-maps` i własnych fallbacków. | Info |
| Historia jako osobny tab | Aktualny `app/(tabs)` ma `spots`, nie `history`; `docs/CURRENT_STATE.md` jest nieaktualny względem routingu. | 🟢 docs/później |

## 🟢 Co już naprawiłem

| Plik | Zmiana | Commit | Kategoria |
|---|---|---|---|
| `app/_layout.tsx` | `initSpotSubmissionQueue()` wołane przy starcie — kolejka offline zgłoszeń bike parków nie była hydratowana, więc zapisane lokalnie spoty nigdy nie szły do backendu. | `c05d069` | offline/resilience |
| `src/services/spotSubmission.ts` | Przy drenażu kolejki zgłoszeń spotów transient errors (sieć, 5xx) nie kasują już lokalnego recordu — tylko trwałe 4xx zdejmują go z kolejki. | `24b09a6` | offline/resilience |
| `app/run/active.tsx` | Debug-tap `setTimeout` czyszczony przy re-tapie i unmount — przestaje wyciekać i próbować setState po unmount. | `4dbefbe` | memory leak / crash guard |
| `app/_layout.tsx` | Cleanup timera globalnego debug triggera przy unmount roota. | `ac3429d` | memory leak |
| `app/(tabs)/_layout.tsx` | Haptic feedback opakowany w `.catch(() => undefined)` — odrzucone promise nie propaguje się jako unhandled rejection na Androidzie bez OS-level haptics. | `d9d69da` | stability |
| `app/run/recording.tsx` | Haptic feedback w Pioneer recording opakowany w `.catch(() => undefined)`, żeby nie przerywał flow nagrywania ani nie generował unhandled rejection. | `62634d2` | stability |
| `src/components/ui/GlowButton.tsx` | Inline CTA ma teraz minimum 44 pt touch target; wcześniej linkowe CTA były zbyt małe pod rękawiczki. | `5a15a8c` | a11y/ui |
| `src/components/ui/TrailCard.tsx` | Trail card dostał pełne `accessibilityLabel` z nazwą, metadanymi i akcją. | `8488d3d` | a11y |
| `src/components/run/ReadinessPanel.tsx` | Pre-ride fallback buttons mają role/labele i minimum 44 pt. | `43e18a2` | a11y/ui |
| `app/run/active.tsx` | Full-screen active run control i back button mają role/labele. | `7b7170c` | a11y |
| `src/components/map/TrailDrawer.tsx` | Bottom sheet actions dostały role/labele i większe touch targety. | `0ad7581` | a11y/ui |

## Krok 2 — Sweep Bugowy

### Wyniki

| Obszar | Status | Wniosek |
|---|---|---|
| Nieobsłużone promise | 🟢/🟡 | Naprawiłem haptics w tab barze i recording. W większych hookach backendowych zostaje temat stale async updates — patrz rekomendacje. |
| Race conditions w timerach/listenerach | 🟢/🟡 | Naprawiłem dwa dev timery bez cleanupu. Core run ma zabezpieczenia (`finalizingRef`, `trackingActiveRef`, background buffer floor), ale wymaga testu terenowego. |
| Memory leaki | 🟢 | Dwa oczywiste timeout leak fixy zrobione. AppState/Auth/Linking listener cleanup wygląda poprawnie. |
| Offline | 🟢/🟡 | Naprawiłem queue init i odporność spot queue drain. Run queue istnieje i hydratuje `saving/pending` do `queued`, ale retry jest app-state based, nie network based. |
| Gate detection / `corridor_rescue` | 🟡 | Tylko raport: nie ruszałem core rankingu. Widzę ryzyka w źródle geometrii i sposobie liczenia korytarza. |
| Uprawnienia location/motion | 🟡 | Location permissiony są obsłużone, motion permissions nie są używane. Ryzyko: ranked/practice flow nie komunikuje jasno braku background location tak dobrze jak Pioneer recording. |
| Realtime Supabase | Info | Brak aktywnych realtime kanałów poza auth listenerem, więc nie ma dziś subskrypcji `postgres_changes` do odpinania. |

### Krok 2b — Pogłębiony review ranking/timing

Dodatkowy przegląd gate engine + finalizacji + RPC `finalize_seed_run` + `delete_run` od strony correctness, cheating i spójności rankingu.

| Obszar | Status | Wniosek |
|---|---|---|
| Monotoniczność timestampów w live distance | 🔴 | `totalTraceDistanceM()` ([src/systems/runFinalization.ts:203](src/systems/runFinalization.ts:203)) i akumulacja `state.totalDistanceM` w `processPoint` ([src/systems/useRealRun.ts:259](src/systems/useRealRun.ts:259)) sumują dystans w kolejności dostarczenia próbek. Jedna out-of-order próbka z background bufora (rare, ale możliwa po AppState blackout) zawyża dystans. Finalizacja NIE sortuje przed sumowaniem. |
| Start/finish timestamp correctness | 🟢 | `autoStartTimestamp` i `autoFinishTimestamp` pochodzą z `loc.timestamp` GPS. `finalizingRef` blokuje podwójny finish. Manual start jest jawnie downgradowany przez `startCrossing: null` → ineligible w `quality.ts:131`. |
| Hardcoded `counted_in_leaderboard = true` w RPC | 🟡 | `finalize_seed_run` (`012_sprint_4_rpcs.sql`, linia ~113) wstawia `counted_in_leaderboard = true` bez server-side re-oceny eligibility. Klient wysyła już zweryfikowane, ale jakakolwiek rozjazd między client-side `quality.ts` a założeniami RPC → leaderboard w niezgodzie z rzeczywistością. |
| `delete_run` promocja bez `trail_version_id` filtra | 🟡 | Promocja next-best run (migration `20260424`, linia ~136) selectuje po `trail_id + user_id`, nie po wersji trasy. Przy rekalibracji traila rider może mieć ranking na v1 a run na v2 — promocja może wybrać niewłaściwą wersję. |
| Brak globalnego rerank po `delete_run` | 🟡 | Komentarz w migracji 20260424 jawnie mówi "out of scope — next incremental job". Jeśli job nigdy nie odpali (a na prodzie **nie widzę cron/edge function do rerank**), ranking zostanie niespójny dla innych riderów dopóki następny PB ich nie przeszachuje organicznie. |
| Cheating: forged `gps_trace` | 🔴 strategiczne | RPC ufa klientowi — `gps_trace jsonb` wstawiany wprost. Nie ma commitmentu/signature, który wiąże trace z urządzeniem ridera w sesji. Replay ataku cudzym tracem jest architektonicznie możliwy. Decyzja do KROK 5 (czy warto dziś rozwiązywać). |
| Anti-cheat (non-forged) | 🟢 | `antiCheat.ts`: too_few_points, time-travel, 300m teleport, >120km/h, min 100m movement — wszystkie są i klient-side, i duplikowane w RPC check'ach. |

## Krok 3a — State coverage (loading / empty / error / offline)

Pass przez 8 kluczowych ekranów. Szukałem cliffów: białych ekranów, stuck spinnerów, useless errorów.

| Ekran | Loading | Empty | Error | Offline |
|---|---|---|---|---|
| `(tabs)/index` | 🟢 cold skeleton | 🟡 anon card pokazany, reszta ukryta bez CTA | 🟢 tryb awaryjny + retry | 🟢 PTR, degraduje miękko |
| `(tabs)/leaderboard` | 🟢 spinner | 🟢 trzy odrębne puste stany | 🟢 PONÓW card | 🟡 brak offline-specific UI |
| `(tabs)/spots` | 🟡 brak skeletonu, flicker empty→list | 🟢 motywujący pusty | 🟢 tryb awaryjny | 🟢 PTR |
| `(tabs)/profile` | 🟡 stats "—" nieodróżnialne od zera | 🟢 sign-in card dla anon | 🟡 `ok` z brakiem user obiektu | 🟢 PTR + orphan purge |
| `spot/[id]` | 🟢 pełny spinner | 🟡 "MISSJA OTWARTA" redundant przy all_calibrating | 🟢 retry | 🟢 PTR |
| `trail/[id]` | 🟡 draft pokazany ale leaderboard nadal ładuje | 🟢 "Tablica pusta" | 🟡 brak explicit error state dla board | 🟡 brak offline check |
| `run/active` | 🟢 Readiness fallback | 🟡 "UNKNOWN TRAIL" dla deep linku do skasowanej trasy | 🟡 alert zamiast screen | 🟡 GPS state nie powiązany z network |
| `run/result` | 🟢 czeka na runStore | 🔴 "Brak danych zjazdu" bez recovery CTA | 🟡 save fails silent przy offline toggle | 🟡 brak network vs server distinction |

**Cross-cutting:**
- `__DEV_MOCK_HERO_BEAT__` flag w `useBackend.ts:36-54` — dev-only, ale mechanizm w kodzie. Nie używany na prodzie, ale warto oznaczyć jako dev-only explicit guard.
- Pull-to-refresh brakuje na `trail/[id]` board section.
- Orphan states (trasa/spot skasowane server-side) pokazują "Unknown Trail" w [app/run/result.tsx:308](app/run/result.tsx:308) bez nav z dna. To pokrywa się z memory notką `bug_orphan_run_lock`.

**TOP 3 state gaps do fixowania:**
1. 🔴 `run/result` orphan recovery — brak CTA gdy trasa/spot skasowane podczas runu. Impact 4, Effort M.
2. 🟡 `trail/[id]` cichy fail leaderboardu — lbLoading blokuje sekcję board bez error fallback. Impact 4, Effort S.
3. 🟡 `(tabs)/spots` brak skeletonu przed fetch — flicker "brak" → lista. Impact 3, Effort S.

## Krok 3b — UI/UX Sweep

### Trail picker / bottom sheet
**Cel usera:** szybko wybrać trasę, zrozumieć czy jedzie ranking/trening/Pioneer i nie pomylić „otwórz trasę” z „startuj”.

**Co zrobiłem (🟢):**
- `5a15a8c` — inline CTA w `GlowButton` ma minimum 44 pt touch target.
- `8488d3d` — `TrailCard` ma pełny accessibility label z nazwą trasy, metadanymi i akcją.
- `0ad7581` — `TrailDrawer` ma większe action targets oraz role/labele.

**Co proponuję (🟡):**
- Rozstrzygnąć list-first vs map/bottom-sheet-first. Dziś główny flow idzie przez listę w `spot/[id]`, a `TrailDrawer` jest komponentem istniejącym, ale nie wygląda na główne entry.
- Rozdzielić tap card vs CTA. Teraz karta jest `Pressable`, a w środku jest CTA; w rękawiczkach to może dać przypadkowe wejście w szczegóły zamiast startu.
- Dodać „glove mode” dla listy tras: większa wysokość karty, CTA pełnej szerokości, mniej drobnego tekstu.

**Edge cases / missing states:** empty jest mocny w `spot/[id]`, loading/error są OK; offline jest głównie pull-to-refresh, brak jasnego „masz stare dane”; słabe GPS nie dotyczy samego pickera; słońce/rękawiczki nadal ryzykowne przez drobne badge/metadane.

### Pre-ride / ranked start screen
**Cel usera:** stanąć na starcie, uzbroić ranking, schować telefon i wiedzieć, że timer naprawdę zadziała.

**Co zrobiłem (🟢):**
- `43e18a2` — fallback actions w `ReadinessPanel` mają większy target i accessibility.
- `7b7170c` — full-screen control w `run/active` ma accessibility label zależny od aktualnego phase label.

**Co proponuję (🟡):**
- Background-location preflight przed ranked: jeśli „Zawsze” nie jest granted, pokaż jasny wybór „włącz” albo „jedź trening”. To jest warunek zaufania do timingu w kieszeni.
- W stanie `GOTOWY`/`UZBROJONY` jeszcze mocniej oddzielić „tapnij UZBRÓJ” od „jedź”; dziś flow jest lepszy niż ukryty full-screen tap, ale w stresie nadal wymaga przeczytania instrukcji.
- Dodać tryb ultra-high-contrast dla pełnego słońca: większy status, mniej subtelnych ramek, mniej tekstu pomocniczego.

**Edge cases / missing states:** permission denied jest obsłużone, weak GPS jest obsłużone, brak gate config degraduje do treningu; offline nie blokuje startu, ale brak sieci nie jest jawnie komunikowany przed przejazdem; rękawiczki OK po poprawkach, ale copy nadal wymaga >2 s uwagi.

### Rider timer (armed / running / finished)
**Cel usera:** po starcie nie czytać UI, tylko mieć pewność czy timer działa i co zrobić na mecie.

**Co zrobiłem (🟢):**
- `7b7170c` — główny ekran aktywnego runu i back control są dostępne jako kontrolki dla accessibility.

**Co proponuję (🟡):**
- Running state powinien mieć jeszcze większy kontrast i jedną dominującą informację: czas + „RANKING/TRENING”. Live stats są przydatne, ale w czasie jazdy to za dużo do czytania.
- Dla finished/invalidated dodać krótką, jednoznaczną mikrocopy na ekranie przed przejściem do result: „dotknij wynik” jest OK, ale nie mówi czy wynik wszedł do ligi.
- Dodać haptic/speech fallback tylko po krytycznych przejściach, nie przy każdym małym stanie, żeby rider nie ignorował sygnałów.

**Edge cases / missing states:** brak GPS w trakcie runu degraduje przez verification, ale UI live nie daje jasnego „GPS przerwany”; noc OK przez dark UI, słońce ryzykowne przez subtelne kolory; rękawiczki OK dzięki full-screen tap.

### Gate radius + distance indicator + arrow
**Cel usera:** dojść na właściwą stronę linii startu bez zgadywania i bez patrzenia długo w telefon.

**Co zrobiłem (🟢):**
- `0ad7581` — istniejący bottom-sheet action „Znajdź start” ma label i większy target.

**Co proponuję (🟡):**
- Pokazywać confidence, nie tylko dystans: „±18m” przy ready state powinno wyglądać jak ostrzeżenie, nie jak neutralna metryka.
- W `ApproachView` mapa ma stałą wysokość 180; przy małych ekranach może zjadać miejsce na instrukcję. Rozważyć kompaktowy wariant tylko z arrow + distance.
- Dodać „nie idź dalej, jesteś za linią” jako bardziej agresywny visual state, bo wrong-side jest krytyczny dla ranked startu.

**Edge cases / missing states:** weak GPS jest wykryty; brak headingu jest optymistyczny, co jest anti-frustration, ale może mylić ridera; słońce ryzykowne dla mini-mapy; rękawiczki nie są problemem, bo tu user raczej idzie, nie jedzie.

### Results / ranking screen
**Cel usera:** natychmiast wiedzieć: czas, czy wynik wszedł do ligi, co poprawić i gdzie wrócić.

**Co zrobiłem (🟢):**
- Brak nowych fixów w tym kroku; wcześniejsze offline/status cards są już obecne w kodzie.

**Co proponuję (🟡):**
- `run/result` orphan recovery: gdy trasa/spot zniknie, pokaż recovery CTA zamiast „Unknown Trail”/fallback.
- `trail/[id]` leaderboard error state: gdy board fetch failuje, pokaż retry w sekcji tablicy.
- Leaderboard chips/tabs są drobne; po jeździe OK, ale w terenie warto zwiększyć touch target dla okresów i trail selectorów.

**Edge cases / missing states:** queued/offline save ma UI, failed ma retry; missing run ma zbyt słaby recovery; empty leaderboard jest OK; słabe GPS jest opisane, ale `corridor_rescue` nie ma czytelnego audit trail dla ridera.

### Pozostałe ekrany
**Cel usera:** onboarding/auth/profile/help nie mogą przeszkadzać core league loopowi.

**Co zrobiłem (🟢):**
- Brak nowych fixów w tej podsekcji.

**Co proponuję (🟡):**
- Profile actions i legal links mają drobne teksty; warto w kolejnym pass podnieść touch targets tam, gdzie nie ma `hitSlop`.
- `spots` lista potrzebuje skeletonu, żeby nie migała empty state przed fetch.
- `docs/CURRENT_STATE.md` zaktualizować, bo myli taby i starą strukturę.

**Edge cases / missing states:** auth ma rate-limit handling, onboarding ma permission ask; profile offline działa przez lokalny run store, ale nie mówi userowi jasno które dane są lokalne vs zsynchronizowane.

## Krok 4 — Performance & Architektura

### Re-render storms / state fan-out

| Obszar | Wniosek | Impact |
|---|---|---:|
| Globalny `triggerRefresh()` | `useBackend.ts` ma ponad 20 hooków zależnych od jednego globalnego `refreshSignal`. Jeden zapis runu/avataru/spotu może odświeżyć home, profile, leaderboards, spots i trail data naraz. Dla usera: więcej spinnerów i wolniejsze ekrany po jeździe. Dla kosztów: niepotrzebne reads. | 4 |
| Live run loop | `useRealRun.ts` ma timer UI co 50 ms. Sam zegar ma sens, ale jeśli do jednego renderu dołączymy dużo telemetry/UI, telefon w kieszeni może grzać baterię. Dla ridera: większe ryzyko dropów GPS i battery drain na dłuższej sesji. | 4 |
| `useBackend.ts` | Plik ma ~980 linii i dużo podobnych fetch hooków bez wspólnego cache/cancel strategy. Dla biznesu: szybkie iterowanie jest coraz droższe, bo mała zmiana danych może zepsuć kilka ekranów. | 3 |

### Supabase reads/writes per ranked ride

Aktualny ranked submit NIE wygląda na jeden atomowy RPC. Live ranked flow idzie przez `submitRunToBackend()` → `api.submitRun()`:

| Etap | Szacunek | Co to znaczy biznesowo |
|---|---:|---|
| Przed jazdą: home + spot + trail | ~7-12 SELECT | Akceptowalne w MVP, ale bez cache każdy powrót do ekranu robi świeży koszt i latency. |
| Zapis ranked runu | 1 SELECT PB + 1 INSERT run + 1 RPC leaderboard + 1 RPC run counts + 0-2 XP/best/favorite updates | Działa, ale nie jest atomowe end-to-end. Gdy część write'ów padnie, wynik może istnieć bez pełnej progresji/profilu. |
| Po zapisie: progression | 1 profile fetch opcjonalnie + active challenges + 0-N challenge/achievement writes | Fajne retentionowo, ale koszt rośnie z liczbą challenge'y. |
| Result impact | 3 leaderboard reads (today/weekend/all_time) | Daje szybki feedback po jeździe, ale to hot path dla każdego przejazdu. |
| **Razem per udany ranked ride** | **około 10-18 reads + 3-8 writes/RPC** | Przy 1000 riderów i 10 przejazdach/dzień to robi się realny koszt i realne latency, zanim jeszcze policzymy przeglądanie rankingów. |

`finalize_seed_run` jest atomowy, ale dotyczy Pioneer/kalibracji traila, nie zwykłego ranked runu.

### Hot reads / N+1

| Miejsce | Problem | Impact |
|---|---|---:|
| `fetchBikeParkTrails()` | Startuje 5 równoległych zapytań, a potem dla każdego "beaten by" robi `fetchLeaderboard()` w pętli. Dla parku z wieloma trasami to klasyczne N+1. | 4 |
| `fetchRiderBoardContext()` | Dla każdej trasy odpala 3 boardy: all-time, today, weekend. Przy 8 trasach to 24 zapytania sekwencyjnie. | 4 |
| `fetchResultImpact()` | Po runie robi 3 board reads. To produktowo wartościowe, ale powinno być batchowane albo cache'owane. | 3 |
| Leaderboard pagination | `fetchLeaderboard()` ma `.limit(50)`, scoped leaderboard też limituje, więc nie ma najgorszego scenariusza "ściągnij wszystko". To plus. | 1 |

### Bundle / kod do utrzymania

Największe pliki: `src/lib/api.ts` (~2222 linie), `app/run/recording.tsx` (~1438), `app/run/result.tsx` (~1081), `src/hooks/useBackend.ts` (~980), `src/systems/useRealRun.ts` (~814). To nie jest problem sam w sobie, ale oznacza, że koszt zmian w core flow rośnie: trudniej testować, trudniej robić małe diffy, łatwiej o regresję. Refactor tych plików to 🟡, bo przekracza 100 linii i dotyka core.

Assets są lekkie: `assets/` ~400 KB, `src/` ~1 MB, `app/` ~460 KB. Nie widzę dziś dużego ryzyka bundle z assetów. Mapbox koszt = 0, bo Mapbox nie jest używany.

### Realtime Supabase

Nie znalazłem aktywnych `supabase.channel()` ani `postgres_changes`. To dobre dla kosztu i stabilności. Trade-off: leaderboard nie jest live, więc "ktoś właśnie Cię przebił" wymaga refresh/poll/push w przyszłości.

### Offline-first readiness

Run queue i spot submission queue istnieją i po Krok 2 są poprawione, ale appka nadal jest "offline-tolerant", nie pełne offline-first. Brakuje: network listenera, jasnego statusu "dane sprzed X min", cache dla rankingów/spotów i product copy odróżniającej brak sieci od błędu serwera.

### Motion + typography

- 🔴 Brak `AccessibilityInfo.isReduceMotionEnabled` guarda — animacje mogą iść wbrew systemowemu ustawieniu. To a11y i komfort, zwłaszcza gdy user po jeździe jest zmęczony.
- 🟡 Trzy systemy typo: `typography.ts`, `chunk9.ts`, `gameHud.ts`. Fragmentacja zwiększa ryzyko niespójnego UI.
- 🟡 `chunk9Typography.body13 = 13pt` bywa za małe na outdoor/słońce. Display/timer są OK; opisowe copy wymaga większej czytelności.

## 🟡 Rekomendacje do zatwierdzenia

| Problem | Impact (1-5) | Effort | Proponowany fix | Diff preview |
|---|---:|---|---|---|
| Pusty `src/data/venues` kontra logika nadal pytająca `getVenueForTrail()` może powodować rozjazd komunikatów trening/ranking i fallbacków gate config. | 5 | M | Jednoznacznie wybrać źródło prawdy: albo DB-only i usunąć/odłączyć zależności od static venue w core flow, albo dynamicznie hydratować registry z DB przed użyciem. | Zmiany w `src/data/venues`, `app/run/active.tsx`, `app/trail/[id].tsx`, `app/(tabs)/leaderboard.tsx`; bez zgody nie ruszam, bo dotyka rankingu. |
| Dokumentacja `docs/CURRENT_STATE.md` opisuje nieistniejący tab `history` i starszą strukturę mock/venue. | 2 | S | Zaktualizować snapshot albo oznaczyć jako historyczny, żeby founder/dev nie podejmował decyzji na starym obrazie systemu. | Docs-only patch w `docs/CURRENT_STATE.md`. |
| Główny trail picker nie jest bottom sheetem mapowym, mimo że taki komponent istnieje (`TrailDrawer`). | 3 | M | Zdecydować, czy core flow ma być list-first czy map/bottom-sheet-first; potem dopiero projektować UX pod rękawiczki i słońce. | Prawdopodobnie layout flow w `spot/[id]`/map components; czeka na decyzję produktową. |
| Run/spot retry odpala się przy starcie i powrocie appki na foreground, ale nie nasłuchuje realnego powrotu sieci. | 4 | M | Dodać network listener i retry po `isConnected=true`; dependency typu NetInfo wymaga zgody. | `package.json` + `src/systems/saveQueue.ts` + `src/services/spotSubmission.ts`; dependency change = 🟡. |
| `useBackend.ts` ma wiele hooków bez `cancelled/mounted` guardu; szybkie przełączanie ekranu/parametru może pokazać stary wynik po nowym wyborze. | 3 | M | Wydzielić mały helper dla cancellable fetch albo dodać lokalne guardy do najbardziej używanych hooków (`useLeaderboard`, `useTrail`, `useSpot`, `useActiveSpots`). | Refactor >100 linii w shared data layer, więc czeka na OK. |
| Ranked/practice run potrafi działać foreground-only, gdy brak background location; user może schować telefon i stracić sample bez tak mocnego ostrzeżenia jak w Pioneer recording. | 5 | M | Przed armed ranked sprawdzić background permission i pokazać jasny wybór: włącz „Zawsze” albo jedź trening/foreground-only. | `app/run/active.tsx`, `src/systems/gps.ts`, prawdopodobnie nowy state w `useRealRun`; dotyka core flow = 🟡. |
| `evaluateCorridor()` mierzy dystans do najbliższego punktu polyline, nie do segmentu linii; przy rzadszej Pioneer geometrii może fałszywie zaniżać corridor coverage. | 4 | M | Liczyć dystans punkt-segment dla każdego odcinka albo uprościć geometrię z kontrolą maksymalnego odstępu punktów. | `src/systems/realVerification.ts` + testy; gate/corridor = 🟡. |
| `corridor_rescue` jest mocne produktowo, ale akceptacja/odrzucenie zależy od kilku progów bez UI-audit trail dla ridera. | 5 | M | Dodać jasne explanation/telemetrię w result/debug: które warunki rescue przeszły, które nie. | `src/systems/runFinalization.ts`, result/debug UI; ranking trust = 🟡. |
| `totalTraceDistanceM()` i live `totalDistanceM` sumują w kolejności dostarczenia, nie po timestampie. Out-of-order background sample → zawyżony dystans → fałszywy corridor rescue pass. | 5 | S | Przed sumowaniem w finalizacji skopiować `points` i posortować po `timestamp`; w `processPoint` zaakceptować próbkę tylko gdy `ts > lastProcessedTs` (już jest guard, ale akumulacja jest przed nim). | `src/systems/runFinalization.ts`, `src/systems/useRealRun.ts`. Małe, samodzielne. |
| RPC `finalize_seed_run` hardcoduje `counted_in_leaderboard = true` — żadna server-side re-weryfikacja kryteriów eligibility. | 4 | M | Przenieść decyzję eligibility do SQL funkcji validateRunEligibility(duration, distance, avgAccuracy, pointCount, geometry) i wywołać ją w RPC przed insertem. | Migracja + mirror logiki z `quality.ts`. Dotyka rankingu → 🟡. |
| `delete_run` promocja bez filtra `trail_version_id` — przy rekalibracji traila może promować run z innej wersji. | 3 | S | Dodać `and trail_version_id = v_run.trail_version_id` do selecta next-best (linia ~137 migracji 20260424). | Nowa migracja (patch do delete_run). Bezpieczna. |
| Brak zadania/joba do globalnego rerank po usunięciu runu. Inni riderzy widzą starą pozycję aż organicznie ktoś ich przeszacuje. | 4 | M | Albo inkrementalny rerank w samym RPC po promocji (prosty UPDATE z window function), albo edge-function cron po delete. | Migracja lub nowy edge function. Produktowo ważne, bo PB/ranking to core. |
| `run/result` dla orphan runu (trasa/spot skasowane) nie ma drogi powrotu — "Unknown Trail" i brak CTA. Pokrywa się z `bug_orphan_run_lock`. | 4 | M | Fallback screen z "Trasa została usunięta — zjazd zachowany w historii" + WRÓĆ do profile/home. | `app/run/result.tsx`, może mały nowy komponent `OrphanRunCard`. |
| `trail/[id]` cicho fail-uje gdy leaderboard się nie załaduje — lbLoading blokuje board bez error fallback. | 4 | S | Dodać error/retry CTA wewnątrz sekcji "Tablica" analogicznie jak w `(tabs)/leaderboard`. | `app/trail/[id].tsx` ~linie board render. |
| `(tabs)/spots` brak skeletonu → flicker "Brak bike parków" przed listą. | 3 | S | Dodać małe skeleton rows dopóki `useActiveSpots` nie zwróci. | `app/(tabs)/spots.tsx`. |
| Trail card ma zagnieżdżony CTA w zewnętrznym `Pressable`; w rękawiczkach user może przypadkowo otworzyć szczegóły zamiast startu albo odwrotnie. | 4 | S | Rozdzielić card tap i CTA: karta jako statyczny container + osobne pełnoszerokie CTA, albo stop propagation na CTA jeśli RN event model to potwierdzi w testach. | `src/components/ui/TrailCard.tsx`, `app/spot/[id].tsx`. |
| `ApproachView` mini-mapa ma stałe 180 px i może zjadać miejsce na instrukcję na małych ekranach. | 3 | S | Dodać compact layout dla małej wysokości: arrow + distance bez mapy albo mapa 120 px. | `src/components/run/ApproachView.tsx`. |
| Live timer pokazuje sporo drobnych live stats w trakcie jazdy; w słońcu i adrenalnie rider powinien widzieć głównie czas + status. | 4 | M | Tryb ride HUD: większy czas/status, live stats zwinięte do jednego paska albo dev-only. | `app/run/active.tsx`, `src/components/run/MotivationStack.tsx`. |
| Result/ranking secondary actions są poprawne, ale leaderboard period/trail chips nadal są małe dla użycia na miejscu. | 3 | S | Podnieść minHeight do 44 dla period chips i trail selectorów, dodać `accessibilityLabel`. | `app/(tabs)/leaderboard.tsx`. |
| Profile/legal/help ma sporo tekstowych linków bez jednolitego 44 pt targetu. | 2 | S | Drugi a11y pass poza core flow: `hitSlop` albo minHeight dla legal/help/settings links. | `app/(tabs)/profile.tsx`, `app/help/index.tsx`, `app/settings/delete-account.tsx`. |
| `corridor_rescue` nie tłumaczy riderowi „dlaczego zaliczone/niezaliczone” na result screenie. | 4 | M | Pokazać 2-3 warunki zrozumiałe dla ridera: bramki, korytarz, GPS; ukryć techniczne progi w dev/debug. | `app/run/result.tsx`, `src/systems/runFinalization.ts`. |
| Brak `useReducedMotion` guarda w Reanimated transitions — a11y gap + motion sickness. | 3 | S | Wrapper hook czytający `AccessibilityInfo.isReduceMotionEnabled()` + bypass w kluczowych sharedTransitions. | Global small hook + audytowane callsity. |
| `useLeaderboard` fetchuje bez cache — na każde wejście w trail/[id] świeży SELECT. Przy skali koszt i latency rosną. | 4 | S | 30-60s in-memory cache w hooku po kluczu `(trailId, periodType, scope)`. | `src/hooks/useBackend.ts`. Samodzielne. |
| Globalny `triggerRefresh()` odświeża zbyt dużo naraz — po zapisie runu może pociągnąć home/profile/leaderboards/spots/trails. | 4 | M | Zastąpić jeden globalny licznik domenowym invalidation: `runs`, `profile`, `spots`, `leaderboard`; hooki subskrybują tylko potrzebny klucz. | `src/hooks/useRefresh.ts`, `src/hooks/useBackend.ts`, call sites po save/avatar/spot. |
| `fetchBikeParkTrails()` ma N+1 dla "beaten by" — po 5 bazowych readach dociąga leaderboard per trail. | 4 | M | Dodać RPC/view `fetch_bike_park_trail_cards(spot_id, user_id)` zwracające gotowe card metrics w jednym strzale. | Migracja SQL + wymiana `fetchBikeParkTrails`; DB/API touch = 🟡. |
| `fetchRiderBoardContext()` robi 3 leaderboardy per trasa sekwencyjnie. | 4 | M | Batch RPC: dla listy `trailIds` zwrócić all-time/today/weekend positions i board sizes. | Nowy RPC + `useVenueActivity`; ogranicza koszt home/retention. |
| Ranked save nie jest atomowy end-to-end: run insert, leaderboard, profile stats, XP/favorite lecą jako osobne operacje. | 5 | L | Zaprojektować `finalize_ranked_run` RPC, które zapisuje run, PB, leaderboard, profile stats i wynik progresji w jednej transakcji. | Migracja + zmiana `src/lib/api.ts`/`runSubmit.ts`; ranking core = 🟡/🔴 graniczne. |
| `useRealRun` renderuje timer co 50 ms razem z szerszym stanem runu. | 4 | M | Odizolować high-frequency timer w małym komponencie/refie, a GPS/status telemetry throttle'ować do 250-1000 ms. | `src/systems/useRealRun.ts`, `app/run/active.tsx`; core run UI = 🟡. |
| Trzy współistniejące systemy typograficzne (`typography.ts`, `chunk9.ts`, `gameHud.ts`). | 2 | M | Zdecydować source of truth; prawdopodobnie `chunk9` dla UI + `gameHud` dla live stats, wygasić `typography.ts`. | Stopniowa migracja ekran po ekranie. |

## Krok 5 — Produkt/GTM

### Retention hooks — co przyciąga ridera z powrotem?

| Hook | Stan w kodzie | Siła |
|---|---|---|
| PB na trasie | ✅ `is_pb` + `ResultPBBadge` + `increment_profile_runs` | Mocny — rider wie kiedy bije własny czas |
| Rywal (gap above/below) | ✅ `MotivationStack`, `RivalAbove` komponent | Mocny — social proof, „dogonić Kasię” |
| Season | 🟡 tylko `spots.season_label = 'SEASON 01'` + hero beat; brak agregowanego season board | Słaby — nie ma wrażenia startu/końca sezonu |
| Streak | ✅ `useStreakState` na home | Średni — drobny, nie eksponowany |
| Daily challenges | ✅ `challenges` tabela + `useDailyChallenges` | Średni — istnieje, ale UX challenge wymaga pokazania efektu |
| Rank progression (rider→sender→…) | ✅ `increment_profile_xp` + rank thresholds | Średni — widoczne na profilu, ale nie wchodzi do loop po każdym rundzie |

🟡 **Największa dziura retencyjna**: sezon nie ma końcówki. Brak countdown, brak wyraźnego podium finale, brak "sezon 2 start w dn. X". Bez tego nie ma cyklicznego triggera powrotu.

### Viral / akwizycja

- 🔴 **Brak mechaniki share'owania wyniku**. Result screen nie ma "udostępnij czas/PB" (Instagram story/Strava). Najtańszy viral hook nie zrobiony.
- 🟡 **Pioneer submission jako user-generated content**: każdy rider może dodać bike park + trail → silny UGC moat, ale flow wymaga zaufanego ridera z kalibracją. Dziś nie ma mechaniki "zaproś do parku" / deep link do konkretnego parku.
- 🟡 **Leaderboard profilu jest publiczny w DB (RLS: SELECT all)** ale nie ma web-widoku ani share link. Strava poor-man's social loop wyczekuje implementacji.

### Monetization

- 🔴 **Brak dziś** — żadnego IAP, RevenueCat, subscription, donatów. Per `docs/CURRENT_STATE.md` status NOT_STARTED.
- 🟡 **Potencjał**: premium features, które NIE blokują core ligi (bo to zabiłoby trust): cosmetic ranks/avatars, advanced stats (split times, corridor analysis), prywatne league/club creation, sponsored park rewards.
- 🟡 **Anti-pattern do unikania**: pay-to-rank. Jakiekolwiek IAP wpływające na leaderboard = koniec zaufania.

### Moat & competitive position

- 🟢 **Pioneer-first geometry** — pierwszy rider na trasie zostawia kanoniczną linię, kolejne runy są scorowane względem niej. To tworzy "first-mover advantage" per-trail i lock-in dla early community.
- 🔴 **Crowd validation gap** (memory note `crowd_validation_gap`) — brak RPC do crowd-confirm poprawnej geometrii po kalibracji. Jeśli Pioneer narysuje złą linię, trasa jest zepsuta permanentnie. To NIE moat — to product blocker.
- 🔴 **PL-only region taxonomy** (memory note `world_app_vs_voivodeship`) — `spots.region` hardcoded do 16 województw. Rider poza PL nie ma jak zgłosić parku. Blokuje globalny rollout.
- 🟡 **Game framing vs utility framing** (memory note `feedback_game_framing`) — UI ma jeszcze fragmenty utility-speak (CURRENT_STATE.md używa słów "feature", "flow"). Każdy ekran musi czytać się jak gra (quest, mission, slot, season).

### Trust model — decyzja strategiczna

| Opcja | Co zyskujemy | Co kosztuje | Kiedy podjąć |
|---|---|---|---|
| **A. Social-trust (status quo)** — klient wysyła trace, RPC ufa; detection outlierów po fakcie (duplikaty, niemożliwe czasy, report-a-rider). | Szybkie do zbudowania; wystarczy dla early community 100-1000 riderów. | Przy rosnącej stawce (sponsorzy, season prizes) cheat jest trywialny; kompromituje tablice. | Zostajemy tu dopóki nie ma monetizacji ani formalnej ligi. |
| **B. Server-side re-verify** — RPC re-ocenia eligibility (`validateRunEligibility` w SQL) + cross-check duplikatów trace. | Średni koszt; eliminuje 80% taniego cheatu (manualne replay'e). | Nie chroni przed sfałszowanym trace z drugiego urządzenia. | Gdy tablice zaczynają mieć stawkę społeczną (np. publiczny podium Słotwiny). |
| **C. Device attestation + nonce** — serwer wydaje session nonce, klient podpisuje każdy sample, attestation (Apple DeviceCheck / Google Play Integrity). | Eliminuje forgery bez root/jailbreak. | Drogie w implementacji; bariera dla Android side-load community. | Przy oficjalnych rankingach parku lub sponsoring contract. |

**Rekomendacja**: A → B w horyzoncie 3 miesięcy (gdy liga wchodzi na 100+ aktywnych riderów/park). C odłożyć do momentu, gdy jest realna stawka.

### TOP 5 product priorities

1. 🔴 **Crowd validation RPC** — riderzy po Pioneer mogą flag / confirm / contribute do rekalibracji. Bez tego pierwsza zła linia = zepsuta trasa na zawsze.
2. 🔴 **Run result share** — generator karty wyniku (PNG) + share sheet. Najcieniszy viral hook, najtańszy.
3. 🟡 **Season finale/countdown** — agregowany season board + widoczny end-date + triggered "Season 02 starts" push. Retencja cykliczna.
4. 🟡 **Region taxonomy globalization** — `spots.country` + `spots.region` z fallbackiem. Odblokowuje non-PL rollout.
5. 🟡 **Server-side eligibility re-verify w RPC (trust model B)** — mirror `quality.ts` do SQL przed insertem. Tańszy hedge niż pełne attestation.

## 🔴 Do dyskusji strategicznej

| Temat | Dlaczego strategiczne | Decyzja do podjęcia |
|---|---|---|
| **Trust model: klient jest wiarygodny** — `gps_trace`, `verification_summary`, `geometry` idą do RPC bez cryptographic commitmentu. Attacker z read-access do czyjegoś runa może podstawić trace jako własny. | Dziś NWD zakłada "rider jest uczciwy" — na MVP/early community OK, ale gdy pojawi się stawka ten model przestaje wystarczać. | Opcja A (status quo) teraz → B (server re-verify) w 3 mies. → C (attestation) przy oficjalnej stawce. |
| **Crowd validation gap** — Pioneer rysuje linię raz i trwa ona do ręcznej interwencji. Błędna geometria = permanentnie zepsuta trasa. | Core product blocker; podkopuje cały Pioneer-first moat. Bez tego async racing się nie skaluje. | Zaprojektować RPC `submit_calibration_vote(trail_id, action: 'confirm'/'flag'/'contribute_geometry')` i UI do głosowania po każdym rundzie. |
| **PL-only region taxonomy** — 16 województw hardcoded blokuje wejście na rynki non-PL. | Jeśli celem jest globalna app, trzeba zmienić teraz, bo migracja regionów po większej bazie jest droższa. | Refactor `spots.region` → `spots.country_code` + `spots.admin_region` przed pierwszym non-PL riderem. |
| **Monetization ścieżka** — dziś brak. Decyzja "kiedy zacząć i na czym" determinuje roadmapę 6 miesięcy. | Zbyt wczesne paywall = śmierć early community. Zbyt późne = brak bufora finansowego. | Uzgodnić model: cosmetic-only vs premium-stats vs sponsored-park revenue share. Żadne z nich nie może dotykać rankingu. |

## TOP 10 do zrobienia teraz

| Priorytet | Temat | Impact | Effort | Status |
|---:|---|---:|---|---|
| 1 | Uporządkować źródło prawdy dla venue/trail geometry | 5 | M | 🟡 |
| 2 | Ranked background-permission preflight | 5 | M | 🟡 |
| 3 | Ranked save atomowy server-side (`finalize_ranked_run`) albo jawny recovery dla partial writes | 5 | L | 🟡/🔴 |
| 4 | Corridor distance point-to-segment zamiast point-to-point | 4 | M | 🟡 |
| 5 | Network-based retry dla offline queues | 4 | M | 🟡 |
| 6 | Zbić hot reads: `fetchBikeParkTrails` N+1 + `fetchRiderBoardContext` 3x per trail | 4 | M | 🟡 |
| 7 | Orphan run recovery na `run/result` | 4 | M | 🟡 |
| 8 | Trail/result share card jako viral hook | 5 | M | 🔴 |
| 9 | Crowd validation dla Pioneer geometry | 5 | L | 🔴 |
| 10 | Season finale/countdown jako retention loop | 4 | M | 🟡 |
