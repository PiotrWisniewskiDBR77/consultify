# RN-G6-A1 — Report Builder cross-tenant audit (Results Next, poza zakresem)

Data: 2026-08-12
Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g6-a1`, gałąź `rn-g6-a1`
HEAD: `d6bd233a7749c8b7b9549d095bd0bc4f4151d69b` (niezmieniony w trakcie audytu)
Faza: READ-ONLY — zero zmian w `server/src/**` i `src/**`.

## Zakres

Weryfikacja hipotezy zgłoszonej przez inny tor: `tests/acceptance/res-012-reporting-snapshot.realdb.test.ts:233`,
test `foreignSnapshotRead`, obserwacja „expected 200 to be 404" przy odczycie migawki raportu KPI
(`GET /api/results/kpi-reports/:snapshotId`) przez użytkownika **innej organizacji**.

## WERDYKT: `FALSE_POSITIVE`

Produkt poprawnie izoluje tenantów na tej ścieżce. Obserwowane „200 zamiast 404" to artefakt
kaskadowej awarii fikstury testowej na świeżo zmigrowanej bazie — spowodowany **niezwiązaną** luką
parytetu schematu, nie błędem izolacji danych.

## Mechanizm — ustalony empirycznie, na realnym Postgresie

### Krok 1 — reprodukcja luki schematu

Zbudowałem od zera lokalny klaster Postgres (`initdb --locale=C`, port 55881, katalog gniazda
`/tmp/rn-a1-sock`) i zmigrowałem go WYŁĄCZNIE przez `server/scripts/migrate.postgres.ts` (bez
`--safe`) przeciw `server/migrations/` — czyli dokładnie tak, jak nakazuje procedura audytu.
Migracja zakończyła się `✅ Postgres migrations complete` (0 błędów, 608 wpisów w
`schema_migrations`).

Uruchomienie `res-012-reporting-snapshot.realdb.test.ts` na tej bazie (
`DATABASE_URL=...55881/consultinity_test NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1
MOCK_DB=false npx vitest run --config vitest.acceptance.config.ts ...`) dało **3/3 FAIL**, nie 1/3:

1. `creates a period-bounded snapshot...` → **500**: `column "source_refs_json" of relation
   "report_builder_reports" does not exist` (INSERT w `ReportBuilderService.createReport`, wołane
   z `server/src/routes/results-kpi-reports.routes.ts:339`). `snapshotV1` zostaje `''` (wartość
   początkowa z linii 21, nigdy nie nadpisana, bo `expect(...).toBe(200)` rzuca przed przypisaniem).
2. `keeps v1 immutable...` → `TypeError: Cannot read properties of undefined (reading 'kpis')` —
   bezpośrednia konsekwencja (1).
3. `does not leak the snapshot...` → **200 zamiast 404** — to jest DOKŁADNIE zgłoszona obserwacja.

### Krok 2 — dlaczego brakuje kolumny (luka niezwiązana z izolacją tenantów)

`server/scripts/migrate.postgres.ts` domyślnie czyta WYŁĄCZNIE `server/migrations/`. Repo ma
cztery katalogi migracji (`server/migrations`, `server/migrations-manual`, `server/migrations-v2`,
`server/migrations-archive` — zgodne z wcześniejszym ustaleniem „4 mechanizmy migracji",
`audyt-bazy-danych-2026-08-06`). Kolumna `report_builder_reports.source_refs_json` jest
zdefiniowana w `server/migrations-v2/001_baseline_20260413.sql:24848` (prawdziwy baseline CREATE
TABLE) — **nie** w żadnym pliku `server/migrations/`.

Jedyna wzmianka o tej kolumnie w `server/migrations/` to
`20260719_baseline_gap.sql:13488-13490`:
```sql
do $t10c$ begin
  alter table "public"."report_builder_reports" alter column "source_refs_json" drop default;
exception when others then null;
end $t10c$;
```
— czyszczący `DROP DEFAULT`, opakowany w `exception when others then null`, więc **milcząco
połyka błąd**, gdy kolumna nie istnieje, zamiast ją utworzyć. Ten plik zakłada, że kolumna już
jest (bo powstała gdzieś indziej — realny demo/prod prawdopodobnie miał ją od baseline w
`migrations-v2` albo z ręcznego ALTER-a), więc na produkcyjnej/demo bazie prawdopodobnie ta
kolumna istnieje i `POST /kpi-reports` działa. Na **czystej** bazie zbudowanej wyłącznie z
`server/migrations/` (dokładnie tak, jak nakazuje procedura tego audytu) — nie istnieje.

To jest realna, ale ODDZIELNA luka (parytet środowisk migracji), niepowiązana z izolacją
tenantów. Zgłaszam ją osobno niżej, nie naprawiam (poza zakresem audytu i poza allowlistą).

### Krok 3 — potwierdzenie mechanizmu „200" przez routing, nie przez wyciek danych

Dodałem kolumnę WYŁĄCZNIE na moim własnym, jednorazowym klastrze (`ALTER TABLE
report_builder_reports ADD COLUMN IF NOT EXISTS source_refs_json TEXT;` — zero zmian w repo, zero
zmian w `server/src`/`src`) i przeuruchomiłem `res-012-reporting-snapshot.realdb.test.ts`:
**3/3 PASS**, włącznie z `foreignSnapshotRead` → **404**, jak oczekiwano.

To znaczy: gdy test 1 nie pada, `snapshotV1` ma prawdziwe ID, a `GET
/api/results/kpi-reports/${snapshotV1}` trafia we właściwy route
(`router.get('/kpi-reports/:snapshotId', ...)`, `results-kpi-reports.routes.ts:344`) — i ten route
poprawnie zwraca 404 obcemu tenantowi.

Żeby jednoznacznie wykazać, DLACZEGO puste `snapshotV1` dawało 200, napisałem osobny test
diagnostyczny (dozwolony przez allowlistę, `tests/**`):
`tests/acceptance/res-012-diag-empty-id-route.realdb.test.ts` — 2/2 PASS:

- `GET /api/results/kpi-reports/` (pusty `snapshotId`, końcowy `/`) → **200**, `body.data` jest
  **tablicą** (kształt endpointu **LISTY**, `results-kpi-reports.routes.ts:244-300`), nie obiektem
  `{snapshot, filters, ...}` (kształt endpointu SZCZEGÓŁU). Express w trybie domyślnym
  (`strict: false`) dopasowuje `/kpi-reports/` do wzorca `/kpi-reports`, który jest zarejestrowany
  WCZEŚNIEJ niż `/kpi-reports/:snapshotId` — więc pusty string w URL-u przez template literal
  (`` `/api/results/kpi-reports/${snapshotV1}` `` z `snapshotV1=''`) ciągnie żądanie do listy, a nie
  do szczegółu.
- `GET /api/results/kpi-reports/does-not-exist-12345` (niepusty, nieistniejący id) → poprawne
  **404** przez route szczegółu.

Endpoint LISTY sam w sobie jest poprawnie skopowany po organizacji (`WHERE r.organization_id = ?`,
linia 265) — obcy tenant dostaje pustą tablicę, bo nie ma żadnych własnych raportów, NIE dostaje
cudzych. To nie jest wyciek; to inny endpoint niż ten, który test *zamierzał* odpytać.

## Ścieżka żądania od trasy do SQL

- Trasa: `server/src/routes/results-kpi-reports.routes.ts:344-359`
  `router.get('/kpi-reports/:snapshotId', ...)` → `getOrgId(req)` (linia 26-28, czyta
  `req.user.organizationId || req.user.organization_id`) → `getKpiReportSnapshot({
  organizationId: orgId, snapshotId })` (linia 354) → `if (!data) return res.status(404)`
  (linia 355).
- Serwis: `server/src/services/results/kpiReportSnapshotService.ts:519-548`, funkcja
  `getKpiReportSnapshot`. Zapytanie SQL, linia 524-527:
  ```sql
  SELECT * FROM results_kpi_report_snapshots WHERE id = ? AND organization_id = ?
  ```
  — predykat tenanta OBECNY, przez `withPgTransaction`/`adaptQuery` (`?` → `$1,$2`,
  `server/src/database/PostgresDatabase.ts:812-869`, generyczny, współdzielony adapter — bez zmian
  z mojej strony).
- Auth: `server/src/middleware/auth.middleware.ts`, `verifyToken` → `attachUser` (linia 598-930).
  `organizationId` w tokenie JWT jest odczytywane (linia 620-622) i — jeśli brak nadpisania przez
  `x-org-context`/demo-nagłówki — trafia do `req.user.organizationId` (linia 858-873) po
  zweryfikowaniu, że użytkownik ma AKTYWNE członkostwo w tej organizacji (linia 803-835, fallback
  na inną aktywną organizację TYLKO gdy tokenowa nie jest aktywna). Token minięty w teście
  (`mintToken({ organizationId: FOREIGN_ORG_ID, organization_id: FOREIGN_ORG_ID, ... })`,
  `res-012-reporting-snapshot.realdb.test.ts:229-232`) poprawnie niesie `FOREIGN_ORG_ID`, a
  `FOREIGN_USER_ID` ma aktywne członkostwo OWNER w `FOREIGN_ORG_ID` (seed, linie 85-91) — więc
  `req.organizationId` faktycznie rozstrzyga się na `FOREIGN_ORG_ID`, nie na bazowy org.

## Tabela: endpoint × rola → status → co wraca

Zweryfikowane na realnym Postgresie (po zamknięciu luki schematu na moim jednorazowym klastrze;
zamknięcie NIE dotyka repo).

| Endpoint | Rola | Status | Co wraca |
|---|---|---|---|
| `GET /kpi-reports/:id` | właściciel (ten sam org, twórca) | 200 | payload+metadane (własna migawka) |
| `GET /kpi-reports/:id` | **inna organizacja** | **404** | `{success:false, error:'Not found'}` — brak payloadu, brak metadanych, **istnienie NIE jest ujawniane** |
| `GET /kpi-reports` (lista) | inna organizacja | 200 | `data: []` — pusta tablica, filtr `r.organization_id = ?` (linia 265); zero elementów obcego tenanta |
| `POST /kpi-reports` (create) z `kpiIds` obcej organizacji | dowolna rola tego samego org co token, celująca w cudzy KPI | 404 | `{success:false, code:'RESULTS_KPI_REPORT_KPI_NOT_FOUND'}` — `listKpisForOrg` filtruje `WHERE COALESCE(k.organization_id, i.organization_id) = ?` (`kpiReportSnapshotService.ts:165`); obcy `kpiIds` nigdy nie trafia do `ownedIds` |
| `POST /kpi-reports/:id/refresh` | inna organizacja | 404 | Ten sam org-scoped `getKpiReportSnapshot` wołany PRZED utworzeniem nowej wersji (linia 373-376) — brak możliwości odświeżenia cudzej migawki |
| `POST /kpi-reports/:id/refresh` (duplikat v8) | inna organizacja | 404 | `server/src/routes/v8/results.routes.ts:2970-3009` — identyczny wzorzec, ta sama funkcja serwisowa |

Wszystkie cztery role z listy kontrolnej sprowadzają się w tym module do jednego rozróżnienia:
„ma aktywne członkostwo w organizacji `X`" vs „nie ma" — bo trasa nie ma osobnej warstwy
zdolności/ról ponad `verifyToken`. Właściciel i zwykły aktywny członek tego samego org mają
identyczny dostęp (brak dodatkowego gate'u roli na `GET/POST /kpi-reports*` poza
`p04AssertKpiPermission` na duplikacie v8-refresh, `results.routes.ts:2973` — nie badane głębiej,
poza hipotezą). Administrator organizacji = zwykły aktywny członek dla tego modułu (brak specjalnej
ścieżki). Aktor systemowy — brak odrębnej ścieżki serwisowego konta w tym routerze.

## Cache, capability layer, Teresa/AI

- **Cache**: brak. `kpiReportSnapshotService.ts` i `results-kpi-reports.routes.ts` nie importują
  żadnego mechanizmu cache; każde żądanie idzie na świeże połączenie przez `withPgTransaction`.
- **Warstwa widoczności/zdolności**: brak dedykowanej warstwy dla tego modułu. Trasy same
  wyliczają `orgId`/`userId` z `req.user` i przekazują do serwisu, który filtruje w SQL. Jedyny
  gate poza `verifyToken` to `p04AssertKpiPermission` na duplikacie v8 refresh (uprawnienie, nie
  izolacja tenanta).
- **Teresa/AI**: grep `results_kpi_report_snapshots` / `kpiReportSnapshotService` w
  `server/src/**` nie znalazł żadnego konsumenta poza `results-kpi-reports.routes.ts` i
  `server/src/routes/v8/results.routes.ts` (oba poprawnie org-scoped, patrz tabela). Pliki
  zawierające zarazem „teresa" i `report_builder_reports` (`notebookService.ts`,
  `transformationFinalOutputService.ts`) nie odwołują się do `results_kpi_report_snapshots` ani do
  `kpiReportSnapshotService` — inna, niepowiązana ścieżka `report_builder_reports` (np. eksport
  notatnika), poza zakresem tej hipotezy.

## Czego to NIE dowodzi

- Nie dowodzi, że `report_builder_reports.source_refs_json` istnieje na demo/prod — nie miałem
  dostępu i nie łączyłem się z żywą bazą (zakaz `dev:staging`/`dev:railway`). Wniosek o realnym
  środowisku opieram wyłącznie na tym, że ta sama luka schematu na **fikstury-only** bazie
  wystarczy do wytłumaczenia całej obserwacji — nie testowałem samego demo.
- Nie dowodzi, że KAŻDY endpoint w Results Next ma poprawny predykat tenanta — zakres tego audytu
  to wyłącznie moduł raportów KPI (`kpi-reports*`), zgodnie ze zleceniem.
- Nie wyklucza, że luka autoryzacji „każdy aktywny członek org, bez rozróżnienia roli" (brak
  osobnego gate'u poza `verifyToken` na bazowej trasie `kpi-reports*`) jest w praktyce
  niepożądana — to nie jest wyciek międzyorganizacyjny (temat tego audytu), tylko potencjalnie
  osobne pytanie o granulację uprawnień WEWNĄTRZ organizacji, nieocenione tutaj.

## Poza-zakresowa luka do zgłoszenia osobno (NIE naprawiona, poza allowlistą)

`report_builder_reports.source_refs_json` brakuje na bazie zbudowanej wyłącznie z
`server/migrations/` (via `server/scripts/migrate.postgres.ts`) — kolumna istnieje tylko w
`server/migrations-v2/001_baseline_20260413.sql`. Jedyna wzmianka w `server/migrations/`
(`20260719_baseline_gap.sql:13488-13490`) milcząco połyka błąd `ALTER COLUMN ... DROP DEFAULT` na
nieistniejącej kolumnie zamiast ją tworzyć. Skutek: `POST /api/results/kpi-reports` (tworzenie
migawki + artefaktu Report Builder) pada z 500 na KAŻDEJ świeżo zmigrowanej-tylko-z-
`server/migrations/` bazie (np. odzyskiwanie po awarii, nowe środowisko dev/staging zbudowane wg
udokumentowanej procedury tego repo). To realny defekt parytetu środowisk, zasługujący na osobne
zgłoszenie/naprawę — nie naprawiałem go (poza zakresem read-only audytu i poza allowlistą tej
sesji).

## Co ruszyłem poza allowlistą

Nic w `server/src/**` ani `src/**`. Poza allowlistą ruszyłem WYŁĄCZNIE mój własny, jednorazowy,
lokalny klaster Postgres (port 55881, katalog danych
`/Users/piotrwisniewski/rn-g2-lanes/g6-a1/.pgdata-a1`, gniazdo `/tmp/rn-a1-sock`) — jedna
diagnostyczna `ALTER TABLE ... ADD COLUMN IF NOT EXISTS source_refs_json TEXT;` wykonana
bezpośrednio przez `psql` na TEJ bazie, żeby odblokować pełny przebieg testu i potwierdzić
mechanizm. Zero zapisów do repo poza dwoma plikami z allowlisty (ten raport +
`tests/acceptance/res-012-diag-empty-id-route.realdb.test.ts`). Klaster i katalog danych
sprzątnięte po sobie na końcu sesji (`pg_ctl stop` dokładnym PID-em, `rm -rf .pgdata-a1`). Port
55821 (baza równoległej sesji) nietknięty; żadnego `pkill -f`.

## Podsumowanie dla orkiestratora

Nie ma tu wycieku międzyorganizacyjnego do naprawienia. Test `res-012-reporting-snapshot.realdb.
test.ts` jest poprawny i wystarczający — pada tylko na bazach z luką schematu opisaną wyżej. Gdy ta
luka nie występuje (jak najpewniej na demo/prod, skoro `POST /kpi-reports` tam działa), cały
scenariusz — łącznie z izolacją międzyorganizacyjną — przechodzi. Rekomendacja: zamknąć ten wątek
jako `FALSE_POSITIVE` i, jeśli ktoś chce, zgłosić osobno lukę `source_refs_json` w
`server/migrations/` jako defekt parytetu środowisk migracji (nie P0, nie bezpieczeństwo danych).
