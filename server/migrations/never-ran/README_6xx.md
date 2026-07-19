# never-ran/ — martwa klasa migracji `6XX_*.sql` (E-MIG6XX)

## Co to jest

96 plików z numerami `600`-`673` (np. `600_model_registry.sql`, `669_v6_seed_system_templates.sql`).
Wiele numerów jest zdublowanych (np. trzy różne pliki `668_*`, trzy `669_*`, dwa `610_*`/`617_*`/
`618_*`/`631_*`/`632_*`/`640_*`/`650_*`-``656_*`) — dowód, że ten zakres numeracji był używany
przez co najmniej dwa równoległe strumienie prac scalone do jednego katalogu.

## Dlaczego są martwe (nigdy się nie odpalają)

Jedyny runner migracji wołany na boot produkcyjnym to `runTablePlatformMigrations()` w
`server/src/database/DatabaseInitializer.ts` (sekcja `TABLE PLATFORM MIGRATION RUNNER`).
Jego wzorzec plików:

```
/^(7\d{2}|\d{8})_.*\.sql$/
```

— wyłącznie `7XX_*` (700-799) albo 8-cyfrowa data. Żaden plik `6XX_*` nigdy nie pasował.
Dodatkowo `readdirSync()` jest nierekursywny, więc podkatalog `never-ran/` jest z definicji
niewidoczny dla runnera niezależnie od nazwy pliku (ta sama podwójna gwarancja co przy
archiwizacji `.sql.sql`, patrz `git log --grep E-SQL-01`).

Wiele z tych plików dodatkowo zawiera dialekt SQLite (`DATETIME`, `INSERT OR IGNORE`,
`json('...')`, `datetime('now', ...)`) — nawet gdyby ktoś naiwnie rozszerzył regex o `6\d{2}`,
surowy `db.query(sql)` w `runTablePlatformMigrations()` (bez warstwy tłumaczenia dialektu,
w przeciwieństwie do `server/scripts/migrate.postgres.ts`) zacząłby wywalać błędy w połowie
katalogu na każdym boot.

## Metodologia audytu (E-MIG6XX, 2026-07-19/20)

Każdy z 96 plików sparsowano (CREATE TABLE + pełna lista kolumn, ALTER TABLE ADD COLUMN,
INSERT INTO) i skrzyżowano z **żywym stanem** bazy demo/staging poprzez lustro parity
(`docker exec consultify-parity-pg18 psql ...` na `:5443` — dump realnej TROLLEY, nie świeży
boot). To dało twardą odpowiedź „czy treść tego pliku faktycznie jest dziś w produkcyjnym
schemacie", niezależnie od tego, którym mechanizmem tam trafiła.

Wynik:

| Kategoria | Liczba obiektów | Status |
|---|---|---|
| Tabele CREATE TABLE (unikalne) | 217 | **216/217 już istnieją live** |
| Kolumny z ALTER TABLE ADD COLUMN | 273 par (tabela,kolumna) | **273/273 już istnieją live** |
| Pełna lista kolumn z CREATE TABLE (wszystkie pola) | 2310 par | 2301/2310 już istnieją live, 9 wyjątków — patrz niżej |

**Wniosek**: te migracje NIE są dziś źródłem masowych brakujących tabel (w przeciwieństwie do
prekursora tej klasy błędu — migracja `238_analytics_module_tables.sql`, `business_metrics` +
7 tabel). Treść trafiła na żywą bazę historycznie — najpewniej przez ręczne uruchomienia
`npm run db:migrate` (`server/scripts/migrate.postgres.ts`, runner PEŁNY, z tłumaczeniem
dialektu SQLite→Postgres) w którymś momencie przeszłości, zanim regex boota zawężono do
`7XX_`/8-cyfrowych. To NIE czyni ich bezpiecznymi do odpalenia teraz (patrz sekcja dialektu
wyżej) — stąd archiwizacja, nie zmiana regexu.

## Wyjątki — GENUINE gaps, naprawione osobnymi migracjami 8-cyfrowymi

Audyt znalazł 3 przypadki, gdzie treść pliku 6xx **faktycznie nigdy nie trafiła** na żywą bazę
(zero rekordów / brakująca kolumna + potwierdzony żywy caller w kodzie) — to NIE fałszywy alarm:

1. **`669_v6_seed_system_templates.sql`** — 18 systemowych szablonów wywiadu (V6 Interview
   Template Library) + ich pytania (razem 111 wierszy) — **0 wierszy `v6_%` na żywo**. Żywy
   caller: `GET /interview/templates` → `InterviewController.getTemplates()` →
   `interview_library_templates` z `template_scope = 'system'` — biblioteka szablonów wywiadu
   pokazywała ZERO systemowych szablonów każdej organizacji. Naprawa:
   `../20260720_seed_v6_interview_library_templates.sql` (tłumaczenie `INSERT OR IGNORE` →
   `INSERT ... ON CONFLICT DO NOTHING`, usunięcie nieistniejącej kolumny
   `interview_library_template_questions.updated_at`, rzutowanie `is_required` int→boolean —
   ten plik nigdy realnie nie wykonał się na Postgresie, więc te błędy nigdy nie zostały
   złapane). Zweryfikowane 2× na parity: run 1 = 18+111 INSERT, run 2 = 129× `INSERT 0 0`.

2. **`614_report_builder_results_kpi_report_template.sql`** — szablon raportu
   `tpl-results-kpi-review` ("Results - KPI Performance Review") — brak na żywo. Żywy caller:
   Report Builder template picker (`src/components/ReportBuilder/TemplatesManager.tsx`).
   Naprawa: `../20260720_report_builder_kpi_review_template.sql` — kopia treści 614 (już
   Postgres-native, już idempotentna `ON CONFLICT DO UPDATE`), z JEDNĄ poprawką:
   `created_by = 'system'` łamie `report_builder_templates_created_by_fkey` (nie ma
   `users.id = 'system'`) — zmienione na `NULL`, zgodnie z każdym innym systemowym szablonem
   w tej tabeli. Uwaga: istnieje już koncepcyjnie podobny szablon
   `tpl-results-kpi-report-default` ("KPI Review Report") zasiany inną, inline ścieżką w
   `DatabaseInitializer.ts` — inne `id`, więc bez konfliktu; ewentualne scalenie dwóch
   podobnych szablonów to osobna decyzja produktowa dla Piotra, nie techniczny blocker.

3. **`603_mcp_providers_registry.sql`** — tabela `mcp_providers` istnieje, ale bez kolumn
   `updated_at`, `last_error`, `last_test_at`. Żywy caller: `server/src/routes/mcp.routes.ts`
   — `POST /mcp/providers` (INSERT z `updated_at`) i `POST /mcp/providers/:id/test` (UPDATE
   `last_test_at`/`last_error`/`updated_at`) — **oba dziś realnie failują** na Postgresie
   ("column does not exist"). Naprawa: `../20260720_mcp_providers_missing_columns.sql`
   (3× `ADD COLUMN IF NOT EXISTS`, wzorzec identyczny jak `ensureSchemaColumnGaps()` w
   `DatabaseInitializer.ts`).

## Sprawdzone i uznane za nieszkodliwe (nie wymagają nowej migracji)

- **`622_my_idea_map_versions.sql`** — tabela nie istnieje live, ale to CELOWE: dropnięta przez
  już istniejący, udokumentowany `901_drop_my_idea_map_versions.sql` (retirement L-07/D-02,
  kanoniczny zamiennik = `my_idea_map_snapshots` + `my_idea_activity` z
  `20260611_my_idea_map_snapshots_and_activity.sql`, oba autorun-eligible). Zero akcji.
- **Rodzina `knowledge_graph_entities`/`knowledge_graph_relations`** (z `650_v4_unified_
  knowledge_graph.sql`) — deklaruje kolumny `created_at`/`updated_at`/`properties_json`, których
  brak live. Sprawdzone: żywy kod (`unifiedKGService.ts`, `ai/knowledgeGraphService.ts`) NIE
  używa tych nazw kolumn — operuje na `attributes`/`first_seen`/`last_seen`/`mentions`, i sam
  zawiera własną inline definicję tabeli (`ai/knowledgeGraphService.ts:451`). Definicja 6xx jest
  martwa/superseded przez inline schema — zero akcji.
- **`interview_template_questions`** (BEZ `_library_` w nazwie — różna tabela niż #1 wyżej) —
  brak kolumn `answer_type`/`help_hint` live. Sprawdzone: zero callerów w
  `server/src/routes`/`server/src/services` (żywa jest wyłącznie
  `interview_library_template_questions`). Tabela osierocona — zero akcji.
- Wszystkie pliki seed (`604`/`606`/`618`/`619`/`620` — `tools`, `kb_articles`,
  `notification_types`, `consulting_templates`, `tool_assets`) — spot-checked konkretne ID z
  treści plików na żywo (np. `tool-known-ambition-decomposer`, `nt-decision-required`,
  `mece-issue-tree`) — obecne z pełną liczbą wierszy odpowiadającą treści plików.
- **`602_adma_seed_parity.sql`** — jednorazowy `UPDATE` na konkretny wiersz demo (`ts-006`),
  dialekt SQLite (`datetime('now', ...)`, `json('...')`), zero CREATE/ALTER na tabelach
  współdzielonych — czysto kosmetyczny seed demo, nie blokuje żadnej funkcji.

## Precedens i decyzja

Ten sam wzorzec co archiwizacja klasy `.sql.sql` (`E-SQL-01`, commit `eb340e6177...`,
`server/migrations/never-ran/README.md`): **archiwizacja, NIE renumeracja** — zmiana nazwy na
pojedyncze rozszerzenie/8-cyfrowy prefiks mogłaby sprawić, że martwa migracja SQLite nagle
zacznie się wykonywać na Postgresie z nieznanym skutkiem. `git mv` = czysty rename (R100,
zero diff treści), git blame/historia zachowane.

Zaktualizowane odwołania do przeniesionych ścieżek: `server/scripts/smoke-v6-interview.ts`,
`server/scripts/smoke-statement-ready.ts` (statyczne smoke-checki na istnienie/treść plików —
`server/migrations/6XX_*` → `server/migrations/never-ran/6XX_*`; check „18 systemowych
szablonów zasianych" przepięty na nowy, faktycznie autorun-owalny
`20260720_seed_v6_interview_library_templates.sql`).

`server/scripts/validate-migration-naming.ts` już pomija katalogi (`stat.isDirectory()
continue`) — nie wymagał zmian; usunięcie 96 plików z `server/migrations/` przy okazji
skasowało ~kilkanaście fałszywych `duplicate-prefix` WARN-ów dla numerów 6xx.
