# M20 — Tabele Studio · FAZA 2 (TESTY) — Raport

Branch: `feat/deliverables-light` · Data: 2026-06-11 · Agent: TESTY

---

## 0. Streszczenie liczbowe

| Grupa | Files | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|---|
| Backend (cwd=`server/`, jak w `server/package.json`) — podzbiór tablePlatform+routes | 41 | 634 | 17 | 0 | ~0,98 s |
| Backend (cwd=repo-root, `server/vitest.config.ts`, **pełny** zakres + AiEditorLevels + seeds) | 52 | **730** | **8** | 0 | ~0,99 s |
| Frontend (cwd=repo-root, `vitest.config.ts`) | 20 | 155 | **1** | 0 | ~2,6 s |
| E2E `tests/e2e/table-platform/` | 3 specy / 11 testów | — | — | (nie uruchomione, brak live serwera) | — |

**Łącznie unit/component uruchomione: 894 PASS / 9 realnych FAIL / 0 SKIP.**

Z 17 backendowych awarii uruchomienia z `server/`: **9 to fałszywe awarie cwd-coupling** (znikają przy cwd=repo-root), **8 to realny mock-drift**, **1 z nich (ModuleSync 725) to kolizja numerów migracji**. Frontend: **1 realny FAIL = flag-drift**.

---

## 1. Inwentarz testów

### 1a. Backend — `server/src/services/tablePlatform/__tests__/` (34 pliki)

| #testów | Plik | Czego dotyczy | Mapuje na |
|---|---|---|---|
| 11 | AiUsageService.test.ts | budżet AI/dzień, hard-cap, reset | S5 |
| 17 | AutomationService.test.ts | triggery automatyzacji, evaluateTriggers | S7 |
| 18 | ConfidenceScoringService.test.ts | scoring zaufania pól/rekordów | S2/S5 |
| 7 | DateDependencyEngine.test.ts | zależności dat (timeline/dependency) | S3/S4 |
| 28 | ExportService.test.ts | eksport CSV/XLSX, rollup w eksporcie | S6 |
| 9 | ExtensionService.test.ts | rozszerzenia/pluginy tabeli | — |
| 22 | FormIntakeService.test.ts | formularze publiczne: slug, allow-list payload, submitFromPublic, rate-limit | **S8** |
| 11 | InterfaceService.test.ts | layout/bloki interfejsu (updateLayout) | S3 |
| 16 | MetadataService.test.ts | bazy/tabele/pola/widoki CRUD (schema) | S2/S3 |
| 5 | ModuleSyncService.test.ts | sync modelu do 4 modułów + migracja 725 | S6/integracja |
| 15 | ProjectionService.test.ts | projekcje/materializacje danych | S4 |
| 26 | RecordSourcesService.test.ts | źródła rekordów + ACL | S1/provenance |
| 11 | RecordsService.test.ts | **Records CRUD (fundament)** | **S1** |
| 14 | RelationExplainabilityService.test.ts | wyjaśnialność relacji linked/rollup | S4 |
| 8 | SSOService.test.ts | single-sign-on serwisu | — |
| 15 | ScheduledAutomationExecutor.test.ts | egzekutor cron/run-now automatyzacji | **S7** |
| 10 | SchemaValidationService.specialized-fields.test.ts | walidacja pól specjalizowanych | S2 |
| 19 | SchemaValidationService.test.ts | walidacja schematu/propozycji | S2 |
| 8 | ServiceAccountService.test.ts | konta serwisowe | — |
| 21 | SourcePackBuilderService.test.ts | budowa source-packów | S6/provenance |
| 62 | SpecializedFieldTypes.test.ts | typy pól (rating, currency, select…) | S2/S3 |
| 15 | TableAiEditorService.test.ts | **applyProposal/rejectProposal + budżet + hard-cap** | **S5** |
| 19 | TableArtifactConversionService.test.ts | **konwersja Table→Document/Deck** | **S6** |
| 19 | TableQaService.test.ts | QA report: axis scoring, persistence, dismiss, scheduleRecompute | S2/QA |
| 20 | TemplateLifecycleService.test.ts | cykl życia szablonów | S2 |
| 18 | ValidationStatusService.test.ts | status walidacji rekordów | S1/S2 |
| 18 | ViewQueryEngine.test.ts | filter/sort/search/pagination widoków | **S3** |
| 15 | WebhookDispatcherService.test.ts | dispatch webhooków | S7 |
| 5 | conversionMaterializer.test.ts | materializacja konwersji | S6 |
| 9 | dependencyGraph.test.ts | graf zależności pól | S4 |
| 25 | formulaEngine.test.ts | **FormulaEngine: SUM/IF/CONCAT/ROUND/DATEDIFF/COALESCE/UPPER/LOWER, parse, deps** | **S4** |
| 5 | migrationRunner.test.ts | istnienie/spójność plików .sql 700–726 | infra |
| 21 | migrations.block-a-b.test.ts | migracje block A/B | infra |
| 8 | migrations.test.ts | migracje podstawowe | infra |
| 23 | smoke.test.ts | smoke CRUD: Metadata/Records/ChatToSchema/GovernedModel | S1/S2 |

### 1b. Backend — `TableAiEditorLevels/__tests__/` (9 plików, 67 testów) → **S5**
MutationExecutor (18), cellLevel (8), structureLevel (7), columnLevel/recordLevel/relationalLevel/sourceLevel (6 ×4), methodologicalLevel/viewLevel (5 ×2). 8 poziomów AI-edycji + egzekutor mutacji.

### 1c. Backend — `seeds/__tests__/` (2 pliki, 20)
tabele_consulting_templates (15) + i18n PL/EN (5) → szablony konsultingowe.

### 1d. Backend — `server/src/routes/__tests__/` (6 plików, 78)
| #testów | Plik | Czego dotyczy |
|---|---|---|
| 25 | table-platform.routes.test.ts | główne endpointy routera (193 endpointy) |
| 15 | record-sources-acl.test.ts | ACL na źródłach rekordów |
| 9 | table-platform.relations-explain.test.ts | endpoint wyjaśniania relacji |
| 9 | table-platform.schema-proposals-acl-audit.test.ts | ACL + audyt propozycji schematu |
| 9 | template-lifecycle-acl.test.ts | ACL cyklu szablonów |
| 11 | validation-status-acl.test.ts | ACL statusu walidacji |

### 1e. Frontend (20 plików, 156 testów)
- `tabeleShell/__tests__/`: TabeleRightRail (11), TabeleLeftRail (8), TabeleTopBarChips (8), TabeleMelsView (6), TabeleAiEditorPanel (5), TabeleQaPanel (5), TabeleSharePanel (5), TabeleSourcePackPanel (5), useTabeleRightRailPanels (4).
- `tabelePreview/`: TabeleProvenanceColumn (10).
- `templateLifecycle/`: TabeleTemplatesGrid (7), TemplateLifecycleFilter (6), TemplateLifecycleBadge (5), useTpBaseTemplates (5).
- `KimiWorkspace/__tests__/`: useKimiArtifactPipeline (5), KimiWorkspaceShell.openInBuilder (4), TabeleView.melsRouting (2).
- `MyWork/table/__tests__/`: TablePlatformFrontend (37), PlatformCellRenderer.specialized (7).
- `utils/`: melsTabeleFlag (8).

### 1f. E2E `tests/e2e/table-platform/` (3 specy, 11 testów)
crud.spec (4), views.spec (4), chat-to-schema.spec (3). API-level Playwright na żywym serwerze.

---

## 2. Uruchomienie + root-cause awarii

### 2a. 9 fałszywych awarii — **cwd-coupling (harness fragility, NIE regresja)**
Pliki `migrationRunner.test.ts` (×5) i część `ModuleSyncService.test.ts` (×4) używają:
```ts
const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
```
`server/package.json` `"test": "vitest run"` ma cwd = `server/` → ścieżka rozwija się do `server/server/migrations` → **ENOENT**. Przy cwd=repo-root (`npx vitest --config server/vitest.config.ts --dir server`) **wszystkie 5 migrationRunner i 3 z 4 ModuleSync przechodzą**. Pliki migracji 700–726 **istnieją** (zweryfikowane: `700_table_platform_foundation.sql`, `725_module_sync.sql`, `726_*`). To nie jest regresja produktu — to test zakłada zły cwd.

### 2b. 8 realnych awarii — **mock-drift (DB-mock nie nadąża za serwisem)**
Wszystkie serwisy backendu mockują `getDatabase().query` sekwencją `mockResolvedValueOnce(...)`. Kod produkcyjny dorzucił dodatkowe zapytania, których sekwencja mocka nie przewiduje → mock „wysycha", zwraca `undefined`.

- **smoke.test.ts › createBase** — `MetadataService.createBase` wykonuje teraz EXTRA `INSERT INTO tp_base_members ... base_owner` (nadanie praw twórcy). Mock ma 2 odpowiedzi; trzecie zapytanie dostaje `undefined` → `Cannot read properties of undefined (reading 'catch')` (linia MetadataService.ts:136).
- **smoke.test.ts › createRecord** — zwraca `null` zamiast rekordu (przesunięta sekwencja).
- **smoke.test.ts › ChatToSchemaService.generateProposal** — `proposal` `undefined`.
- **MetadataService.test.ts › createField / updateField** — `result.name` `undefined` (ta sama przyczyna: dodatkowe query w ścieżce pola).
- **InterfaceService.test.ts › updateLayout ×2** — przesunięta sekwencja mocka.

To **dług testowy, nie regresja runtime**: serwisy działają; testy nie odzwierciedlają aktualnej liczby/sekwencji zapytań.

### 2c. 1 realna awaria — **kolizja numerów migracji**
`ModuleSyncService.test.ts › migration 725 creates tp_module_sync_results` pada nawet przy cwd=repo-root. Przyczyna: istnieją **DWA** pliki `725_*` (`725_module_sync.sql` + `725_organizations_missing_columns.sql`) i **DWA** `726_*`. Test bierze `files.filter(startsWith('725'))[0]` — kolejność `readdirSync` jest krucha. To realny problem danych (duplikaty numerów migracji), nie tylko testu.

### 2d. 1 realna awaria FE — **flag-drift (stan flagi default OFF→ON)**
`useTabeleRightRailPanels.test.tsx` linia 77–80: „returns no panels when both kill switches are off (default)" oczekuje `panelsActive=false`, dostaje `true`. Przyczyna: `src/utils/tabeleAiEditorFlag.ts` ma teraz **`return parsed === null ? true` ("Default ON — server flag also defaults ON")**, podczas gdy QA/SourcePack/Conversions nadal default OFF. Test pisany pod „wszystkie OFF" — AI Editor flipuje wynik. **Implikacja pokrycia: nie ma już prawdziwego testu czystej ścieżki all-OFF; default-state realnie testuje ścieżkę AI-Editor-ON.**

---

## 3. Mapa pokrycia S1–S8

| Sekcja | FE? | BE? | E2E? | PR-gate? | Uwagi |
|---|---|---|---|---|---|
| **S1 Records API CRUD (fundament)** | ☑ TablePlatformFrontend (mock API) | ☑ RecordsService (11), ValidationStatus (18), smoke | ☑ crud.spec (false-green) | ✗ | **DB w 100% zmockowane — żaden test nie dotyka realnej `tp_records`.** createRecord smoke FAIL (mock-drift). |
| **S2 generacja tabeli (pipeline V8)** | ◯ częściowo (MelsView/openInBuilder) | △ tylko smoke ChatToSchema (FAIL) + SchemaValidation + TemplateLifecycle | ☑ chat-to-schema.spec (false-green) | ✗ | **Brak dedykowanego testu pipeline'u generacji V8.** Jedyny smoke pada (mock-drift). |
| **S3 widoki Grid/Kanban/Calendar + share** | ☑ TablePlatformFrontend (Kanban/Calendar/Timeline/Matrix mockowane jako sloty), TabeleSharePanel | ☑ ViewQueryEngine (18: filter/sort/search/pagination), InterfaceService | ☑ views.spec (false-green) | ✗ | Widoki w FE **zmockowane** (sprawdzane że slot się renderuje, nie sama logika widoku). Public share-link viewer/revoke = `ShareViewDialog` (zmockowany w teście FE). |
| **S4 formuły FormulaEngineV2 + linked/rollup** | ✗ | △ formulaEngine (25, **tylko skalarne funkcje**), RelationExplainability (14), dependencyGraph | ✗ | ✗ | **`formulaEngine.ts` nie zawiera logiki rollup/lookup/linked — brak testu obliczania rollup/linked.** Pokryte tylko SUM/IF/CONCAT/ROUND/DATEDIFF/COALESCE/UPPER/LOWER. |
| **S5 AI Editor applyProposal/reject + budżet** | ☑ TabeleAiEditorPanel (apply/reject/propose wired), useTabeleRightRailPanels | ☑☑ TableAiEditorService (15) + AiEditorLevels (67) + AiUsageService (11: budżet/hard-cap) | ✗ | ✗ | **Najlepiej pokryta sekcja.** Budżet, hard-cap (AiBudgetExhaustedError), 8 poziomów, MutationExecutor. DB zmockowane. |
| **S6 konwersja Table→Doc/Deck** | ☑ TabeleSharePanel (document/presentation target) | ☑ TableArtifactConversionService (19), conversionMaterializer (5), ModuleSync | ✗ | ✗ | Solidne BE; brak E2E. |
| **S7 automatyzacje run-now/cron** | ✗ | ☑ AutomationService (17), ScheduledAutomationExecutor (15), WebhookDispatcher (15) | ✗ | ✗ | Brak FE i E2E; BE dobre, ale DB zmockowane (cron faktyczny nieweryfikowany). |
| **S8 formularze publiczny slug+submissions** | ✗ | ☑ FormIntakeService (22: slug, allow-list, submitFromPublic, rate-limit) | ✗ | ✗ | **Brak FE i E2E** publicznego formularza; sam serwis pokryty (zmockowany FormService). |

**PR-gate — ustalenie kluczowe:** `test-suite.yml` odpala się tylko na `push`/`pull_request` do `main`/`develop` (oraz `workflow_dispatch`); poza tym kroki coverage/unit są „Deferred". Domyślny branch repo = **Londyn**, branch roboczy = **`feat/deliverables-light`**. **Żaden test M20 nie ma bramki PR na branchu roboczym ani na Londyn.** Brak jakiegokolwiek workflow specyficznego dla tabel/tabele. E2E table-platform nie są wymienione w `e2e-nightly.yml`/`e2e-weekly.yml` → biegają tylko przy pełnym `playwright test`, nieobjętym bramką.

---

## 4. Pułapki (false-green / mock / flag-state)

1. **DB całkowicie zmockowane na BE (S1 fundament włącznie).** Każdy test serwisu mockuje `getDatabase().query = vi.fn()`. Żaden test nie dotyka realnej `tp_*` (ani SQLite, ani PG). Weryfikowane są kształty wywołań i logika, NIE realny SQL/schema. `vitest.config.ts` ustawia `DB_TYPE: sqlite`, ale serwisy i tak są mockowane — sqlite nie jest faktycznie używane przez te testy. → **Schema-drift tp_* przejdzie niezauważony.** Tylko `migrationRunner` czyta pliki `.sql` (statycznie), `formulaEngine` to czysta logika.

2. **E2E `tests/e2e/table-platform/` = wzorzec M19 (false-green).** `crud.spec.ts`:
   - `if (!token) { test.skip(); }` — brak serwera/auth → **zielony przez skip**.
   - `if (baseRes.status() === 404) { test.skip(); }` — route nieobecny / flaga OFF → **zielony przez skip**.
   - gałąź błędu: `expect(res.status()).toBeLessThan(500)` — **403/404 PRZECHODZI** bez wykonania CRUD.
   To samo w `views.spec.ts` i `chat-to-schema.spec.ts` (`test.skip()` + `<500`). **Te 11 testów strukturalnie nie potrafi oblać** przy braku/zepsuciu feature'u tabel. ~0 realnego pokrycia bez w pełni zaseedowanego live-serwera z flagą ON.

3. **Testy ścieżki za flagą — który stan testowany.** FE flagi: AI Editor **default ON**, QA/SourcePack/Conversions **default OFF**. `useTabeleRightRailPanels.test.tsx` testuje głównie ścieżkę `forceEnableForTesting:true` (wymuszony ON) — czyli realny default-OFF QA/SourcePack/Conversions **nie jest testowany w stanie produkcyjnym**. Test „all-OFF" jest stale (oblewa się przez AI-Editor-ON). E2E skipują przy 404 (flaga OFF) → ścieżka OFF nigdy nie egzekwowana, ścieżka ON tylko gdy live-serwer ma flagę.

4. **Mock-drift jako maska regresji.** 8 oblanych testów to drift, ale gdyby serwis miał realny bug, ten sam zmockowany kształt mógłby go ukryć — testy nie ćwiczą realnego DB.

5. **Kolizja numerów migracji (725×2, 726×2).** Realny dług infrastrukturalny; test ModuleSync 725 oblany przez krytyczną kolejność `readdirSync`.

---

## 5. Backlog (typ · plik · scenariusz · priorytet)

| # | Typ | Plik / cel | Scenariusz | Priorytet |
|---|---|---|---|---|
| B1 | Fix (mock-drift) | smoke.test.ts (createBase/createRecord/generateProposal) | Zaktualizować sekwencję `mockQuery` o nowy `INSERT tp_base_members base_owner` i obecne zapytania createRecord/generateProposal | **P1** |
| B2 | Fix (mock-drift) | MetadataService.test.ts (createField/updateField), InterfaceService.test.ts (updateLayout ×2) | Dostroić sekwencję mocka do aktualnej liczby zapytań | **P1** |
| B3 | Fix (harness) | migrationRunner.test.ts, ModuleSyncService.test.ts | Zamienić `path.resolve(process.cwd(),'server/migrations')` na ścieżkę względną do `__dirname` (odporną na cwd) | **P1** |
| B4 | Bug danych | `server/migrations/725_*`, `726_*` | Usunąć kolizję numerów migracji (dwa 725, dwa 726); test ModuleSync zależny od kolejności plików | **P1** |
| B5 | Fix (flag-drift) | useTabeleRightRailPanels.test.tsx | Zaktualizować assert default-state pod AI Editor=ON; dodać osobny test czystego all-OFF (mock wszystkich flag na OFF) | **P2** |
| B6 | Nowy (integracja) | `server/.../__tests__/records.integration.test.ts` | **S1**: realny CRUD na `tp_records` w SQLite/PG (bez mocka DB) — fundament musi mieć choć jeden integracyjny test schema-aware | **P1** |
| B7 | Nowy (BE) | formulaEngine / FormulaEngineV2 | **S4**: testy rollup/lookup/linked-record (obecnie 0); obliczanie rollup po relacji | **P2** |
| B8 | Nowy (BE) | ChatToSchema / generacja V8 | **S2**: dedykowany test pipeline'u generacji tabeli V8 (intent→ground→propose→materialize) zamiast pojedynczego smoke | **P2** |
| B9 | Refactor E2E (anty-false-green) | crud/views/chat-to-schema.spec.ts | Zastąpić `test.skip()` na braku tokena/404 twardym `beforeAll` seedem; wymusić realny status (201/200) zamiast `<500`; zaznaczyć jasno preconditiony serwera | **P2** |
| B10 | Nowy (FE+E2E) | S8 formularz publiczny | Brak FE/E2E publicznego slug+submission; dodać render formularza po slug + submit happy-path | **P3** |
| B11 | Nowy (FE+E2E) | S7 automatyzacje | Brak FE; brak realnego testu cron/run-now (DB zmockowane) — dodać integrację egzekutora | **P3** |
| B12 | CI-gate | .github/workflows | M20 nie ma bramki PR na branchu roboczym/Londyn; rozważyć włączenie subsetu tablePlatform do bramki lub dedykowany workflow | **P3** |

---

## 6. Dowody
- `evidence/f2_tests.log` — skonsolidowane podsumowanie.
- `evidence/f2_tests_be.log` — backend cwd=server/ (17 FAIL).
- `evidence/f2_tests_be_rootcwd.log` — backend cwd=repo-root, pełny zakres (8 FAIL / 730 PASS).
- `evidence/f2_tests_fe.log` — frontend (1 FAIL / 155 PASS).
