# NWD E2E / Product / Architecture Audit

Data: 2026-04-26
Zakres: web smoke E2E, testy lokalne, flow uzytkownika, offline-first, architektura run/save/queue, brakujace elementy do gamingowej aplikacji DH.

## Weryfikacja

- Uruchomiono Expo web lokalnie na `http://localhost:8082`.
- Sprawdzono ekrany jako uzytkownik: `/auth`, `/(tabs)`, `/__dev/approach-preview?state=on_line_ready`, `/__dev/empty-states`.
- Wykonano smoke screenshoty przez Playwright Chrome channel dla viewportu mobilnego `390x844`.
- `npx tsc --noEmit` przechodzi.
- `npm test` przechodzi: 7 suites, 102 tests.

Nie wykonano realnego E2E na fizycznym telefonie z GPS, background location i OTP, bo obecny projekt nie ma jeszcze dedykowanego E2E runnera, a czesc scenariuszy wymaga uprawnien urzadzenia i/lub backendu.

## Co juz jest mocne

- `useRunGateEngine` ma sensowna logike i testy dla gate/intent/quality.
- Ranked run nie spada po cichu do practice: brak intentu lub brak uprawnien zatrzymuje flow.
- `app/run/active.tsx` wymaga background location dla ranked i pozwala trenowac bez logowania.
- `recordingStore` ma session fencing i mutex, co ogranicza ryzyko popsucia aktywnej sesji.
- `runStore` po hydratacji podnosi stany `saving/pending` do kolejki, zamiast zostawiac je w martwym stanie.
- Ekrany po redesignie wygladaja spojnie w web smoke: auth, home signed-out, approach preview i empty states sa czytelne.

## P1 - rzeczy, ktore moga realnie popsuc flow

### 1. First-launch nadal robi auth wall

`app/onboarding/index.tsx` po zakonczeniu onboardingu robi `router.replace('/auth')`, a komentarz sugeruje, ze auth screen ma escape hatch do przegladania bez logowania. W `app/auth/index.tsx` nie ma jednak widocznego przycisku "przegladaj bez logowania".

Efekt: nowy uzytkownik po pierwszym uruchomieniu trafia na logowanie i nie ma jasnej drogi do offline/practice/browse, mimo ze aplikacja ma tryb signed-out w tabsach.

Rekomendacja: dodac na auth ekran mocny secondary CTA typu `PRZEGLADAJ / TRENING OFFLINE` prowadzacy do `/(tabs)`, albo po onboardingu prowadzic bezposrednio do tabsow, a logowanie traktowac jako bramke dla ranked/social/progression.

### 2. Leaderboard na swiezym stanie nie wybiera domyslnego bike parku

`app/(tabs)/leaderboard.tsx` startuje z `selectedVenueId = ''`. Jesli nie ma `nwd.selectedVenueId` w AsyncStorage i nie przyjdzie `trailId` w parametrach, `useTrails(selectedVenueId || null)` zwraca pusta liste.

Efekt: na clean install leaderboard moze nie miec zadnego kontekstu trasy, mimo ze lokalny registry ma venue.

Rekomendacja: ustawic domyslnie pierwszy aktywny venue z `getAllVenues()` albo wyprowadzic venue z `trailId`. Stan pusty powinien byc prawdziwym brakiem danych, nie efektem niewybranego defaultu.

### 3. Result screen moze pokazac falszywe "Brak danych zjazdu"

`app/run/result.tsx` od razu pyta `getFinalizedRun(runSessionId)`, ale `runStore` hydratuje sie asynchronicznie. Jesli user otworzy wynik po cold-starcie zanim store skonczy hydratacje, ekran moze pokazac fallback "Brak danych zjazdu".

Efekt: bardzo zly moment UX po zjezdzie offline - user moze uwierzyc, ze stracil wynik.

Rekomendacja: result screen powinien czekac na hydration state (`isRunStoreHydrated` albo hook/subscription), pokazac loading i dopiero po hydratacji decydowac, ze danych nie ma.

### 4. Offline queue jest niewidoczna i za malo reaktywna

`src/systems/saveQueue.ts` flushuje przy starcie i powrocie appki do foreground. Nie widac listenera connectivity typu NetInfo. Dodatkowo submissiony spotow w `src/services/spotSubmission.ts` moga byc kolejkowane, a pozniej hard reject/duplicate/auth reject konczy sie tylko logiem.

Efekt: user nie ma centrum prawdy: co sie zsynchronizowalo, co czeka, co zostalo odrzucone i dlaczego.

Rekomendacja: dodac "Outbox / Sync Center" z runami, spotami i trasami: status, powod bledu, retry, retry-after, confidence. Sync powinien reagowac na powrot sieci, nie tylko foreground.

### 5. XP moze dryfowac po retry

`src/systems/retrySubmit.ts` przy retry liczy XP jeszcze raz z `isPb: false` i `position: null`. Jesli pierwotny wynik mial inny kontekst, XP wyslany przy retry moze nie byc tym samym XP, ktory user zobaczyl po zjezdzie.

Efekt: gra moze rozjechac lokalna nagrode i backendowy zapis.

Rekomendacja: persistowac snapshot `xpAwarded`/reward context w `FinalizedRun`, albo przeniesc scoring w pelni na idempotentny backend.

## P2 - poprawki jakosciowe i produktowe

- `MAX_STORED_RUNS = 15` w `src/systems/runStore.ts` jest za niskie dla weekendu DH offline. Lepiej rozdzielic retention historii od retention kolejki sync i trzymac duzo wiecej metadanych.
- Brakuje prawdziwego E2E runnera. Obecnie sa dobre testy logiki, ale nie ma scenariuszy user-flow na natywnym runtime.
- `src/hooks/useVenueContext.ts` i `src/data/venues/index.ts` maja TODO dotyczace dynamicznego venue/geometry. Dla skali kategorii appka potrzebuje offline packow bike parkow, nie statycznego registry.
- `app/run/recording.tsx` pozwala kontynuowac mimo zbyt malej liczby punktow, ale `app/run/review.tsx` i tak moze to odrzucic. Lepiej nie przechodzic dalej albo pokazac jasny stan "dograj jeszcze chwile".
- `app/run/result.tsx` uzywa tekstowych symboli statusu zamiast wspolnego `IconGlyph`, co odcina ten ekran od nowego design systemu.
- Jest drobna literowka w copy: "Bike park nie dostępny" powinno byc "Bike park niedostępny".
- Web runtime wypisuje warningi React Native Web dla deprecated `shadow*`, `textShadow*`, `pointerEvents` i Animated native driver. Nie blokuje to natywki, ale utrudnia audyt web smoke.

## Brakujace E2E scenariusze

Priorytetowo dodac testy natywne w Maestro albo Detox:

1. Pierwsze uruchomienie -> onboarding -> wejscie bez logowania -> home -> trail -> practice.
2. Pierwsze uruchomienie -> auth -> OTP mock/dev -> profile/leaderboard.
3. Practice run bez logowania -> GPS unavailable/poor/good -> wynik lokalny.
4. Ranked run bez Always Location -> blokada z poprawnym CTA.
5. Ranked run online -> submit success -> result -> leaderboard refresh.
6. Ranked run offline -> queued result -> kill app -> restart -> outbox still has run -> reconnect -> synced.
7. Pioneer: create spot offline -> queue -> reconnect -> visible success or visible reject.
8. Cold-start deep link `/run/result?runSessionId=...` before hydration -> loading -> correct result.

Web Playwright zostawic jako szybki smoke layoutu, ale nie traktowac go jako pelnej prawdy dla GPS/background/location.

## Kierunek, zeby to bylo "prekursorem" offline gaming DH

- Offline park packs: bike park, trasy, checkpointy, ghosty, PB znajomych, lokalne achievementy i zasady rankingu pobrane przed jazda.
- Local-first event log: `RunStarted`, `GateArmed`, `CheckpointPassed`, `RunFinalized`, `SyncQueued`, `SyncAck`, zamiast polegania na rozproszonych zapisach AsyncStorage.
- Sync Center jako core feature, nie debug: user widzi, ze appka dziala w lesie bez internetu i nic nie ginie.
- Anti-cheat confidence jako element gry: jakosc GPS, corridor, checkpointy, background permission, device integrity.
- Ghost/rival mode offline: lokalny przeciwnik, PB, split points i replay linii po zjezdzie.
- Progression, ktory odblokowuje sie natychmiast offline, a backend pozniej tylko potwierdza i scala.

## Najblizszy sensowny plan napraw

1. Odblokowac signed-out/offline wejscie po onboardingu i poprawic auth CTA.
2. Naprawic default venue/trail w leaderboardzie.
3. Dodac hydration guard do result screen.
4. Zrobic prosty Outbox UI dla run queue i spot submission queue.
5. Persistowac XP snapshot w `FinalizedRun`.
6. Dodac Maestro/Detox smoke dla 3 krytycznych flow: first launch, practice offline, queued ranked result.
