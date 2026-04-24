# NWD Audit Report — 2026-04-24

## Executive Summary
- 🟢 Naprawione do tej pory: 6.
- 🟡 Do zatwierdzenia: 8.
- 🔴 Do dyskusji strategicznej: 0 na tym etapie audytu.
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

## 🔴 Do dyskusji strategicznej

Do uzupełnienia po Krokach 4-5. Na etapie Kroku 2 nie wprowadzałem żadnych zmian 🔴.

## TOP 10 do zrobienia teraz

| Priorytet | Temat | Impact | Effort | Status |
|---:|---|---:|---|---|
| 1 | Uporządkować źródło prawdy dla venue/trail geometry | 5 | M | 🟡 |
| 2 | Ranked background-permission preflight | 5 | M | 🟡 |
| 3 | Corridor distance point-to-segment zamiast point-to-point | 4 | M | 🟡 |
| 4 | Network-based retry dla offline queues | 4 | M | 🟡 |
| 5 | UI sweep pre-ride i live timer pod rękawiczki/słońce | 5 | M | W toku |
| 6 | Cancellable fetch guardy w `useBackend.ts` | 3 | M | 🟡 |
| 7 | Zaktualizować `docs/CURRENT_STATE.md` | 2 | S | 🟡 |
| 8 | Sprawdzić leaderboard puste/error/loading states | 4 | S | W toku |
| 9 | Oszacować reads/writes per ride | 3 | S | W toku |
| 10 | Produkt/GTM: retention, viral, monetization, moat | 4 | M | Przed nami |
