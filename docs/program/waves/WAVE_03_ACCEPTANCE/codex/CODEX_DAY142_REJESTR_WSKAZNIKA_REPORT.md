# CODEX DAY 142 — rejestr wskaźnika

Data pomiaru: 2026-08-30  
Marker: `251ca29e53`  
Gałąź: `codex/day142-rejestr-wskaznika-20260830`  
Werdykt: **R1–R4 ZMIERZONE; zero zmian produktu i zero migracji.**

## Stan wejściowy

### §0.1-BIS

```text
$ git merge-base --is-ancestor 251ca29e53 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
(brak wyjścia)
$ git branch --show-current
codex/day142-rejestr-wskaznika-20260830
$ ls -la node_modules
lrwxr-xr-x ... node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    24Gi    34%   /
$ lsof -nP -iTCP:{6028,4950,4951} -sTCP:LISTEN
PORT 6028 WOLNY
PORT 4950 WOLNY
PORT 4951 WOLNY
```

### T1–T4 — komendy obowiązkowe

```text
$ grep -rhoE "CREATE TABLE (IF NOT EXISTS )?[a-z_]*kpi[a-z_]*" server/migrations/*.sql | sort -u
42 unikalne nazwy tabel zawierające `kpi` (surowy wynik; nie wszystkie są rejestrami definicji).

$ grep -n "initiative_kpis" -B3 -A6 server/migrations/*rvn_kpi_initiative_impacts* | head -20
4:-- verbatim. Legacy `initiative_kpis` (SQLite-flavored, different engine
5--- entirely) is NOT reused — confirmed not-applicable, only `initiatives.id`

$ grep -rniE "closure|close|archive" server/src/services/initiative/ --include='*.ts' | grep -i kpi | head -8
initiativeKpiAssignmentService.ts:1027: "delete" ... is ARCHIVE, not a hard delete
initiativeKpiAssignmentService.ts:1033: await archiveDefinition(...)

$ grep -rnE "kpi" src/components/Benefits/*.tsx | grep -iE "fetch|api\.|use[A-Z]" | head -10
BenefitsHub.tsx:199 Api.get(`/initiatives/${i.id}/kpis`)
FinancialMappingPanel.tsx:102 Api.get('/benefits/financial/kpi-mappings')
FinancialMappingPanel.tsx:103 Api.get('/benefits/kpi-mappings')
FinancialMappingPanel.tsx:176 Api.get(`/benefits/financial/impact/${kpiId}`)
```

T3 z grepu nie rozstrzyga zamknięcia inicjatywy: trafienie dotyczy jawnego archiwizowania definicji KPI, nie przejścia statusu inicjatywy. Rozstrzygnięciem jest R2 na realnym PG.

### Baza i bezpieczeństwo Z30

`cx-day142-pg`, `pgvector/pgvector:pg16`, host `127.0.0.1:6028`, baza `cx142`.

```text
Pierwszy przebieg migracji: exit 0, "Postgres migrations complete"
Drugi przebieg migracji: exit 0, "Applying migrations: 0"
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)"
BRAK ZMIENNYCH POCZTY
SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';
(0 rows)
grep ...outbox... server/src/Gateway.ts
(0 trafień)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

1. T1 „co najmniej siedem” jest potwierdzone, lecz surowe 42 tabele to liczba zawyżona funkcjonalnie: obejmuje pomiary, akcje, mapowania, polityki, snapshoty i historię. Po zastosowaniu definicji „fizyczny rejestr/katalog definicji KPI z własnym identyfikatorem” wynik wynosi **8**.
2. Widok `kpis` nie jest dodatkowym magazynem: jest read-only compatibility view nad `initiative_kpis` (opis i zapytania: `kpiLegacyArchiveRepository.ts:78-110`).
3. T3 nie pozostaje nieznane: realny pomiar R2 wykazał przeżycie KPI po kanonicznym zamknięciu.
4. `B8` jest w instrukcji wpisane dwukrotnie; spełniam warunek jednokrotnie.
5. `Z24` odsyła do nieistniejącego §0.4a; zgodnie z §0.1-BIS odwołanie pominięto.
6. Konflikt `Z34a` („push”) z końcowym „Nie pushujesz” rozstrzyga §0.1-BIS: **nie pushowano**.

## R1 — wszystkie fizyczne rejestry definicji KPI

Komenda odkrycia każdego wiersza: `rg -n "CREATE TABLE( IF NOT EXISTS)? <tabela>\\b" server/migrations/*.sql`; tożsamość i linki potwierdzono zapytaniem do `information_schema.columns` na realnym PG. Wynik: **8**.

| # | Rejestr i migracja tworząca | Co przechowuje | Pisarz / czytelnik (przykłady) | Link do inicjatywy | Własna tożsamość |
|---|---|---|---|---|---|
| 1 | `initiative_kpis`; `061_initiative_lifecycle.sql:32` (także definicje naprawcze 565/727) | bieżąca definicja, cel, wartość, progi, status, widoczność | write `kpiDefinitionService.ts:344,498`; read `benefits.routes.ts:125,339`, `BenefitsHub.tsx:199` przez `/initiatives/:id/kpis` | nullable `initiative_id`; FK `ON DELETE CASCADE` | **tak**, `id`; od 20260802 link jest nullable, lecz fizyczne usunięcie inicjatywy nadal kasuje podpięty KPI |
| 2 | `project_kpis`; `063_project_kpis.sql:5` | KPI raportowania projektu | write `demoSeedService.ts:3910`; read `ManagementReportRepository.ts:655` | brak `initiative_id`, ma `project_id` | **tak**, `id` |
| 3 | `rollout_kpis`; `20260608_rollout_tables.sql:19` | KPI rolloutów/projektów | write/read `rollout.routes.ts:97,116,152`; read `executiveAggregateService.ts:933` | brak, ma opcjonalny `project_id` | **tak**, `id` |
| 4 | `kpi_definitions`; `262_benefits_tracking.sql:8` | legacy katalog definicji raportowych | brak znalezionego live writera; read `results-kpi-reports.routes.ts:135`, archive `kpiLegacyArchiveRepository.ts:162` | brak | **tak**, `id` |
| 5 | `v8_kpi_definitions`; `20260323_v8_results_roi.sql:13` | V8 Results/ROI, wartości i cadence | write `resultsROIService.ts:324,395`; liczne reads w tym `:356,803,841` | opcjonalny `initiative_id`; także `canonical_kpi_id` → `initiative_kpis` | **tak**, `kpi_id` |
| 6 | `tp_kpi_definitions`; `713_governed_models.sql:16` | KPI Table Platform / governed model | write `GovernedModelService.ts:193`; read `:69,210,227` | brak; należy do `model_id` | **tak**, `kpi_id`; domena zewnętrzna wobec Results |
| 7 | `rvn_kpi_definitions`; `20260810_rvn_kpi_core.sql:50` | Results vNext: root KPI, wersja, owner, policy | write `kpiDefinitionCommands.ts:386,429`; read `kpiRepository.ts:123,156,225` | **brak w root**; historyczny link w `rvn_kpi_initiative_impacts` | **tak**, `kpi_id` |
| 8 | `finance_analysis_kpi_catalog`; `20260809_finance_v3_d03_analysis_01_tables.sql:39` | wersjonowany katalog formuł KPI finansowych | seed/migracje; read `kpiComputeService.ts:264,314,371`, `financeExportService.ts:189` | brak | **tak**, `id`; domena finansowa |

Tabele `*_measurements`, `*_values`, `*_time_series`, mappings, scorecards, recovery/deviation/actions/policies/history/snapshots nie są osobnymi rejestrami definicji; są magazynami zależnymi od jednego z powyższych rootów. `kpis` jest widokiem, a `z139_backup_919_initiative_kpis` artefaktem backupowym, nie aktywnym rejestrem produktu.

### T4 — co czyta ekran Wyników

`BenefitsHub` czyta `/initiatives/:id/kpis`, którego backend czyta `initiative_kpis`. `KPIAttributionPanel` i `FinancialMappingPanel` czytają `/benefits/kpi-mappings` oraz `/benefits/financial/kpi-mappings`; backend łączy mapowania z `initiative_kpis` (`benefits.routes.ts:125,339,448`). W przejrzanych komponentach `src/components/Benefits/*.tsx` nie znaleziono bezpośredniego konsumenta pozostałych siedmiu rootów. Ekran Wyników nie jest więc dziś ekranem jednego wspólnego rejestru; jego aktywnym rootem jest `initiative_kpis` plus zależne mapowania.

## R2 — KPI a zamknięcie inicjatywy

Test: `server/src/routes/__tests__/day142.initiative-kpi-survival.pg.test.ts`.

Ścieżka: podpisany JWT → realny `ApiGateway.getInstance().initializeRoutes(app)` → `verifyToken` → `PATCH /api/initiatives/:id/status` → `InitiativeController.updateInitiativeStatus` → `executeInitiativeTransition` → realny PostgreSQL.

```text
DAY142_SELECT_BEFORE [{"initiative_status":"EXECUTING","kpi_id":"6ab04d6d-7c29-47e8-a99d-14dff72bdbbb","initiative_id":"acc3e872-d31f-4be8-b9a1-eed63b45cccb","current_value":40,"target_value":100,"unit":"percent","archived_at":null}]
DAY142_HTTP_CLOSE 200 {"id":"acc3e872-d31f-4be8-b9a1-eed63b45cccb","status":"DONE","previousStatus":"EXECUTING","gate":"COMPLETE","message":"Status updated"}
DAY142_SELECT_AFTER [{"initiative_status":"DONE","kpi_id":"6ab04d6d-7c29-47e8-a99d-14dff72bdbbb","initiative_id":"acc3e872-d31f-4be8-b9a1-eed63b45cccb","current_value":40,"target_value":100,"unit":"percent","archived_at":null}]
Test Files 1 passed (1); Tests 1 passed (1); retry=0
```

**Jednoznaczny wynik: wskaźnik przeżywa kanoniczne zamknięcie inicjatywy `EXECUTING→DONE`; nadal istnieje, nie jest zarchiwizowany, pozostaje widoczny w org-scoped SELECT i zachowuje wartości potrzebne do pomiaru.** Zamknięcie zmienia status inicjatywy, nie usuwa rekordu. Osobne fizyczne usunięcie inicjatywy pozostaje ryzykiem, bo FK `initiative_kpis.initiative_id` ma `ON DELETE CASCADE`.

Fixture jawnie spełniał timeline oraz immutable approved `CLOSURE` decision. Dwa wcześniejsze przebiegi ujawniły kolejno drift nazwy `frequency`→`measurement_frequency` i poprawne fail-closed bramki `GATE_BLOCKED`/`CLOSURE_GATE_DECISION_REQUIRED`; nie zaliczono ich jako dowodu R2.

## R3 — projekt drogi do jednego rejestru (bez wykonania)

Rekomendowany docelowy root: `rvn_kpi_definitions.kpi_id`, ponieważ już modeluje KPI niezależnie, a związek historyczny z inicjatywą jest osobnym `rvn_kpi_initiative_impacts`. To najlepiej odpowiada `DEC-2026-08-30-01`. Dzisiejszym runtime SSOT ekranu Benefits pozostaje jednak `initiative_kpis`; cutover bez pomiaru konsumentów byłby niebezpieczny.

1. Nadać każdemu źródłowemu KPI stabilny canonical key i tabelę crosswalk (`source_system`, `source_id`, `canonical_kpi_id`) z unikalnością per tenant. Ryzyko: kolizje semantyczne przy podobnych nazwach/jednostkach; zakaz automatycznego scalania po nazwie.
2. Sklasyfikować rooty: `rvn_kpi_definitions` jako przyszły SSOT Results; `initiative_kpis`, `v8_kpi_definitions`, `kpi_definitions` jako źródła migracji/compatibility; `project_kpis` i `rollout_kpis` jako konteksty/linki; `tp_*` i finance catalog pozostawić domenowo odrębne, chyba że właściciel jawnie zdecyduje o federacji. Ryzyko: utrata semantyki domenowej.
3. Najpierw backfill tylko-additive z readbackiem liczebności, wersji, jednostek, ownerów, widoczności i tenantów; następnie shadow-read porównujący rekord po rekordzie. Ryzyko: cicha utrata danych przy JSON/TEXT i różne enumy cadence/status.
4. Przepiąć Benefits na jeden read model z `rvn_kpi_definitions` + wersja + latest measurement + historyczne impacts; utrzymać stary odczyt jako mierzoną kontrolę do czasu owner acceptance. Ryzyko: rozjazd filtrów widoczności i pozorne zniknięcie KPI.
5. Dopiero po stabilnym okresie zatrzymać legacy writers; nie stosować trwałego dual-write. Stare tabele najpierw read-only archive/view, usunięcie dopiero po osobnej decyzji i dowodzie rollbacku. Ryzyko: odwracalność oraz konsumenci spoza `Benefits`.
6. Przed fizycznym rozłączaniem zmienić semantykę usuwania inicjatywy: historyczny link nie może mieć cascade kasującego KPI. To wymaga osobnej migracji i decyzji; w tym dyżurze niczego nie zmieniono.

## R4 — tożsamość wskaźnika

W kluczowych rootach identyfikator KPI jest własny (`id`/`kpi_id`), a nie wyprowadzony z identyfikatora inicjatywy. Najczystszy model ma `rvn_kpi_definitions`: root nie zawiera `initiative_id`, a relacja jest w `rvn_kpi_initiative_impacts`. `initiative_kpis` także ma własne `id` i nullable `initiative_id`, lecz istniejący FK cascade nadal wiąże cykl życia przy fizycznym DELETE. `v8_kpi_definitions` ma własne `kpi_id`, opcjonalne `initiative_id` i most `canonical_kpi_id`. Koszt fazy to zatem głównie crosswalk, zachowanie wersji/pomiarów/widoczności i cutover konsumentów — nie wymyślenie identyfikatora od zera.

## W-A — dowód mutacyjny

Nie było pozycji naprawczej ani zmiany produktu, więc W-A nie ma zastosowania. Test R2 jest pomiarem zachowania istniejącego kodu, nie roszczeniem `FIXED`/`VERIFIED` dla naprawy. Nie wykonywano mutacji produktu.

## W-C — pomiar różnicowy

Cel `initiativeTransitionService.closureGate.test.ts` jest identyczny z markerem (`git diff --quiet 251ca29e53 -- <plik>` → `WC_TARGET_IDENTICAL_TO_MARKER=YES`). Dwa przebiegi tej samej komendy, `RUN_DB_TESTS=0 MOCK_DB=true`, external config, `--retry=0`, dały te same cztery pełne nazwy i status `passed`: brak decyzji Closure, nieukończony milestone, nieukończony task, caller-pinned client. Różnica nazw/statusów: **0**; porażki marker/current: **0/0**.

## Pułapki (a)–(e)

- (a) `ENABLE_V8_GLOBAL=true` — brak fałszywego 404 przed auth.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` — strażnik nie przepuszczał z powodu `NODE_ENV=test`.
- (c) `DB_TYPE=postgres` potwierdzone pierwszą asercją testu i logiem `DB_IDENTITY ... 127.0.0.1:6028/cx142`; użyto configu poza repo bez przypięcia SQLite.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; podpisany JWT przeszedł przez realny Gateway/verifyToken.
- (e) liczbę rejestrów zmierzono samodzielnie; komentarz migracji potwierdził brak reuse `initiative_kpis`.
- `--retry=0`; JSON pokazuje 1 test wykonany i 0 pending/skipped.

## Artefakty i SHA-256

```text
424c3193711e57ccad3d3ad640d60a62c18e4419ca7064a7c9772b7c227935ca  migrate-1.log
bfbe47461c6c8496f02fe0151ce39634301c7349b69a25ee3ee45718f0196b64  migrate-2.log
7b188f874bf3182ad92680fb7e338d51ba3be3a6d2e1d4811a0cac4f1863126d  day142-r2-vitest.log
633f592b527a3cdd770093d10880dfddf75af2d8e50dd8ebb395da54b15bccc9  day142-r2-vitest.json
dbfdca0d6844a7b8463bf543c14bf6c7396946dc7aba5251dceeb3c40263d699  wc-marker.json
a2e8a797a509b4a4a441f41485dc2682d25cbcb48e71b98d0ef38e578371dffd  wc-current.json
95f4bb9c948e8543b6aeecfaac54ea1fce777c108c927f55df3c73fa029bd205  vitest.day142.config.ts
```

Katalog: `/private/tmp/cx-day142-rejestr-wskaznika-artefakty`.

## W-D — granica rozłączności

Oczekiwane pliki względem markera:

```text
server/src/routes/__tests__/day142.initiative-kpi-survival.pg.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY142_REJESTR_WSKAZNIKA_REPORT.md
```

Oba są w tabeli licencji. Zero migracji i zero zmian produktu. Nie pushowano.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie zmierzono produkcji, demo, stagingu ani Railway — zakaz Z8/Z28; wyniki dotyczą markera i efemerycznej bazy po pełnych migracjach.
2. Nie udowodniono, że wszystkie UI/serwisy poza `src/components/Benefits` i wskazanymi backendami da się bez regresji przepiąć na `rvn_kpi_definitions`.
3. Nie zmierzono danych rzeczywistych ani jakości automatycznego deduplikowania ośmiu rejestrów; bez danych ownera nie wolno scalać semantycznie podobnych KPI.
4. Nie wykonano fizycznego DELETE inicjatywy; ze schematu wynika `ON DELETE CASCADE` dla `initiative_kpis`, ale nie jest to kanoniczne zamknięcie mierzone w R2.
5. Nie rozstrzygnięto produktowo, czy `finance_analysis_kpi_catalog` i `tp_kpi_definitions` mają wejść do wspólnego Results registry, czy pozostać federowanymi domenami. Rekomendacja: pozostać odrębne do jawnej decyzji właściciela.
