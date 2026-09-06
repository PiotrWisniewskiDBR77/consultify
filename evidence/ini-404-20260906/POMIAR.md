# INI-404 — karta realnej inicjatywy bez 404 (pojemnik 1, DEC-400)

Stanowisko: własny serwer :4102 + vite :3103 z worktree `mvp/inicjatywa-404-runtime`,
baza `consultify-noc-pg` :54400 (NIE dotykano :4100/:3090, stagingu ani demo).

Rekord badany: REALNY wiersz klasycznego rejestru DBR77 — `fa87dc75-d838-4fa0-8263-590969aa8621`
„Supply Chain Optimization" (nie id pokazowe).

Stan danych zmierzony na żywej bazie:
- `select count(*) from initiatives` → 77 (w tym 71 dla org `cc9db573…` = DBR77)
- `select … from ie_aggregate_state where aggregate_type='initiative'` → 0 wierszy

## PRZED (przed-karta.png / .json)
- `odpowiedziHttp` ≥400: **1** — `404 GET /api/initiatives/runtime-v1/initiatives/fa87dc75-…`
- `bledyKonsoli`: **1** — „Failed to load resource: … 404 (Not Found)"

Ta sama pojedyncza 404 pada na obu drogach użytkownika:
- deep-link `/initiatives?mode=doc&open=<id>`
- lista → wiersz → podgląd → przycisk „Otwórz" (który nawiguje na ten sam deep-link)

Żadna inna trasa runtime-v1 nie jest wołana z karty (sprawdzone także po wejściu
w sekcje „Bramy", „Sugerowane zmiany", „Artefakty" — dalej dokładnie jedna 404).

## PO (po-karta.png / .json)
- `odpowiedziHttp` ≥400: **0**
- `bledyKonsoli`: **0**
- treść karty identyczna jak PRZED (tytuł, 5 grup sekcji, WŁAŚCIWOŚCI z realnymi
  wartościami, „—" tam gdzie brak danych) — nic nie zniknęło i nic nie pęka.
