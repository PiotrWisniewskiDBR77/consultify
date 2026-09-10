# P4 — BEZPIECZEŃSTWO (koszyk 2 MVP, kryterium 2, lista S2.3)

Data: 2026-09-10 · gałąź `mvp/p4-bezpiecz-20260910` · baza `023167a7f3`
Pomiar: własny backend na porcie 3107, `CSRF_MODE=enforce`, `NODE_ENV=production`,
żywa baza **staging** (serwis `pgvector`, 50 organizacji / 86 użytkowników).

---

## 1. Czy `CSRF_MODE` ma implementację — TAK

Nie fantom. Łańcuch jest pełny:

| ogniwo | plik |
|---|---|
| odczyt flagi | `server/src/middleware/csrf.middleware.ts` — `getCsrfMode()` |
| middleware | tamże — `csrfProtectionMiddleware` (off / report / enforce) |
| **realny wołacz** | `server/src/index.ts:1268` — `app.use('/api/', csrfProtectionMiddleware)` |
| cookie | `server/src/index.ts:1263` — `csrfTokenMiddleware` (gdy produkcja **lub** mode ≠ off) |
| strona klienta | `src/services/csrfClient.ts`, wołany z `src/index.tsx:48` |

**Wartość domyślna to `off`** (jawnie, nie z heurystyki: każda wartość inna niż
`report`/`enforce` daje `off`). Zmierzone zmienne: staging `CSRF_MODE=report`,
demo **brak zmiennej** → `off`, czyli **demo dziś nie ma ochrony CSRF**.
Obie liczby nadzorcy potwierdzone.

## 2. Logi stagingu w trybie `report`

Okno 2026-09-10 05:59–06:19 (20 minut, 5000 linii): **62 naruszenia, wszystkie
jedna trasa** — `POST /analytics/web-vitals`, wszystkie `CSRF_MISSING`.
Przyczyna: `navigator.sendBeacon` w `src/utils/webVitals.ts:378` omija
interceptor `window.fetch`. Ruch mutujący, który naruszeń **nie** dał:
`POST /api/v10/teresa/voice-event` (136), `PUT /api/preferences` (31),
`PUT /api/users/:id` (~20), `POST /api/v8/my-work/inbox/canonical/materialize` (9).

Zastrzeżenie: to 20 minut ruchu, nie doba — próbka, nie zbiór.

## 3. DEFEKT ZNALEZIONY I NAPRAWIONY: wszystkie zwolnienia CSRF były martwe

`csrfProtectionMiddleware` jest montowany przez `app.use('/api/', ...)`, więc
Express podaje `req.path` **względną** (`/auth/login`), a lista zwolnień
porównywała wyłącznie z `/api/auth/login`. Efekt w trybie enforce — zmierzony,
nie wywnioskowany:

| trasa (POST, bez tokenu) | przed naprawą | po naprawie |
|---|---|---|
| `/api/auth/login` | **403** | 400 (walidacja ciała) |
| `/api/auth/register` | **403** | 400 |
| `/api/auth/refresh` | **403** | 400 |
| `/api/auth/reset-password` | **403** | 400 |
| `/api/webhooks/stripe` | **403** | 400 |
| `/api/tasks` (kontrola: ma być chroniona) | 403 | **403** |

Ten sam defekt widać było w logach stagingu: pole `path` w `csrf_violation`
nie miało prefiksu `/api`.

Naprawa: `candidatePaths()` + `isExemptRequest()` sprawdzają wariant względny
**i** pełny (`baseUrl + path`); log podaje ścieżkę pełną.
Test: `tests/unit/backend/security/csrfExemptMountPrefix.test.ts` (7 przypadków).

## 4. Przepływ zapisu w trybie enforce — PRZESZEDŁ

`scripts/security/p4-csrf-enforce-probe.mjs`, wynik w `csrf-enforce-probe.json`.
Każda trasa strzelona dwa razy: z tokenem (musi przejść) i bez (musi dać 403).

| obiekt | trasa | z tokenem | bez tokenu | sprzątnięte |
|---|---|---|---|---|
| inicjatywa | `POST /api/initiatives` | **200 utworzona** | 403 | tak |
| zadanie | `POST /api/tasks` | **201 utworzone** | 403 | tak |
| decyzja | `POST /api/decisions` | **201 utworzona** | 403 | tak |
| materiał | `POST /api/tool-assets` | 404 — trasy nie ma | 403 | — |
| web-vitals | `POST /api/analytics/web-vitals` | 204 | 403 | — |
| preferencje | `PUT /api/preferences` | 200 | 403 | — |

Kolumna „bez tokenu" jest dowodem, że sonda cokolwiek mierzy: gdyby enforce
nie działał, byłoby tam 200.

### Werdykt CSRF enforce
**Bezpieczny do włączenia dopiero z naprawą z pkt 3.** Bez niej padłyby:
logowanie, rejestracja, odświeżenie sesji, reset hasła, weryfikacja e-mail,
`/api/auth/demo-login`, `/api/auth/quick-access` i **webhooki Stripe** (te
ostatnie trwale — zewnętrzny system nie ma jak wysłać tokenu).

Po naprawie zostaje jedna znana ofiara: `POST /api/analytics/web-vitals`
z `sendBeacon` (telemetria, odpowiedź 204). Do wyboru: przełożyć na `fetch`
z `keepalive` (wzór jest już w `src/services/api.ts`) albo dopisać do zwolnień.

## 5. Macierz cross-org

`scripts/security/p4-crossorg-matrix.mjs` + `p4-crossorg-targets.mjs`.
Organizacja A = Northwind (`468b234c…`), organizacja B = świeże konto założone
przez API i skasowane po pomiarze.

**654 strzały · 17 tras faktycznie zmierzonych · 0 wycieków** (po naprawie z pkt 6).
Pozostałe 637 to `N/A` — trasa nie istnieje pod danym zasobem, co potwierdza
kontrola bazowa (ten sam strzał **własnym** zasobem atakującego też daje 404).
To jest odpowiedź na pułapkę „404 bo izolacja vs 404 bo trasy nie ma" —
poprzedni pomiar wziął 22 nieistniejące trasy za defekty produktu.

Zmierzone jako izolowane: `organizations/:id`, `projects/:id` (+ `/ai-role`,
`/finance`, `/notification-settings`, `/regulatory-mode`, `/steering-board`),
`initiatives/:id` (+ `/capacity`, `/lineage`, `/readiness`,
`/transition-preflight`), `tasks/:id`, `decisions/:id` (+ `/created-tasks`,
`/detail`), `users/:id`.

## 6. DEFEKT ZNALEZIONY I NAPRAWIONY: wyciek danych między organizacjami

`GET /api/projects/:id/notification-settings` czytało
`SELECT * FROM project_notification_settings WHERE project_id = ?` — bez filtra
po organizacji; router miał strażnika tylko na `PUT`, nie na `GET`.

Dowód nie z kodu, lecz z danych: do projektu organizacji A wstawiono wiersz
kontrolny `escalation_days = 4242`; konto organizacji B odczytało go w całości
(`{"id":"p4-canary-row", … "escalation_days":4242}`). Wiersz usunięty.

Rodzeństwo o tym samym kształcie — `/:id/ai-role`, `/:id/regulatory-mode` —
oddawało wartości domyślne **wyłącznie dlatego, że ich tabele są puste**;
po pierwszym zapisie wyciekłoby to samo. Naprawione razem.

Naprawa: `ProjectController.assertProjectInCallerOrg()` (404, nie 403, żeby nie
potwierdzać istnienia cudzego projektu). Po naprawie konto B dostaje 404 na
wszystkich trzech, właściciel nadal 200 z danymi.
Test: `tests/unit/backend/controllers/ProjectController.crossOrgGuard.test.ts`.

## 7. Czy pomiar umie wykryć wyciek — TAK, udowodnione

`P4_CANARY=1` atakuje zasoby organizacji A kontem organizacji A: każda działająca
trasa musi wtedy zostać zaklasyfikowana jako WYCIEK.
Wynik: **22 z 23 zmierzonych tras wykryte jako wyciek** (`crossorg-canary.json`).
Skrypt kończy się błędem, gdy kanarek nie wykryje niczego.

Jedna trasa (`initiatives/:id/capacity`) została słusznie odsiana: strzał tą samą
trasą z nieistniejącym UUID daje odpowiedź identyczną co do znaku, więc to echo
identyfikatora z URL-a, a nie dane ofiary. Ta kontrola jest w skrypcie
(`isEchoOnly`) — bez niej macierz raportowała 4 wycieki, z czego 3 pozorne.

## 8. Czego NIE zmierzono (N/A, nie PASS)

- **Mutacje cross-org** (PUT/DELETE na cudzym zasobie). Świadomie nie strzelane:
  udany atak zniszczyłby dane na współdzielonej bazie staging dzień przed
  pilotażem. Zmierzone są wyłącznie odczyty.
- **Pełna lista tras.** Kryterium mówi o 2725 trasach; introspekcja żywego
  routera dała 5221 wpisów, ale Express 5 nie wystawia prefiksu sub-routera
  (`layer.path`/`layer.regexp` = undefined), więc 5110 z nich nie ma ścieżki
  montażu. Skrypt `p4-route-inventory.ts` ma bezpiecznik, który w takiej sytuacji
  **odmawia zapisu** zamiast oddać fałszywy inwentarz. Macierz oparto na
  109 sufiksach `GET /:id/*` z routera × 6 typów zasobów.
- **Materiały** — `POST /api/tool-assets` nie istnieje; właściwej trasy zapisu
  materiału nie ustalono w czasie dyżuru.
- **Demo** — cały pomiar wykonany na bazie staging. Demo nie było dotykane.

## 9. Pułapki, które potwierdziły się w trakcie

1. `grep --include` w zsh zwraca `no matches found` zamiast wyników.
2. `timeout` nie istnieje na macOS — pierwsze `railway variables` zwróciło pustkę,
   którą łatwo wziąć za „brak zmiennej".
3. `server.env` ma `DB_HOST=postgres.railway.internal` — proces ginie po cichu.
   **Gorzej:** publiczny odpowiednik tego hosta prowadzi do serwisu `Postgres`,
   który ma **1 organizację i 1 użytkownika**. Aplikacja staging jedzie na
   serwisie **`pgvector`** (`DATABASE_URL`). Pomiar na złej bazie wyglądał
   normalnie — 401 przy logowaniu — i tylko sprawdzenie liczby organizacji
   to wykryło.
4. `DELETE /api/decisions/:id` zwraca 200, a rekord zostaje w bazie. Sprzątanie
   przez API nie wystarcza — `p4-cleanup-probe-data.mjs` sprząta na bazie
   i weryfikuje licznikiem.

## 10. Zmienne dla nadzorcy

Do ustawienia **dopiero po wdrożeniu naprawy z pkt 3** (bez niej enforce zabija
logowanie i webhooki):

```
staging:  CSRF_MODE=enforce      (dziś: report)
demo:     CSRF_MODE=report       (dziś: brak zmiennej = off)
```

Rekomendacja: demo najpierw na `report` na czas pilotażu, `enforce` po przejrzeniu
logów `csrf_violation`. Produkcji nie dotykano i nie ma dla niej rekomendacji.

## Pliki

- `scripts/security/p4-csrf-enforce-probe.mjs` — przepływ zapisu w enforce
- `scripts/security/p4-crossorg-targets.mjs` — cele macierzy
- `scripts/security/p4-crossorg-matrix.mjs` — macierz + kanarek + kontrola echa
- `scripts/security/p4-route-inventory.ts` — inwentarz tras (z bezpiecznikiem)
- `scripts/security/p4-cleanup-probe-data.mjs` — sprzątanie
- `evidence/p4-bezpieczenstwo-20260910/*.json` — surowe wyniki
