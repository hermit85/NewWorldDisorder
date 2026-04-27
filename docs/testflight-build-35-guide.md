# NWD · TestFlight Build 35 — Tester Guide

Krótki przewodnik dla pierwszych zewnętrznych testerów. Praktyczny,
nie marketingowy. Jeśli coś nie działa — w aplikacji jest przycisk
**ZGŁOŚ PROBLEM** / **Wyślij feedback**, używaj go zamiast Slacka.

---

## Co nowego w Build 35

Względem Build 34:

- **Zaproś rywala** — po finiszu na trasie, w ekranie wyniku jest
  przycisk do udostępnienia czasu znajomemu (Messenger / WhatsApp /
  iMessage). Wysyła wiadomość z nazwą trasy i czasem do pobicia.
- **Feedback w aplikacji** — przycisk **ZGŁOŚ PROBLEM** w ekranie
  wyniku oraz **Wyślij feedback** w menu JA. Trafia bezpośrednio do
  zespołu (insert do Supabase + fallback na e-mail).
- **Sync Outbox — czytelne stany** — w JA → Sync Outbox widać
  wyraźnie: WYSYŁANIE / WYSŁANO N/M / BŁĄD, oraz osobno listę
  *„NIE WYSŁANO PO 5 PRÓBACH"* (run wymaga decyzji).
- **Founder tools** (tylko dla mojego konta) — reset moich danych
  testowych bez deletowania konta.
- **Bugfix**: nie da się dodać trasy do nowo zgłoszonego bike parku
  (alert „Bike park nie dostępny") — naprawione.

Brak zmian w: silniku GPS, kalibracji, leaderboard, animacjach,
warstwie społecznej (i tak nie ma).

---

## Co testować — priorytety

1. **Pioneer flow end-to-end**:
   - Dodaj nowy bike park → dodaj pierwszą trasę → przejedź pioneer
     run → potwierdź że trasa pojawia się jako *Próbna* i park
     flipnął się na aktywny.
2. **Sync po offline** — wyłącz internet, zrób run, wróć do menu,
   włącz internet, otwórz Sync Outbox, kliknij **WYŚLIJ TERAZ**.
   Run powinien zniknąć z kolejki i pojawić się w historii.
3. **Zaproś rywala** — po finiszu kliknij share, wyślij sobie
   wiadomość. Sprawdź że copy ma sens (nazwa trasy + czas), URL nie
   prowadzi do błędu (patrz „Znane ograniczenia" niżej).
4. **Feedback** — wyślij minimum jeden testowy feedback typu
   *praise* / *idea* (nie tylko bug), żeby potwierdzić że pipeline
   działa w obie strony.

---

## Jak zaprosić rywala

1. Po skończeniu zjazdu, na ekranie wyniku → przycisk
   **ZAPROŚ RYWALA**.
2. Wybierz aplikację (Messenger, WhatsApp, iMessage…).
3. Wiadomość zawiera nazwę trasy + Twój czas + link.

Tip: na razie link prowadzi tylko do strony głównej, nie do trasy
(patrz „Znane ograniczenia"). Cała informacja o wyzwaniu jest w
treści wiadomości — po kliknięciu znajomy widzi co i z kim ma
pobić.

---

## Jak wysłać feedback

Dwa wejścia, ten sam mechanizm:

- **Z ekranu wyniku** — przycisk **ZGŁOŚ PROBLEM** (kontekst trasy
  + run ID idzie automatycznie).
- **Z menu JA** — kliknij ⚙️ → **Wyślij feedback**.

Wybierz kategorię (*bug / niejasne / pomysł / pochwała*), wpisz
opis, wyślij. Jeśli nie ma zasięgu — pojawi się przycisk
**WYŚLIJ E-MAILEM** z gotową wiadomością i pełnym kontekstem.

---

## Co robić gdy sync nie działa

- Zjazd zawsze zapisuje się lokalnie — **nie tracisz wyniku** nawet
  bez netu.
- Otwórz **JA → Sync Outbox**.
- **WYŚLIJ TERAZ** — przycisk pokazuje wyraźnie wynik:
  - *WYSYŁANIE…* — w toku
  - *WYSŁANO N/M* (zielone) — wszystko poszło
  - *WYSŁANO N/M* (żółte) — częściowo, część zostaje w kolejce
  - *BŁĄD: …* (czerwone) — nic nie poszło, treść błędu w UI
- Po **5 nieudanych próbach** run trafia do osobnej sekcji
  *„NIE WYSŁANO PO 5 PRÓBACH"*. Tam dwie opcje:
  - Spróbuj jeszcze raz manualnie (czasem wystarczy zmienić sieć
    Wi-Fi/4G).
  - **USUŃ Z KOLEJKI** — zjazd lokalnie znika; jeśli nie zniknął
    od razu, restart appki.

Jeśli żaden run nie idzie a internet działa — wyślij feedback typu
*bug* z ekranu Sync Outbox (kontekst trafi automatycznie).

---

## Co robi Founder reset (tylko dla Darka)

W menu JA pojawia się czerwony przycisk **Founder tools** (tylko
mój profil). Działanie:

- **Podgląd resetu** — pokazuje ile rzeczy zostanie usuniętych
  (runs, leaderboard entries, achievements, challenge progress).
- **Reset** — kasuje **TYLKO** moje:
  - runs
  - leaderboard_entries
  - challenge_progress
  - user_achievements
  - liczniki w profilu (XP, total_runs, total_pbs,
    pioneered_verified_count) → 0
- **NIE kasuje**:
  - konta auth (zostaję zalogowany)
  - profilu (rola i ustawienia zostają)
  - cudzych danych
  - spotów / trasów (do tego są osobne `delete_test_spot` /
    `delete_trail_cascade`, też tylko dla foundera/curatora)

Ten reset jest po to, żeby móc wielokrotnie testować flow
pioneer/leaderboard z czystego stanu, bez recyklingu konta.

---

## Znane ograniczenia (Build 35)

Świadome — nie zgłaszaj jako bug:

- **Brak deep-linka challenge** — link w „Zaproś rywala" prowadzi
  do strony głównej, nie do trasy. Cała informacja o wyzwaniu jest
  w tekście wiadomości. Pełny deep-link dojdzie w jednej z
  kolejnych buildów.
- **Brak powiadomień push** — nie ma żadnych powiadomień o nowych
  rekordach / wyzwaniach.
- **Brak grafu społecznego** — nie ma znajomych, follow-ów,
  klubów. Leaderboard jest globalny per trasa.
- **Brak backendu sezonów** — etykiety „SEASON 01" są
  kosmetyczne, nic nie liczy.
- **Brak crowd validation** — drugi rider potwierdzający trasę nie
  jest jeszcze zaimplementowany (ADR-012 Phase 2).
- **Województwa = Polska** — pole regionu spotów jest hardcoded na
  16 polskich województw. Jeżdżenie poza PL działa technicznie ale
  region wygląda dziwnie.
- **Sentry source maps** — wymagają natywnego buildu (nie Expo
  Go), ale na TestFlight są ok.

---

## Czego NIE testować

Nie ma sensu raportować:

- Animacje i mikrointerakcje — celowo zostały bez zmian.
- Wygląd leaderboard / customization — UI placeholder do następnej
  iteracji.
- Polskie znaki w copy — sprawdzane manualnie, jeśli widzisz coś
  bez ogonków zgłoś jako bug.

---

## Co robić jeśli appka się crashuje

1. Otwórz ją ponownie — runs i sync state są persystowane lokalnie,
   nic nie tracisz.
2. Wyślij feedback typu *bug* opisując co robiłeś przed crashem
   (Sentry łapie crash automatycznie, ale Twoja narracja
   przyspiesza diagnozę 10x).
3. Jeśli appka crashuje przy starcie — odinstaluj i zainstaluj
   ponownie z TestFlight.

---

Build 35 · 2026-04-27
