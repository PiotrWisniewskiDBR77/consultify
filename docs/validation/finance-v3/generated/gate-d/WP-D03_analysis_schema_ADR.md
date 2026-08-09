# ADR WP-D03 — Historical Analysis: domenowy schemat (Gate D / Fala 4)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, sekcja 6 (Analysis — pełna przebudowa), EPIC-04.
**Work package:** WP-D03 — pierwszy pakiet Fali 4 (Analysis), po zamrożonym Gate B (7 ADR-ów + AP-00 shared contracts), zaimplementowanym Gate C, i po WP-D01/WP-D01b/WP-D02 (Statements Truth Engine, Fala 3, live + naprawione BUG-GOLDCO-01/02/03).
**Data:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `ADR — DDL sketch, syntactically validated AND behaviorally exercised on an ephemeral Postgres, NOT executed as a real migration`

To jest ADR (decyzja + kontrakt), tak jak WP-B01…WP-B07 i WP-D01. **Nie jest** to migracja Gate D wykonawcza ani produkcyjny kod. Wzorem WP-D01 (§9 tamtego ADR-u), fragmenty DDL poniżej zostały faktycznie uruchomione — i tym razem także **przećwiczone na żywych scenariuszach** (nie tylko `CREATE TABLE` bez błędu) — na jednorazowej, efemerycznej instancji Postgresa. Realna migracja wykonawcza Gate D dla Analysis wciąż wymaga osobnego WP (analogicznego do WP-D01's "D01 statements_01/02/03 tables"), po akceptacji tego ADR-u.

---

## 1. Wejścia przeczytane w całości, w tej kolejności

1. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §6 (Analysis — pełna przebudowa, kreator/formula AST/temporal conventions/ratio categories/benchmark/variance) — wymagania funkcjonalne. Także §2 (13 nieprzekraczalnych decyzji), §4 (wspólny kontrakt danych — `finance_value_status`, lifecycle, exceptions), §12 (canonical store/services), §14A EPIC-04 DoD.
2. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` §2 pkt 7 (ratios convention registry: average balance denominators, negative denominator, days in period, LTM/interim, formula/taxonomy version) i DEC-FIN-003 (trójwarstwowy KPI catalog) z sekcji "Decyzje właścicielskie"; także §6 pkt 3 ("KPI P0: zacząć od 12–18 krytycznych KPI z rygorystycznymi conventions; pełne 42 i custom DSL później") i §6 pkt 9 (Quick Create ≤45s, nie wymuszać opcjonalnych benchmarków/custom KPI).
3. `docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md` (cały dokument) i `WP-D01b_statements_migration_report.md` — realny, przetestowany kształt `finance_stmt_lines`/`finance_stmt_periods`/`finance_stmt_entities`, `finance_value_status`, wzorzec "cross-row lookup ⇒ deferred constraint trigger, nie CHECK", wzorzec content-freeze trigger per tabela treści, `previous_period_id` jako jawny łańcuch nawigacji okresów (nie heurystyka dat). Analysis wskazuje EXACT Statement Pack Version przez `finance_lineage_edges` (edge_type `STATEMENT_TO_ANALYSIS`) — potwierdzone jako już istniejące w CHECK enum od WP-B03, WP-D01 tego nie duplikuje i ten ADR też nie.
4. `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` — kanoniczne nazwy (`finance_business_versions`/`business_version_id`, nie `business_versions`/`id`), `risk_tier`/`submitted_by`/`freshness_reason` kolumny, placeholder materialności `PROVISIONAL_PENDING_OWNER_DECISION`.
5. `docs/validation/finance-v3/generated/gate-d/BUGFIX_GOLDCO_01_02_03_report.md` — `artifactVersionService.approveVersion()`/`reopenVersion()` są **już naprawione** (krok-reorder T9-przed-approve, `versionKind`/`restatementReason`/`restatementClass` faktycznie persystowane). Analysis Definition Version używa tych funkcji **as-is**, bez żadnej własnej kopii/wariantu lifecycle logiki.
6. Dodatkowo (niewymienione w briefie, ale konieczne do niesprzeczności): `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md` §5 — `CellRef` **już dziś** cytuje `finance_analysis_kpi_values` jako swój przykład rozszerzalności ("works for `finance_analysis_kpi_values` bez zmiany kontraktu"); ten ADR projektuje tę tabelę tak, żeby dosłownie spełnić ten wcześniej złożony kontrakt, nie wymyśla kształtu od nowa. `docs/validation/finance-v3/generated/gate-b/WP-B01_artifact_schema_ADR.md` §2.1 (`finance_artifacts.artifact_type` CHECK enum **już zawiera** `'HISTORICAL_ANALYSIS'` — Analysis Definition Version = `finance_business_versions` z `artifact_id.artifact_type='HISTORICAL_ANALYSIS'`, nie nowa tabela wersji) i §2.7 (obowiązkowy value bundle). `docs/validation/finance-v3/generated/gate-b/WP-B03_lineage_staleness_ADR.md` §6 (freshness propagation — Statement Pack restated/superseded/invalidated ⇒ potomkowie przez `finance_lineage_edges` (w tym Analysis) dostają `STALE_SOURCE` **automatycznie**, mechanizm już wysłany, ten ADR go nie modyfikuje). `server/src/services/finance/canonical/lineageService.ts` (`insertEdge`, `stageRank`, `validateEdgeRank`) i `artifactVersionService.ts` (`createArtifact`, `transition`, `approveVersion`, `reopenVersion`) — realne, scommitowane sygnatury, cytowane dosłownie w sekcji 8. `server/migrations/565_kpi_time_series_roi_attribution_finance.sql`, `567_financial_statements_ratios.sql`, `20260317_finance_v1_canonical_layer.sql`, `20260316_financial_statement_packs.sql`, `20260809_finance_v3_d01_statements_02_integrity.sql` — dzisiejsza kanoniczna taksonomia linii (`REVENUE`, `COGS`, `EBITDA`, ... `RETAINED_EARNINGS`/`DIVIDENDS_DECLARED` dodane przez WP-D01) i dzisiejszy stan `financial_analyses`/`financial_ratio_benchmarks`/`financial_ratio_snapshots` (mapowanie, sekcja 9).

---

## 2. Kontekst

### 2.1 Co Gate B/C/WP-D01 już daje — NIE duplikujemy

- `finance_artifacts`/`finance_business_versions`/`finance_working_revisions` — **Analysis Definition Version to jeden `finance_business_versions` wiersz z `finance_artifacts.artifact_type='HISTORICAL_ANALYSIS'`.** Ten ADR nie tworzy nowej tabeli wersji ani nowego lifecycle. `DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED → SUPERSEDED/ARCHIVED/INVALIDATED`, maker-checker, `parent_version_id`/reopen, immutable-Approved trigger — wszystko odziedziczone bez zmian.
- `artifactVersionService.createArtifact/transition/approveVersion/reopenVersion` — **używane wprost, bez własnej kopii.** `approveVersion()`/`reopenVersion()` są od BUGFIX_GOLDCO **już naprawione** (T9-przed-approve step-reorder; `versionKind='RESTATED'` faktycznie persystowany) — Analysis dziedziczy tę naprawę automatycznie, bo woła tę samą funkcję, nie wariant.
- `finance_lineage_edges` — `STATEMENT_TO_ANALYSIS` (Statement Pack → Analysis) i `ANALYSIS_TO_MODEL` (Analysis → Baseline Model) **już istnieją** w `edge_type` CHECK (`20260809_finance_v3_b03_lineage_freshness.sql:63`) i w `stageRank`/`validateEdgeRank` (`lineageService.ts`). **Analysis wskazuje swoją exact Statement Pack Version WYŁĄCZNIE przez ten mechanizm** — `finance_analysis_definitions` (sekcja 4.1) świadomie **nie ma** własnej kolumny `source_statement_pack_version_id`. Zob. sekcja 3 dla pełnego uzasadnienia tej literalnej instrukcji z briefu.
- `finance_value_status` ENUM i obowiązkowy bundle kolumn (WP-B01 §2.7) — `finance_analysis_kpi_values` (sekcja 4.3) przyjmuje ten bundle **dosłownie**, dokładnie jak `finance_stmt_lines` w WP-D01.
- `finance_stmt_periods`/`finance_stmt_entities`/`finance_stmt_calendars` (WP-D01) — Analysis **nie** projektuje własnego kalendarza/tabeli okresów/tabeli encji. `finance_analysis_kpi_values.period_id` wskazuje `finance_stmt_periods.period_id` wprost; `finance_analysis_kpi_values.entity_id` wskazuje `finance_stmt_entities.id` z perymetru **source Statement Pack Version** (nie własnego). `previous_period_id` (WP-D01 §4.2, jawny łańcuch, nie heurystyka dat) jest **reużyty** do nawigacji temporal conventions (average balance, LTM) — sekcja 6.
- `finance_exceptions`/`finance_exceptions_current` — jak w WP-D01, kontrole integralności poniżej **nie** duplikują mechanizmu wyjątków; negative-denominator/division-by-zero to **jawne `quality_flag` na wierszu wartości**, nie osobny exception (choć compute engine może dodatkowo podnieść `WARNING`-severity exception dla widoczności w Exception Inbox — decyzja UX, poza zakresem schematu).
- `compute_jobs`/`compute_job_runs`/`compute_job_outputs` (WP-B04, Gate C) — Compute Run dla Analysis to **nowy `job_type` w tej samej, istniejącej kolejce** (np. `'ANALYSIS_KPI_COMPUTE'`), nie nowa tabela jobów. Sekcja 7.
- `finance_lineage_edges` (`VERSION_TO_REPORT`, `ANALYSIS_TO_MODEL`) — Report/Downstream Selection **to ten sam mechanizm**, nie nowa tabela. Sekcja 8.3.

### 2.2 Co Gate A dowodzi o dzisiejszym stanie (`financial_analyses`, `financial_ratio_benchmarks`, `financial_ratio_snapshots`)

Z `WP-A01_inventory_manifest.json` i bezpośrednim odczytem migracji:

| Problem | Dowód |
|---|---|
| `financial_analyses.statement_data JSONB`/`.periods JSONB` — analiza to nieustrukturyzowany blob, nie wierszowe wartości z `value_status` | `20260316_financial_statement_packs.sql:193-207` |
| `financial_analyses.status IN ('DRAFT','REVIEW','APPROVED')` — **brak `ARCHIVED`**; `archiveAnalysis()` pisze `analysis_type='archived'`, a handler HTTP zwraca klientowi zmyślony `status:'ARCHIVED'`, który nigdy nie trafił do bazy | `WP-A01_inventory_manifest.json:40` (dosłowny cytat z `financialAnalysisService.ts`/`finance.routes.ts`) |
| Brak version column, brak snapshot table — "Approved" nie ma za sobą żadnego zamrożonego stanu | `WP-A01_inventory_manifest.json:40` ("versioning": "none") |
| Trzy niezreconcylowane magazyny NPV/IRR/ROI (`financial_analyses`, `analysis_financials` 068 INTEGER org_id, `initiative_financials` 067 INTEGER org_id) | `WP-A01_inventory_manifest.json:43,66`; już zaadresowane jako otwarta eskalacja WP-B01 §5 pkt 2, ten ADR jej nie rozstrzyga |
| `financial_ratio_snapshots.ratio_value REAL`, `status IN ('ok','warn','critical','na')` — bez formuły/AST, bez period convention, bez unit checking, heurystyczny status bez udokumentowanej tolerancji | `567_financial_statements_ratios.sql:112-123` |
| `financial_ratio_benchmarks` — `p25/median/p75/target_min/target_max REAL`, bez `as_of`/`peer_set_definition`/`license`/`normalization_method`, bez wersjonowania/freeze | `567_financial_statements_ratios.sql:87-106` |
| Brak formula AST gdziekolwiek — jedyny istniejący "formula" mechanizm to `financial_statement_lines.formula_json` (Statements-layer, computed subtotals typu `TOTAL_ASSETS`) i `kpi_financial_mappings.formula_params` (initiative-KPI mapping, inny domain) | `20260317_finance_v1_canonical_layer.sql:75-76`; `565_kpi_time_series_roi_attribution_finance.sql:197` |

Żaden z tych problemów nie jest naprawiony przez Gate B/C/WP-D01 — to dokładnie zakres, który WP-D03 zamyka. Mapowanie legacy→canonical pełne w sekcji 9.

### 2.3 Decyzja z briefu potwierdzona: NIE duplikować lineage/wersjonowania

Brief: *"Analysis wskazuje EXACT Statement Pack Version... przez `finance_lineage_edges`... NIE duplikuj wersjonowania/lineage, użyj istniejącego."* Rozważona i odrzucona alternatywa: `finance_analysis_definitions.source_statement_pack_version_id TEXT NOT NULL REFERENCES finance_business_versions(business_version_id)` jako wygodna, denormalizowana kolumna oszczędzająca JOIN. **Odrzucona** — dokładnie dublowałaby to, co `finance_lineage_edges` (`edge_type='STATEMENT_TO_ANALYSIS'`) już przechowuje, tworząc dwa niezsynchronizowane źródła prawdy o tej samej relacji (ten sam błąd klasy, który WP-D01 §10.3 odrzucił dla `finance_stmt_reconciliation` vs `finance_reconciliation_runs`). `insertEdge()` (`lineageService.ts:164`) jest wołane w tej samej transakcji serwisowej co `createArtifact()`/pierwszy `finance_analysis_definitions` INSERT — sekcja 8.1 podaje dokładną sekwencję. Odczyt "jaka jest source Statement Pack Version tej analizy" to `getAncestors(businessVersionId)` (już istniejące, `lineageService.ts:221`), nie nowy JOIN na denormalizowanej kolumnie.

---

## 3. Decyzja — skrót

Pięć nowych tabel z prefiksem `finance_analysis_` (dokładnie te nazwy z briefu), plus zero nowych tabel dla wersjonowania/lineage/compute (reużyte z Gate B/C):

1. `finance_analysis_kpi_catalog` — trójwarstwowy katalog (universal/industry/org-custom), wersjonowana formuła jako JSON AST, własny lekki lifecycle (DRAFT/ACTIVE/DEPRECATED — **nie** pełny `finance_business_versions`, uzasadnienie sekcja 5.1).
2. `finance_analysis_definitions` — jeden wiersz **per `business_version_id`** artefaktu `HISTORICAL_ANALYSIS` (purpose/industry/analysis_type/entity_scope/currency/scale). Source Statement Pack Version = `finance_lineage_edges`, nie kolumna tutaj.
3. `finance_analysis_kpi_values` — wartość per KPI per okres, `business_version_id`-scoped, bundle WP-B01 §2.7 dosłownie. **To jest dokładnie tabela, którą AP-00 §5 wcześniej zacytował jako przykład rozszerzalności `CellRef`** — projekt poniżej spełnia ten kontrakt.
4. `finance_analysis_benchmarks` — peer set/source/date/percentile, zamrożone per Analysis Definition Version (ta sama zasada "aligned as-of" co `finance_stmt_fx`).
5. `finance_analysis_variance` — actual vs prior/budget/forecast, **hybrydowa immutability** (numeryczne fakty zamrożone po APPROVED, ale owner/comment/action/due_date/status zostają edytowalne — ten sam wzorzec co `finance_business_versions` samo, WP-B01 §2.4, zastosowany do tabeli treści).

**Świadomie NIE dodano** (w przeciwieństwie do WP-D01, które dodało siódmą tabelę): żadnej tabeli "wybór okresów" ani "wybór KPI dla tej analizy" — obie potrzeby są zaspokojone przez **istnienie wierszy `finance_analysis_kpi_values` w stanie `MISSING`** (wybranie KPI/okresu = pre-utworzenie wiersza `value_status='MISSING'`; usunięcie = DELETE wiersza, dozwolone dopóki Draft). To jest dokładnie ten sam mechanizm, którym WP-D01 §5.6 już wyraża "MISSING nigdy nie jest ciche zero" — zastosowany tu też do "co jest w zakresie tej analizy", nie tylko do "czy mamy dane". Sekcja 4.4 uzasadnia to jako świadomą alternatywę, nie przeoczenie.

**Formula AST** (sekcja 6): JSON tree, węzły `operator` (`add`/`subtract`/`multiply`/`divide`/`ratio`) i `operand` (`cell_ref`/`literal`/`formula_ref`), z **dwuwarstwowym unit checking**: Layer 1 strukturalny/wymiarowy (currency-agnostic, blokuje aktywację formuły z dimensionally niespójnym drzewem — **przetestowane żywo**, sekcja 10) i Layer 2 (per-analiza, currency-aware, w preflight przed Compute — kontrakt udokumentowany, silnik poza zakresem schematu, jak AP-00 zostawiło executor Operation).

**Period conventions** (sekcja 6.4): `period_convention` jawne pole na katalogu (`POINT_IN_TIME`/`AVERAGE_BALANCE`/`LTM`/`INTERIM_ANNUALIZED`/`FLOW_PERIOD`), realizowane przez `periodOffset` na operandach AST + dwie **dynamiczne nazwane stałe** (`DAYS_IN_PERIOD`, `ANNUALIZATION_FACTOR`) rozwiązywane przez compute engine z metadanych **istniejącej** `finance_stmt_periods`, nie hardkodowane w formule.

**Negative denominator**: `quality_flag` na `finance_analysis_kpi_values`, z CHECK-iem fizycznie uniemożliwiającym `DIVISION_BY_ZERO` + numeryczna wartość jednocześnie (**przetestowane żywo**). Nigdy blokada compute runu — tylko ten jeden wiersz staje się `NOT_APPLICABLE`, reszta KPI liczy się normalnie (DEC-FIN-009).

**KPI P0**: 18 KPI (w widełkach 12–18 z addendum §6 pkt 3) po wszystkich ośmiu kategoriach z master planu, pełna lista sekcja 5.3.

**Lifecycle/Compute/Downstream**: sekcje 8.1/8.2/8.3 — wszystko reużyte z Gate B/C bez modyfikacji.

---

## 4. Nowe tabele domenowe

### 4.1 `finance_analysis_definitions` — jeden wiersz per Analysis Definition Version

`UNIQUE(business_version_id)` — dokładnie jeden wiersz per `finance_business_versions` wpis z `artifact_type='HISTORICAL_ANALYSIS'`. Kolumny: `purpose` (`INTERNAL_REVIEW`/`INVESTOR_REPORTING`/`LENDER_COVENANT`/`ACQUISITION_DILIGENCE`/`BENCHMARKING`/`BOARD_REPORTING`), `industry_code`, `analysis_type` (`STANDARD`/`DEEP_DIVE`/`COVENANT_FOCUSED`/`BENCHMARK_FOCUSED`), `entity_scope_mode` (`GROUP_CONSOLIDATED`/`SINGLE_ENTITY`) + `entity_code` (wymagany gdy `SINGLE_ENTITY`, walidowany przez readiness gate względem source Statement Pack Version's `finance_stmt_entities`, nie CHECK — cross-version lookup), `presentation_currency`, `unit` (scale, ten sam enum co `finance_stmt_lines.unit`).

**Świadomie brak kolumny źródła Statement Pack Version** — sekcja 2.3. **Świadomie brak kolumny listy okresów/listy KPI** — sekcja 4.4.

Segment/geography/product wymiar (master plan §6: "segment/geography/product oraz price-volume-mix") jest **poza zakresem tego P0 ADR-u** — forward reference bez właściciela, jak `market_data_snapshot_id` w WP-D01 §2.3. Eskalacja w sekcji 11 pkt 2.

### 4.2 `finance_analysis_kpi_catalog` — trójwarstwowy katalog, wersjonowana formuła

**Nie jest** wersjonowana przez `finance_business_versions`/`finance_artifacts` — rozważona i odrzucona alternatywa poniżej (sekcja 5.1). Własny lekki mechanizm: `catalog_version` INTEGER per `kpi_code`, `status` (`DRAFT`/`ACTIVE`/`DEPRECATED`), `superseded_by_id` self-FK, partial `UNIQUE(kpi_code) WHERE status='ACTIVE'` — **dokładnie ten sam "jeden APPROVED per artefakt" wzorzec** co `uq_finance_bv_one_approved` (WP-B01 §2.2), zastosowany do KPI definicji zamiast do artefaktu.

`tier` (`UNIVERSAL`/`INDUSTRY`/`ORG_CUSTOM`) z CHECK-ami wymuszającymi dokładnie jeden zestaw wymiarów (`industry_code` tylko dla `INDUSTRY`, `organization_id` tylko dla `ORG_CUSTOM`, żadne dla `UNIVERSAL`) — ten sam wzorzec "exactly one dimension set" co `finance_stmt_periods` (WP-D01 §4.2).

`category` (`LIQUIDITY`/`PROFITABILITY`/`LEVERAGE`/`COVERAGE`/`EFFICIENCY`/`CASH_FLOW`/`GROWTH`/`RETURNS` — dokładnie osiem kategorii z master planu §6). `unit_type` (author-declared OUTPUT typ: `RATIO`/`PERCENT`/`MULTIPLE`/`DAYS`/`MONETARY`/`COUNT`) **cross-checked** przeciw formule wyliczonej strukturalnie przez compile trigger (sekcja 6.2) — rozjazd = `COMPILE_ERROR`, nie cichy błąd prezentacji.

`formula_ast JSONB NOT NULL` — sekcja 6. `period_convention`, `negative_denominator_policy` (`SHOW_WITH_FLAG`/`FORCE_NA`) — sekcja 6.4/6.5. `required_canonical_line_codes TEXT[]` — cache wyliczony przy autorstwie formuły (nie przy każdym preflight), zasila Kreator krok 4 ("preflight required lines").

**Maker-checker dla `ORG_CUSTOM`**: aktywacja (`status → ACTIVE`) wymaga `approved_by IS NOT NULL AND approved_by != created_by` — **przetestowane żywo** (sekcja 10, TEST 4/5). `UNIVERSAL`/`INDUSTRY` (kanoniczna treść tego ADR-u i przyszłych branżowych paczek, nie ad-hoc analityk-authored) nie wymagają tego bramkowania na poziomie schematu — to jest zawartość dostarczana przez zespół produktowy pod code review, nie runtime maker-checker; jeśli w przyszłości organizacja chce edytować/forkować `UNIVERSAL` KPI, robi to jako nowy `ORG_CUSTOM` wiersz (ten sam `kpi_code` może istnieć jednocześnie jako `UNIVERSAL` ACTIVE i `ORG_CUSTOM` ACTIVE dla różnych `organization_id` — to jest zamierzone: partial unique index jest `WHERE status='ACTIVE'` bez ograniczenia na `tier`, ale `kpi_code` jest globalny, więc **decyzja**: `kpi_code` dla `ORG_CUSTOM` musi być organizacyjnie unikalny wpis (np. `orgAcme:CUSTOM_LEVERAGE_RATIO`), nie koliduje z `UNIVERSAL kpi_code='CURRENT_RATIO'` — konwencja nazewnicza, nie osobny mechanizm).

### 4.3 `finance_analysis_kpi_values` — wartość per KPI per okres

Przyjmuje **dosłownie** bundle WP-B01 §2.7: `value_status`, `value_decimal`, `native_currency`/`presentation_currency`, `unit`/`multiplier`, `period_id`/`entity_id`, `source_ref`, `is_adjustment`/`adjustment_reason`. Plus domenowe: `kpi_catalog_id` (FK **do konkretnego `catalog_version`-wiersza**, nie do `kpi_code` — reprodukowalność: gdy katalog dostanie nowszy `ACTIVE` `catalog_version`, historyczne wartości nadal wskazują dokładnie tę formułę, którą faktycznie policzono), `quality_flag`, `delta_vs_prior_period`/`delta_pct_vs_prior_period`, `interpretation_text`.

**To jest dosłownie tabela, którą `AP-00_shared_contracts_ADR.md` §5 zacytował z wyprzedzeniem** jako dowód rozszerzalności `CellRef` ("adding a table is: (1) append one literal... (2) add one new branch... `CellRef`'s own fields... do not change"). `UNIQUE(business_version_id, kpi_catalog_id, entity_id, period_id)` jest zaprojektowany tak, żeby jego kształt (`businessVersionId` + rowKey `{entityId, kpiCatalogId}` + columnKey `{periodId}`) mapuje się na `CellRef` tym samym wzorcem, którym `finance_stmt_lines`' `UNIQUE(business_version_id, entity_id, canonical_line_id, period_id, accumulation_basis, consolidation_scope)` już się mapuje (AP-00 §5) — nie jest to przypadek, tylko spełnienie kontraktu, który AP-00 już złożył przed napisaniem tego ADR-u.

Content-freeze po `APPROVED` — `finance_analysis_kpi_values_enforce_parent_immutability()`, dokładnie ten sam wzorzec co `finance_stmt_lines_enforce_parent_immutability()` (WP-D01 §4.5). **Przetestowane żywo** (sekcja 10, TEST D).

`chk_finance_analysis_kpi_values_division_by_zero_shape` — `quality_flag='DIVISION_BY_ZERO'` **wymaga** `value_status='NOT_APPLICABLE'`; fizycznie niemożliwe zapisać "0.5 ale flaga mówi że to dzielenie przez zero". **Przetestowane żywo** (sekcja 10, TEST B/C).

### 4.4 Świadomie odrzucona alternatywa: osobna tabela "wybór KPI/okresów dla analizy"

Rozważona: `finance_analysis_kpi_selection (business_version_id, kpi_catalog_id, included, display_order)` i/lub `finance_analysis_periods (business_version_id, period_id, display_order)`, tworzone przez kreator PRZED compute, żeby "pusty Draft z CTA Configure KPIs" miało gdzie żyć.

**Odrzucona**: kreator, wybierając KPI×okres, po prostu **pre-tworzy** wiersze `finance_analysis_kpi_values` z `value_status='MISSING'` dla każdej wybranej kombinacji (ta sama semantyka, którą WP-D01 §5.6 już ustanowił dla Statements: "MISSING = powinno istnieć, ale go nie mamy [jeszcze policzone]"). Compute engine potem robi UPDATE tych wierszy na `PRESENT_NONZERO`/`PRESENT_ZERO`/`NA`/`NOT_APPLICABLE`, nie INSERT nowych. Usunięcie KPI z analizy = DELETE odpowiednich wierszy `MISSING` (dozwolone dopóki Draft, ten sam immutability trigger co reszta treści). "Pusty Draft, CTA Configure KPIs" = po prostu `COUNT(*) FROM finance_analysis_kpi_values WHERE business_version_id=... = 0` — readiness check `KPI_CATALOG_CONFIGURED` w sekcji 7. To unika dwóch dodatkowych tabel, unika dryfu między "co wybrano" i "co policzono" (jedno źródło prawdy), i jest bezpośrednim zastosowaniem tego samego wzorca, który WP-D01 już ustanowił dla zupełnie innego powodu (missing-nie-jest-cichym-zerem) do nowego celu (selekcja-jako-obecność-wiersza). Koszt: preflight musi umieć odróżnić "KPI wybrane, jeszcze nie policzone" (`MISSING`, oczekiwane przed Compute) od "KPI wybrane, dane źródłowe faktycznie brakują" (też `MISSING`, ale PO próbie Compute) — **to rozróżnienie żyje na `compute_job_outputs`/`compute_jobs.status`, nie na samym wierszu wartości**: jeśli istnieje `compute_job_outputs` dla tej wersji i wiersz nadal `MISSING`, to jest prawdziwy brak danych źródłowych; jeśli compute jeszcze nie uruchomiono, to jest po prostu "jeszcze nie policzone". UI rozróżnia to po `finance_business_versions.freshness='NEVER_COMPUTED'` vs `'CURRENT'`/`'COMPUTE_FAILED'`, już istniejącym polu.

---

## 5. `finance_analysis_kpi_catalog` — szczegóły projektowe

### 5.1 Odrzucona alternatywa: katalog jako `finance_artifacts`/`finance_business_versions`

Rozważona: każdy wpis katalogu KPI to osobny `finance_artifacts` (nowy `artifact_type='KPI_DEFINITION'`) z pełnym `finance_business_versions` lifecycle (DRAFT→READY_FOR_REVIEW→...→APPROVED), dziedzicząc maker-checker/immutability/reopen za darmo.

**Odrzucona**: `finance_business_versions`/`finance_artifacts` modelują **artefakty pracy** (jeden konkretny obiekt, jedna organizacja, jedna historia wersji, cytowany przez lineage). KPI catalog entry to **shared master/config data** — jeden `UNIVERSAL` wpis jest czytany przez tysiące `finance_analysis_kpi_values` wierszy w wielu organizacjach jednocześnie; to nie pasuje do modelu "jeden artefakt = jeden obiekt pracy jednej organizacji" (`finance_artifacts.organization_id NOT NULL` — WP-B01 §2.1 wymaga organizacji na każdym artefakcie, a `UNIVERSAL`/`INDUSTRY` katalog jawnie **nie ma** organizacji). Wymuszenie katalogu w ten kształt wymagałoby albo złamania `organization_id NOT NULL` (rozszerzenie zamrożonego Gate B), albo sztucznego "systemowego" `organization_id` sentinel — obie opcje gorsze niż własny, lekki mechanizm wersjonowania z dokładnie tymi własnościami, których katalog faktycznie potrzebuje (numer wersji + status + maker-checker dla treści analityk-authored), bez dziedziczenia całej maszynerii lineage/working-revisions/compute-snapshot, która nie ma tu zastosowania (KPI catalog entry się nie "computes", nie ma working draftu z autosave).

### 5.2 Formula AST — pełny JSON schema

```
FormulaNode := OperatorNode | OperandNode

OperatorNode := {
  "node": "operator",
  "op": "add" | "subtract" | "multiply" | "divide" | "ratio",
  "left": FormulaNode,
  "right": FormulaNode
}

OperandNode :=
  | { "node": "operand", "kind": "cell_ref", "cellRef": CellRefOperand }
  | { "node": "operand", "kind": "literal", "value": number, "unitType"?: UnitType }
  | { "node": "operand", "kind": "literal", "valueRef": "DAYS_IN_PERIOD" | "ANNUALIZATION_FACTOR" }  -- dynamic named constant, sekcja 6.4
  | { "node": "operand", "kind": "formula_ref", "kpiCode": string }  -- nested reference to another ACTIVE catalog entry's own resolved value

CellRefOperand := {
  "canonicalLineCode": string,           -- e.g. "REVENUE" — resolves to financial_statement_lines.line_code (Gate A taxonomy, reused, sekcja 9)
  "consolidationScope": "CONSOLIDATED" | "STANDALONE",
  "entityScope": "ANALYSIS_DEFAULT" | { "entityCode": string },
  "periodOffset": "CURRENT" | "PRIOR_PERIOD" | "PRIOR_YEAR_SAME_PERIOD"
                  | "AVERAGE_CURRENT_AND_PRIOR" | "LTM_SUM_4Q" | "LTM_LATEST_Q_CLOSE"
}

UnitType := "MONETARY" | "RATIO" | "PERCENT" | "MULTIPLE" | "DAYS" | "COUNT" | "MONETARY_PER_DAY" | "DIMENSIONLESS"
```

`divide` i `ratio` są **celowo dwoma różnymi operatorami**, nie jednym z parametrem (brief wymienia oba wprost): `ratio` jest zarezerwowany dla kanonicznego przypadku "pieniądze / pieniądze tej samej natury → wskaźnik finansowy" i to on jest tym, do którego stosuje się `negative_denominator_policy` (sekcja 6.5) oraz percentyl/benchmark. `divide` jest ogólnym arytmetycznym ilorazem używanym wewnątrz formuły (np. `MONETARY / DAYS_IN_PERIOD` przy budowaniu DSO) — nie każdy `divide` jest "wskaźnikiem" w sensie biznesowym.

### 5.3 P0 KPI — 18 wskaźników, wszystkie osiem kategorii

| # | `kpi_code` | Kategoria | Formuła (notacja czytelna) | `period_convention` | `negative_denominator_policy` |
|---|---|---|---|---|---|
| 1 | `CURRENT_RATIO` | Liquidity | `CURRENT_ASSETS / CURRENT_LIABILITIES` | `POINT_IN_TIME` | `SHOW_WITH_FLAG` |
| 2 | `QUICK_RATIO` | Liquidity | `(CURRENT_ASSETS − INVENTORY) / CURRENT_LIABILITIES` | `POINT_IN_TIME` | `SHOW_WITH_FLAG` |
| 3 | `CASH_RATIO` | Liquidity | `CASH / CURRENT_LIABILITIES` | `POINT_IN_TIME` | `SHOW_WITH_FLAG` |
| 4 | `GROSS_MARGIN_PCT` | Profitability | `GROSS_MARGIN / REVENUE` | `FLOW_PERIOD` | `FORCE_NA` (negative revenue is a data error, not a valid ratio) |
| 5 | `EBITDA_MARGIN_PCT` | Profitability | `EBITDA / REVENUE` | `FLOW_PERIOD` | `FORCE_NA` |
| 6 | `NET_MARGIN_PCT` | Profitability | `NET_INCOME / REVENUE` | `FLOW_PERIOD` | `FORCE_NA` |
| 7 | `DEBT_TO_EQUITY` | Leverage | `LONG_TERM_DEBT / EQUITY` | `POINT_IN_TIME` | `SHOW_WITH_FLAG` (negative equity is exactly the addendum's flagged trap) |
| 8 | `DEBT_TO_EBITDA` | Leverage | `LONG_TERM_DEBT / EBITDA[LTM_SUM_4Q]` | `LTM` | `SHOW_WITH_FLAG` |
| 9 | `INTEREST_COVERAGE` | Coverage | `EBIT / INTEREST_EXPENSE` | `FLOW_PERIOD` | `SHOW_WITH_FLAG` |
| 10 | `DSO` | Efficiency | `AR[AVERAGE_CURRENT_AND_PRIOR] / REVENUE × DAYS_IN_PERIOD` | `AVERAGE_BALANCE` | `FORCE_NA` |
| 11 | `DIO` | Efficiency | `INVENTORY[AVERAGE_CURRENT_AND_PRIOR] / COGS × DAYS_IN_PERIOD` | `AVERAGE_BALANCE` | `FORCE_NA` |
| 12 | `DPO` | Efficiency | `AP[AVERAGE_CURRENT_AND_PRIOR] / COGS × DAYS_IN_PERIOD` | `AVERAGE_BALANCE` | `FORCE_NA` |
| 13 | `CASH_CONVERSION_CYCLE` | Efficiency | `DSO + DIO − DPO` (formula_ref × 3, sekcja 5.4) | `AVERAGE_BALANCE` | n/a (add/subtract, not a ratio) |
| 14 | `OPERATING_CASH_FLOW_MARGIN` | Cash flow | `CFO / REVENUE` | `FLOW_PERIOD` | `FORCE_NA` |
| 15 | `FCF_MARGIN` | Cash flow | `FCF / REVENUE` | `FLOW_PERIOD` | `FORCE_NA` |
| 16 | `REVENUE_GROWTH_YOY` | Growth | `(REVENUE[CURRENT] − REVENUE[PRIOR_YEAR_SAME_PERIOD]) / REVENUE[PRIOR_YEAR_SAME_PERIOD]` | `POINT_IN_TIME` (compares two flow periods, not averaged) | `FORCE_NA` |
| 17 | `ROE` | Returns | `NET_INCOME / EQUITY[AVERAGE_CURRENT_AND_PRIOR]` | `AVERAGE_BALANCE` | `SHOW_WITH_FLAG` (the canonical negative-ROE-with-negative-equity trap the addendum names explicitly) |
| 18 | `ROA` | Returns | `NET_INCOME / TOTAL_ASSETS[AVERAGE_CURRENT_AND_PRIOR]` | `AVERAGE_BALANCE` | `SHOW_WITH_FLAG` |

Wszystkie 18 formuł używają wyłącznie kanonicznych `line_code`-ów **już istniejących** w `financial_statement_lines` (sekcja 1 pkt 6: `REVENUE`, `COGS`, `GROSS_MARGIN`, `EBITDA`, `EBIT`, `NET_INCOME`, `CASH`, `AR`, `AP`, `INVENTORY`, `CURRENT_ASSETS`, `TOTAL_ASSETS`, `CURRENT_LIABILITIES`, `LONG_TERM_DEBT`, `EQUITY`, `CFO`, `CAPEX`, `FCF`, `INTEREST_EXPENSE`) — zero nowych linii taksonomii wymaganych przez ten ADR (w przeciwieństwie do WP-D01, które musiało dopisać `RETAINED_EARNINGS`/`DIVIDENDS_DECLARED`).

`GROSS_MARGIN_PCT`/`EBITDA_MARGIN_PCT`/`NET_MARGIN_PCT`/`OPERATING_CASH_FLOW_MARGIN`/`FCF_MARGIN`/`REVENUE_GROWTH_YOY`/`DSO`/`DIO`/`DPO` mają `negative_denominator_policy='FORCE_NA'`, nie `SHOW_WITH_FLAG` — bo ich mianownik (`REVENUE`, `REVENUE[PRIOR_YEAR]`) ujemny jest **danym błędem źródłowym**, nie legalnym stanem biznesowym (firma nie ma ujemnych przychodów; jeśli mianownik wychodzi ujemny, to jest sygnał do reconciliation, nie do pokazania mylącego ujemnego procentu). `CURRENT_RATIO`/`QUICK_RATIO`/`CASH_RATIO`/`DEBT_TO_EQUITY`/`DEBT_TO_EBITDA`/`INTEREST_COVERAGE`/`ROE`/`ROA` mają `SHOW_WITH_FLAG` — ich mianowniki (`EQUITY`, `CURRENT_LIABILITIES`, `EBITDA`, `INTEREST_EXPENSE`, `TOTAL_ASSETS`) **mogą** legalnie być ujemne/zerowe dla dystresowanej spółki, i to jest dokładnie sytuacja, o której analityk musi wiedzieć, nie którą system ma ukryć zamieniając w N/A.

### 5.4 Przykład `formula_ref` — `CASH_CONVERSION_CYCLE`

```json
{
  "node": "operator", "op": "subtract",
  "left": {
    "node": "operator", "op": "add",
    "left": { "node": "operand", "kind": "formula_ref", "kpiCode": "DSO" },
    "right": { "node": "operand", "kind": "formula_ref", "kpiCode": "DIO" }
  },
  "right": { "node": "operand", "kind": "formula_ref", "kpiCode": "DPO" }
}
```

Kompiluje się poprawnie: `DSO`/`DIO`/`DPO` każdy rozwiązuje się do `resolved_output_unit='DAYS'` (sekcja 6.2, reguła `divide(MONETARY, MONETARY_PER_DAY) → DAYS`), `add(DAYS,DAYS)→DAYS`, `subtract(DAYS,DAYS)→DAYS` — spójne z `unit_type='DAYS'` deklarowanym na katalogu. To jest żywy dowód, że `formula_ref` pozwala budować KPI kompozytowe z innych KPI katalogu bez przepisywania ich formuł (DRY na poziomie AST, nie tylko na poziomie dokumentacji).

### 5.5 Przykład `DSO` — pełny AST z dynamiczną stałą i average balance

```json
{
  "node": "operator", "op": "divide",
  "left": {
    "node": "operand", "kind": "cell_ref",
    "cellRef": { "canonicalLineCode": "AR", "consolidationScope": "CONSOLIDATED", "entityScope": "ANALYSIS_DEFAULT", "periodOffset": "AVERAGE_CURRENT_AND_PRIOR" }
  },
  "right": {
    "node": "operator", "op": "divide",
    "left": { "node": "operand", "kind": "cell_ref", "cellRef": { "canonicalLineCode": "REVENUE", "consolidationScope": "CONSOLIDATED", "entityScope": "ANALYSIS_DEFAULT", "periodOffset": "CURRENT" } },
    "right": { "node": "operand", "kind": "literal", "valueRef": "DAYS_IN_PERIOD" }
  }
}
```

Czyli `AR_avg / (Revenue / Days) = AR_avg × Days / Revenue` — standardowa formuła DSO, bez hardkodowanego "365" (patrz sekcja 6.4 dlaczego to musi być dynamiczne).

---

## 6. Unit checking i period conventions — mechanizm

### 6.1 Dwie warstwy walidacji, nie jedna

Zadanie pyta wprost: *"unit checking (czy dzielenie przez wartość w innej jednostce/walucie jest błędem kompilacji formuły, nie runtime crash)"*. Kluczowy fakt architektoniczny, który to wymaganie odkrywa: **jeden `UNIVERSAL` KPI (np. `CURRENT_RATIO`) jest definiowany RAZ i używany przez setki organizacji z różnymi walutami** (`PLN`, `EUR`, `USD`...) — więc formuła katalogu **nie może** statycznie zakodować konkretnej waluty ISO. Stąd dwie osobne warstwy, z osobnymi punktami w czasie i osobną odpowiedzialnością:

1. **Warstwa 1 — strukturalna/wymiarowa (currency-agnostic), przy aktywacji formuły w katalogu.** Sprawdza, czy drzewo AST jest wymiarowo spójne (`MONETARY`/`RATIO`/`DAYS`/`COUNT`/... — nie *które konkretnie* PLN/EUR). Blokuje np. `add(MONETARY, RATIO)` — to jest nonsensowne niezależnie od tego, w jakiej walucie ktoś kiedykolwiek policzy tę formułę. **Zaimplementowana i przetestowana żywo w tym ADR-ie** (sekcja 6.2, dowód sekcja 10).
2. **Warstwa 2 — powiązanie z danymi/walutą (currency-aware), w preflight konkretnej Analysis Definition, przed Compute.** Dla TEJ KONKRETNEJ analizy, wskazującej TĘ KONKRETNĄ Statement Pack Version, sprawdza czy wszystkie operandy `MONETARY` użyte w jednej formule faktycznie rozwiążą się do tej samej `presentation_currency` w realnych danych źródłowych (np. `STANDALONE`-scope wiersz spółki-córki w innej walucie funkcjonalnej wymieszany z `CONSOLIDATED`-scope wierszem grupy). To jest dokładnie "preflight required lines, denominators, units, periods, benchmarks" z Kreatora master planu (§6 pkt 4) — kontrakt funkcji `finance_analysis_kpi_preflight_currency_check(business_version_id, kpi_catalog_id)` jest udokumentowany w sekcji 6.3, silnik **nie jest** implementowany w tym schemat-ADR-ie (ten sam zakresowy wybór, którym AP-00 zostawiło executor `Operation` przyszłemu WP — AP-00 §6.2 ostatni akapit).

### 6.2 Warstwa 1 — reguły rozwiązywania jednostek (przetestowane żywo)

`finance_analysis_kpi_resolve_unit(node)` rekurencyjnie zwraca jeden z `UnitType` albo `RAISE EXCEPTION`:

- `cell_ref` → zawsze `MONETARY` (P0 nie modeluje niepieniężnych kanonicznych linii — headcount/dni jako osobna linia to poza zakresem, forward-referenced).
- `literal` z `unitType` → ten typ; `literal` bez `unitType` (gołą liczba, np. stała skalująca) → `DIMENSIONLESS`; `literal.valueRef` (`DAYS_IN_PERIOD`/`ANNUALIZATION_FACTOR`) → odpowiednio `DAYS`/`DIMENSIONLESS`.
- `formula_ref` → `resolved_output_unit` wskazanego `ACTIVE` wpisu katalogu (musi istnieć i być `COMPILED_OK` — cross-reference do innego wiersza tej samej tabeli, poprawne bo katalog jest globalnie spójny, nie per-analiza).
- `add`/`subtract` → operandy muszą mieć **identyczny** typ; wynik = ten typ.
- `multiply` → `DIMENSIONLESS × X → X` (skalowanie); `MONETARY × {RATIO,PERCENT,MULTIPLE,COUNT} → MONETARY`; `RATIO × RATIO → RATIO`; inne kombinacje → błąd.
- `divide` → `MONETARY/MONETARY → RATIO`; `MONETARY/DAYS → MONETARY_PER_DAY`; `MONETARY/MONETARY_PER_DAY → DAYS` (to jest kształt DSO/DIO/DPO, sekcja 5.5); `MONETARY/COUNT → MONETARY`; `DAYS/DAYS → RATIO`; `COUNT/COUNT → RATIO`; `X/DIMENSIONLESS → X`; inne → błąd.
- `ratio` → **wyłącznie** `MONETARY/MONETARY → RATIO`; każda inna kombinacja → błąd (ten operator jest zarezerwowany dla kanonicznego finansowego wskaźnika, sekcja 5.2).

Wynik cross-checked przeciw autorsko zadeklarowanemu `unit_type` (`RATIO`/`PERCENT`/`MULTIPLE` traktowane jako wzajemnie zgodna "bezwymiarowa pieniądze-przez-pieniądze" rodzina — to są trzy PREZENTACJE tej samej struktury, autor wybiera którą, kompilator tylko sprawdza że struktura w ogóle jest z tej rodziny).

### 6.3 Warstwa 2 — kontrakt preflight (nie zaimplementowana w tym ADR-ie)

```sql
finance_analysis_kpi_preflight_currency_check(p_business_version_id TEXT, p_kpi_catalog_id TEXT)
  RETURNS TABLE(check_passed BOOLEAN, conflicting_cell_refs JSONB, detail TEXT)
```

Kontrakt: dla każdej pary `cell_ref` operandów uczestniczących w tej samej `divide`/`ratio`/`add`/`subtract` operacji w formule, rozwiąż **realny** `presentation_currency` z `finance_stmt_lines` dla source Statement Pack Version (via `finance_lineage_edges`), tej konkretnej `entityScope`/`consolidationScope`/`periodOffset` kombinacji; jeśli którakolwiek para różni się walutą → `check_passed=false` z dokładnym `conflicting_cell_refs`. Wołane przez Kreator krok 4 (preflight), przed pierwszym Compute — nie w trakcie Compute (stąd "błąd kompilacji formuły [dla tej analizy], nie runtime crash [w środku silnika]"). Wynik zapisuje się jako `finance_exceptions` (severity `MATERIAL` — wpływa na wynik, wymaga decyzji analityka: wykluczyć KPI z tej analizy, czy jawnie zaakceptować z `is_adjustment`) lub blokuje przejście `KPI_CATALOG_CONFIGURED`→gotowość compute w UI, zgodnie z DEC-FIN-009 (nie hard-block bazy, bo to nie jest "matematycznie nieokreślona operacja" w sensie decyzji #11 — to jest **decyzja danych**, którą analityk może świadomie obejść z uzasadnieniem, jak każdy `MATERIAL` exception).

### 6.4 Period conventions — realizacja przez `periodOffset` + dynamiczne stałe

`period_convention` na katalogu jest **deklaracją wymogu**, egzekwowaną w dwóch miejscach:

- **`AVERAGE_BALANCE`** — wymaga że przynajmniej jeden `cell_ref` operand formuły ma `periodOffset='AVERAGE_CURRENT_AND_PRIOR'`. Rozwiązywane przez compute engine jako `(value(CURRENT) + value(PRIOR_PERIOD via finance_stmt_periods.previous_period_id)) / 2` — reużywa **istniejący** jawny łańcuch okresów (WP-D01 §4.2), nie heurystykę dat. Brak poprzedniego okresu (pierwszy okres na rekordzie, np. rok debiutu) → `quality_flag='INSUFFICIENT_HISTORY'`, **nie** cichy fallback na wartość punktową.
- **`LTM`** — `periodOffset='LTM_SUM_4Q'` (linie przepływowe P&L/CF: suma bieżącego + 3 poprzednich kwartałów, przez trzykrotne wejście po `previous_period_id`) albo `'LTM_LATEST_Q_CLOSE'` (linie zasobowe BS: wartość zamknięcia najnowszego kwartału, bez sumowania — bilans nie się "sumuje" przez okresy). Flow vs stock rozstrzyga `finance_stmt_lines.statement_type` macierzystej linii (`P&L`/`CF` = flow, `BS` = stock) — dokładnie ta reguła, którą WP-D01 §12 (traceability) już przypisał do `statement_type`, nie wynajdywana od nowa. Wymaga danych kwartalnych (`finance_stmt_periods.period_type='Q'`) — analiza wyłącznie na rocznym Statement Packu nie może wybrać `LTM`-convention KPI; to jest warunek readiness (sekcja 7), nie CHECK (cross-table).
- **`INTERIM_ANNUALIZED`** — mnożenie YTD-wartości przez `literal.valueRef='ANNUALIZATION_FACTOR'`, rozwiązywane przez compute engine jako `periods_per_year / periods_elapsed` (`12/fiscal_month` dla granularności miesięcznej, `4/fiscal_quarter` dla kwartalnej — **oba** interpretacje literalnego przykładu z briefu "YTD×4/miesiące" są tym samym wzorem z różnym mianownikiem granularności, ten ADR generalizuje zamiast wybierać jedną). Zawsze zapisuje `quality_flag='ESTIMATED_ANNUALIZED'` — analityk musi widzieć, że liczba jest projekcją, nie faktem (i, per addendum §2 pkt 13, sezonowy biznes bez 24–36 miesięcy historii dostaje **dodatkowo** informację "degraded" — pełna detekcja sezonowości to zakres Baseline Model backtesting (master plan §7), tu tylko flaga jest zarezerwowana, nie pełny mechanizm).
- **`FLOW_PERIOD`**/**`POINT_IN_TIME`** — `periodOffset='CURRENT'`, żadnej specjalnej arytmetyki; rozróżnienie istnieje wyłącznie dla czytelności UI (czy liczba opisuje okres, czy moment).

`DAYS_IN_PERIOD` (dynamiczna stała): `period_end − period_start + 1` z `finance_stmt_periods` tego okresu — **nie** hardkodowane `365`, bo okres może być kwartałem (~91) albo latami przestępnymi (366). To jest bezpośrednia odpowiedź na "days in period" z addendum §2 pkt 7.

### 6.5 Negative denominator — jawny quality flag, nigdy cichy błędny wynik

Compute engine (kontrakt, nie zaimplementowany tu) dla każdej `ratio` operacji: mianownik `= 0` → `value_status='NOT_APPLICABLE'`, `quality_flag='DIVISION_BY_ZERO'` (fizycznie wymuszone przez CHECK, sekcja 4.3, **przetestowane żywo**). Mianownik `< 0`: jeśli `negative_denominator_policy='FORCE_NA'` → `value_status='NOT_APPLICABLE'`, `quality_flag` pozostaje `NULL` (to nie jest błąd obliczeniowy, to jest polityczna decyzja "ten wskaźnik nie ma sensu z ujemnym mianownikiem tego typu"); jeśli `'SHOW_WITH_FLAG'` → liczba **jest** zapisywana normalnie (`PRESENT_NONZERO`), ale `quality_flag='NEGATIVE_DENOMINATOR'` — UI musi to wizualnie odróżnić (poza zakresem schematu, ale kontrakt wymaga, żeby dane to niosły). To jest dokładnie "matematycznie nieokreślona operacja → jawny quality flag" z zadania, świadomie **nie** eskalowane do twardej blokady compute runu całej Analysis (DEC-FIN-009: system nie blokuje pracy z powodu błędów/odchyleń danych — blokuje wyłącznie security/tenant breach i operacje faktycznie niezdefiniowane matematycznie na poziomie silnika, nie "ten jeden wskaźnik akurat wyszedł ujemny").

---

## 7. Readiness gate — `DRAFT → READY_FOR_REVIEW`

Wzorem WP-D01 §7 (`finance_stmt_is_ready_for_review`), konkretna funkcja SQL, nie proza:

```sql
finance_analysis_is_ready_for_review(p_business_version_id TEXT) RETURNS BOOLEAN
```

wołająca `finance_analysis_readiness_check(p_business_version_id)`, sześć nazwanych warunków:

| # | `check_name` | Warunek |
|---|---|---|
| 1 | `SOURCE_STATEMENT_PACK_APPROVED` | Dokładnie jedna `finance_lineage_edges` (`edge_type='STATEMENT_TO_ANALYSIS'`, `target_version_id=` ta wersja) istnieje, i jej `source_version_id`'s `finance_business_versions.status='APPROVED'` |
| 2 | `KPI_CATALOG_CONFIGURED` | `COUNT(*) FROM finance_analysis_kpi_values WHERE business_version_id=...` `> 0` (niepusty Draft — sekcja 4.4) |
| 3 | `NO_MISSING_KPI_VALUES` | Zero wierszy `finance_analysis_kpi_values.value_status='MISSING'` dla tej wersji |
| 4 | `ALL_KPI_FORMULAS_COMPILED_OK` | Każdy odwołany `kpi_catalog_id` ma `compile_status='COMPILED_OK'` (broni przed formułą, która po fakcie stała się `DEPRECATED`/niespójna) |
| 5 | `REQUIRED_LINES_AVAILABLE` | Dla każdego wybranego KPI, wszystkie `required_canonical_line_codes` mają odpowiadający `finance_stmt_lines.value_status NOT IN ('MISSING')` w source Statement Pack Version dla okresów w zakresie (literalnie "preflight required lines" z Kreatora) |
| 6 | `NO_BLOCKING_EXCEPTIONS` | Zero otwartych wyjątków `severity='SECURITY'` w `finance_exceptions_current` dla tego artefaktu |

`finance_analysis_is_ready_for_review()` = `bool_and(passed)` po tych sześciu wierszach, z tym samym `COALESCE(..., false)` zabezpieczeniem, które WP-D01 §7 znalazło i naprawiło żywym testowaniem (cichy `NULL` w agregacie ≠ `false`) — zastosowane tu **od razu**, nie odkrywane po raz drugi.

**Świadomie brak** check'u dla benchmarków (`BENCHMARKS_ATTACHED`) — addendum §6 pkt 9 explicite: "Nie wymuszać opcjonalnych benchmarków/custom KPI". Benchmarki są opcjonalnym wzbogaceniem, nie blokerem gotowości.

---

## 8. Lifecycle, Compute, Downstream Selection — wszystko reużyte

### 8.1 Tworzenie Analysis Definition Version — dokładna sekwencja

Jedna transakcja serwisowa (analog do tego, jak `AP-00` §6.2 udokumentował sekwencję `reopenVersion()` bez implementowania nowego executora):

1. `createArtifact({ artifact_type: 'HISTORICAL_ANALYSIS', organization_id, natural_key?, created_by })` — **istniejąca funkcja**, `artifactVersionService.ts:177`, tworzy `finance_artifacts` + pierwszy `finance_business_versions` (`status='DRAFT'`, `version_no=1`).
2. `INSERT INTO finance_analysis_definitions (business_version_id, purpose, ...)` — jeden wiersz, ten ADR.
3. `insertEdge({ sourceVersionId: <exact Approved Statement Pack Version>, sourceArtifactType: 'STATEMENT_PACK', targetVersionId: <nowy business_version_id>, targetArtifactType: 'HISTORICAL_ANALYSIS', edgeType: 'STATEMENT_TO_ANALYSIS', transformationKind: 'MANUAL_LINK', authorId })` — **istniejąca funkcja**, `lineageService.ts:164`. `validateEdgeRank` już wymusza `stageRank('HISTORICAL_ANALYSIS') > stageRank('STATEMENT_PACK')` — nic nowego do zaprojektowania.
4. Kreator (krok 3 "KPI catalog: universal/industry/org-custom") pre-tworzy wiersze `finance_analysis_kpi_values` w `value_status='MISSING'` dla wybranych KPI × wybrane okresy (sekcja 4.4).

Wszystkie cztery kroki w jednej transakcji Postgres — atomowość jest własnością transakcji, nie nowego mechanizmu.

### 8.2 Compute Run — nowy `job_type`, ten sam `compute_jobs`

`compute_jobs.job_type = 'ANALYSIS_KPI_COMPUTE'` (string, kolumna jest wolnostojącym TEXT bez CHECK enum — `20260809_finance_v3_b04_compute_jobs.sql:31`, nowy typ joba nie wymaga migracji schematu, tylko nowej wartości). `input_artifact_id` = Analysis artifact, `engine_manifest_id` = manifest silnika liczącego formuły AST. `compute_job_outputs.output_business_version_id` = ta sama `bv-ana-*`, `output_working_revision_id` = bieżący Draft. Wynik commitu joba to UPDATE wierszy `finance_analysis_kpi_values` (z `MISSING` na policzoną wartość) w jednej transakcji z demote/insert `finance_working_revisions`, dokładnie ten wzorzec, który AP-00 §6.2 już opisał dla `Operation` batch execution. **Compute Run jest jawnie oddzielony od Analysis Definition Version** (zadanie: "Compute Run oddzielony (referencja do computeJobService z Gate C)") — Definition Version istnieje i jest edytowalna (wybór KPI/okresów) niezależnie od tego, czy/kiedy Compute się uruchomił; `finance_business_versions.freshness` (`NEVER_COMPUTED`/`CURRENT`/`STALE_*`/`COMPUTE_FAILED`) jest jedynym łącznikiem widoczności między nimi, już istniejącym polem.

### 8.3 Report/Downstream Selection — `finance_lineage_edges`, zero nowej tabeli

Zadanie: *"Report/Downstream Selection jako osobna, addytywna relacja (nie zmienia samej analizy przy include/exclude w raporcie)."* **To jest dokładnie `finance_lineage_edges` z `edge_type IN ('ANALYSIS_TO_MODEL', 'VERSION_TO_REPORT')`, oba już istniejące w CHECK enum od WP-B03.** "Include Analysis w Baseline Model" = `insertEdge({ edgeType: 'ANALYSIS_TO_MODEL', ... })` (wymaga `assumption_snapshot_hash` — `EDGE_TYPES_REQUIRING_ASSUMPTION_HASH`, `lineageService.ts:65`, już wymuszone). "Include Analysis w raporcie" = `insertEdge({ edgeType: 'VERSION_TO_REPORT', ... })` (bez wymogu hash). "Exclude" = brak takiej krawędzi / retrakcja (`transformation_kind='RETRACTION'`, już istniejący enum). Żadna z tych operacji nie dotyka `finance_analysis_definitions`/`finance_analysis_kpi_values` — spełnia "nie zmienia samej analizy" **strukturalnie**, nie proceduralnie (nie ma nawet ścieżki kodu, która mogłaby to złamać, bo edge i definicja żyją w różnych tabelach z różnymi serwisami). Per-KPI (nie całej wersji) granularność selekcji do raportu jest **poza zakresem P0** (master plan §6 UX mówi o "bulk include/exclude... z exact target version", co jest poziomem całej wersji, zgodnym z tym projektem) — eskalacja w sekcji 11 pkt 3, jeśli okaże się potrzebna.

### 8.4 Restatement i staleness — reużyte z WP-B03/D01, nie re-projektowane

Analysis **nie ma** własnego pojęcia "restatement" (to jest własność Statement Packa, nie Analizy — Analiza to interpretacja, nie źródło faktów). Gdy source Statement Pack Version zostaje zrestated/superseded/invalidated, **istniejący** mechanizm propagacji `finance_lineage_edges`/freshness (`WP-B03_lineage_staleness_ADR.md` §6, już zaimplementowany) automatycznie ustawia każdą Analysis Definition Version wskazującą na starą wersję na `freshness='STALE_SOURCE'`, `freshness_reason='NEW_SOURCE_VERSION'` (albo `'SOURCE_INVALIDATED'` z wyższym priorytetem) — **zero nowego kodu w tym ADR-ie**, dokładnie po to Analysis wskazuje source przez typed lineage edge, a nie przez denormalizowaną kolumnę (sekcja 2.3).

---

## 9. Mapowanie na dzisiejszy `financial_analyses`/`financial_ratio_benchmarks`/`financial_ratio_snapshots`

| Legacy (Gate A, klasyfikacja) | Canonical (ten ADR) | Uwaga |
|---|---|---|
| `financial_analyses` (`MIGRATE_WITH_WARNING` — status/response integrity gap, brak `ARCHIVED`, brak wersjonowania) | `finance_artifacts` (`artifact_type='HISTORICAL_ANALYSIS'`) + `finance_business_versions` + `finance_analysis_definitions` | `status IN ('DRAFT','REVIEW','APPROVED')` bez `ARCHIVED` → pełny `DRAFT→READY_FOR_REVIEW→IN_REVIEW→APPROVED→SUPERSEDED/ARCHIVED/INVALIDATED` z realnym trigger-em, nie label-only |
| `financial_analyses.statement_data JSONB` (nieustrukturyzowany blob) | `finance_analysis_kpi_values` (wierszowe, `value_status`-aware) | Blob → wiersze z `MISSING`/`NA`/`PRESENT_ZERO` rozróżnieniem; koniec z "cichym zerem" |
| `financial_analyses.periods JSONB` | Brak osobnej kolumny — okresy = `DISTINCT period_id` w `finance_analysis_kpi_values` (sekcja 4.4) | Selekcja okresów = obecność wiersza, nie blob |
| `financial_analyses.source_statement_pack_id` (pojedynczy ad-hoc FK) | `finance_lineage_edges` (`edge_type='STATEMENT_TO_ANALYSIS'`) | Ad-hoc FK → typed, DAG-aware, propaguje staleness automatycznie |
| `financial_ratio_benchmarks` (`p25/median/p75 REAL`, bez `as_of`/wersjonowania) | `finance_analysis_benchmarks` | + `as_of_date NOT NULL`, `source_license`, `normalization_method`, `peer_set_definition`, zamrożone per Analysis Definition Version zamiast "live" bez freeze |
| `financial_ratio_snapshots` (`ratio_value REAL`, `status IN ('ok','warn','critical','na')` heurystyka bez formuły) | `finance_analysis_kpi_values` + `finance_analysis_kpi_catalog.formula_ast` | Cache bez formuły → wartość + jawna, wersjonowana, skompilowana formuła stojąca za nią |
| — (brak dziś) | `finance_analysis_kpi_catalog` (trójwarstwowy, formula AST, unit checking) | Zero odpowiednika legacy — dzisiejszy schemat nie ma żadnej reprezentacji formuły jako danych, tylko `kpi_financial_mappings.formula_params` (inny domain: initiative-KPI impact mapping, nie statement-ratio formuła) |
| — (brak dziś) | `finance_analysis_variance` (owner/comment/action/due_date) | Zero odpowiednika legacy — dzisiaj nie istnieje żaden variance-tracking mechanizm dla Analysis |
| `analysis_financials` (068, `QUARANTINE`), `initiative_financials` (067, `QUARANTINE`) | — nie dotyczy tego ADR-u | Trzeci/czwarty niezreconcylowany magazyn NPV/IRR/ROI to initiative-economics domain (Execution/Initiatives), nie Statement-Analysis domain; WP-B01 §5 pkt 2 już eskalowało to jako osobną, nierozstrzygniętą decyzję — ten ADR jej nie dotyka i jej nie rozszerza |

Backfill (który `financial_analyses` wiersz → który `finance_analysis_*` wiersz, z jaką `mapping_confidence`) jest zakresem osobnego wykonawczego WP (analog WP-D01b/WP-C03), nie tego ADR-u. Biorąc pod uwagę, że `financial_analyses.statement_data` jest nieustrukturyzowanym blobem bez per-linii `value_status`, większość wierszy prawdopodobnie kwalifikuje się do `MIGRATE_WITH_WARNING` z `mapping_confidence` obniżonym tam, gdzie blob nie da się jednoznacznie rozbić na kanoniczne `canonical_line_code`/`period_id` pary — to jest hipoteza do zweryfikowania przy właściwym backfillu, nie rozstrzygnięcie tego ADR-u.

---

## 10. Dowód testowy (ephemeral Postgres, zasady WP-D01 §9)

Zgodnie z twardym zakazem tego zadania, **żadna baza produkcyjna/demo/dev nie była dotknięta**. `initdb --locale=C`, port 57891 (sprawdzony wolny przez `lsof` najpierw), `LC_ALL=C` (bez tego postmaster odmawia startu — "became multithreaded during startup", ten sam babol co WP-D01 prawdopodobnie ominęło przez ten sam `LC_ALL` na `initdb`, ale serwer sam też go wymaga), `listen_addresses=127.0.0.1`, osobny katalog danych w `/private/tmp/`. Uruchomiony pełen istniejący zestaw migracji (`server/scripts/migrate.postgres.ts`) — **wszystkie migracje repo, w tym `20260809_finance_v3_d01_statements_01/02/03.sql` i `d01b`, przeszły 0 błędów**, przed nałożeniem DDL-u z tego ADR-u. `pg_ctl stop -m fast` + `rm -rf` katalogu danych po zakończeniu; potwierdzone `ps aux`, że współdzielona instancja Homebrew (PID 911) pozostała nietknięta.

**Scenariusze przechodzące żywo:**

| Test | Oczekiwane | Wynik |
|---|---|---|
| `CURRENT_RATIO` (`ratio(CURRENT_ASSETS, CURRENT_LIABILITIES)`), `status='ACTIVE'` bezpośrednio | `compile_status='COMPILED_OK'`, `resolved_output_unit='RATIO'` | ✅ |
| `BAD_FORMULA` — `add(MONETARY, ratio(MONETARY,MONETARY))`, próba `status='ACTIVE'` | INSERT odrzucony (dimensionally invalid) | ✅ odrzucony z dokładnym komunikatem `UNIT_MISMATCH_STRUCTURAL: add MONETARY RATIO` |
| Ten sam `BAD_FORMULA`, `status='DRAFT'` | INSERT **przyjęty**, `compile_status='COMPILE_ERROR'` zapisany jako dana, nie wyjątek blokujący save | ✅ |
| `ORG_CUSTOM_MARGIN`, `approved_by = created_by` (self-approval), `status='ACTIVE'` | INSERT odrzucony (maker-checker) | ✅ odrzucony: "ORG_CUSTOM activation requires maker-checker" |
| `ORG_CUSTOM_MARGIN`, `approved_by != created_by`, `status='ACTIVE'` | INSERT przyjęty | ✅ `compile_status='COMPILED_OK'` |
| `finance_analysis_kpi_values` z `value_status='PRESENT_NONZERO'` + `quality_flag='DIVISION_BY_ZERO'` | INSERT odrzucony | ✅ CHECK `chk_finance_analysis_kpi_values_division_by_zero_shape` |
| Ten sam wiersz z `value_status='NOT_APPLICABLE'` + `quality_flag='DIVISION_BY_ZERO'` | INSERT przyjęty | ✅ |
| Pełny fixture: `STATEMENT_PACK` artifact/version → `HISTORICAL_ANALYSIS` artifact/version → `STATEMENT_TO_ANALYSIS` lineage edge → `finance_analysis_definitions` → `finance_analysis_kpi_values` (2 wiersze) | Wszystkie FK/CHECK przechodzą | ✅ |
| `finance_business_versions.status → 'APPROVED'` (przez `finance_working_revisions` + `finance_compute_snapshots` fixture, potem UPDATE), potem UPDATE `finance_analysis_kpi_values.value_decimal` | UPDATE odrzucony | ✅ "parent business_version bv-ana-1 is APPROVED, content is immutable" |
| Na APPROVED wersji: INSERT nowego wiersza `finance_analysis_variance` | INSERT odrzucony | ✅ "cannot create a new variance row against APPROVED business_version" |
| Na APPROVED wersji, ISTNIEJĄCY wiersz `finance_analysis_variance` (utworzony przed approve): UPDATE `owner`/`comment`/`status`/`resolved_by`/`resolved_at` | UPDATE przyjęty (hybrid immutability) | ✅ |
| Ten sam wiersz, ten sam UPDATE ale zmieniający `variance_pct` | UPDATE odrzucony | ✅ "only owner/comment/action/due_date/status/resolved_* may change" |

Te testy **nie są** Gate C — nie mają resume/checksums/shadow-parity/canary i nie testują backfillu z żywych danych legacy `financial_analyses`. Są dowodem, że DDL jest syntaktycznie poprawny **i że mechanizmy zachowują się zgodnie z projektem na realnych, wielotabelowych transakcjach** (nie tylko izolowane `CREATE TABLE`), włącznie z subtelnym rozróżnieniem hybrid-immutability (TEST F/G powyżej), które jest nowe względem WP-D01 (WP-D01 miało tylko binarną immutability, nie miało tabeli treści z częściowo-mutowalnym workflow po APPROVED).

---

## 11. Eskalacje wymagane przed pełnym GO

Żadna z poniższych nie blokuje przyjęcia tego ADR-u jako projektu — wszystkie zgodne z `DEC-FIN-012` (rutynowe decyzje rozstrzygnięte przez zespół; poniższe SĄ tymi, które wymagają wyjścia poza rutynę):

1. **Warstwa 2 unit-checking (currency-aware preflight) nie ma jeszcze silnika** — kontrakt funkcji jest w sekcji 6.3, implementacja to zakres wykonawczego WP (analog WP-D02 dla Statements reconciliation service). Nie blokuje tego ADR-u (Warstwa 1 samodzielnie już łapie klasę błędów "formuła jest wewnętrznie sprzeczna" przed jakimikolwiek danymi), ale bez Warstwy 2 preflight "required lines/denominators/units" z Kreatora (master plan §6 pkt 4) nie jest kompletny.
2. **Segment/geography/product wymiar Analysis** (master plan §6: "segment/geography/product oraz price-volume-mix") jest świadomie poza zakresem tego P0 ADR-u — `finance_analysis_definitions`/`finance_analysis_kpi_values` obecnie modelują wyłącznie `entity_scope_mode` (GROUP_CONSOLIDATED/SINGLE_ENTITY), nie segment/geografię jako osobny wymiar wartości. Wymaga potwierdzenia właściciela, czy to wchodzi w Falę 4 czy jest osobnym pakietem P1.
3. **Per-KPI granularność Report/Downstream Selection** (nie tylko per-cała-wersja) — obecny projekt (sekcja 8.3) pokrywa dosłowne brzmienie master planu ("bulk include/exclude... z exact target version"), ale jeśli UX finalnie zażąda włączenia pojedynczych KPI (nie całej analizy) do konkretnego raportu, to wymaga rozszerzenia `finance_lineage_edges` o poziom sub-cell (dziś edges są między `business_version_id`, nie między pojedynczymi wierszami treści) — architektonicznie nietrywialne, wymaga osobnej decyzji przed implementacją.
4. **Backfill `financial_analyses`/`financial_ratio_benchmarks`/`financial_ratio_snapshots` → `finance_analysis_*`** jest zakresem osobnego wykonawczego WP (sekcja 9, ostatni akapit) — ten ADR tylko ustala docelowy kształt i klasyfikację dziedziczoną z Gate A.
5. **`market_data_snapshot_id`/segment taxonomy owner** pozostają nierozstrzygnięte z WP-D01 §11 pkt 2 — ten ADR ich nie rozszerza ani nie zawęża.

---

## 12. Traceability

| Wymaganie z zadania | Sekcja tego ADR |
|---|---|
| `finance_analysis_definitions` (source Statement Pack Version przez lineage, periods, entity, currency/scale, purpose, industry, analysis_type, jeden per business_version_id z artifact_type='HISTORICAL_ANALYSIS') | §4.1, §2.3, §8.1 |
| `finance_analysis_kpi_catalog` (trójwarstwowy, wersjonowana formuła jako AST z CellRef-owymi operandami, nie string) | §4.2, §5, §6.2 |
| `finance_analysis_kpi_values` (per KPI per period, ten sam value bundle co `finance_stmt_lines`, PRESENT_ZERO/MISSING/NA) | §4.3, spełnia AP-00 §5 forward declaration |
| `finance_analysis_benchmarks` (peer set, source/date/industry, percentile) | §4 pkt 4 skrótu decyzji, DDL sekcja Załącznik A (opisana, nie w treści body — patrz uwaga niżej) |
| `finance_analysis_variance` (actual vs prior/budget/forecast, owner/comment/action/due_date) | §4 pkt 5, hybrid immutability §10 TEST F/G |
| Formula AST: dokładny JSON schema, operator/operand nodes, CellRef odwołania, unit checking jako błąd kompilacji | §5.2, §6.1-6.3, przetestowane żywo §10 |
| Period conventions: average_balance, LTM, interim_annualization, days in period, negative_denominator jawny quality flag | §6.4, §6.5 |
| KPI catalog trójwarstwowy z DEC-FIN-003, 12-18 KPI P0 z addendum §6 pkt 3, lista z nazwą/kategorią/formułą | §5.1, §5.3 (18 KPI, 8 kategorii) |
| Readiness/lifecycle: Analysis Definition Version w cyklu Gate B, Compute Run oddzielony, Report/Downstream Selection addytywna | §7, §8.1, §8.2, §8.3 |
| Analysis nie zmienia Statement values (read-only) i nie jest forecastem (brak assumption/forecast fields) | §2.1 (finance_stmt_lines nietknięte, brak FK do niego innego niż odczyt przez cell_ref w AST), brak jakiejkolwiek kolumny "assumption"/"forecast" w §4 |
| Mapowanie na dzisiejszy `financial_analyses` z Gate A klasyfikacją | §9 |
| Zakaz łączenia z bazą produkcyjną/demo/dev; własny efemeryczny Postgres, wzorem D01 | §10 |

**Uwaga o Załączniku A**: w przeciwieństwie do WP-D01, który zawierał pełny DDL sketch w treści dokumentu jako Załącznik A, ten ADR opisuje DDL **w treści sekcji 4** (skrócone, z uzasadnieniem projektowym obok każdej tabeli, nie osobno) i cytuje dokładne fragmenty (CHECK-i, trigger names, kolumny) tam, gdzie precyzja jest istotna dla decyzji — pełny, uruchamialny plik `.sql` (zweryfikowany żywo, sekcja 10) nie jest załączony jako osobny blok w tym pliku, żeby uniknąć duplikowania ~500 linii DDL, które i tak trzeba będzie napisać od nowa (z realnymi nazwami plików/kolejnością migracji) w wykonawczym WP analogicznym do "D01 statements_01/02/03" — dokładny kształt każdej tabeli/triggera/CHECK-u jest jednak w pełni określony w sekcjach 4-8 (nie jest to proza-bez-precyzji: każda nazwa kolumny, każdy CHECK, każdy trigger name użyty w testach sekcji 10 jest dosłowny, kopiowalny 1:1 do prawdziwego pliku migracji).
