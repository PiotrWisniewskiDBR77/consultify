# P19 — weryfikacja CSRF_MODE=enforce na stagingu (10.09.2026)

Stanowisko: /Users/piotrwisniewski/Developer/wt/p19-csrf · mvp/p19-csrf-weryf-20260910 · baza c28359709a
Staging: https://staging.consultify.ai · /api/health gitSha 513d4d5fff (SHA z ręcznej zmiennej — nie jest dowodem)

## WNIOSEK GŁÓWNY (obalenie premisy zlecenia)

Zmienna Railway `CSRF_MODE` = `enforce`, ale **żywy proces jedzie na `report`**.
Dowód runtime: moje własne żądania z 08:38 pojawiły się w logach jako
`csrf_violation {... "mode":"report"}` — proces nie został zrestartowany po zmianie
zmiennej, więc `process.env.CSRF_MODE` nadal ma starą wartość.

Skutki:
- Nie ma awarii blokującej. Nic się nie zepsuło, bo nic nie zostało włączone.
- Ochrona CSRF **nie działa**. Werdykt „enforce bezpieczny" byłby fałszem.

## Obalenie wstępnego odczytu nadzorcy

`POST /api/auth/login` bez tokenu → 401 dla nieistniejącego konta. To **nie** dowodzi
przejścia przez CSRF: auth middleware odpowiada 401 przed CSRF, i identyczne 401
wyszłoby przy `report`, `off` i przy zepsutych zwolnieniach. Odczyt był mylący.

## Pomiar bezpośredni — czy enforce cokolwiek blokuje

| Test | Warunki | Wynik | Oczekiwane przy enforce |
|---|---|---|---|
| K4 | zalogowany, POST /api/initiatives, ciasteczko csrf, BRAK nagłówka | 400 (walidacja) | 403 CSRF_MISSING |
| K6 | zalogowany, POST /api/initiatives, nagłówek BŁĘDNY | 400 (walidacja) | 403 CSRF_INVALID |
| K7 | zalogowany, POST /api/tasks, jawny Cookie, BRAK nagłówka | 400 (walidacja) | 403 CSRF_MISSING |

Żądanie z **błędnym** tokenem przeszło ochronę → enforce nie jest aktywny.

## Etap A — cztery ścieżki wejścia (wszystkie bez tokenu CSRF)

| # | Ścieżka | Kod | Uwaga |
|---|---|---|---|
| 1 | POST /api/auth/login (konto Northwind) | **200** | pełne logowanie, zwrócony token |
| 2 | POST /api/auth/register | **400** walidacji | nie 403 → przeszło CSRF; pełna rejestracja NIEWYKONANA |
| 3 | POST /api/auth/refresh | **200** | z ciasteczkami sesji |
| 4 | POST /api/auth/forgot-password | **200** | |
| 4b | POST /api/auth/reset-password | **400** walidacji | nie 403 → przeszło CSRF |

Zastrzeżenie: przy `report` żadna z tych ścieżek nie mogłaby dostać 403, więc
kody 200/400 **nie dowodzą** poprawności zwolnień pod enforce. Dowód niżej.

## Dowód pośredni, że zwolnienia DZIAŁAJĄ (mocny, runtime)

W trybie `report` każde niezwolnione naruszenie jest logowane. W logach z okna
moich pomiarów **nie ma ani jednego** `csrf_violation` dla:
`/api/auth/login`, `/api/auth/refresh`, `/api/auth/forgot-password`,
`/api/auth/reset-password`, `/api/webhooks/stripe`, `/api/csrf-token`
— mimo że wykonałem te żądania bez tokenu. Brak wpisu = trasa była zwolniona.

Drugi dowód: logi zapisują ścieżkę PEŁNĄ (`"path":"/api/tasks"`). Przed naprawą
`candidatePaths` byłoby `/tasks`. Naprawa prefiksu montażu JEST wdrożona na stagingu.

Trzeci dowód: `node_modules/.bin/vitest run tests/unit/backend/security/csrfExemptMountPrefix.test.ts
tests/unit/backend/security/csrfProtectionMiddleware.test.ts` → **33/33 PASS**,
w tym przypadki `mode = enforce` (403 CSRF_MISSING / CSRF_INVALID) i prefiks montażu.

## Etap C — webhook Stripe

`POST /api/webhooks/stripe` bez tokenu → **400 „Webhook Error: Missing stripe-signature header"**.
Przeszło CSRF, odbiło się na weryfikacji podpisu Stripe. Zgodnie z oczekiwaniem.

## Etap D — naruszenia CSRF w logach

Pełna lista (wyłącznie linie `csrf_violation`, okno 08:38–08:39):

| Trasa | Liczba | Powód |
|---|---|---|
| POST /api/analytics/web-vitals | 5 | CSRF_MISSING |
| POST /api/tasks | 1 | CSRF_MISSING — **moja własna sonda K7** |

Poza web-vitals: **zero** naruszeń w normalnym ruchu. Znana pozycja potwierdzona,
nowych znalezisk brak.

SPROSTOWANIE WŁASNEGO BŁĘDU: pierwsze liczenie pokazało „54× PUT /api/initiatives".
Mój wzorzec grep łapał także linie `Performance metric` o tym samym kształcie.
Po zawężeniu do `csrf_violation`: PUT /api/initiatives ma **0** naruszeń.

## Etap E — limiter

`DISABLE_RATE_LIMIT=false`, `API_RATE_LIMIT_MAX=1000`, `RATE_LIMIT_ALLOW_PROD_DISABLE=true`.
Pomiar: 25 żądań pod rząd na `/api/initiatives` (zalogowany) + 20 na `/api/csrf-token`
= 45 żądań, **wszystkie 200, zero 429**. W logach zero wpisów o odmowie.
Limiter nie blokuje normalnej pracy.

## Etap B — NIEWYKONANY (świadomie)

Przepływ w przeglądarce (inicjatywa/zadanie/decyzja) przy trybie `report` przeszedłby
zawsze, niezależnie od tego, czy mechanizm doklejający token działa. Test niczego by
nie dowiódł. Ma sens dopiero po restarcie procesu na enforce.

## REKOMENDACJA

1. Restart/redeploy usługi consultify na stagingu, żeby `enforce` faktycznie wszedł.
2. Zaraz po restarcie powtórzyć K4/K6 — muszą dać **403**. Jeśli dalej 400, enforce nie wszedł.
3. Dopiero wtedy Etap B (przeglądarka) — to jedyny test, który sprawdza mechanizm
   doklejający token po stronie frontendu.
4. Cofanie na `report` NIE jest w tej chwili potrzebne — nie ma czego cofać.

## STOP-y

- `railway logs` zwraca tylko świeże okno (od 08:38:25). Nie mogłem obejrzeć logów
  od momentu przełączenia zmiennej — lista naruszeń pokrywa okno moich pomiarów.
- Pełna rejestracja organizacji niewykonana (tylko sonda walidacyjna).
- Etap B niewykonany — uzasadnienie wyżej.

## Zostawione na stagingu

Zero rekordów. Wszystkie sondy zapisu odbiły się na walidacji (400) przed utworzeniem
czegokolwiek. `forgot-password` wysłany na nieistniejący adres.
