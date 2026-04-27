# Clean test state — kolejność wykonania w Supabase Studio

**Project:** `umdmipgxbiverudtvylx`
**Studio:** https://supabase.com/dashboard/project/umdmipgxbiverudtvylx/sql/new

## Krok 1 — Apply founder tools migration (jednorazowo)

Wklej całą zawartość:

```
supabase/migrations/20260427160000_founder_test_tools.sql
```

Run. To doda role 'founder' + 4 RPCs. Idempotent (CREATE OR REPLACE), więc można odpalać wielokrotnie bez szkody.

## Krok 2 — Clean state (przed każdym czystym przebiegiem testów)

Wklej całą zawartość:

```
supabase/scripts/clean_test_state.sql
```

Run. Zobaczysz w "Notices":
```
BEFORE | runs=N spots=N trails=N leaderboard=N challenge_progress=N achievements=N
AFTER  | runs=0 spots=0 trails=0 leaderboard=0 challenge_progress=0 achievements=0
KEPT   | profiles=2 (counters zeroed, accounts intact)
```

Operacja w transakcji — jak coś pęknie, rolluje się.

## Krok 3 — Nadaj rolę founder dla testowych kont (jednorazowo)

Najpierw znajdź UUID-y:

```sql
select id, username, role
  from public.profiles
 order by created_at desc;
```

Potem nadaj founder:

```sql
update public.profiles
   set role = 'founder'
 where id in (
   '<uuid-konta-1>',
   '<uuid-konta-2>'
 );
```

Po tym `is_founder_user()` zwróci `true` dla tych dwóch kont, a w aplikacji pojawi się **JA → MENU → Founder tools** (czerwony entry, destructive style).

## Krok 4 (opcjonalny) — wyczyść avatary

Jeśli chcesz też wyczyścić zdjęcia profilowe ze storage:

```sql
delete from storage.objects where bucket_id = 'avatars';
```

## Co się stanie w aplikacji po cleanie

Po reloadzie aplikacji na testowym koncie zobaczysz dokładnie te stany:

| Ekran | Stan po clean |
|---|---|
| **START** | NO_SPOT — "GDZIE DZIŚ JEŹDZISZ? / Dodaj swój bike park i otwórz pierwszą arenę NWD." / CTA "DODAJ BIKE PARK" |
| **SPOTY** | empty — "BRAK BIKE PARKÓW / Brak parków w Twojej okolicy. Dodaj pierwszy." |
| **TABLICA** | NO_SPOT — "Wybierz pierwszy bike park" |
| **JA** | DOROBEK 0/0/0/0 · PASY 0/7 · Rekordy osobiste: "Pierwszy czysty zjazd zapisze Twój rekord." |

Konta zostają, awatary zostają (chyba że usuniesz w kroku 4), tylko aktywność znika.

## Jak chcesz wyczyścić tylko swoje testowe konto (nie wszystkich)

Po wdrożeniu migracji + nadaniu roli founder, w aplikacji:
**JA → MENU → Founder tools → wpisz RESET → WYCZYŚĆ DANE.**

To wymazuje TYLKO Twoje runs/PBs/wyzwania/pasy. Spoty i trasy pioniera **zostają** — kasujesz je osobno przez `delete_test_spot` RPC (jeszcze bez UI; mogę dodać w następnym passie).
