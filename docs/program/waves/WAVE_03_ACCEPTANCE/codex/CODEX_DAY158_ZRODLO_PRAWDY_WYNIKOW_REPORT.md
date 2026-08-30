# CODEX DAY 158 — źródło prawdy Wyników: crosswalk i shadow-read

Data pomiaru: 2026-08-30. Gałąź: `codex/day158-zrodlo-prawdy-wynikow-20260830`. Marker: `43322a8b31`. Bez pushu.

## Stan wejściowy

```text
$ git merge-base --is-ancestor 43322a8b31 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
<pusto>
$ git branch --show-current
codex/day158-zrodlo-prawdy-wynikow-20260830
$ ls -la node_modules
lrwxr-xr-x ... node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
/dev/disk3s1s1  1.8Ti  12Gi  23Gi  34% ... /
$ lsof -nP -iTCP:6045 -sTCP:LISTEN; lsof -nP -iTCP:4984 -sTCP:LISTEN; lsof -nP -iTCP:4985 -sTCP:LISTEN
<pusto dla wszystkich trzech portów>
```

Stan T1–T4:

```text
$ grep -n "kpis" src/components/Benefits/BenefitsHub.tsx | head -4
179: const [kpis, setKpis] = ...
199: const kpiResponse = await Api.get(`/initiatives/${i.id}/kpis`);
200: return { initiative: i, kpis: extractInitiativeKpiRows(kpiResponse) };
202: return { initiative: i, kpis: [] };
$ grep -n "listInitiativeKpiAssignments\|FROM initiative_kpis" server/src/routes/pmo/initiatives.routes.ts | head -4
<pusto>
$ grep -n "CREATE TABLE" -A18 server/migrations/20260810_rvn_kpi_core.sql | grep -iE "rvn_kpi_definitions|initiative_id" | head -6
50:CREATE TABLE IF NOT EXISTS rvn_kpi_definitions (
112- kpi_id UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
284- kpi_id UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
$ grep -rn "canonical_kpi_id" server/migrations/*.sql | head -4
server/migrations/20260803_res002_kpi_definition_versions.sql:143: ADD COLUMN IF NOT EXISTS canonical_kpi_id TEXT REFERENCES initiative_kpis(id) ON DELETE SET NULL;
server/migrations/20260803_res002_kpi_definition_versions.sql:145: ON v8_kpi_definitions(canonical_kpi_id);
$ grep -rl "initiative_kpis" server/src --include='*.ts' | grep -v __tests__ | wc -l
56
$ grep -rl "rvn_kpi_" server/src --include='*.ts' | grep -v __tests__ | wc -l
36
```

Istniejący most `v8_kpi_definitions.canonical_kpi_id` wskazuje z V8 do `initiative_kpis`, pozostawia historyczne wiersze bez mapowania i nie łączy `initiative_kpis` z `rvn_kpi_definitions`. Day158 dodaje osobną tabelę o przeciwnym celu (`initiative_kpis` → `rvn_kpi_definitions`) i nie zmienia ani nie duplikuje kolumny V8.

## Korekty wobec instrukcji

- T1 oczekiwał trafienia `listInitiativeKpiAssignments`/`FROM initiative_kpis` w `pmo/initiatives.routes.ts`; komenda dała zero trafień. Realny łańcuch to `BenefitsHub.tsx:199` → `pmo/initiatives.routes.ts:3349` → `InitiativeController.ts:3031,3053` → `initiativeKpiAssignmentService.ts:462,552,606`.
- `§0.1-BIS` rozstrzygnął konflikt Z34a z końcowym zakazem: nie wykonano żadnego pushu.
- `§0.1-BIS` uznał odwołanie Z24 do nieistniejącego `§0.4a` za martwe; pominięto je.
- Chroniony `server/vitest.config.ts` ustawia `DB_TYPE=sqlite`; użyto configu poza repo: `/private/tmp/cx-day158-zrodlo-prawdy-wynikow-scratch/vitest.day158.config.ts`, uruchamianego z `server/`. Pierwszy test asertuje efektywne `DB_TYPE=postgres`.

## Z30 — brak wysyłki

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
<pusto>
$ docker exec cx-day158-pg psql -U postgres -d cx158 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — addytywna tabela crosswalk

Commit `38eb275c8f`. Nowa migracja `20260830_day158_kpi_crosswalk.sql` tworzy wyłącznie `kpi_crosswalk` i jej indeksy. Nie ma `ALTER TABLE` istniejącego rejestru. FK `canonical_kpi_id` prowadzi do `rvn_kpi_definitions(kpi_id)` z `ON DELETE RESTRICT`; unikalność ma dokładny klucz `(organization_id, source_system, source_id)`.

```text
Pierwszy przebieg po dodaniu: Applying migrations: 1; → 20260830_day158_kpi_crosswalk.sql; complete
Drugi przebieg: Applying migrations: 0; complete
information_schema/pg_indexes: unikalny indeks kpi_crosswalk_organization_id_source_system_source_id_key
```

## R2 — jawne wypełnienie i readback

Commit `1ed4111088`. `registerConfirmedInitiativeKpiMappings` przyjmuje wyłącznie jawne identyfikatory i podstawę `manual|owner_confirmed`. `INSERT ... SELECT` wymusza istnienie obu rekordów w tej samej organizacji. Nie istnieje wyszukiwanie po nazwie, jednostce ani kodzie. Przypadek testowy zawiera dwa KPI o identycznej nazwie/jednostce, ale bez jawnego potwierdzenia pozostawia drugi rekord bez mapowania.

Surowy odczyt RealPG:

```json
{"sourceSystem":"initiative_kpis","sourceRows":2,"mappedRows":1,"unmappedRows":1,"unmappedReason":"no_confirmed_mapping"}
```

## R3 — shadow-read bez cutoveru

Commit `11efb65deb`. `runInitiativeKpiShadowRead` jest osobnym odczytem; nie jest importowany przez żadną trasę ani kod produkcyjny poza własnym modułem. Porównuje najnowszy pomiar RVN, bieżącą wersję definicji, status i visibility. Legacy nie ma kolumny visibility, więc raportuje `null` jako uczciwe `UNKNOWN`, nie zgaduje wartości.

Surowy wynik RealPG:

```json
{"comparedPairs":1,"matchingPairs":0,"divergentPairs":1,"differences":[{"field":"value","sourceValue":12,"canonicalValue":"11"},{"field":"status","sourceValue":"on_track","canonicalValue":"active"},{"field":"visibility","sourceValue":null,"canonicalValue":"OPEN_ORG"}]}
```

Realny `ApiGateway` + `verifyToken` + podpisany JWT + RealPG: 1/1 test PASS potwierdził bajtowo identyczny JSON `GET /api/initiatives/:id/kpis` przed mapowaniem, po mapowaniu i po shadow-read. Źródło prawdy ekranu nie zostało przełączone.

## R4 — konsumenci obu rodzin

Mianowniki statyczne: 56 plików `server/src` zawiera `initiative_kpis`, 36 zawiera `rvn_kpi_` (bez `__tests__`). Poniżej potwierdzeni realni czytelnicy, nie sama obecność nazwy.

Legacy `initiative_kpis`:

| Caller | Odczyt | Rodzaj |
|---|---|---|
| `GET /api/initiatives/:id/kpis`, `pmo/initiatives.routes.ts:3349` → `InitiativeController.ts:3053` | `initiativeKpiAssignmentService.ts:552,606` | front `BenefitsHub.tsx:199` |
| `GET /:projectId/strategic`, `resultsStrategic.routes.ts:162` | bezpośredni SELECT `:194` | trasa HTTP agregatu strategicznego |
| `GET /api/executive/aggregate`, `executiveAggregate.routes.ts:19,59` | `executiveAggregateService.ts:889` | trasa HTTP ExecutionHub |
| `GET /attribution/:kpiId`, `benefits.routes.ts:1682,1699` | `kpiAttributionService.ts:63` | trasa HTTP Benefits |
| `GET /api/report-builder/:id/entity-links`, `report-builder.routes.ts:5749` | bezpośredni SELECT `:5795` | trasa HTTP Report Builder |
| generator prezentacji przez `presentations.routes.ts:104` | `presentationGeneratorService.ts:1324` | wewnętrzny generator wywoływany z tras prezentacji |

Rodzina `rvn_kpi_*`:

| Caller | Odczyt | Rodzaj |
|---|---|---|
| `GET /api/vnext/results/kpi`, `resultsVnext/kpi.routes.ts:405,417` | `kpiRepository.ts:123` | trasa HTTP VNext KPI |
| `GET /api/vnext/results/kpi/:kpiId/initiative-impacts`, `kpiPerspectives.routes.ts:468,486` | `kpiInitiativeImpactRepository.ts:80,134` | trasa HTTP VNext impacts |
| `GET .../kpi-evidence-links`, `resultsVnext/roi.routes.ts:1532,1542` | `roiEconomicModelRepository.ts:315` przy `hydrateKpiDetails` | trasa HTTP ROI |
| funkcje perspektyw KPI | `kpiPerspectivesRepository.ts:143,162,205,228,244` | repozytorium wewnętrzne wołane przez trasy perspektyw |

## Testy i pułapki (a)–(e)

Komenda finalna miała w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6045/cx158 JWT_SECRET=...`, config poza repo i `--retry=0`.

Wynik JSON: 4/4 przypadki PASS, 0 FAIL, 0 pending. Porównanie odbywa się po pełnych nazwach w `day158-final-vitest.json`.

- Pakiet crosswalk/shadow: (a), (b), (d) nie leżą na ścieżce, bo nie montuje trasy; mimo to env był fail-closed. (c) wyłączone configiem poza repo i asercją `DB_TYPE=postgres`. (e) wyłączone testem identycznej nazwy bez automatycznego mapowania.
- Pakiet HTTP: (a) `ENABLE_V8_GLOBAL=true`; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) config poza repo + asercja; (d) `ENABLE_TEST_AUTH_BYPASS=false` i podpisany JWT; (e) jawny mapping ID→ID, bez heurystyki.

`W-A`: nie ma zastosowania — dyżur buduje addytywny most i pomiar, nie naprawia istniejącego defektu. Nie wpisano `FIXED` ani `ZROBIONE_WG_DoD`.

`W-C`: nie wykonano sztucznego przebiegu nowych testów na markerze, ponieważ oba pliki Day158 i tabela nie istnieją na markerze; taki przebieg mierzyłby brak pakietu, nie regresję. Stan: `EVIDENCE_MISSING` dla pełnego różnicowego korpusu marker-vs-HEAD. Zamiast zawyżać wynik podano finalne pełne nazwy 4 przypadków i 0 pominiętych.

ESLint czterech zmienionych plików TS: PASS (0 błędów).

## W-D — granica zmian

```text
$ git diff --name-only 43322a8b31..HEAD
server/migrations/20260830_day158_kpi_crosswalk.sql
server/src/routes/__tests__/day158.kpi-crosswalk.pg.test.ts
server/src/routes/__tests__/day158.results-source-unchanged.pg.test.ts
server/src/services/resultsVnext/kpi/kpiCrosswalkService.ts
server/src/services/resultsVnext/kpi/kpiShadowReadService.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY158_ZRODLO_PRAWDY_WYNIKOW_REPORT.md
```

Zero zmian w `src/**`, istniejących migracjach KPI, `server/src/services/documentStudio/**`, `server/src/routes/__tests__/day157.*`, globalnych configach testowych, trasach i middleware.

## Artefakty

- `/private/tmp/cx-day158-zrodlo-prawdy-wynikow-artefakty/day158-final-vitest.json` — SHA-256 `436a14c6841c1579ff44680689a6deeff249583ad46e94a1a1c2e7859536bb6f`
- `/private/tmp/cx-day158-zrodlo-prawdy-wynikow-artefakty/day158-http-unchanged-vitest.json` — SHA-256 `cd647335d7a007d2a7551f635c21e176f8205f25c07e884d9849315ea81861a5`
- `/private/tmp/cx-day158-zrodlo-prawdy-wynikow-artefakty/day158-r2-r3-raw-readback.log` — SHA-256 `ff48b3eb3c7890adc0cae399bf599673d9bb2e4ea695d61da240bb534fbf485f`
- `/private/tmp/cx-day158-zrodlo-prawdy-wynikow-artefakty/day158-r1-migration-first.log` — SHA-256 `bef354384e8cd05a985efcb69995f0cca75adb9b535a2be9ad91dd41faa8e528`
- `/private/tmp/cx-day158-zrodlo-prawdy-wynikow-artefakty/day158-r1-migration-second.log` — SHA-256 `fe90b166bbacb0ad0b960ab847604a72611deb212ee454bade81ae0e6667c90c`

## TWIERDZENIA NIEZWERYFIKOWANE

- `EVIDENCE_MISSING`: nie wykonano pełnego korpusu testów całego repo na markerze i HEAD; nie ma twierdzenia o braku wszystkich regresji repozytorium.
- `NOT_PROVEN`: nie badano produkcji, demo, stagingu ani Railway; zakaz Z28 był zachowany.
- `NOT_PROVEN`: nie ma decyzji właściciela ani listy produkcyjnych mapowań. Implementacja celowo pozostawia rekord bez wpisu, dopóki jawne ID→ID nie zostanie dostarczone.
- `UNKNOWN`: semantyczna równoważność statusów `initiative_kpis.status` i `rvn_kpi_definitions.status` nie została założona; shadow-read raportuje surowy rozjazd.
- `UNKNOWN`: legacy `initiative_kpis` nie ma jednolitej kolumny visibility na świeżej bazie; shadow-read raportuje tę stronę jako `null`, bez fabrykowania wartości.
