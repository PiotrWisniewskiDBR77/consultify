# CODEX DAY 171 — KONTRAKTY DANYCH

## Stan wejściowy

- Marker: `514c60b3553e6a492214b3f9e4ff09d1a7eb8561`.
- Gałąź: `codex/day171-kontrakty-danych-20260830`.
- Worktree: `/private/tmp/cx-day171-kontrakty-danych`.
- Baza: jednorazowy `pgvector/pgvector:pg16`, kontener `cx-day171-pg`, `127.0.0.1:6069`, baza `cx171`.
- Runtime zarezerwowany: `5012` i `5013`.
- Wolne miejsce przy starcie: `32 GiB`.

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
514c60b3553e6a492214b3f9e4ff09d1a7eb8561
```

`git status --short | head -3` nie zwrócił żadnego wiersza.

Tip `github-backup/codex/m03-admin-20260824` jest osiem commitów przed markerem roboczym. Zgodnie z `DEC-2026-08-26-95` pracuję dokładnie z markera; scalenie nowszego tipa należy do nadzorcy.

## Korekty wobec instrukcji

Instrukcja jest sprzeczna w przydziale zasobów. `Z7`, `§0.2c` i `§0.5` wskazują wyłącznie bazę `6069` oraz runtime `5012`/`5013` i nakazują STOP, gdy którykolwiek jest zajęty. Tabela po licencjach podaje `6071` oraz `4994`/`4995`, przy czym te numery są jednocześnie przypisane innym dyżurom w `Z7`. Zastosowałem bezpieczniejszą, wielokrotnie powtórzoną regułę: `6069`, `5012`, `5013`. Wszystkie trzy porty były wolne.

Weryfikacja T2 wskazuje realny plik `src/services/api/financeV2.types.ts`, a nie podany w pierwszej alternatywie `src/types/financeV2.types.ts`. Zadziałał fallback z instrukcji i potwierdził wywołania wspólnego formattera.

## R1 — pomiar przed zmianą kodu produktu

### R1(a) Nazwa wskaźnika

| Warstwa | Plik:linia / pomiar | Wniosek |
|---|---|---|
| Baza scorecard | `server/migrations/20260812_rvn_kpi_scorecards.sql:48-66` | `rvn_kpi_scorecard_items` ma `kpi_id`, ale nie ma nazwy. |
| Baza definicji | `server/migrations/20260810_rvn_kpi_core.sql:50-79` i tabela wersji od linii 86 | Nazwa istnieje jako niepuste `rvn_kpi_definition_versions.name`; dojście prowadzi przez `rvn_kpi_definitions.current_definition_version_id`. |
| Istniejący wzorzec | `server/src/services/resultsVnext/kpi/kpiRepository.ts:121-126` | `listKpis` już robi tenantowe `LEFT JOIN` do aktualnej wersji i wybiera `dv.name`. |
| Urwanie | `server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts:218-228` | `listScorecardItems` wybiera tylko `si.*`; nazwa nie dochodzi do mappera. |
| DTO/front | `src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts:109-119`; `kpiScorecardPresenters.tsx:390-396` | DTO nie ma nazwy, a ekran pokazuje skrócony `kpiId`. |
| Żywy PG | zapytanie `information_schema.columns` i `LEFT JOIN` na świeżej bazie | Kolumna nazwy istnieje i jest `NOT NULL` w tabeli wersji; scorecard ma tylko klucz. Świeża baza ma 0 pozycji, więc brak danych do statystyki wypełnienia przed zasiewem. |

Wniosek: dana istnieje i jest kontraktowo wypełniona dla zatwierdzonej bieżącej wersji, ale nie istnieje w obecnym kontrakcie pozycji scorecardu. Dla KPI bez bieżącej wersji uczciwym wynikiem jest `null`.

### R1(b) Nazwy osób

| Warstwa | Plik:linia / pomiar | Wniosek |
|---|---|---|
| Baza | `server/migrations/000_initdb_core_tables.sql:57-78` | `users.first_name` i `users.last_name` istnieją, oba są nullable. |
| Kontrakt | `kpiScorecardTypes.ts:59-106,116-151,186-239` | Scorecard, item i snapshot niosą tylko identyfikatory osób. |
| Front | `kpiScorecardPresenters.tsx:124-130,303-307,430,536,698-700` | Identyfikatory są prezentowane zamiast nazw. |
| Żywy PG | `SELECT count(*) ... FROM users` | 1/1 użytkowników świeżej bazy ma niepustą nazwę. |
| Wspólny resolver | `rg resolveUserNames|getUsersByIds server/src/services` | Nie znaleziono współdzielonego resolvera w zakresie repozytorium. |

Wniosek: dane istnieją i na świeżej bazie są wypełnione dla istniejącego użytkownika, ale mogą być puste lub użytkownik może nie istnieć. Kontrakt musi dopuścić `null` i zachować ID jako fallback/tooltip.

### R1(c) Waluta

| Kandydat | Plik:linia / pomiar | Wniosek |
|---|---|---|
| Waluta operacyjna | `server/migrations/20260411_p30d_organization_type_and_new_fields.sql:45` | `organization_profiles.currency` istnieje, jest nullable, bez defaultu; semantycznie właściwa. |
| Billing | `server/migrations/000_z_core_baseline.sql:43` | `organizations.billing_currency` ma `DEFAULT 'USD'`, ale jest walutą rozliczenia SaaS — nie wolno jej użyć do wyceny. |
| Projekt | `server/migrations/000_z_core_baseline.sql:184` i brak `project_id` w tabelach finance_v3 | Pole istnieje, ale nie ma ścieżki JOIN z artefaktu wyceny. |
| Żywy PG | `SELECT ... organizations LEFT JOIN organization_profiles` | 1 organizacja, 0 profili z walutą, 1 wynik bez waluty. |

Wniosek: dana istnieje, ale na świeżej bazie jest pusta. Kontrakt może zwracać wyłącznie nullable `organization_profiles.currency`; dla braku ekran nie pokazuje ani placeholdera waluty, ani fallbacku USD/PLN.

### R1(d) Jednostka wskaźnika Analizy

| Warstwa | Plik:linia / pomiar | Wniosek |
|---|---|---|
| Baza | `server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql:57-64` | `finance_analysis_kpi_catalog.unit_type` jest `NOT NULL` i ma zamknięty CHECK. |
| Trasa | `server/src/routes/v8/finance-v2/analysis.routes.ts:143-160` | `unitType`, waluty i skala są mapowane do odpowiedzi. |
| DTO | `src/services/api/financeV2.types.ts:743-762` | `AnalysisKpiValueDto` niesie wszystkie metadane jednostki. |
| Urwanie | `src/services/api/financeV2.types.ts:104-116`; `analysisKpiTable.contract.ts:188-197`; `AnalysisKpiDetailCard.tsx:78,130` | Wspólny formatter przyjmuje tylko status i liczbę, więc odrzuca metadane tuż przed prezentacją. |
| Żywy PG | `information_schema.columns` | `unit_type` istnieje i jest `NOT NULL`; nie jest kolumną nullable w wartościach. |

Wniosek: dana istnieje i jest kontraktowo wypełniona. Defekt leży wyłącznie w prezentacji frontu.

## Migracje i protokół zerowej wysyłki

- Pierwszy przebieg migracji: `Applying migrations: 869`, `Postgres migrations complete`.
- Drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`.
- Środowisko: `BRAK ZMIENNYCH POCZTY`.
- `settings WHERE key LIKE 'smtp%'`: `0 rows`.
- `Gateway.ts` nie zawiera startu drenaży outboxu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Osiągalność kanonicznego runtime ekranowego i zrzuty: niezmierzone. Realna ścieżka HTTP została zmierzona dla `GET /api/vnext/results/kpi/scorecards/:scorecardId/items`; test waluty mierzy serwis i surowy SQL, a test jednostki mierzy surowy SQL i dokładnie ten sam formatter frontu. Nie przedstawiam ich jako pełnego runtime browserowego Wyceny/Analizy.
- `getKpi` w `kpiRepository.ts:141-174` zwraca `name: null`; obserwacja poza licencją, bez naprawy.
- Kolumna „Proces” w `ResultsKpiRegistryPage.tsx` pokazuje identyfikator, a `primary_process_id` nie ma FK; obserwacja poza licencją, bez naprawy.

## R2 — nazwa KPI i nazwy osób

- `listScorecardItems` łączy pozycję z `rvn_kpi_definitions`, bieżącą `rvn_kpi_definition_versions` i użytkownikiem dodającym. Zwraca nullable `kpiName` i `addedByName` bez usuwania ID.
- Listy scorecardów wystawiają nullable `ownerName`; odczyty migawek wystawiają nullable `createdByName` i `publishedByName`.
- Prezenter pokazuje nazwę, a dla `null` zachowuje istniejący skrócony ID. `scopeId`, pole `KPI ID` i `contentHash` pozostały identyfikatorami.
- Realny `ApiGateway` + podpisany JWT + RealPG: `GET .../items` zwrócił `kpiName = "Efektywność całkowita urządzeń"` i `addedByName = "Piotr Kontraktowy"`; surowy SQL zwrócił tę samą nazwę dla tego samego `kpi_id`.

## R3 — waluta Wyceny

- `loadValuationCurrency` czyta wyłącznie nullable `organization_profiles.currency` i normalizuje pusty string do `null`.
- `ValuationResultsDto.currency` przechodzi przez endpoint wyników i stan workspace.
- Nagłówek EV, przedział metod, tabela wyników, tabela wag i komórki sensitivity dopisują kod waluty tylko przy wartości niepustej. Brak waluty nie renderuje placeholdera ani fallbacku.
- Surowy SQL oraz serwis potwierdziły `null` przed wstawieniem profilu i `PLN` po wstawieniu profilu. `organizations.billing_currency` nie jest czytana przez nowy kod.

## R4 — jednostka Analizy

- Dodano osobny `formatAnalysisKpiValueForDisplay`; wspólny `formatFinanceValueForDisplay` ma niezmienione ciało.
- Mapowanie: `PERCENT` mnoży przez 100 i dopisuje `%`; `MULTIPLE` dopisuje `×`; `DAYS` dopisuje `dni`; `MONETARY` używa `presentationCurrency` i istniejącego `financeUnitLabel`; `RATIO`/`COUNT` pozostają bez sufiksu.
- Tabela, okresy i karta szczegółowa używają nowej funkcji. Surowy PG potwierdził `unit_type='PERCENT'`, a formatter zwrócił `12%` dla `0.12`.

## Dowody testowe i pułapki środowiska

Konfiguracja RealPG: `server/vitest.config.ts` uruchomiona z katalogu `server/`; plik w linii 17 używa `DB_TYPE: process.env.DB_TYPE || 'sqlite'`. Komenda jawnie ustawiła w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6069/cx171 JWT_SECRET=...` oraz `--retry=0`. Pierwszy test asertuje `process.env.DB_TYPE === 'postgres'`, strażnik RealPG działa bez argumentów, a odczyt celu dał `{ database: 'cx171', port: 5432 }` wewnątrz kontenera.

Pułapki `Z33`: V8 zostało jawnie włączone, auth bypass jawnie wyłączony, beta visibility wymuszona, mock DB wyłączony, retry wyłączone. Test montuje `ApiGateway.getInstance().initializeRoutes(app)`, nie goły router. Proces nie uruchamia `server/src/index.ts` ani drenaży.

Wyniki według pełnych nazw przypadków:

- `day171.data-contracts.pg.test.ts`: 3/3 PASS, 0 fail.
- `kpiScorecard.routes.test.ts`: 27/27 PASS, 0 fail, z właściwym `server/vitest.config.ts` i ścieżką względem katalogu `server/`.
- Pakiet frontowy (`financeV2.types`, tabela Analizy, workspace Wyceny): 53/55 PASS. Dwa nazwane RED-y są istniejącymi asercjami starego defektu: oczekują `0,35` i `0,4`, a po poprawce otrzymują `35%` i `40%`. Plik `src/components/Finance/Analysis/__tests__/analysisKpiTable.contract.test.ts` nie jest licencjonowany do zapisu; nie zmieniłem go. `financeV2.types.test.ts` przeszedł bez modyfikacji, a `ValuationWorkspace.test.tsx` przeszedł.
- Pełny `tsc --noEmit`: FAIL na setkach zastanych błędów poza zakresem (m.in. `TS7030` w wielu trasach, błędy w `Initiatives/**`, `MyWork/**`). Pierwszy przebieg bez zwiększonego heapu zakończył się OOM; drugi z `NODE_OPTIONS=--max-old-space-size=8192` ujawnił zastany denominator. Nie zmieniałem tych plików.

Instrukcja odwołuje się do `§0.4a`, ale wydany dokument nie zawiera takiej sekcji. Zamiast przepisywać cudzą liczbę podaję własny, jawny denominator uruchomionych pakietów powyżej oraz listę plików z `git diff --name-only 514c60b355..HEAD` po commitach.

## Dowód mutacyjny

Każda mutacja została wykonana na kodzie produkcyjnym po kopii do `/private/tmp/cx-day171-kontrakty-danych-scratch`, uruchomiona z `--retry=0`, a następnie cofnięta przez `cp`:

1. `PERCENT`: usunięcie mnożenia przez 100 zapaliło przypadek „renders 0.12 as 12%” z wynikiem `0,12%` zamiast `12%`.
2. Nazwa KPI: zastąpienie `dv.name AS kpi_name` przez `NULL` zapaliło przypadek realnego `GET scorecard items`.
3. Waluta: wymuszenie `loadValuationCurrency => null` zapaliło oczekiwanie `PLN`.

Po przywróceniu finalny RealPG ponownie dał 3/3 PASS. `git diff --check` jest czysty.

Artefakty poza repo i SHA-256:

- `/private/tmp/cx-day171-kontrakty-danych-artefakty/day171-realpg-final.json` — `438f8d616e0a9c2ffa5ab4c8457410560cc5c82841879fb18c9f00bff89d9c1c`
- `/private/tmp/cx-day171-kontrakty-danych-artefakty/day171-mutation-kpi-red.json` — `b3430d6edf2a4c4b783068ecb15f459313262c2e0fa0d7bd7a99f3a8d73dc3b4`
- `/private/tmp/cx-day171-kontrakty-danych-artefakty/day171-mutation-currency-red.json` — `5828f4993147cb72940ff581d35768c4534c1e18545cff5b087540b503ca3c55`
- `/private/tmp/cx-day171-kontrakty-danych-artefakty/day171-mutation-percent-red.json` — `917e3a9bac1c05803227be9fd12a0031d7a56a55a762217f1502e3751a59e072`
- `/private/tmp/cx-day171-kontrakty-danych-artefakty/day171-scorecard-unit.json` — `7269c0d7641c52a3f843aa36080982333e85a6f6301dea87c403baf20a7f2046`
- `/private/tmp/cx-day171-kontrakty-danych-artefakty/day171-unit.json` — `dd93bbc57b9c59f000d482710d588fc9ebc9d3c8e4f453a03ac92ff0a593b38c`

## Stan odbioru

- R2: `PARTIAL` — pozycja itemu jest zweryfikowana przez RealPG + realny ApiGateway + surowy SQL i mutację red/green; JOIN-y `ownerName` oraz nazw twórcy/publikującego migawkę nie mają osobnego runtime readbacku.
- R3: `PARTIAL` — źródło, DTO, przepływ propsów i komponenty są wdrożone; RealPG/SQL oraz mutacja są zielone, ale brak kanonicznego runtime browserowego i zrzutów trzech ekranów.
- R4: `PARTIAL` — kontrakt PG, formatter oraz mutacja są zielone; brak kanonicznego runtime browserowego i istniejące, nielicencjonowane asercje starego zachowania pozostają czerwone.

Pierwszy commit kodu i testu: `5c188d42b2` (`fix(day171): carry KPI names currency and units`). Został wypchnięty natychmiast po utworzeniu na `github-backup/codex/day171-kontrakty-danych-20260830`.

Pliki produkcyjne/testowe dotknięte względem markera:

```text
server/src/routes/__tests__/day171.data-contracts.pg.test.ts
server/src/routes/v8/finance-v2/valuation.routes.ts
server/src/services/finance/canonical/valuationAdvisorService.ts
server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts
server/src/services/resultsVnext/kpi/kpiScorecardTypes.ts
src/components/Finance/Analysis/AnalysisKpiDetailCard.tsx
src/components/Finance/Analysis/analysisKpiTable.contract.ts
src/components/Finance/Valuation/ValuationWorkspace.tsx
src/components/Finance/Valuation/steps/MethodsWeightsStep.tsx
src/components/Finance/Valuation/steps/ResultsStep.tsx
src/components/Finance/Valuation/steps/SensitivityStep.tsx
src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts
src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters.tsx
src/services/api/financeV2.types.ts
```
