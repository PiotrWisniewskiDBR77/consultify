# Agent — 8 tras 500 + limiter AI (2026-09-05)

Gałąź: `agent/trasy-500-limiter-20260905` (baza: linia m03, `b066a5f8eb`).
Stanowisko pomiarowe: lokalny Postgres 17 + pgvector (`fz120-f8-pg`, :5433),
dwie bazy zmigrowane **od zera** przez `server/scripts/migrate.postgres.ts`
(`ag_trasy_500`, `ag_trasy_500_fresh`). Serwer uruchamiany realnie
(`server/src/index.ts`) z `NODE_ENV=development APP_ENV=staging` — czyli w tym
samym kształcie środowiska, w którym zrobiono pomiar 04.09.

**Każdy wiersz poniżej to pomiar na żywym serwerze, nie odczyt z kodu.**

---

## 0. Co zastałem (istotne dla oceny)

Dyżur 313 (`c9d73cfb57`, 04.09 05:41) zdążył już zamknąć **3 z 8** przyczyn:
`GROUP_CONCAT → STRING_AGG` w `adaptQuery`, migrację `coverage_percent`
(20261913) i walidację UUID w `admin/service-accounts`. Potwierdziłem pomiarem,
że te trzy trasy faktycznie oddają 200 — i **objąłem je testami**, bo dotąd nie
miały pokrycia na realnym PG (dowody mutacyjne 5, 6, 8 poniżej pokazują, że bez
tych napraw testy są czerwone).

Zostawało 5 tras. Przy ich rozbieraniu wyszły **trzy rzeczy poważniejsze niż
zgłoszone 500**, opisane w §2, §3 i §4.

---

## 1. Tabela: trasa → przyczyna → naprawa → test → status

| # | Trasa | Przyczyna (zmierzona) | Naprawa | Test | Status |
|---|---|---|---|---|---|
| 1 | `GET /api/admin/service-accounts` | `invalid input syntax for type uuid` — `tp_service_accounts.organization_id` jest typu `uuid`, a `organizations.id` to TEXT | zastane (dyżur 313): `validateUUID` → pusta lista | realdb #13 (oba kształty tenanta) | **200** ✅ |
| 2 | `GET /api/knowledge-graph/freshness/duplicates` | `function group_concat(text) does not exist` | zastane (dyżur 313): rewrite w `adaptQuery` | realdb #10 — **z dwoma realnymi duplikatami**, więc dowodzi, że `STRING_AGG` *agreguje*, a nie tylko parsuje na pustej tabeli | **200** ✅ |
| 3 | `GET /api/report-builder/sources/upload_bundle` | `column "coverage_percent" does not exist` na bazie od zera | zastane (dyżur 313): migracja 20261913 | realdb #11 | **200** ✅ |
| 3b | `GET /api/report-builder/sources/upload_bundle/:sourceId` | **znalezione przy przejściu rodziny** — `canonical_markdown` i `auto_summary` nadal nie istnieją na bazie od zera | nowa migracja `20262101` | realdb #12 | **200** ✅ |
| 4 | `GET /api/billing/webhook-events` | `column "organization_id" does not exist` — tabela **nigdy** nie miała kolumn tenanta | nowa migracja `20262100` (+ `attempt_count`, `updated_at`, `last_attempt_at`, indeks) | realdb #1 — sprawdza też **izolację tenanta** | **200** ✅ |
| 5 | `GET /api/billing/webhook-events/stats` | dwie przyczyny: jw. + `operator does not exist: text >= timestamp with time zone` (`created_at` jest TEXT, a `datetime('now',…)` jest przepisywane na timestamptz) | cutoff liczony w JS i **bindowany** jako tekst w formacie kolumny | realdb #2 i #3 | **200** ✅ |
| 6 | `GET /api/report-builder/definitions` | `invalid input syntax for type uuid` — `report_definitions.organization_id` typu `uuid` | tenant bez UUID dostaje **katalog systemowy** (`organization_id IS NULL`) zamiast błędu | realdb #4 | **200** ✅ |
| 7 | `GET /api/table-platform/admin/service-accounts` | jw. (`tp_service_accounts`) | guard w serwisie → pusta lista | realdb #5 | **200** ✅ |
| 8 | `GET /api/table-platform/admin/sso` | jw. (`tp_sso_configs`) | guard w serwisie → `null` → wołacz renderuje 404 „not configured", identycznie jak dla tenanta uuid bez SSO | realdb #6 | **404** ✅ (taki sam jak dla poprawnego tenanta) |

Zapisy w tej rodzinie nie mogą się zdegradować do „pustki", więc 5 mutacji
table-platform mówi wprost **400 po polsku** zamiast 500 (realdb #7).

### Pomiar przed/po (ten sam serwer, ta sama baza)

```
                                              tenant uuid      tenant legacy TEXT
                                              przed → po       przed → po
/api/admin/service-accounts                    200 → 200        200 → 200
/api/knowledge-graph/freshness/duplicates      200 → 200        200 → 200
/api/report-builder/sources/upload_bundle      200 → 200        200 → 200
/api/report-builder/definitions                200 → 200        500 → 200
/api/billing/webhook-events                    500 → 200        500 → 200
/api/billing/webhook-events/stats              500 → 200        500 → 200
/api/table-platform/admin/service-accounts     200 → 200        500 → 200
/api/table-platform/admin/sso                  404 → 404        500 → 404
```

Pomiar prowadziłem **na dwóch kształtach tenanta naraz** — 5 z 8 awarii widać
wyłącznie przy organizacji o nie-UUID-owym `id`, czyli dokładnie takiej, jaka
wystąpiła w pomiarze 04.09 (`invalid input syntax for type uuid: "..."`).
Gdybym testował tylko na świeżo utworzonej organizacji UUID, ogłosiłbym
„4 trasy działają" i minąłbym się z defektem.

---

## 2. Wyciek stosu i surowego SQL — przyczyna była systemowa, nie per-trasa

Zgłoszenie mówiło o 3 trasach oddających surowy SQL i stos. Zmierzyłem
odpowiedź i przyczyna leży **w globalnym handlerze**, więc dotyczyła każdej
trasy, która oddaje 500:

`server/src/utils/ErrorHandler.ts` puszczał gałąź verbose przy
`NODE_ENV === 'development' || NODE_ENV === 'test'`, a staging/demo chodzą
właśnie na `development`. Zmierzona odpowiedź dla zwykłego zalogowanego
użytkownika:

```json
{"status":"error","error":{"message":"column \"coverage_percent\" does not exist",
 "stack":"error: ...\n    at .../PostgresDatabase.ts:732:17"}}
```

Uwaga metodyczna: zlecenie wskazywało `server/src/middleware/ErrorHandler.ts`.
Na macOS ta ścieżka rozwiązuje się do `middleware/errorHandler.ts` — to **inny,
nieużywany na tej trasie** mapper. Realnie zamontowany jest
`server/src/utils/ErrorHandler.ts` i to on wyciekał.

Naprawa — dwa niezależne bezpieczniki:

1. `isVerboseErrorEnv()` — verbose tylko dla `test`, albo dla `development`,
   które **nie jest hostowanym wdrożeniem** (Railway / `APP_ENV` w tierze
   deployed).
2. `isDatabaseDriverError()` — błąd sterownika (pg: 5-znakowy SQLSTATE +
   `severity`/`routine`/`file`; sqlite: `SQLITE_*`) nigdy nie oddaje `message`
   ani `stack`, w **żadnym** środowisku. Jego `message` to powierzchnia SQL.

Zmierzone po naprawie, przy `NODE_ENV=development APP_ENV=staging`:

```json
{"status":"error","correlationId":"f387fe4e-…",
 "error":{"code":"DATABASE_ERROR",
          "message":"Nie udało się odczytać danych. Spróbuj ponownie lub zgłoś identyfikator korelacji."}}
```

Regresja sprawdzona: istniejące `errorHandler.{production,development}.contract.test.ts`
nadal 4/4 zielone (lokalny deweloper dalej widzi stos).

---

## 3. Punkt B — bramki ról

**To jest najpoważniejsze znalezisko tego dyżuru i nie było zgłoszone.**

`/api/table-platform/admin/*` nie miało **żadnej** bramki roli — dziedziczyło z
góry routera tylko `verifyToken + requireTablePlatform + limiter`. Zmierzone na
żywym serwerze tokenem **VIEWER-a**:

```
VIEWER  GET  /api/table-platform/admin/service-accounts  → 200  (lista kont org)
VIEWER  GET  /api/table-platform/admin/sso               → 404  (czyta konfigurację SSO)
VIEWER  POST /api/table-platform/admin/service-accounts  → 201  {"token_prefix":"tp_sa_sTZnzW99", …}
```

VIEWER **wygenerował działający token konta serwisowego** z zakresami, o które
sam poprosił. To pełna ścieżka eskalacji uprawnień, nie „za dużo widać".

Naprawa: `requireTenantAdmin` na 8 trasach `/admin/*` — powiela kontrakt, który
już istniał obok dla tych samych zasobów (`/api/admin/service-accounts`,
`/api/billing/*` oddają 403 VIEWER-owi i MEMBER-owi). Bramka jest **per-trasa**,
bo `router.use` na górze jest współdzielony z powierzchnią nie-admin, którą
każdy członek tabeli może legalnie czytać.

Przy przejściu całej rodziny objąłem też `POST /admin/scim/token` — **drugą,
niezgłoszoną trasę mintującą token**, równie niebronioną.

Zmierzone po naprawie (para „obcy nie widzi" + „właściciel widzi"):

| rola | `/table-platform/admin/*` | `/admin/health-panel/probes` | `/admin/service-accounts` | `/billing/webhook-events` |
|---|---|---|---|---|
| VIEWER | 200/201 → **403** | 403 | 403 | 403 |
| MEMBER | 200/201 → **403** | 403 | 403 | 403 |
| OWNER | 200/201/404 (bez zmiany) | 200 | 200 | 200 |

### Trasy, które ZOSTAWIAM dla OWNER-a — z uzasadnieniem

- **`/api/admin/health-panel/probes`** — zostaje. Nie jest trasą superadmina:
  własny docblock modułu deklaruje ją jako panel „dowodów działania" dla
  **org owners/admins**, wyniki są cache'owane per `organizationId`
  (`getCachedResults(ctx.organizationId)`), a sondy mutujące i tak blokuje
  `isHealthPanelAllowedEnv()` na produkcji. Bramka działa poprawnie: VIEWER i
  MEMBER dostają 403. Katalog 20 sond to statyczna lista nazw podsystemów, nie
  dane innego tenanta.
  **Zastrzeżenie do decyzji właściciela (nie zmieniam sam):** ten katalog to
  jednak wewnętrzny detal produktu. Jeśli intencją jest, żeby klient go nie
  widział, to decyzja produktowa — zawężenie do superadmina jest jednolinijkowe,
  ale nie wykonuję go bez zlecenia, bo wyłączyłoby funkcję, dla której moduł
  powstał.
- **`/api/admin/service-accounts`** — zostaje. Dane są w zakresie własnej
  organizacji, a OWNER powinien zarządzać kontami serwisowymi swojej firmy.
  Gate (członkostwo ACTIVE + rola OWNER/ADMIN) działa: 403 dla VIEWER/MEMBER.
- **`/api/billing/webhook-events*`** — zostaje. Rozliczenia to sprawa
  właściciela organizacji, dane są org-scoped (potwierdzone testem izolacji
  tenanta), a `hasBillingAccess` już dopuszcza tylko
  OWNER/ADMIN/BILLING_MANAGER/SUPERADMIN.

---

## 4. Punkt C — limiter AI

`aiRateLimiter` (30/min w produkcji, klucz po IP gdy `userId` jest null) liczył
też odpytywanie w tle. Widok czatu sam z siebie odpytuje
`GET /api/ai/stream/partial/:sessionId` (czy jest przerwana odpowiedź do
wznowienia) i `GET /api/ai/conversations/:id/proposals` (odświeżenie paska
propozycji). Oba to zwykłe SELECT-y w zakresie tenanta — potwierdziłem czytając
handlery, nie tylko nazwy.

`isGenerativeQuotaExemptRead` rozszerza istniejący wzorzec
`isAgentHubDatabaseRead` o te dwie trasy oraz o odczyty panelu akcji i statusu
budżetu, które ten sam widok odpytuje obok czatu:
`/actions/{pending,center,runs,proposals}`, `/governance/approval-requests`,
`/soft-cap-status`, `/budget/status`, `/tier-limits`.

**Świadomie NIE zwolniłem hurtem wszystkich 41 GET-ów** z `ai.routes` — wypisane
są wyłącznie czyste odczyty bazy. Każda mutacja i każda trasa sięgająca do
providera (`/chat`, `/chat/stream`, `/chat/quick`, `/generate`, `/refine-text`,
`/recommend`, `/deep-research/*`) zostaje pod limiterem. Trasy z własnym
budżetem (`aiMemoryRateLimiter`, `aiActionsRateLimiter`) zachowują go — zdejmowany
jest **tylko wspólny kubełek generatywny**.

Dowód zamontowany, dokładnie jak w zleceniu — prawdziwy `aiRateLimiter`
załadowany z `NODE_ENV=production` (budżet 30/min) za tą samą kompozycją
`router.use`, co w `ai.routes`:

```
40 × GET  /stream/partial/:sessionId  →  0 × 429   (wszystkie 200)
31 × POST /chat/stream                →  31. daje 429
```

---

## 5. Testy i dowody mutacyjne

| Plik | Testy |
|---|---|
| `tests/integration/day314-routes-500-fixes.realdb.test.ts` | 13 ✅ (realny PG, `RUN_DB_TESTS=1`) |
| `tests/unit/backend/contracts/day314.errorHandler.noLeakOnDeployment.contract.test.ts` | 5 ✅ |
| `server/src/routes/__tests__/day314.aiPartialPollingNotRateLimited.test.ts` | 2 ✅ (zamontowany limiter) |
| `server/src/routes/__tests__/day314.aiGenerativeQuotaExemptReads.test.ts` | 28 ✅ |
| istniejące `errorHandler.{production,development}.contract.test.ts` | 4 ✅ (bez regresji) |

Dowody mutacyjne — każdy: **cofnij naprawę → czerwony → przywróć → zielony**:

| # | Cofnięta naprawa | Skutek |
|---|---|---|
| 1 | guard uuid w `SSOService.getSSOConfig` | test `/admin/sso` czerwony |
| 2 | bramka `requireTenantAdmin` | test VIEWER-a czerwony |
| 3 | powrót `datetime('now','-30 days')` | 2 testy `stats` czerwone |
| 4 | `orgAddressable = true` w `listDefinitions` | test `definitions` czerwony |
| 5 | `DROP COLUMN organization_id` | suita czerwona już na fixturze |
| 6 | usunięty rewrite `GROUP_CONCAT → STRING_AGG` | test `duplicates` czerwony |
| 7 | stary warunek `NODE_ENV` w `ErrorHandler` | 3 z 5 testów kontraktu czerwone |
| 8 | `DROP COLUMN canonical_markdown, auto_summary` | test `:sourceId` czerwony |
| 9 | usunięty wyjątek `/stream/partial/` w limiterze | test 40 odpytań czerwony (10 × 429) |

Po każdej mutacji drzewo robocze przywrócone — `git status` czysty, suity
ponownie zielone.

---

## 6. Migracje (obie addytywne, idempotentne, sprawdzone na bazie od zera)

- `server/migrations/20262100_day314_billing_webhook_events_org_scope.sql`
  — `organization_id`, `attempt_count`, `updated_at`, `last_attempt_at`
  + indeks `(organization_id, created_at DESC)`.
- `server/migrations/20262101_day314_imported_reports_canonical_columns.sql`
  — `canonical_markdown`, `auto_summary`.

Obie przeszły na `ag_trasy_500_fresh` zmigrowanej **od zera**
(`✅ Postgres migrations complete`, exit 0), kolumny potwierdzone w
`information_schema`. Żadnego DROP-a, żadnego przenoszenia danych.

---

## 7. Znaleziska poboczne, których nie zgłaszano

1. **Wstrzyknięcie SQL przez `?period=`** w
   `GET /api/billing/webhook-events/stats`. `period` trafiało prosto do stringa
   SQL (`datetime('now', '-${period}')`). Usunąłem u źródła: cutoff liczony w JS
   i bindowany, więc **nie ma już fragmentu interpolowanego** — nie łatam tego
   białą listą. Test #3 podaje ładunek `1 days') OR 1=1 --`.
2. **`billing_webhook_events` nie działała nigdy w żadną stronę** — nie tylko
   odczyt. Serwis od zawsze wstawiał `organization_id`, więc zapis również nie
   utrwalał tenanta. Dodatkowo `updateEventStatus` pisał `datetime('now')` do
   kolumn TEXT, a `getPendingRetries` porównywał TEXT z timestamptz — cała
   ścieżka ponowień była martwa. Naprawione razem, bo to ta sama tabela.
3. **`POST /api/table-platform/admin/scim/token`** — druga trasa mintująca token,
   równie niebroniona. Objęta bramką (§3).

---

## 8. Czego NIE naprawiłem i dlaczego

1. **Nie zmieniam typów kolumn `organization_id` z `uuid` na TEXT.**
   Rozjazd typów (`organizations.id` TEXT vs `report_definitions` /
   `tp_service_accounts` / `tp_sso_configs` typu `uuid`) jest realnym długiem
   schematu, ale konwersja typu kolumny na żywej bazie jest operacją
   destrukcyjną i nieodwracalną — poza mandatem robotnika i poza zakresem tego
   zlecenia. Naprawiłem **objaw na trasach** (zamiast 500 jest prawdziwa
   odpowiedź). **Rekomendacja do decyzji: rozstrzygnąć, który typ jest kanoniczny
   dla `organization_id`, bo dopóki się rozjeżdżają, ta rodzina będzie odrastać.**
2. **Nie zawężam `/api/admin/health-panel/probes` do superadmina** — uzasadnienie
   w §3; to decyzja produktowa właściciela, nie defekt.
3. **Nie zwalniam z limitera pozostałych ~30 GET-ów `ai.routes`.** Zwolniłem
   tylko te, których handlery przeczytałem i potwierdziłem jako czyste odczyty.
   Hurtowe zwolnienie „bo to GET" byłoby zgadywaniem.
4. **Nie sprawdziłem tych tras na realnym stagingu/demo.** Zakaz dotykania tych
   baz. Wszystkie liczby pochodzą z lokalnych baz zmigrowanych od zera —
   odtwarzają kształt „fresh install", ale nie odtworzą defektu, który zależy od
   danych zastanych wyłącznie na demo.
5. **Nie uruchamiałem pełnego `tsc` ani `vitest` całego repo** (zakaz w zleceniu).
   Każdy zmieniony plik przeszedł `esbuild`; uruchamiałem wyłącznie własne pliki
   testowe plus dwa istniejące kontrakty ErrorHandlera pod kątem regresji.
   **Nie mam więc dowodu, że nie zepsułem czegoś poza tym zakresem** —
   `ErrorHandler` i `table-platform.routes` to pliki o szerokim zasięgu i
   zasługują na pełny przebieg CI przed scaleniem.

---

## 9. Commity (gałąź `agent/trasy-500-limiter-20260905`)

```
70b4b4e7e2  fix(report-import): domkniecie rodziny imported_reports (canonical_markdown, auto_summary)
00278a8a45  test(day314): dowody na realnym PG dla 8 tras + kontrakt braku wycieku
dbb2399016  fix(table-platform): /admin/* nie mialo ZADNEJ bramki roli
1fe2af0fcd  fix(ai): czyste odczyty bazy nie zjadaja budzetu generatywnego
36366575bb  fix(uuid-orgs): tenant bez UUID nie wywraca tras na kolumnach typu uuid
b0ea1abce4  fix(billing): webhook-events — brakujace kolumny tenanta + TEXT vs timestamptz + wstrzykniecie w period
51b54847d7  fix(errors): deployed env nigdy nie oddaje stosu ani surowego SQL
```
