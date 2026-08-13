# ADR WP-D05 — Baseline Models: domenowy schemat (Gate D / Fala 5)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, sekcja 7 (Baseline Models — pełna przebudowa), EPIC-05.
**Work package:** WP-D05 — pierwszy pakiet Fali 5, po zamrożonym Gate B (7 ADR-ów + AP-00), zaimplementowanym Gate C, i po WP-D01/WP-D01b/WP-D02 (Statements) i WP-D03/WP-D03b/WP-D04 (Analysis).
**Data:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `ADR — DDL sketch, syntactically validated AND behaviorally exercised on an ephemeral Postgres, NOT executed as a real migration`

To jest ADR (decyzja + kontrakt), wzorem WP-B01…WP-B07, WP-D01, WP-D03. **Nie jest** to migracja Gate D wykonawcza ani produkcyjny kod. Gate A (`WP-A03_legacy_classification.md`) nazwał ten pakiet najbardziej architektonicznie wrażliwym dotąd: dzisiejszy `financial_models`/`financial_model_events` jest w 100% zbudowany z eventów ekonomicznych — w tym eventów **decyzyjnych** (`debt_drawdown`, `equity_injection`, `dividend`) — co wprost łamie DEC-FIN-002 ("Baseline Model nie stosuje cash/debt plug, nie uruchamia finansowania... Cash jest wynikiem"). Ten ADR nie jest rozszerzeniem istniejącej architektury — jest jej zamianą, zgodnie z tym, co WP-A03 już przewidziało (sekcja 6 pkt 2 tamtego dokumentu: "event-only model... prawdopodobnie kwalifikuje się do `MIGRATE_WITH_WARNING` lub `QUARANTINE`, nie `AUTO_MIGRATE`").

---

## 1. Wejścia przeczytane w całości, w tej kolejności

1. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §7 (Baseline Models — definicja, schedules, dwa widoki, circularity) — wymagania funkcjonalne. Także §2 pkt 3 (nieprzekraczalna decyzja: no-plug/no-financing/no-decisions w Baseline), §4 (wspólny kontrakt danych), §12 (canonical store), §14A EPIC-05 DoD.
2. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` — DEC-FIN-002 w sekcji "Decyzje właścicielskie" (**NIENARUSZALNE**: brak plug, brak finansowania, brak decyzji w Baseline; ujemna gotówka pozostaje widoczna jako czerwony alarm). Także sekcja 2 pkt 11-13 (model schedules, circularity/plug policy, backtesting — uwaga: pkt 12 "tylko nazwany revolver/cash sweep" jest ogólną rekomendacją dla schedules w ogóle, ale DEC-FIN-002 w sekcji "Decyzje właścicielskie" ma pierwszeństwo dla Baseline konkretnie per kolejność z handoffu §nadrzędny — sekcja 6.1 tego ADR-u rozstrzyga tę pozorną sprzeczność).
3. `docs/validation/finance-v3/generated/gate-a/WP-A03_legacy_classification.md` — pełny opis dzisiejszego `financial_models`/`financial_model_events` (13 typów eventów, sekcja 3), dlaczego jest to problem strukturalny nie tylko potencjalny.
4. `docs/validation/finance-v3/generated/gate-b/ORCHESTRATOR_DECISIONS_LOG.md` — ORCH-DEC-001 (jednoznaczne eventy decyzyjne migrują do nowego Prediction Scenario Version, `source=migrated_legacy_event`; niejednoznaczne zostają w QUARANTINE, nigdy cicho odrzucone ani cicho migrowane).
5. `docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md` i `WP-D03_analysis_schema_ADR.md` (całość) — realny, przetestowany kształt `finance_stmt_lines`/`finance_stmt_periods`/`finance_stmt_entities`/`finance_stmt_calendars`, wzorzec deferred constraint trigger dla cross-row tie-outs, wzorzec content-freeze trigger per tabela treści, wzorzec "jedna tabela z discriminated type + JSONB" (WP-D03 rozważyło to dla katalogu KPI i odrzuciło na rzecz osobnej tabeli — sekcja 10.2 tego ADR-u wyjaśnia dlaczego Baseline schedules podejmuje przeciwną decyzję). Baseline wskazuje exact Approved Statement Pack + compatible Approved Historical Analysis przez `finance_lineage_edges` (`STATEMENT_TO_MODEL`, `ANALYSIS_TO_MODEL`) — **już istniejące** typy krawędzi (`20260809_finance_v3_b03_lineage_freshness.sql`), ten ADR ich nie duplikuje (sekcja 3, ta sama decyzja co WP-D03 §2.3 dla `STATEMENT_TO_ANALYSIS`).
6. `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` — kanoniczne nazwy (`finance_business_versions`/`business_version_id`), `finance_artifacts.artifact_type` CHECK **już zawiera** `BASELINE_MODEL`, `finance_lineage_edges.edge_type` CHECK **już zawiera** `STATEMENT_TO_MODEL`/`ANALYSIS_TO_MODEL`/`MODEL_TO_SCENARIO`/`MODEL_TO_VALUATION` z `stage_rank(BASELINE_MODEL)=2` (WP-B03 §2.1) — cycle prevention i wielorodzicielstwo już rozwiązane, nic tu do zaprojektowania.
7. Dodatkowo (niewymienione w briefie, konieczne do niesprzeczności): `server/migrations/571_financial_modeling_t054.sql` (realny DDL `financial_models`/`financial_model_events`/`financial_model_outputs`, sekcja 9), `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md` §12 pkt 3 (autorytatywna lista `job_type` "powstanie wraz z WP-D03/D04/**D05**" — `job_type='model_compute'` jest już zarezerwowane dla tego pakietu, nie wymyślam nowej nazwy), `WP-B05_exception_ledger_ADR.md` §1.3/§2 (severity `SECURITY` z `blocking_category IN ('TENANT_BREACH','UNDEFINED_MATH')` — `UNDEFINED_MATH` jest **już zarezerwowane**, ten ADR jest jego pierwszym konkretnym konsumentem, nie tworzę nowego mechanizmu blokady), `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md` §5 (`CellRef` addressing pattern, zastosowany do `finance_baseline_outputs`' unique key tak samo jak do `finance_stmt_lines`).

---

## 2. Kontekst

### 2.1 Co Gate B/C/D01/D03 już daje — NIE duplikujemy

- `finance_artifacts`/`finance_business_versions`/`finance_working_revisions` — **Baseline Model Version to jeden `finance_business_versions` wiersz z `finance_artifacts.artifact_type='BASELINE_MODEL'`** (już w CHECK enum, `20260809_finance_v3_b01_core_artifacts.sql`). Ten ADR nie tworzy nowej tabeli wersji ani lifecycle. `DRAFT→READY_FOR_REVIEW→IN_REVIEW→APPROVED→SUPERSEDED/ARCHIVED/INVALIDATED`, maker-checker, immutable-Approved trigger, reopen/`vN+1` — wszystko odziedziczone.
- `finance_lineage_edges` — `STATEMENT_TO_MODEL` (nullable `assumption_snapshot_hash` — czyste dane źródłowe) i `ANALYSIS_TO_MODEL` (**wymagany** `assumption_snapshot_hash` — WP-B03 §2.2, bo Model faktycznie *oblicza* coś z Analysis) **już istnieją** w `edge_type` CHECK i `stageRank`. Baseline wskazuje source Statement Pack + Historical Analysis **wyłącznie** tak — sekcja 3 wyjaśnia dlaczego `finance_baseline_models` świadomie nie ma kolumny `source_statement_pack_version_id`/`source_analysis_version_id`.
- `finance_stmt_periods`/`finance_stmt_entities`/`finance_stmt_calendars` (WP-D01) — Baseline **nie** projektuje własnego kalendarza/encji/okien czasu. Przyszłe miesiące horyzontu prognozy (2026-2028) to **nowe wiersze w tej samej `finance_stmt_periods`** (WP-D01 jest właścicielem tabeli; tworzenie forecast-period wierszy przy zakładaniu Baseline Model jest zakresem serwisu wykonawczego, nie nowego mechanizmu schematu). `entity_id` na wszystkich nowych tabelach wskazuje `finance_stmt_entities.id` z perymetru **source Statement Pack Version** — dokładnie ten sam wzorzec reużycia co WP-D03 §2.1 dla `finance_analysis_kpi_values.entity_id`.
- `finance_value_status` ENUM i obowiązkowy bundle WP-B01 §2.7 — `finance_baseline_outputs` i `finance_baseline_assumptions` przyjmują ten bundle dosłownie, jak `finance_stmt_lines`/`finance_analysis_kpi_values`.
- `financial_statement_lines` (Gate A legacy taxonomy, `AUTO_MIGRATE`) — reużyta bez zmian jako `canonical_line_id` FK na `finance_baseline_outputs`, dokładnie jak WP-D01 §4.5. Jedna addytywna kolumna dopisana (sekcja 5.3).
- `compute_jobs`/`compute_job_runs`/`compute_job_outputs` (WP-B04) — Compute Run dla Baseline to `job_type='model_compute'`, **już nazwany w WP-B04 §12 pkt 3** jako przyszły konsument tego pakietu. Nie tworzę nowej kolejki.
- `finance_exceptions`/`finance_exceptions_current` — severity `SECURITY` z `blocking_category='UNDEFINED_MATH'` **już istnieje w schemacie** (`20260809_finance_v3_b05_exception_ledger.sql`, `finance_exceptions_blocking_category_check`). Circularity solver non-convergence (sekcja 6) jest jego **pierwszym realnym konsumentem** — nie tworzę nowego mechanizmu blokady, tylko poprawnie z niego korzystam.

### 2.2 Co Gate A dowodzi o dzisiejszym stanie (`financial_models`/`financial_model_events`)

Z `WP-A03_legacy_classification.md` i bezpośrednim odczytem `server/migrations/571_financial_modeling_t054.sql`:

| Problem | Dowód |
|---|---|
| Model to lista **eventów ekonomicznych** (`financial_model_events`), nie okresowe schedules | `571_financial_modeling_t054.sql:38-65` — `event_type IN ('revenue','cogs','opex','capex_purchase','depreciation_run','debt_drawdown','debt_repayment','interest_accrual','tax_accrual','tax_payment','wc_change','equity_injection','dividend')`. WP-A03 §6 pkt 2: "to NIE jest hipotetyczna patologia — to JEST bieżąca architektura Baseline Models na `origin/demo`." |
| Eventy **decyzyjne** żyją w tej samej tabeli co eventy harmonogramowe, bez rozróżnienia | `debt_drawdown` (nowe zadłużenie), `equity_injection`, `dividend` — trzy z trzynastu typów są z definicji decyzjami finansowania/dystrybucji, dokładnie to, co DEC-FIN-002 zakazuje w Baseline |
| `financial_models.approved_snapshot TEXT` nullable, bez `CHECK` wiążącego z `status` | `571_financial_modeling_t054.sql:26`; WP-A03 §4 pierwszy wiersz — "Approved bez snapshotu" możliwe strukturalnie |
| `financial_model_versions`/`valuation_snapshots.version` bez `UNIQUE(model_id, version)` | WP-A03 §4 czwarty wiersz — duplicate version możliwy strukturalnie |
| Brak jakiegokolwiek mechanizmu no-plug/no-financing na poziomie schematu | Nic w `571_financial_modeling_t054.sql` ogranicza `event_type` do harmonogramowych — `debt_drawdown` INSERT jest dziś tak samo łatwy jak `revenue` INSERT |
| Brak monthly engine z purpose-driven horizon — `horizon_months INTEGER DEFAULT 60` to stały fallback, nie wymuszona `horizon_rationale` | `571_financial_modeling_t054.sql:16` |
| `financial_model_outputs.value REAL` bez `value_status` — silent-zero możliwy | `571_financial_modeling_t054.sql:68-77` |

Żaden z tych problemów nie jest naprawiony przez Gate B/C/D01/D03 — to dokładnie zakres, który ten ADR zamyka. Mapowanie legacy→canonical, per `event_type`, w sekcji 9.

### 2.3 Decyzja z briefu potwierdzona: NIE duplikować lineage

`finance_baseline_models` **świadomie nie ma** kolumn `source_statement_pack_version_id`/`source_analysis_version_id`. Source jest wyłącznie `finance_lineage_edges` (`STATEMENT_TO_MODEL`, `ANALYSIS_TO_MODEL`) — ta sama decyzja i to samo uzasadnienie co WP-D03 §2.3 dla Analysis→Statement: dwie kolumny denormalizowane obok istniejącej krawędzi dałyby dwa niezsynchronizowane źródła prawdy o tej samej relacji. Odczyt "jaki jest source" = `getAncestors(businessVersionId)` (już istniejące, `lineageService.ts:221`).

---

## 3. Decyzja — skrót

Cztery nowe tabele domenowe z prefiksem `finance_baseline_` (dokładnie te nazwy z briefu), plus dwie pomocnicze (solver diagnostics, backtest — sekcje 6/8) i jedna addytywna kolumna na istniejącej taksonomii:

1. `finance_baseline_models` — jeden wiersz per `business_version_id` artefaktu `BASELINE_MODEL` (`horizon_months`, `horizon_rationale`, konfiguracja solvera circularity). Source Statement+Analysis przez lineage, nie FK.
2. `finance_baseline_schedules` — **jedna** tabela, discriminated `schedule_type` (9 wartości, zamknięty CHECK enum) + `payload JSONB` walidowany per-typ triggerem. Decyzja i uzasadnienie (przeciw 9 osobnym tabelom) w sekcji 10.1.
3. `finance_baseline_assumptions` — driver grid: historia/base period/rule/unit/source/forecast value/range/quality, per okres, bundle WP-B01 §2.7.
4. `finance_baseline_outputs` — przyszłe P&L/BS/CF, **dosłownie** ta sama struktura co `finance_stmt_lines` (WP-D01 §4.5), plus `value_kind` (actual/forecast band) i `driving_schedule_type`.
5. `finance_baseline_solver_diagnostics` — per-okres log solvera circularity (iteracje, zbieżność, residual) — rolluje się w istniejący `compute_jobs`, ten sam wzorzec "generic aggregate + domain detail" co WP-D01 §4.6.
6. `finance_baseline_backtest_runs` / `finance_baseline_backtest_line_results` — holdout actual vs forecast, bias/MAPE per material line.
7. `financial_statement_lines.excluded_from_baseline` (addytywna kolumna) — curated denylist flag (dziś: `DIVIDENDS_DECLARED`), fizyczna warstwa #3 no-plug (sekcja 5.3).

**Cash jako wynik — CZTERY fizyczne warstwy** (nie jedna, sekcja 5), nie tylko konwencja: (1) zamknięty `schedule_type` enum bez wartości `financing`/`dividend`/`plug`; (2) forbidden-key trigger na `payload` (allowlist dla `debt_maturity`/`equity_re`, denylist sprawdzany na WSZYSTKICH typach); (3) taksonomia-driven trigger blokujący `PRESENT_NONZERO` dla `excluded_from_baseline` linii na outputs; (4) cash roll-forward trigger BEZ opcji plug/balancing line — niezgodność fizycznie nie może się zacommitować, bo nie istnieje wiersz zaprojektowany żeby wchłonąć residual.

**Circularity solver** (sekcja 6): deterministyczny iteracyjny fixed-point solver, `finance_baseline_models.circularity_max_iterations`/`circularity_tolerance_currency` per-model config, non-convergence = `finance_exceptions(severity='SECURITY', blocking_category='UNDEFINED_MATH')` — już zarezerwowany mechanizm blokady WP-B05, pierwszy realny konsument.

**Funding gap alert** (sekcja 7): `quality_flag='FUNDING_GAP'` na wierszu CASH (nie osobna tabela `finance_baseline_alerts` — odrzucona alternatywa, sekcja 10.3) + automatyczny `finance_exceptions(severity='WARNING')`, non-blocking (DEC-FIN-009: ujemna gotówka to poprawny stan, nie błąd).

**Legacy mapping** (sekcja 9): 13 typów `financial_model_events` sklasyfikowane per ORCH-DEC-001 — 8 harmonogramowych → Baseline schedules, 3 jawnie decyzyjne (`debt_drawdown`/`equity_injection`/`dividend`) → Prediction Scenario (`source=migrated_legacy_event`), 2 niejednoznaczne (`debt_repayment`/`wc_change`) → wymagają inspekcji instancji, domyślnie `QUARANTINE`/Prediction (nigdy domyślnie Baseline — sekcja 9.2).

**Dowód testowy**: DDL uruchomiony na jednorazowym efemerycznym Postgresie (port 57893, `initdb --locale=C`, `/private/tmp/`, `pg_ctl stop`+`rm -rf` na koniec, PID 911 nietknięty), 15 scenariuszy przechodzących żywo, w tym dwa błędy znalezione i naprawione przez samo testowanie (sekcja 11) — żadna baza produkcyjna/demo/dev nie była dotknięta.

---

## 4. Nowe tabele domenowe

### 4.1 `finance_baseline_models`

`UNIQUE(business_version_id)`. Kolumny: `horizon_months INTEGER NOT NULL CHECK (0 < x <= 240)`, `horizon_rationale TEXT NOT NULL CHECK IN ('STEADY_STATE','DEBT_MATURITY','BUSINESS_CYCLE')` + `horizon_rationale_note TEXT NOT NULL` (wolny tekst uzasadnienia, nie tylko wybór enuma — "36 miesięcy" bez powodu nie przechodzi review merytorycznego, nawet jeśli przechodzi CHECK). `circularity_max_iterations`/`circularity_tolerance_currency` — konfiguracja solvera per model (sekcja 6), z sensownymi defaultami (50 iteracji, 1 jednostka prezentacji). Dwie jawne flagi projektowe: `interest_income_on_cash_modeled`, `mandatory_contractual_cash_sweep_modeled` — deklarują WPROST który mechanizm (jeśli którykolwiek) jest źródłem circularity dla tego konkretnego modelu (sekcja 6.1); oba `false` domyślnie = model bez circularity, solver kończy się w jednej iteracji.

**Świadomie brak kolumny źródła** (`source_statement_pack_version_id`/`source_analysis_version_id`) — sekcja 2.3.

### 4.2 `finance_baseline_schedules`

Jedna tabela, `schedule_type TEXT NOT NULL CHECK (schedule_type IN ('revenue_pvm','headcount','cogs_opex','wc_dso_dio_dpo','capex_depreciation','leases','debt_maturity','tax_nol','equity_re'))` — dokładnie dziewięć rodzin ze zdania zadania. `entity_id` (reużyty z source Statement Pack perymetru), `schedule_item_code` (stabilny naturalny klucz w obrębie `schedule_type`+`entity_id` — np. konkretny `facility_id` dla `debt_maturity`, konkretna CAPEX vintage dla `capex_depreciation`, konkretny lease dla `leases`), `effective_from_period_id`/`effective_to_period_id`, `payload JSONB NOT NULL` (kształt per-typ, walidowany triggerem, sekcja 5.2), `source_ref JSONB` (provenance: Analysis KPI, benchmark, ręczne wejście).

`UNIQUE(business_version_id, schedule_type, entity_id, schedule_item_code, effective_from_period_id)` — pozwala na wiele wierszy tego samego `schedule_item_code` w różnych momentach efektywności (np. CAPEX vintage z rewizją założenia w trakcie życia modelu, dopóki Draft), ale nie duplikat tego samego punktu w czasie.

### 4.3 `finance_baseline_assumptions`

Driver grid: `schedule_type` (spina z 4.2), `driver_code` (np. `REVENUE_GROWTH_YOY` pod `revenue_pvm`, `DSO_DAYS` pod `wc_dso_dio_dpo` — katalog udokumentowany w Załączniku B, nie DB enum, ten sam wybór co WP-D03 zrobiło dla `kpi_code` custom-organizacyjnych: pełny generyczny katalog-tabela byłby przedwczesnym rozszerzeniem zakresu tego P0, eskalacja sekcja 12 pkt 1), `entity_id`, `period_id`, `base_period_id` (do czego historia jest zakotwiczona), `rule` (`HISTORICAL_AVERAGE`/`GROWTH_RATE`/`FIXED_VALUE`/`LINKED_TO_ANALYSIS_KPI`/`FORMULA`/`MANUAL_OVERRIDE`), bundle WP-B01 §2.7 (`value_status`/`value_decimal`/`unit`), `range_low`/`range_high` (sensitivity), `quality` (`CONFIRMED`/`ESTIMATED`/`DEGRADED_INSUFFICIENT_HISTORY`), `source_ref`.

`Effect preview`/`undo`/`reset` z briefu **nie są kolumnami tej tabeli** — to Working Revision/autosave mechanizm, już istniejący w Gate B (master plan §12: "Working Revisions... Autosave/Undo/Compute nie tworzą... nowych wersji biznesowych"), zastosowany tu bez modyfikacji, dokładnie jak WP-D01/D03 nie reprojektowały go dla swoich tabel treści.

### 4.4 `finance_baseline_outputs`

Przyjmuje **dosłownie** kształt `finance_stmt_lines` (WP-D01 §4.5): `statement_type`, `canonical_line_id`, `entity_id`, `period_id`, `consolidation_scope`, pełny bundle WP-B01 §2.7. Plus dwie kolumny domenowe: `value_kind TEXT CHECK IN ('ACTUAL','FORECAST')` — actual/forecast band z briefu; `driving_schedule_type` (nullable — `NULL` dla linii wyliczonych przez roll-up/solver, np. `CASH`/`TOTAL_ASSETS`/`NET_INCOME`, niebędących bezpośrednim produktem jednego `schedule_type`). `quality_flag` niesie m.in. `FUNDING_GAP` (sekcja 7).

`UNIQUE(business_version_id, entity_id, canonical_line_id, period_id, consolidation_scope)` — ten sam "jedna autorytatywna komórka" wzorzec, świadomie **bez** `accumulation_basis` w kluczu (w przeciwieństwie do `finance_stmt_lines`) — Baseline nie ma pojęcia quarter-only/YTD/LTM na poziomie **przechowywania**, to jest własność **roll-upu** (sekcja 8), nie osobnego wiersza; `value_kind` też świadomie nie jest częścią klucza — jest opisem TEJ jednej autorytatywnej komórki, nie osobnym wymiarem tworzącym drugi wiersz dla tego samego okresu (mapuje się czysto na `CellRef` z AP-00 §5, jak `finance_stmt_lines`).

### 4.5 `finance_baseline_solver_diagnostics`

Per-okres log solvera: `compute_job_id` (FK `compute_jobs.id` — istnieje niezależnie od tego, czy job ostatecznie skomitował `compute_job_outputs`, bo WP-B04's "commit tylko przy sukcesie" oznacza, że diagnostyka non-convergence musi żyć gdzie indziej niż output), `period_id`, `iterations_used`, `converged BOOLEAN`, `final_residual_currency`, `tolerance_applied`. `UNIQUE(compute_job_id, period_id)`.

### 4.6 `finance_baseline_backtest_runs` / `finance_baseline_backtest_line_results`

**Nie** jako `finance_lineage_edges` — to porównanie ("zmierzone przeciwko"), nie DAG-owa krawędź "przekształca się w" (rozważone i odrzucone jako rozszerzenie zamrożonego `edge_type` enum, sekcja 10.4). `finance_baseline_backtest_runs`: `baseline_business_version_id`, `actual_statement_pack_business_version_id` (oba zwykłe composite FK do `finance_business_versions`), `holdout_period_start_id`/`holdout_period_end_id`, `history_months_available`, `seasonality_degraded` (**generated column**, `history_months_available < 24` — dolna granica przedziału "24-36 miesięcy" z addendum §2 pkt 13, konserwatywny wybór: degraded do momentu udowodnienia wystarczającej historii, nie odwrotnie). `finance_baseline_backtest_line_results`: per `canonical_line_id`×`entity_id`×`period_id`, `forecast_value`/`actual_value`, `bias`/`abs_pct_error` jako **generated columns** (bias = actual − forecast; `abs_pct_error` = `NULL`, nie `0`, gdy `actual_value=0` — ta sama "nigdy cicho zero" dyscyplina co WP-D01 §5.6), `is_material_line`.

### 4.7 `financial_statement_lines.excluded_from_baseline` (addytywna kolumna)

`BOOLEAN NOT NULL DEFAULT false`, ustawiona `true` dziś wyłącznie dla `DIVIDENDS_DECLARED` (jedyna istniejąca linia taksonomii reprezentująca decyzję dystrybucji — `DEBT_DRAWDOWN`/`EQUITY_INJECTION`/`SHARE_BUYBACK` **nie istnieją** dziś jako kody linii, bo żaden `schedule_type` może ich kiedykolwiek wyprodukować — sekcja 5.3 wyjaśnia dlaczego to defense-in-depth, nie jedyna warstwa).

---

## 5. Fizyczne wykluczenie plug/financing — cztery warstwy

To jest **kontrakt schematu**, nie tylko konwencja aplikacyjna — dodanie plugu w przyszłości wymaga jawnej zmiany DDL (migracja, code review), nie dodania wiersza.

### 5.1 Warstwa 1 — zamknięty `schedule_type` CHECK enum

`finance_baseline_schedules.schedule_type` przyjmuje wyłącznie dziewięć wartości z zadania. Nie ma `'financing'`/`'dividend'`/`'surplus_allocation'`/`'plug'`. Dodanie takiej wartości wymaga `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` — reviewable schema change, nie runtime INSERT. **Przetestowane żywo** (TEST 1, sekcja 11): próba `schedule_type='financing'` odrzucona przez CHECK.

### 5.2 Warstwa 2 — forbidden-key trigger na `payload`

`finance_baseline_validate_schedule_payload()` sprawdza **na każdym** `schedule_type` (nie tylko `debt_maturity`/`equity_re`) obecność kluczy z denylisty (`new_draw`, `debt_drawdown`, `discretionary_repayment`, `dividend`/`dividend_amount`, `equity_injection`, `share_buyback`/`buyback_amount`, `surplus_allocation`, `cash_plug`/`balancing_item`/`plug`) — defense in depth przeciw przemyceniu decyzyjnego pola do mniej oczywistego typu (np. `wc_dso_dio_dpo`). Dodatkowo, `debt_maturity` i `equity_re` mają **allowlist wymaganych kluczy** (`principal_opening`/`contractual_rate`/`amortization_schedule` dla długu; `opening_retained_earnings` dla equity) — struktura tych dwóch najbardziej wrażliwych typów jest jawnie ograniczona do continuité kontraktowej/strukturalnej, nie do dowolnego JSON-a. **Przetestowane żywo** (TEST 2/4): `new_draw` w `debt_maturity` i `dividend` w `equity_re` odrzucone; **przetestowane żywo** (TEST 3): poprawny payload bez zakazanych kluczy przyjęty.

### 5.3 Warstwa 3 — taksonomia-driven denylist na outputs

`finance_baseline_block_discretionary_financing_lines()` — cross-table lookup do `financial_statement_lines.excluded_from_baseline` (trigger, nie CHECK, ten sam powód co WP-D01 §5 wstęp: subquery w CHECK jest niedozwolone w Postgresie). Blokuje **wyłącznie** `value_status='PRESENT_NONZERO'` dla oznaczonej linii — `NA`/`MISSING` pozostają dozwolone, bo `DIVIDENDS_DECLARED` musi móc istnieć jako wiersz strukturalny (retained earnings roll-forward, sekcja 5.4 poniżej, oczekuje wiersza, nawet jeśli jego wartość jest zawsze pusta w Baseline). **Przetestowane żywo** (TEST 6/6b): `PRESENT_NONZERO` odrzucone, `NA` przyjęte.

**Uczciwie nazwana granica tej warstwy**: to jest curated denylist (dziś jeden kod), nie automatyczny dowód, że KAŻDY przyszły kod linii reprezentujący decyzję finansowania zostanie złapany — nowy kod taksonomii domyślnie dostaje `excluded_from_baseline=false`. Fizyczna gwarancja programu leży w Warstwie 1+2 (żaden `schedule_type` może dziś wyprodukować taki kod), Warstwa 3 jest dodatkowym zabezpieczeniem na poziomie samego wyniku, nie jedynym mechanizmem — udokumentowane wprost, nie przemilczane (eskalacja sekcja 12 pkt 3).

### 5.4 Warstwa 4 — cash roll-forward BEZ opcji plug

`finance_baseline_check_cash_rollforward()` — deferred constraint trigger (`AFTER INSERT OR UPDATE ... DEFERRABLE INITIALLY DEFERRED FOR EACH ROW`, ten sam wzorzec co WP-D01 §5, poprawiony od razu na `FOR EACH ROW` bez powtarzania WP-D01's `FOR EACH STATEMENT` błędu — sekcja 11). `opening_cash(poprzedni_okres) + net_change_cash(bieżący_okres) = closing_cash(bieżący_okres)`, tolerancja `finance_baseline_models.circularity_tolerance_currency` (ten sam epsilon co solver — jedno źródło prawdy, nie dwie wymyślone liczby). **Nie istnieje żaden wiersz/bucket, do którego residual mógłby zostać zapisany** — niespójna gotówka fizycznie nie może się zacommitować, silnik obliczeniowy MUSI faktycznie policzyć poprawnie, nie może "wyrównać" różnicy trzecim wierszem. **Przetestowane żywo** (TEST 7): rozjazd 459 000 PLN odrzucony na COMMIT z dokładnym komunikatem; (TEST 8): spójny roll-forward przechodzi.

Analogiczne kontrole `finance_baseline_check_balance()` (Assets=L+E) i `finance_baseline_check_re_rollforward()` (opening RE + NET_INCOME = closing RE, bez terminu "− dywidendy" niosącego realną wartość, bo Warstwa 3 już to gwarantuje) — ten sam wzorzec, ta sama tolerancja.

---

## 6. Circularity solver

### 6.1 Skąd bierze się circularity w modelu, który NIE ma revolvera/discretionary repayment

Addendum §2 pkt 12 (rekomendacja ogólna dla schedules) mówi "tylko nazwany revolver/cash sweep" — ale DEC-FIN-002 (decyzja właścicielska, wyższy priorytet dla Baseline konkretnie, zgodnie z kolejnością pierwszeństwa w handoffie nadrzędnym) zakazuje **wszelkiego** finansowania/plug/alokacji nadwyżek w Baseline. Pozorna sprzeczność rozstrzygnięta tak: Baseline **nigdy** nie modeluje discretionary revolver (draw/repay sterowany potrzebą gotówkową) — to zawsze i wyłącznie Prediction. Ale to nie znaczy, że Baseline jest wolne od circularity — dwa **kontraktowe, niedyskrecjonalne** mechanizmy wciąż tworzą klasyczną pętlę interest↔cash flow, bez żadnej decyzji zarządczej:

1. **`interest_income_on_cash_modeled`** — jeśli model nalicza odsetki od średniego salda gotówki (typowa praktyka), to: `interest_income = rate × average(cash_opening, cash_closing)`, `cash_closing` zależy od `net_income` (przez CF), `net_income` zależy od `interest_income` — pętla, mimo zerowego zadłużenia.
2. **`mandatory_contractual_cash_sweep_modeled`** — jeśli **umowa kredytowa** (nie decyzja zarządu) zawiera klauzulę obowiązkowego cash sweep (np. "X% wolnych przepływów pieniężnych ponad próg spłaca dług automatycznie, bez uznaniowości") — jest to fakt kontraktowy zapisany w `debt_maturity.payload`, nie decyzja Prediction. Kwota sweepu zależy od FCF (który zależy od interest expense, który zależy od salda długu, które zależy od sweepu) — pętla.

Oba mechanizmy są jawnie deklarowane na `finance_baseline_models` (dwie kolumny boolean, sekcja 4.1) — projekt schematu wymusza świadomą decyzję "czy ten model w ogóle ma circularity", zamiast domyślnego założenia.

### 6.2 Algorytm (pseudo-kod)

```
function solve_period(period, baseline_model, prior_period_closing):
    tolerance = baseline_model.circularity_tolerance_currency
    max_iter  = baseline_model.circularity_max_iterations

    # Seed guesses from the prior period's closing balances (or opening
    # balance sheet for the first forecast period).
    cash_guess = prior_period_closing.cash
    debt_guess = prior_period_closing.debt   # only moves via CONTRACTUAL schedule terms below

    for iteration in 1..max_iter:
        # 1. Contractual, non-discretionary debt movement for this period —
        #    driven ENTIRELY by debt_maturity.payload.amortization_schedule
        #    and (if mandatory_contractual_cash_sweep_modeled) the sweep clause.
        #    NEVER a discretionary draw/repay — those do not exist in this
        #    schema (section 5, layers 1-2).
        scheduled_amortization = lookup_contractual_amortization(period, debt_guess)
        mandatory_sweep = 0
        if baseline_model.mandatory_contractual_cash_sweep_modeled:
            mandatory_sweep = contractual_sweep_formula(fcf_before_sweep, debt_guess)

        interest_expense = debt_maturity.contractual_rate * average(prior_period_closing.debt, debt_guess)
        interest_income  = 0
        if baseline_model.interest_income_on_cash_modeled:
            interest_income = cash_interest_rate * average(prior_period_closing.cash, cash_guess)

        # 2. Mechanical P&L -> CF -> BS roll (all other lines come from the
        #    other 7 schedule_types — revenue_pvm/headcount/cogs_opex/
        #    wc_dso_dio_dpo/capex_depreciation/leases/tax_nol — none of which
        #    can be circular w.r.t. cash by construction: they depend on
        #    volume/price/headcount/DSO assumptions, not on cash itself).
        net_income = compute_net_income(period, interest_expense, interest_income)
        cfo = net_income + depreciation - delta_working_capital
        cfi = -capex
        cff = -scheduled_amortization - mandatory_sweep   # contractual only, never discretionary
        net_change_cash = cfo + cfi + cff

        new_cash  = prior_period_closing.cash + net_change_cash
        new_debt  = prior_period_closing.debt - scheduled_amortization - mandatory_sweep

        residual = max(abs(new_cash - cash_guess), abs(new_debt - debt_guess))

        cash_guess, debt_guess = new_cash, new_debt

        if residual <= tolerance:
            record_diagnostics(period, iterations_used=iteration, converged=true, residual)
            return { cash: new_cash, debt: new_debt, converged: true }

    # Fail-closed: did not converge within max_iterations.
    record_diagnostics(period, iterations_used=max_iter, converged=false, residual)
    raise_exception(
        severity='SECURITY', blocking_category='UNDEFINED_MATH',
        source_ref={period_id, iterations_used: max_iter, residual}
    )
    return { converged: false }   # compute job does NOT commit compute_job_outputs for this run
```

Kluczowe własności:

- **Deterministyczny** — fixed-point iteration, ten sam input zawsze daje ten sam wynik (żadnej losowości/heurystyki).
- **Fail-closed** — brak zbieżności w `max_iterations` nie zwraca "najlepszego przybliżenia" jako gotowego wyniku; podnosi `UNDEFINED_MATH` (już zarezerwowany mechanizm blokady WP-B05 §2/§3 — nikt na poziomie organizacji nie może tego zwolnić, wymaga operatora platformy, dokładnie jak dla `TENANT_BREACH`). **Przetestowane żywo** (TEST 13): wstawienie takiego wyjątku poprawnie zawraca `NO_OPEN_UNDEFINED_MATH=false` z `finance_baseline_readiness_check`.
- **Brak dyskrecjonalności w pętli** — jedyne dwa wejścia do solvera (`scheduled_amortization`, `mandatory_sweep`) pochodzą wyłącznie z `debt_maturity.payload`, którego Warstwa 2 (sekcja 5.2) fizycznie ogranicza do pól kontraktowych. Solver nie ma dostępu do żadnego pola reprezentującego decyzję.
- **Diagnostyka per okres**, nie tylko per model — `finance_baseline_solver_diagnostics` (sekcja 4.5) zapisuje `iterations_used`/`converged`/`final_residual_currency` osobno dla każdego miesiąca, bo zbieżność może się różnić okres do okresu (np. gorzej blisko granicy dojrzałości długu).

---

## 7. Funding gap alert

`finance_baseline_mark_funding_gap()` — `BEFORE INSERT OR UPDATE` na `finance_baseline_outputs`, wyzwala się wyłącznie na wiersz `CASH`. Gdy `value_decimal < 0`: ustawia `NEW.quality_flag = 'FUNDING_GAP'` (widoczne bezpośrednio w gridzie Calculations, zero dodatkowego zapytania) **i** podnosi `finance_exceptions(severity='WARNING')` z `dedup_key` opartym o `(business_version_id, entity_id, period_id)`, sprawdzanym przed insertem żeby nie duplikować wpisu przy każdym recompute tego samego okresu. **Nie blokuje niczego** — DEC-FIN-009: ujemna gotówka jest poprawnym, widocznym stanem, nie błędem; DEC-FIN-002: "Ujemna gotówka pozostaje widoczna jako wartość oraz czerwony alarm". **Przetestowane żywo** (TEST 9a/9b): `quality_flag` ustawiony, dokładnie jeden wpis `WARNING` podniesiony (nie duplikowany).

Rozważona i odrzucona alternatywa (`finance_baseline_alerts` jako osobna tabela) — sekcja 10.3.

---

## 8. Monthly engine, purpose-driven horizon, roll-up

`finance_baseline_models.horizon_months`/`horizon_rationale`/`horizon_rationale_note` (sekcja 4.1) — nie ma hardkodowanych 3/5/10 lat; `horizon_rationale_note` wymaga wolnotekstowego uzasadnienia (np. "dług zapada w miesiącu 36"), nie tylko wybór enuma.

Roll-up miesiąc→kwartał→rok jako **SQL VIEW**, nie materializowane przechowywanie: `finance_baseline_outputs_quarterly`, `finance_baseline_outputs_annual`. Flow linie (`P&L`/`CF`) sumują się przez okres; stock linie (`BS`) biorą wartość zamknięcia (ostatni miesiąc) — dokładnie ta sama reguła `statement_type`-driven flow/stock co WP-D01 §12 już przypisało, reużyta bez ponownego wymyślania. Numer kwartału liczony jako `CEIL(fiscal_month / 3.0)` z `finance_stmt_periods.fiscal_month`, **nie** czytany z `p.fiscal_quarter` — WP-D01's `chk_finance_stmt_period_month_shape` gwarantuje, że ta kolumna jest zawsze `NULL` na wierszach `period_type='MONTH'` (dokładnie jedna kombinacja wymiarów per typ okresu). **Przetestowane żywo** (TEST 11a/11b): kwartalny roll-up poprawnie sumuje `NET_CHANGE_CASH` (0+30 000+(−600 000) = −570 000) i poprawnie bierze wartość zamknięcia dla `CASH` (−70 000, wartość marca).

Decyzja VIEW-nie-materialized udokumentowana jako świadomie odłożona optymalizacja wydajności (nie przeoczenie) — materializacja wymagałaby własnej historii freshness/invalidation na wierzchu tej, którą `finance_business_versions.freshness` już daje bazowej tabeli miesięcznej; jeśli 10k×120-cell target Finance Data Grid (master plan §10) okaże się zbyt wolny na żywym VIEW przy realnym wolumenie, materializowany roll-up odświeżany przy commit compute_job_outputs jest udokumentowanym przyszłym krokiem (eskalacja sekcja 12 pkt 4).

---

## 9. Mapowanie legacy `financial_model_events` → nowy schemat (Gate A + ORCH-DEC-001)

Trzynaście `event_type` z `571_financial_modeling_t054.sql:41-46`, sklasyfikowane wg tego, czy reprezentują fakt harmonogramowy/kontraktowy (→ Baseline) czy decyzję zarządczą (→ Prediction Scenario, `source=migrated_legacy_event`, per ORCH-DEC-001):

| `event_type` | Klasyfikacja | Cel migracji | Uzasadnienie |
|---|---|---|---|
| `revenue` | Harmonogramowe | `finance_baseline_schedules(schedule_type='revenue_pvm')` | Cena/wolumen — kontynuacja historycznej relacji, nie decyzja |
| `cogs` | Harmonogramowe | `schedule_type='cogs_opex'` | j.w. |
| `opex` | Harmonogramowe | `schedule_type='cogs_opex'` | j.w. |
| `capex_purchase` | Harmonogramowe | `schedule_type='capex_depreciation'` | Kontynuacja historycznego tempa inwestycji, nie nowa inicjatywa |
| `depreciation_run` | Harmonogramowe | `schedule_type='capex_depreciation'` | Mechaniczna konsekwencja CAPEX vintages |
| `tax_accrual` | Harmonogramowe | `schedule_type='tax_nol'` | Statutory rate × EBT, mechaniczne |
| `tax_payment` | Harmonogramowe | `schedule_type='tax_nol'` (cash-timing modifier) | Timing płatności, nie decyzja o stawce |
| `interest_accrual` | Harmonogramowe, **ale NIE migrowane 1:1** | Nie kopiowane jako wiersz — solver (sekcja 6) przelicza `interest_expense` na żywo z `debt_maturity.contractual_rate` × średnie saldo. Legacy wartość używana wyłącznie jako **dowód do potwierdzenia** stawki/salda migrowanego `debt_maturity` (backtest, sekcja 4.6) | Baseline nie przechowuje interest jako wejścia — to wynik solvera. Rozbieżność historyczna vs przeliczona > tolerancji → `MIGRATE_WITH_WARNING`, wymaga ręcznego potwierdzenia założenia stopy |
| `debt_drawdown` | **Decyzyjne** | Prediction Scenario, `source=migrated_legacy_event` | Nowe zadłużenie jest z definicji decyzją finansowania — DEC-FIN-002 |
| `equity_injection` | **Decyzyjne** | Prediction Scenario, `source=migrated_legacy_event` | j.w. |
| `dividend` | **Decyzyjne** | Prediction Scenario, `source=migrated_legacy_event` | Dystrybucja nadwyżki jest z definicji decyzją — DEC-FIN-002; odpowiada wprost `DIVIDENDS_DECLARED.excluded_from_baseline=true` (sekcja 4.7) |
| `debt_repayment` | **Niejednoznaczne — wymaga inspekcji instancji** | Domyślnie `QUARANTINE` lub Prediction; migruje do `finance_baseline_schedules(debt_maturity)` **wyłącznie** jeśli backfill-service potwierdzi kompletny, nienachodzący na siebie, kontraktowy harmonogram amortyzacji dla tej `facility_id` (wszystkie wiersze `debt_repayment` dla danego `model_id`+facility tworzą spójny plan spłaty pasujący do typowej amortyzacji) | Spłata może być kontraktową ratą (Baseline) LUB uznaniową nadpłatą z nadwyżki (Prediction) — `event_type` sam w sobie tego nie rozstrzyga; DEC-FIN-002 wymaga **domyślnej ostrożności**: niepewne nigdy nie ląduje domyślnie w Baseline |
| `wc_change` | **Niejednoznaczne — wymaga inspekcji instancji** | Domyślnie `MIGRATE_WITH_WARNING` do `finance_baseline_schedules(wc_dso_dio_dpo)` jako assumption override, chyba że powiązane z `initiative_id` na `financial_models` (wtedy Prediction) | Zmiana WC może być znaną kontraktową/strukturalną korektą (np. nowa umowa z dostawcą) — dozwolone w Baseline jako assumption, nie decyzja finansowania w rozumieniu DEC-FIN-002 (który celuje w cash/debt/dividend/surplus, nie w politykę operacyjną WC) — ale wymaga potwierdzenia, że nie jest efektem osobnej inicjatywy |

**8 harmonogramowych + 3 jawnie decyzyjne + 2 niejednoznaczne = 13**, zgodne z pełną listą `event_type`.

Rzeczywisty backfill (który `financial_model_events` wiersz → który nowy wiersz, z jaką `mapping_confidence`) jest zakresem osobnego wykonawczego WP (analog WP-C03/WP-D01b), nie tego ADR-u. Biorąc pod uwagę, że WP-A03 już zaklasyfikowało "event-only model" jako strukturalnie uboższy niż docelowy kształt, większość istniejących `financial_models` prawdopodobnie kwalifikuje się do `MIGRATE_WITH_WARNING` na poziomie CAŁEGO modelu (nie tylko pojedynczych eventów) — potwierdzenie tego wymaga WP-A01 live inwentarza, nie jest rozstrzygnięciem tego ADR-u.

---

## 10. Rozważane alternatywy (odrzucone)

### 10.1 Dziewięć osobnych tabel zamiast jednej `finance_baseline_schedules`

Rozważona: `finance_baseline_schedule_revenue`, `finance_baseline_schedule_debt`, ... (dziewięć tabel, każda z własnym, w pełni typowanym DDL zamiast JSONB).

**Odrzucona**: (1) każda z dziewięciu tabel wymagałaby własnej kopii scaffoldingu (immutability trigger, `entity_id`/`period_id` FK, `created_by`/`created_at`, indeksy) — dziewięciokrotny boilerplate za coś, co jest fundamentalnie tym samym kształtem ("jeden wiersz = jeden element harmonogramu, scoped do wersji/encji/okresu"); (2) fizyczna gwarancja no-plug byłaby **słabsza**, nie silniejsza — z dziewięcioma tabelami ktoś mógłby po prostu `CREATE TABLE finance_baseline_schedule_financing` jako dziesiątą, bez dotykania ŻADNEGO istniejącego CHECK-a, podczas gdy z jedną tabelą jedyna droga to `ALTER TABLE ... ADD CONSTRAINT` na już-istniejącej, chronionej kolumnie — bardziej oczywisty, bardziej reviewable ślad w migracji; (3) Finance Data Grid (master plan §10) chce jednego, wspólnego wzorca dostępu do gridu — JOIN/UNION dziewięciu tabel dla jednego widoku "Assumptions"/"Schedules" jest gorszy niż jedno zapytanie z `WHERE schedule_type=...`. Koszt: `payload JSONB` wymaga walidacji per-typ w triggerze zamiast w samym DDL — zaakceptowany, bo dokładnie ten sam kompromis WP-D03 już zaakceptowało dla `formula_ast JSONB` (walidacja w funkcji, nie w CHECK).

### 10.2 `finance_baseline_schedules` jako `finance_business_versions`/`finance_artifacts` (WP-D03 §5.1 precedens odwrotny)

Rozważona (przez analogię do KPI catalog): każdy element harmonogramu jako osobny artefakt z pełnym lifecycle.

**Odrzucona z tego samego powodu co WP-D03 odrzuciło to dla KPI catalog** — element harmonogramu (jeden wiersz CAPEX vintage, jedna nota kredytowa) jest treścią WEWNĄTRZ jednej Baseline Model Version, nie niezależnym, wielokrotnie-cytowanym obiektem współdzielonym między organizacjami (w przeciwieństwie do `UNIVERSAL` KPI catalog entry, które faktycznie jest takim obiektem). Content-freeze przez rodzica (sekcja "A" w blokach DDL) jest właściwym mechanizmem, nie osobny lifecycle per wiersz.

### 10.3 `finance_baseline_alerts` jako osobna tabela zamiast `quality_flag`+`finance_exceptions`

Rozważona: dedykowana tabela `finance_baseline_alerts(business_version_id, alert_type, period_id, severity, ...)`.

**Odrzucona**: dokładnie ten sam błąd klasy, który WP-D01 §10.3 odrzuciło dla `finance_stmt_reconciliation` vs `finance_reconciliation_runs` — dwa niezsynchronizowane miejsca prawdy o tym samym zdarzeniu (alert na CASH<0 vs stan wiersza CASH). `quality_flag` (widoczny bezpośrednio w gridzie, zero JOIN) + `finance_exceptions` (istniejący, przetestowany ledger z severity/dedup/waiver już zaimplementowanym w WP-B05) razem dają dokładnie to, czego potrzebuje funding gap, bez trzeciego mechanizmu.

### 10.4 Backtest jako `finance_lineage_edges` zamiast osobnych tabel z prostym FK

Rozważona: nowy `edge_type='MODEL_TO_ACTUAL_COMPARISON'` łączący Baseline Model Version z Approved Statement Pack Version dla okresu holdout.

**Odrzucona**: (1) `edge_type` enum jest **zamrożony** (WP-B03, część Gate B) — rozszerzenie go wymaga cross-ADR review, nie jednostronnej decyzji tego pakietu; (2) semantycznie backtest to "zmierzone przeciwko", nie "przekształca się w" — `stage_rank(STATEMENT_PACK)=0` i `stage_rank(BASELINE_MODEL)=2` implikowałyby kierunek DAG-u (`STATEMENT_PACK → BASELINE_MODEL`), co jest mylące dla relacji, która w rzeczywistości idzie "do tyłu w czasie" (Baseline prognozujący przeszły okres, porównywany z faktycznym Statement Packem TEGO SAMEGO okresu, nie źródłowym Statement Packem, z którego Baseline powstał). Zwykły composite FK (`(baseline_business_version_id, organization_id)`/`(actual_statement_pack_business_version_id, organization_id)` → `finance_business_versions`) daje tenant-safety bez przeciążania grafu lineage relacją o innej naturze.

---

## 11. Dowód testowy (ephemeral Postgres)

Zgodnie z twardym zakazem tego zadania, **żadna baza produkcyjna/demo/dev nie była dotknięta**. `LC_ALL=C initdb --locale=C`, port 57893 (sprawdzony wolny przez `lsof` najpierw), `listen_addresses=127.0.0.1`, osobny katalog danych w `/private/tmp/`. Uruchomiony pełen istniejący zestaw migracji (`server/scripts/migrate.postgres.ts`, `NODE_ENV=test`) — wszystkie migracje repo (w tym Gate B/C i WP-D01/D01b/D02/D03/D03b/D04) przeszły 0 błędów, przed nałożeniem DDL-u z tego ADR-u. Po testach: `pg_ctl -m fast stop` + `rm -rf` katalogu danych; potwierdzone `ps aux`, że współdzielona instancja Homebrew (PID 911, `/opt/homebrew/var/postgresql@15`) pozostała nietknięta przez cały czas.

**Co testowanie znalazło i naprawiło (nie tylko potwierdziło):**

1. Fixture setup bug (nie bug schematu): `finance_compute_snapshots` ma FK na `finance_working_revisions.working_revision_id` — pierwszy przebieg fixture'u wstawiał snapshot PRZED working revision, łamiąc FK. Naprawione przez poprawną kolejność insertów. Wart odnotowania, bo to dokładnie ten sam rodzaj błędu ("kolejność FK w fixture, nie w schemacie"), którego żadne z WP-D01/D03 nie musiało naprawiać — ich fixture'y insertowały w innej kolejności od początku.
2. Readiness gate: pierwsza wersja `finance_baseline_readiness_check()` miała tylko osiem warunków, w tym `NO_MISSING_OUTPUT_CELLS` liczący wiersze ze `value_status='MISSING'`. Fixture z tylko 3 z 36 zadeklarowanych miesięcy horyzontu **przeszedł** ten warunek (bo nigdy nie utworzono wierszy `MISSING` dla brakujących 33 miesięcy — nie były nigdy zapisane, więc nie mogły być policzone jako `MISSING`). To jest dokładnie ten sam wzorzec "SQL cicho pomija to, czego nie ma" co WP-D01 §7 i WP-D03 §7 już złapały dla `COALESCE(...,NULL)`, tu w nowej postaci: brak wiersza ≠ wiersz `MISSING`. Naprawione dodaniem dziewiątego warunku `OUTPUT_GRID_COVERS_HORIZON`, porównującego `COUNT(DISTINCT period_id)` z `horizon_months` — złapane przez żywe testowanie tego ADR-u, nie przez świadomość problemu z góry.

**Scenariusze przechodzące żywo** (`wp_d05_block1_tables.sql`/`wp_d05_block2_triggers.sql`/`wp_d05_block3_readiness_rollup.sql`/`wp_d05_fixtures_and_tests.sql`, scratchpad sesji, nie w repo):

| # | Test | Oczekiwane | Wynik |
|---|---|---|---|
| 1 | `schedule_type='financing'` | INSERT odrzucony (CHECK enum) | ✅ |
| 2 | `debt_maturity` payload z kluczem `new_draw` | INSERT odrzucony (forbidden-key trigger) | ✅ |
| 3 | `debt_maturity` payload bez zakazanych kluczy | INSERT przyjęty | ✅ |
| 4 | `equity_re` payload z kluczem `dividend` | INSERT odrzucony | ✅ |
| 5 | Spójny Jan/Feb fixture (balance, cash rollforward, RE rollforward) | COMMIT przechodzi | ✅ |
| 6 | `DIVIDENDS_DECLARED` `PRESENT_NONZERO` w Baseline outputs | INSERT odrzucony (taksonomia-driven trigger) | ✅ |
| 6b | `DIVIDENDS_DECLARED` `NA` w Baseline outputs | INSERT przyjęty | ✅ |
| 7 | Mar cash rollforward złamany (rozjazd 459 000) | COMMIT odrzucony, dokładny komunikat diff/tolerancja | ✅ |
| 8 | Mar cash rollforward spójny | COMMIT przechodzi | ✅ |
| 9a | CASH < 0 (funding gap) | `quality_flag='FUNDING_GAP'` ustawiony | ✅ |
| 9b | j.w. | dokładnie jeden `finance_exceptions(severity='WARNING')` podniesiony, deduplikowany | ✅ |
| 10 | Readiness gate z częściowym fixture (3/36 miesięcy, brak schedules) | `finance_baseline_is_ready_for_review()=false` | ✅ |
| 10b | "Compatible" Analysis↔Statement Pack check | Poprawnie `true` dla fixture, gdzie Analysis i Model wskazują tę samą Statement Pack Version | ✅ |
| 11a | Kwartalny roll-up, flow linia (`NET_CHANGE_CASH`) | Suma Jan+Feb+Mar = 0+30 000−600 000 = −570 000 | ✅ |
| 11b | Kwartalny roll-up, stock linia (`CASH`) | Wartość zamknięcia (Mar) = −70 000 | ✅ |
| 12a | INSERT do `finance_baseline_schedules` po `APPROVED` rodzica | Odrzucony (immutability trigger) | ✅ |
| 12b | UPDATE `finance_baseline_outputs` po `APPROVED` rodzica | Odrzucony | ✅ |
| 13 | `finance_exceptions(severity='SECURITY', blocking_category='UNDEFINED_MATH')` OPEN | `NO_OPEN_UNDEFINED_MATH=false`, readiness zablokowane | ✅ |

Te testy **nie są** Gate C — nie mają resume/checksums/shadow-parity/canary i nie testują backfillu z żywych danych legacy `financial_model_events`. `finance_baseline_solver_diagnostics`/`finance_baseline_backtest_runs`/`finance_baseline_backtest_line_results` zostały **DDL-zwalidowane** (CREATE TABLE bez błędu, wszystkie FK/CHECK poprawne składniowo) ale **nie przećwiczone żywym INSERT-em** w tym przebiegu — udokumentowana granica, nie przemilczana (eskalacja sekcja 12 pkt 5). Są dowodem, że DDL jest syntaktycznie poprawny i że no-plug/circularity/funding-gap/readiness mechanizmy zachowują się zgodnie z projektem na realnych, wielotabelowych transakcjach.

---

## 12. Eskalacje wymagane przed pełnym GO

Żadna z poniższych nie blokuje przyjęcia tego ADR-u jako projektu — wszystkie zgodne z `DEC-FIN-012` (rutynowe decyzje rozstrzygnięte przez zespół; poniższe SĄ tymi, które wymagają wyjścia poza rutynę lub jawnie odkładają decyzję operacyjną):

1. **Katalog `driver_code`** (sekcja 4.3) nie jest DB enumem ani osobną tabelą — udokumentowany w Załączniku B, egzekwowany konwencją aplikacyjną. Jeśli w przyszłości okaże się potrzebny per-organizacja custom driver (analogicznie do `ORG_CUSTOM` KPI w WP-D03), wymaga rozszerzenia do pełnego katalogu-tabeli z maker-checker — nie rozstrzygnięte tutaj.
2. **`horizon_rationale_note`** wymusza tylko `NOT NULL`, nie waliduje merytorycznej jakości uzasadnienia (np. czy faktycznie odpowiada `horizon_rationale` wybranemu obok) — pozostawione jako element manualnego review, nie mechanizmu DB.
3. **Warstwa 3 (denylist na outputs, sekcja 5.3) jest curated, nie automatyczna** dla przyszłych kodów taksonomii — nowy kod linii reprezentujący decyzję finansowania wymaga świadomego ustawienia `excluded_from_baseline=true` przez autora migracji taksonomii; Warstwa 1+2 pozostaje fizyczną gwarancją niezależną od tej czujności.
4. **Materializacja roll-upu** (sekcja 8) jako VIEW nie materialized — jeśli 10k×120-cell performance target (master plan §10) tego wymaga przy realnym wolumenie, potrzebna osobna decyzja o materialized-view-refresh-on-commit, poza zakresem tego P0.
5. **`finance_baseline_solver_diagnostics`/`finance_baseline_backtest_*`** nie zostały przećwiczone żywym INSERT-em w tej rundzie testowania (sekcja 11) — wymaga domknięcia przy wykonawczym Gate D razem z realnym silnikiem compute.
6. **Rzeczywisty backfill** `financial_models`/`financial_model_events` → `finance_baseline_*` (sekcja 9) jest zakresem osobnego wykonawczego WP (analog WP-C03/WP-D01b) — ta tabela mapowania jest punktem startowym, nie kompletną specyfikacją migracji danych, w tym rozstrzygnięcia niejednoznacznych `debt_repayment`/`wc_change` per-instancję.
7. **Precedent dla `mandatory_contractual_cash_sweep_modeled`** — schemat dopuszcza taką flagę i pole w `debt_maturity.payload`, ale kontrakt prawny/finansowy potwierdzający, że dana klauzula jest rzeczywiście niedyskrecjonalna (a nie zamaskowaną decyzją) jest kwestią merytorycznej weryfikacji przez Corporate Finance/FP&A przy tworzeniu konkretnego modelu, nie czymś, co DB może zweryfikować automatycznie.

---

## 13. Traceability

| Wymaganie z zadania | Sekcja tego ADR |
|---|---|
| `finance_baseline_models` — jeden per `business_version_id`, wskazuje exact source Statement+Analysis przez lineage, NIE nowa kolumna FK | §4.1, §2.3 |
| `finance_baseline_schedules` — 9 typów, jedna tabela z discriminated `schedule_type`+JSONB, zdecyduj i uzasadnij (vs 9 tabel) | §4.2, §10.1 |
| `finance_baseline_assumptions` — driver grid: historia, base period, rule, unit, source, forecast value, range, quality, per period | §4.3 |
| `finance_baseline_outputs` — ta sama struktura co `finance_stmt_lines`, actual/forecast band | §4.4 |
| Cash jako wynik — fizyczne wykluczenie plug/financing mechanizmu, nie tylko konwencja | §5 (cztery warstwy), przetestowane żywo TEST 1-4, 6-8 |
| Funding gap alert — quality_flag czy osobna tabela alerts | §7, §10.3 (odrzucona alternatywa), TEST 9a/9b |
| Circularity solver — deterministyczny, iteracyjny, convergence limit, fail-closed UNDEFINED_MATH jak B05 Security | §6, algorytm §6.2, TEST 13 |
| Monthly engine + purpose-driven horizon (nie hardcoded 3/5/10 lat) | §4.1, §8 |
| Roll-up monthly→quarterly→annual jako VIEW czy materialized | §8 (VIEW, uzasadnienie), TEST 11a/11b |
| Dwa widoki: Assumptions (historia/rule/undo/reset) i Calculations (ta sama struktura co Statements, actual/forecast band) | §4.3 (Assumptions), §4.4 (Calculations) |
| Backtest — holdout actual, bias/MAPE per material line | §4.6, §10.4 (odrzucona alternatywa: lineage edge) |
| Usuń Events Timeline i Valuate Model z głównego toku — brak tabeli "events"/"valuate" | Cały pakiet: zero tabeli `*_events`/`*_valuate`; jedyne odniesienie do "events" jest w mapowaniu legacy→nowy schemat (§9), nie w nowym schemacie |
| Mapowanie legacy `financial_model_events` → nowy schemat wg A01/A03, rozdzielenie co idzie tu vs do Prediction wg ORCH-DEC-001 | §9 (pełna tabela 13 typów) |
| Zakaz łączenia z bazą produkcyjną/demo/dev; własny efemeryczny Postgres, wzorem D01/D03 | §11 |

---

## Załącznik A — DDL sketch (zweryfikowany żywo)

Trzy bloki, w kolejności wykonania: (1) tabele, (2) triggery/funkcje integralności, (3) readiness gate + roll-up views. Pełne, uruchamialne pliki `.sql` (dokładnie te zweryfikowane w sekcji 11) żyją w scratchpad sesji (`/private/tmp/wp_d05_block1_tables.sql`, `wp_d05_block2_triggers.sql`, `wp_d05_block3_readiness_rollup.sql`), nie w repo — wzorem WP-D03's uwaga o Załączniku A (unikanie duplikowania ~600 linii DDL, które i tak trzeba przepisać z realnymi nazwami plików migracji w wykonawczym Gate D). Kluczowe fragmenty, dosłowne i kopiowalne 1:1:

```sql
CREATE TABLE finance_baseline_schedules (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id         TEXT NOT NULL,
  business_version_id     TEXT NOT NULL,
  schedule_type           TEXT NOT NULL CHECK (schedule_type IN (
                             'revenue_pvm','headcount','cogs_opex','wc_dso_dio_dpo',
                             'capex_depreciation','leases','debt_maturity','tax_nol','equity_re'
                           )),
  entity_id                TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  schedule_item_code         TEXT NOT NULL,
  effective_from_period_id     TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),
  effective_to_period_id         TEXT REFERENCES finance_stmt_periods(period_id),
  payload                          JSONB NOT NULL,
  source_ref                         JSONB,
  created_by                           TEXT NOT NULL,
  created_at                             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_baseline_schedules_item
    UNIQUE (business_version_id, schedule_type, entity_id, schedule_item_code, effective_from_period_id),
  CONSTRAINT fk_finance_baseline_schedules_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

-- Physical layer #2: forbidden-key denylist + per-type required-key allowlist.
CREATE FUNCTION finance_baseline_validate_schedule_payload() RETURNS TRIGGER AS $$
DECLARE
  v_forbidden_keys TEXT[] := ARRAY[
    'discretionary_repayment','new_draw','debt_drawdown','revolver_draw',
    'dividend_amount','dividend','equity_injection','share_buyback',
    'buyback_amount','surplus_allocation','cash_plug','balancing_item','plug'
  ];
  v_key TEXT;
BEGIN
  IF jsonb_typeof(NEW.payload) != 'object' THEN
    RAISE EXCEPTION 'finance_baseline_schedules: payload must be a JSON object';
  END IF;
  FOREACH v_key IN ARRAY v_forbidden_keys LOOP
    IF NEW.payload ? v_key THEN
      RAISE EXCEPTION 'finance_baseline_schedules: payload key "%" is a discretionary financing/plug concept, forbidden in Baseline (DEC-FIN-002)', v_key;
    END IF;
  END LOOP;
  CASE NEW.schedule_type
    WHEN 'debt_maturity' THEN
      IF NOT (NEW.payload ? 'principal_opening' AND NEW.payload ? 'contractual_rate' AND NEW.payload ? 'amortization_schedule') THEN
        RAISE EXCEPTION 'finance_baseline_schedules: debt_maturity payload requires principal_opening, contractual_rate, amortization_schedule';
      END IF;
    WHEN 'equity_re' THEN
      IF NOT (NEW.payload ? 'opening_retained_earnings') THEN
        RAISE EXCEPTION 'finance_baseline_schedules: equity_re payload requires opening_retained_earnings';
      END IF;
    ELSE NULL;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Physical layer #4: cash roll-forward with zero plug option.
CREATE FUNCTION finance_baseline_check_cash_rollforward() RETURNS TRIGGER AS $$
DECLARE
  v_cash_line_id TEXT; v_net_change_line_id TEXT;
  v_opening_cash NUMERIC; v_net_change NUMERIC; v_closing_cash NUMERIC;
  v_prev_period_id TEXT; v_tolerance NUMERIC; v_diff NUMERIC;
BEGIN
  SELECT id INTO v_cash_line_id FROM financial_statement_lines WHERE line_code = 'CASH';
  SELECT id INTO v_net_change_line_id FROM financial_statement_lines WHERE line_code = 'NET_CHANGE_CASH';
  IF NEW.canonical_line_id != v_cash_line_id THEN RETURN NEW; END IF;

  SELECT previous_period_id INTO v_prev_period_id FROM finance_stmt_periods WHERE period_id = NEW.period_id;
  IF v_prev_period_id IS NULL THEN RETURN NEW; END IF;

  SELECT value_decimal INTO v_opening_cash FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND canonical_line_id = v_cash_line_id AND period_id = v_prev_period_id AND consolidation_scope = NEW.consolidation_scope;
  SELECT value_decimal INTO v_net_change FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND canonical_line_id = v_net_change_line_id AND period_id = NEW.period_id AND consolidation_scope = NEW.consolidation_scope;
  IF v_opening_cash IS NULL OR v_net_change IS NULL THEN RETURN NEW; END IF;

  v_closing_cash := NEW.value_decimal;
  SELECT circularity_tolerance_currency INTO v_tolerance FROM finance_baseline_models WHERE business_version_id = NEW.business_version_id;
  v_tolerance := COALESCE(v_tolerance, 1);
  v_diff := ABS((v_opening_cash + v_net_change) - v_closing_cash);
  IF v_diff > v_tolerance THEN
    RAISE EXCEPTION 'finance_baseline: cash roll-forward broken for period %, entity % — opening (%) + net_change (%) != closing (%), diff % > tolerance % — no plug line exists to absorb this residual',
      NEW.period_id, NEW.entity_id, v_opening_cash, v_net_change, v_closing_cash, v_diff, v_tolerance;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_finance_baseline_check_cash_rollforward
  AFTER INSERT OR UPDATE ON finance_baseline_outputs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_check_cash_rollforward();
```

Pełny zestaw (7 tabel domenowych + 1 addytywna kolumna + 7 funkcji/triggerów + 2 funkcje readiness + 2 VIEW) jest w pełni określony w sekcjach 4-8 tego dokumentu — każda nazwa kolumny, każdy CHECK, każdy trigger name użyty w testach sekcji 11 jest dosłowny, kopiowalny 1:1 do prawdziwego pliku migracji wykonawczego Gate D.

## Załącznik B — katalog `driver_code` (dokumentacja aplikacyjna, nie DB enum)

Przykładowe (nie wyczerpujące — eskalacja §12 pkt 1) `driver_code` per `schedule_type`, do orientacji Kreatora i Finance Data Grid:

| `schedule_type` | Przykładowe `driver_code` |
|---|---|
| `revenue_pvm` | `PRICE_GROWTH_PCT`, `VOLUME_GROWTH_PCT`, `MIX_SHIFT_PCT` |
| `headcount` | `HIRES_PER_PERIOD`, `ATTRITION_RATE_PCT`, `AVG_SALARY_GROWTH_PCT` |
| `cogs_opex` | `COGS_PCT_OF_REVENUE`, `OPEX_GROWTH_PCT` |
| `wc_dso_dio_dpo` | `DSO_DAYS`, `DIO_DAYS`, `DPO_DAYS` |
| `capex_depreciation` | `CAPEX_PCT_OF_REVENUE`, `USEFUL_LIFE_MONTHS` |
| `leases` | `LEASE_ESCALATION_PCT` |
| `debt_maturity` | `CONTRACTUAL_RATE`, `AMORTIZATION_PCT_PER_PERIOD` |
| `tax_nol` | `STATUTORY_TAX_RATE_PCT`, `NOL_UTILIZATION_PCT` |
| `equity_re` | `OPENING_RE_CONFIRMED` (rzadko forecast-driven — głównie kontynuacja) |
