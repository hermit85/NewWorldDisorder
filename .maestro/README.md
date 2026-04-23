# E2E — Maestro

Smoke flows dla buildu przedprodukcyjnego. Odpalane ręcznie przed release.

## Instalacja

```sh
curl -Ls "https://get.maestro.mobile.dev" | bash
# sprawdź:
maestro --version
```

Szczegóły: https://docs.maestro.dev/getting-started/installing-maestro

## Co pokrywamy

| Flow | Co testuje | Wymaga |
|---|---|---|
| `00_smoke_launch.yaml` | cold launch → onboarding/auth/tabs renderują się | żadnych |
| `01_onboarding.yaml` | 3 slajdy + GPS gate | `clearState: true` (fresh install) |
| `02_auth_enter_email.yaml` | email → ekran OTP (bez realnego kodu) | fresh install |
| `03_tabs_navigation.yaml` | START/SPOTY/TABLICA/RIDER | zalogowany user |
| `04_spots_browse.yaml` | filtry + otwarcie detalu | zalogowany user |
| `05_run_active_cancel.yaml` | deep-link `nwd://run/active` → cancel | zalogowany user + `TRAIL_ID` |

Poza zakresem (wymaga infry):
- real OTP login → trzeba Mailosaur/Inbucket + `MAESTRO_EMAIL`
- full ranked-run end-to-end → wymaga symulacji GPS (Maestro nie umie; zostaje w manualach)
- crowd-validation → blocker serwerowy (zobacz `memory/crowd_validation_gap.md`)

## Uruchomienie

```sh
# wszystko po kolei
maestro test .maestro/config.yaml

# pojedynczy flow
maestro test .maestro/flows/00_smoke_launch.yaml

# z env
TRAIL_ID=<uuid> maestro test .maestro/flows/05_run_active_cancel.yaml
```

Urządzenie: iOS Simulator (uruchom `open -a Simulator`) albo podłączony Android (`adb devices`). Bundle: `com.nwdisorder.app`.

## Target builda

Flows używają **widocznego tekstu** jako selectorów — brak `testID` w kodzie. To działa, ale łamie się przy lokalizacji / redesignie copy. Jeśli przechodzimy na regularny CI, dodajmy `testID` do kluczowych interakcji (CTA auth, tab bar, cancel run, pierwsza karta spot).

## Ograniczenia

- Flows zakładają polską lokalizację UI — zmiana copy = update selectorów.
- `01_onboarding.yaml` wyczyści stan appki (`clearState: true`) — lokalna sesja rider'a zniknie.
- `05_run_active_cancel.yaml` wymaga żywego `TRAIL_ID` w bazie środowiska; nie ma seed.
