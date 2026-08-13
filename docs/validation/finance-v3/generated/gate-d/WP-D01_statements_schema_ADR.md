# ADR WP-D01 — Statements Truth Engine: domenowy schemat (Gate D / Fala 3)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, sekcja 5 (Statements — pełna przebudowa), EPIC-03.
**Work package:** WP-D01 — pierwszy pakiet domenowy Gate D (Fala 3), po zamrożonym Gate B (7 ADR-ów) i zaimplementowanym Gate C (WP-C01/C02/C03).
**Data:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `ADR — DDL sketch, syntactically validated on ephemeral Postgres, NOT executed as a real migration`

To jest ADR (decyzja + kontrakt), tak jak WP-B01…WP-B07 z Gate B. **Nie jest** to migracja Gate C ani produkcyjny kod. Różnica wobec typowego Gate B: fragmenty DDL poniżej zostały faktycznie uruchomione na jednorazowej, efemerycznej instancji Postgresa (zasady jak WP-C01/C02/C03, patrz sekcja 9) — nie po to, żeby to był Gate C, ale dlatego że "zweryfikuj realny runtime, nie dokumentację" (CLAUDE.md, złota reguła #1) obejmuje też składnię i zachowanie triggerów we własnym ADR-ze, nie tylko cudzy kod. Realna migracja Gate D wykonawcza wciąż wymaga osobnego WP (analogicznego do WP-C01), po akceptacji tego ADR-u.

---

## 1. Wejścia przeczytane w całości, w tej kolejności

1. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §5 (Statements — pełna przebudowa) — wymagania funkcjonalne.
2. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` §2 pkt 1–7 i "Korekta tolerancji" — kalendarze/restatements/konsolidacja/waluty/polityki/reconciliation ledger/ratios convention, oraz zakaz `max(1 jednostka, 0.1%)`.
3. `docs/validation/finance-v3/generated/gate-c/WP-C01_migration_report.md` i `server/migrations/20260809_finance_v3_b01…b07*.sql` — realny, przetestowany kształt `finance_artifacts`/`finance_business_versions`/`finance_working_revisions`/`finance_lineage_edges`/`finance_exceptions`/`finance_reconciliation_runs`/`finance_compute_snapshots`/`version_kind`.
4. `docs/validation/finance-v3/generated/gate-a/WP-A01_inventory_manifest.md` (+ `.json`) i `docs/validation/finance-v3/generated/gate-a/WP-A03_legacy_classification.md` — dzisiejszy stan `financial_statements`/`financial_statement_values` na `origin/demo`.
5. Dodatkowo (niewymienione w briefie, ale konieczne do niesprzeczności): `docs/validation/finance-v3/generated/gate-b/WP-B01_artifact_schema_ADR.md` §2.7 (obowiązkowy bundle kolumn "wartość finansowa"), `docs/validation/finance-v3/generated/gate-b/WP-B03_lineage_staleness_ADR.md` (stage_rank, edge_type), `docs/validation/finance-v3/generated/gate-b/WP-B06_reproducibility_retention_export_ADR.md` §4 (`version_kind`) i §10.3 (otwarte właścicielstwo `fiscal_calendar_id`/`fx_snapshot_id`), `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` §7 (placeholder materialności).

---

## 2. Kontekst

### 2.1 Co Gate B/C już daje — NIE duplikujemy

WP-D01 buduje **na wierzchu** istniejącego, przetestowanego (586/586 migracji, 17/17 testów triggerów, `WP-C01_migration_report.md`) rdzenia:

- `finance_artifacts` / `finance_business_versions` / `finance_working_revisions` — jeden `finance_business_version` z `finance_artifacts.artifact_type='STATEMENT_PACK'` **JEST** "Statement Pack Version" z master planu. Ten ADR nie tworzy nowej tabeli wersji ani nowego lifecycle — każda tabela domenowa poniżej wskazuje `business_version_id` z tej istniejącej tabeli.
- `finance_lineage_edges` — `STATEMENT_TO_ANALYSIS`/`STATEMENT_TO_MODEL` już istnieją w `edge_type` CHECK; WP-D01 nic tu nie zmienia.
- `finance_exceptions` / `finance_exceptions_current` — severity `Info/Warning/Material/CriticalData/Security`, append-only, już zaimplementowane; kontrole integralności poniżej **nie** duplikują tego mechanizmu wyjątków, tylko twardo blokują niepoprawny zapis przez trigger (tam gdzie decyzja właścicielska #11 z master planu dopuszcza blokadę: "matematycznie nieokreślona operacja" — niezbalansowany bilans jest dokładnie tym przypadkiem).
- `finance_reconciliation_runs` — artefakt-poziomowy agregat waterfallu (`source_total → mapped → excluded → unmapped → duplicate → reclass → elimination → canonical → residual`) **już istnieje i jest przetestowany**. `finance_stmt_reconciliation` (ten ADR) jest tabelą wiersz-poziomową, która **rolluje się w** istniejący `finance_reconciliation_runs.id`, nie odtwarza kształtu waterfallu od nowa.
- `finance_business_versions.version_kind`/`restatement_reason`/`restatement_class` (WP-B06 §4.1) — mechanizm original/restated/management-adjusted **już istnieje w schemacie**. Sekcja 6 tego ADR-u tylko **stosuje** ten mechanizm do `STATEMENT_PACK`, nie projektuje nowego.
- `finance_value_status` ENUM (`PRESENT_ZERO`/`PRESENT_NONZERO`/`MISSING`/`NA`/`NOT_APPLICABLE`) i obowiązkowy bundle kolumn wartości (WP-B01 §2.7) — `finance_stmt_lines` (sekcja 4.5) przyjmuje ten bundle **dosłownie**, nie wymyśla własnego.

### 2.2 Co Gate A dowodzi o dzisiejszym stanie (potwierdzone `grep`, nie domysł)

Z `WP-A01_inventory_manifest.md`/`.json` i `WP-A03_legacy_classification.md`, oraz bezpośrednim odczytem `server/migrations/20260316_financial_statement_packs.sql`:

| Problem | Dowód |
|---|---|
| `financial_statements.currency`/`financial_statement_packs.currency` nullable (`TEXT DEFAULT 'PLN'` bez `NOT NULL`) | `20260316_financial_statement_packs.sql:8,50`; `WP-A03` §"NULL period/unit" |
| `financial_statement_values.value REAL` w pełni nullable, bez jednostki/waluty na poziomie wartości (unit żyje tylko na `financial_statements`) | `20260316_financial_statement_packs.sql:78`; `WP-A03` linia 183 |
| `financial_statement_values` **nie ma** `organization_id` — tenant scope wyłącznie przez JOIN do `financial_statements` | `WP-A01_inventory_manifest.json` (`financial_statement_values.org_scoped: false`) |
| `page`/`bbox` z ekstraktora NULL na żywo (potwierdzone realnym uploadem P4 Apator) | pamięć sesji `p4-apator-realny-upload-2026-08-06` — `source_page` kolumna istnieje (`20260317_finance_v1_canonical_layer.sql:82`) ale ekstraktor jej dziś nie zwraca |
| Brak `RETAINED_EARNINGS`/`DIVIDENDS_DECLARED` w kanonicznej taksonomii linii | `grep line_code` na `565_kpi_time_series_roi_attribution_finance.sql` + `567_financial_statements_ratios.sql` — brak tych dwóch kodów |
| Brak konsolidacji/entity/FX/fiscal calendar w ogóle — `financial_statements` ma jeden płaski `entity_name TEXT` bez perymetru | `20260316_financial_statement_packs.sql:42-66` |
| Zero reconciliation ledger na poziomie wiersza (istnieje tylko `financial_statement_validations`, ex-post agregat pass/warn/fail) | `20260317_finance_v1_canonical_layer.sql:112-130` |

Żaden z tych problemów nie jest naprawiony przez Gate B/C (poza governance/lifecycle) — to dokładnie zakres, który WP-D01 zamyka.

### 2.3 Właścicielstwo przejęte tym ADR-em

`WP-B06_reproducibility_retention_export_ADR.md` §10 pkt 3 zostawia `fiscal_calendar_id`/`fx_snapshot_id`/`market_data_snapshot_id` na `finance_compute_snapshots` jako **forward reference bez właściciela**, z rekomendacją: *"prawdopodobnie WP-D01 (Statements, master plan wymienia »fiscal calendars« wprost w tym pakiecie)... WP-D01 potwierdza właścicielstwo przy swoim starcie."*

**Decyzja:** WP-D01 przejmuje właścicielstwo `fiscal_calendar_id` (→ `finance_stmt_calendars`, sekcja 4.1) i `fx_snapshot_id`/rate (→ `finance_stmt_fx`, sekcja 4.4). `market_data_snapshot_id` **pozostaje nieprzypisany** — to jest domena Valuation (WP-E, market data dla WACC/comps), nie Statements; ten ADR jednostronnie go nie zagarnia.

`finance_compute_snapshots.fiscal_calendar_id`/`.fx_snapshot_id` (kolumny już istnieją w `20260809_finance_v3_b06_reproducibility_retention_export.sql:31-32`, dziś bez FK) **nie są zmieniane przez ten ADR** — dodanie realnego `REFERENCES finance_stmt_calendars(fiscal_calendar_id)`/`finance_stmt_fx(fx_rate_id)` jest udokumentowanym **przyszłym krokiem** wykonawczego Gate D (addytywny `ALTER TABLE ... ADD CONSTRAINT`), nie częścią tego ADR-u — ten ADR nie modyfikuje żadnego już-zamrożonego pliku migracji Gate C.

---

## 3. Decyzja — skrót

Siedem nowych tabel z prefiksem `finance_stmt_` (task wymienił sześć nazw; `finance_stmt_calendars` jest siódmą, uzasadnioną przejęciem właścicielstwa z sekcji 2.3):

1. `finance_stmt_calendars` — kalendarz fiskalny (standard/4-4-5/53-tygodniowy).
2. `finance_stmt_periods` — okna okresów (FY/Q/miesiąc/tydzień, stub-aware).
3. `finance_stmt_entities` — legal entity + perymetr konsolidacji, ownership/NCI, **scoped per Statement Pack Version** (nie osobna tabela master — patrz sekcja 10.1).
4. `finance_stmt_fx` — kursy transaction/functional/presentation, average/closing/historical.
5. `finance_stmt_lines` — wartości P&L/BS/CF, przyjmuje bundle WP-B01 §2.7 dosłownie.
6. `finance_stmt_reconciliation` — wiersz-poziomowy detal waterfallu, rolluje się w istniejący `finance_reconciliation_runs`.
7. `finance_stmt_source_evidence` — provenance per wiersz/komórka, z `bbox`/`source_page` zamykającym potwierdzony na żywo gap ekstraktora.

Pięć kontroli integralności jako **deferred constraint triggery** (nie CHECK — każda wymaga cross-row/cross-table lookupu, dokładnie ten sam powód, dla którego Gate C/B01 samo rutuje takie reguły do triggera zamiast CHECK — patrz `WP-C01_migration_report.md` §6 wstęp):

- Assets = Liabilities + Equity (§5.1),
- Cash roll-forward — jedna kontrola pokrywająca zarówno "CF closing cash = BS cash" jak i "opening+movements=closing" (§5.2),
- Retained earnings roll-forward (§5.3),
- Elimination debits = credits (§5.4).

Tolerancja **nie** jest `max(1 jednostka, 0.1%)` — jest `LEAST(source_rounding_tolerance, materiality_tolerance)`, zgodnie z korektą z addendum (§5.0).

Restatement = **zero nowego mechanizmu**, czyste zastosowanie `version_kind`/`reopen` z WP-B06 do `STATEMENT_PACK` (§6).

Readiness gate `DRAFT → READY_FOR_REVIEW` = konkretna funkcja SQL `finance_stmt_is_ready_for_review(business_version_id)`, siedem nazwanych, testowalnych warunków (§7).

---

## 4. Nowe tabele domenowe

### 4.1 `finance_stmt_calendars` — kalendarz fiskalny

Jeden wiersz = jeden obowiązujący kalendarz dla organizacji lub dla jednego `entity_code` (miękki klucz — patrz sekcja 10.1 dlaczego nie ma osobnej tabeli master encji). Standard / 4-4-5 / 53-tygodniowy, z jawnym `fiscal_year_end_reference` (`LAST_DAY_OF_MONTH` vs `NEAREST_WEEKDAY`) i wzorcem 4-4-5 (`445`/`454`/`544`).

### 4.2 `finance_stmt_periods` — okna okresów

`period_type IN (FY, Q, MONTH, WEEK)`, `fiscal_year`/`fiscal_quarter`/`fiscal_month`/`fiscal_week` z CHECK-ami wymuszającymi dokładnie jeden zestaw wymiarów per typ (Postgres traktuje `NULL` jako różne od `NULL` w `UNIQUE`, więc unikalność jest egzekwowana **czterema częściowymi indeksami**, po jednym na `period_type` — patrz komentarz w Załączniku A). `is_stub`/`stub_reason` dla okresów przejściowych (zmiana roku fiskalnego). **`previous_period_id`** (self-FK) to jawny łańcuch dla kontroli roll-forward (§5.2/5.3) — świadomie NIE heurystyka po `period_end`, bo ta zawodzi na granicach 4-4-5/53-tygodniowych/stub. `WEEK` wymaga kalendarza 4-4-5/53-tygodniowego — cross-table, więc trigger, nie CHECK.

`accumulation_basis` (`QUARTER_ONLY`/`YTD`/`LTM`/`FULL_YEAR`) **nie** jest kolumną tej tabeli — okno okresu (`per_2025_q3` = lip-wrz) jest jedno, ale ta sama komórka może być raportowana quarter-only, YTD lub LTM w zależności od potrzeby analitycznej; to własność **wartości** (`finance_stmt_lines.accumulation_basis`, sekcja 4.5), nie okna czasu.

### 4.3 `finance_stmt_entities` — legal entity + perymetr konsolidacji

Jeden wiersz = jedna encja **w kontekście jednej konkretnej `business_version_id`** (Statement Pack Version). `role` (`GROUP_PARENT`/`SUBSIDIARY`/`ASSOCIATE`/`JOINT_VENTURE`/`ELIMINATION_BUCKET`), `consolidation_method` (`FULL`/`PROPORTIONAL`/`EQUITY_METHOD`/`NOT_CONSOLIDATED`), `ownership_pct` + wygenerowane `nci_pct` (`GENERATED ALWAYS AS`, tylko dla `FULL`), `perimeter_event` (`ACQUISITION`/`DISPOSAL`/`STEP_UP`/`STEP_DOWN`/`ORGANIC`) z datą. `entity_code` jest stabilnym naturalnym kluczem spinającym tę samą spółkę między wersjami/okresami bez osobnej tabeli master (uzasadnienie w sekcji 10.1).

### 4.4 `finance_stmt_fx` — kursy walutowe

Zamrożone **per Statement Pack Version** (nie per organizacja/na żywo) — kurs użyty w Approved wersji nie może się cicho przesunąć, ta sama zasada "aligned as-of" co market data w Valuation. `rate_type IN (AVERAGE, CLOSING, HISTORICAL)`. CTA (cumulative translation adjustment) **nie jest osobną tabelą** — to wiersz `finance_stmt_lines` przeciw kanonicznej linii OCI/CTA z `is_adjustment=true`, tak jak każda inna wartość (decyzja, nie przeoczenie — patrz sekcja 10.3).

### 4.5 `finance_stmt_lines` — wartości P&L/BS/CF

Przyjmuje **dosłownie** obowiązkowy bundle z WP-B01 §2.7: `value_status finance_value_status NOT NULL`, `value_decimal NUMERIC` (pełna precyzja źródłowa — rounding tylko na granicy prezentacji, nigdy w przechowywaniu), `native_currency`/`presentation_currency`, `unit`/`multiplier`, `period_id`/`entity_id`, `source_ref`, `is_adjustment`/`adjustment_reason`. Plus kolumny domenowe: `statement_type`, `canonical_line_id` (FK do **istniejącej** `financial_statement_lines`, reużytej, nie zduplikowanej — Gate A klasyfikuje ją `AUTO_MIGRATE`), `accumulation_basis`, `consolidation_scope` (`STANDALONE`/`CONSOLIDATED`/`ELIMINATION`), `sign_convention`, `accounting_policy` (`IFRS`/`LOCAL_GAAP`/`US_GAAP`), `ifrs16_treatment`, `discontinued_operations`, `exceptional_item`, `reclassified_from_line_id`.

`UNIQUE(business_version_id, entity_id, canonical_line_id, period_id, accumulation_basis, consolidation_scope)` to **stabilny kanoniczny klucz komórki** wymagany przez Finance Data Grid (master plan §10) — jeden autorytatywny wiersz per kombinacja wymiarów, adresowalny bez niejednoznaczności.

Content-freeze po `APPROVED`: `finance_business_versions`' własny trigger niemutowalności (B01 §2.4) chroni **tylko ten jeden wiersz** — każda tabela treści Gate D potrzebuje własnego strażnika przeciw rodzicowi. `finance_stmt_lines_enforce_parent_immutability()` (trigger `BEFORE INSERT OR UPDATE OR DELETE`) odrzuca każdy zapis, gdy `finance_business_versions.status` rodzica = `APPROVED`. **Przetestowane żywo (TEST 6, sekcja 9)** — reprodukuje dokładnie ten sam wzorzec ochrony, który Gate C udowodnił dla `finance_business_versions` samego, teraz na tabeli treści.

### 4.6 `finance_stmt_reconciliation` — wiersz-poziomowy waterfall

`bucket IN (MAPPED, EXCLUDED, UNMAPPED, DUPLICATE, RECLASS, ELIMINATION, CANONICAL)` per wiersz źródłowy (`source_row_ref` JSONB). `reconciliation_run_id` FK do **istniejącego** `finance_reconciliation_runs.id` — ten ADR nie tworzy drugiego agregatu, tylko detal, który dziś nie istnieje (agregat B05 ma `reclass_net_total`/`elimination_net_total` jako pojedyncze liczby per run, nie per wiersz). `duplicate_of_row_id`/`reclass_target_line_id`/`elimination_counterparty_entity_id` wymagane odpowiednim CHECK-iem gdy `bucket` tego wymaga.

### 4.7 `finance_stmt_source_evidence` — provenance per wiersz/komórka

Rozszerza kształt `financial_statement_value_evidence` (Gate A) o `bbox` JSONB (`{x0,y0,x1,y1,page}`) — **nowa** kolumna zamykająca potwierdzony na żywo gap ekstraktora (P4 Apator: `source_page` istnieje w schemacie od `20260317_finance_v1_canonical_layer.sql`, ale ekstraktor go dziś nie zwraca; to jest problem ekstraktora, nie schematu, ale schemat musi mieć miejsce na dokładniejszy dowód niż samo `source_page`, stąd `bbox`). Celuje w `finance_stmt_lines` (nowa tabela), nie w legacy `financial_statement_values`.

---

## 5. Kontrole integralności

Wszystkie pięć jako **`CREATE CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED ... FOR EACH ROW`** — nie CHECK (Postgres nie pozwala na subquery w CHECK, dokładnie ten sam powód, dla którego WP-B01/B03/B05 same routują takie reguły do triggerów, patrz `WP-C01_migration_report.md` §6 akapit wstępny). Constraint triggery w Postgresie **muszą** być `FOR EACH ROW` (nie `FOR EACH STATEMENT`) — to wymusiło jedną poprawkę projektu w trakcie testowania (§9, "co testowanie znalazło i naprawiło"). `DEFERRABLE INITIALLY DEFERRED` = kontrola uruchamia się raz, na `COMMIT`, po zakończeniu całej transakcji (batch paste/import), nie w trakcie zapisu przejściowo niezbalansowanego stanu.

### 5.0 Tolerancja — korekta z addendum

Addendum §2 "Korekta tolerancji": *"Nie używać automatycznie `max(1 jednostka źródłowa, 0,1%)`... Tolerancja reconciliation powinna wynikać z source rounding i materiality policy, zwykle z bardziej restrykcyjnego progu."*

Interpretacja zastosowana w `finance_stmt_balance_tolerance()`: **`LEAST(rounding_tolerance, materiality_tolerance)`** — "bardziej restrykcyjny" = mniejszy z dwóch, nie automatyczny wybór jednego.

- `rounding_tolerance` = **1 pełna jednostka prezentacji** (`finance_stmt_unit_value(unit)` — 1/1000/1000000/1000000000 dla `UNITS`/`THOUSANDS`/`MILLIONS`/`BILLIONS`). Uzasadnienie: `value_decimal` przechowuje pełną precyzję źródłową (WP-B01 §2.7), ale `unit` opisuje, jak grubo był zaokrąglony **dokument źródłowy** (np. sprawozdanie opublikowane z dokładnością do tysiąca PLN) — to jest właśnie "source rounding" z addendum. Dwa niezależnie zaokrąglone subtotale (Total Assets, Total Liabilities+Equity) mogą każdy nieść do ±0,5 jednostki błędu zaokrąglenia źródła; połączony najgorszy przypadek = 1 pełna jednostka.
- `materiality_tolerance` = `finance_reconciliation_runs.materiality_threshold_applied` (placeholder `PROVISIONAL_PENDING_OWNER_DECISION`, `GATE_B_INTEGRATION_RECONCILIATION.md` §7: 5% linii/subtotala LUB niższy próg per organizacja) × `ABS(total_assets)`.
- Gdy nie istnieje jeszcze żaden `finance_reconciliation_runs` dla danej wersji, funkcja **nie wymyśla** wartości domyślnej — spada do samego `rounding_tolerance` (placeholder materialności jest per-run, nie stały domyślny, zgodnie z jego własnym statusem `PROVISIONAL_PENDING_OWNER_DECISION`).

### 5.1 Assets = Liabilities + Equity

`finance_stmt_check_balance()` — dla każdego wiersza `BS`, dociąga `TOTAL_ASSETS` i `TOTAL_LIABILITIES_EQUITY` (istniejące kody taksonomii) dla tej samej `(business_version_id, entity_id, period_id, accumulation_basis)`, `consolidation_scope='CONSOLIDATED'`. **Przetestowane żywo**: TEST 1 (zbalansowane, przechodzi), TEST 1b (600 PLN różnicy < 1000 PLN tolerancji, przechodzi), TEST 2 (50 000 PLN różnicy > 1000 PLN tolerancji, **odrzucone na COMMIT** z dokładnym komunikatem różnicy/tolerancji — sekcja 9).

### 5.2 Cash roll-forward (CF closing cash = BS cash; opening + movements = closing)

`finance_stmt_check_cash_rollforward()` — jedna kontrola pokrywa **oba** punkty z brief-u, bo dla gotówki to ta sama równość: `opening_cash(poprzedni_okres.CASH) + NET_CHANGE_CASH(bieżący_okres.CF) = closing_cash(bieżący_okres.CASH)`. Używa `finance_stmt_periods.previous_period_id` (nie heurystyki dat) do znalezienia poprzedniego okresu; brak poprzedniego okresu (pierwszy okres na rekordzie, np. bilans otwarcia) **nie jest błędem**, kontrola jest pomijana. **Przetestowane żywo**: spójny roll-forward przechodzi, przesunięcie zamykającej gotówki o 100 000 PLN ponad tolerancję **odrzucone na COMMIT** (sekcja 9).

### 5.3 Retained earnings roll-forward

`finance_stmt_check_retained_earnings_rollforward()` — `opening_RE + NET_INCOME - DIVIDENDS_DECLARED = closing_RE`. `RETAINED_EARNINGS`/`DIVIDENDS_DECLARED` **dopisane** do kanonicznej taksonomii `financial_statement_lines` (nie istniały — potwierdzone `grep`, sekcja 2.2) jako addytywny `INSERT ... ON CONFLICT DO NOTHING`, nie nowa tabela.

Precyzyjne rozróżnienie `value_status` przy `DIVIDENDS_DECLARED`: kontrola liczy je jako 0 **tylko** gdy status to `NA` (analityk jawnie potwierdził brak dywidendy w tym okresie) lub `PRESENT_ZERO`; gdy status to `MISSING`, **cała kontrola jest pomijana** (nie da się zweryfikować), nigdy nie traktuje `MISSING` jako 0 — to jest dosłowne domknięcie problemu #2 z master planu §3 ("Silent-zero... brakujące dane są zamieniane na zero") na poziomie tej jednej, konkretnej kontroli. **Przetestowane żywo**: `NA` przechodzi poprawnie; przełączenie na `MISSING` **pomija** kontrolę zamiast fałszywie przepuścić lub fałszywie zablokować (sekcja 9).

### 5.4 Elimination debits = credits

`finance_stmt_check_elimination_balance()` — dla `consolidation_scope='ELIMINATION'`, suma `value_decimal` (z odwróceniem znaku dla `sign_convention='CONTRA'`) po tej samej `(business_version_id, canonical_line_id, period_id, accumulation_basis)` musi zejść do ~0 w tolerancji. **Przetestowane żywo**: para debet/kredyt 500 000/500 000 przechodzi; jednostronna zmiana jednej nogi do 700 000 (niesparowana) **odrzucona na COMMIT** (sekcja 9).

### 5.5 Period collision / duplicate detection

Realizowane strukturalnie, nie osobnym triggerem: `uq_finance_stmt_lines_cell` (§4.5) fizycznie uniemożliwia dwa wiersze dla tej samej komórki (kolizja okresu = próba wstawienia drugiej wartości do tej samej `(entity, line, period, basis, scope)` kończy się naruszeniem `UNIQUE`, nie cichym nadpisaniem). Duplikaty na poziomie **źródłowym** (przed mapowaniem) są śledzone jako `finance_stmt_reconciliation.bucket='DUPLICATE'` (§4.6) z wymaganym `duplicate_of_row_id`.

### 5.6 "Missing nigdy nie staje się zero" — rekapitulacja

Ta zasada (master plan §3 pkt 2, problem #2) jest egzekwowana na **trzech** niezależnych poziomach w tym schemacie, nie jednym:
1. `chk_finance_stmt_lines_value_shape` — `value_status='MISSING'` **wymaga** `value_decimal IS NULL`; nie da się zapisać `MISSING` z wartością liczbową ani `0` bez `value_status='PRESENT_ZERO'` jawnie.
2. Readiness gate (§7, `MAPPING_COMPLETE_NO_MISSING`) — Statement Pack z choć jedną komórką `MISSING` nie może przejść `DRAFT → READY_FOR_REVIEW`.
3. Retained earnings roll-forward (§5.3) — `MISSING` na `DIVIDENDS_DECLARED` **pomija** kontrolę zamiast cicho liczyć jako 0.

---

## 6. Restatement — reużycie WP-B06, zero nowego mechanizmu

Zadanie wymaga: *"Restatement: original/restated/management-adjusted jako osobne version_kind (spójne z WP-B06 ADR — sprawdź je, nie wymyślaj nowego mechanizmu)."*

`finance_business_versions.version_kind` (`ORIGINAL`/`RESTATED`/`MANAGEMENT_ADJUSTED`), `restatement_reason`, `restatement_class` **już istnieją** w schemacie od `20260809_finance_v3_b06_reproducibility_retention_export.sql:74-86`, z CHECK-iem wymuszającym powód+klasę gdy `RESTATED`. WP-D01 **nic tu nie dodaje** — po prostu ustawia `finance_artifacts.artifact_type='STATEMENT_PACK'` na artefaktach, do których ten mechanizm ma zastosowanie (już domyślnie dowolny artifact_type, więc żadna zmiana schematu nie jest potrzebna).

Mechanika (z WP-B06 §4.2, zacytowana, nie wymyślona ponownie): restatement **to reopen** (B02 T12) z dodatkowymi metadanymi (`versionKind: 'RESTATED'`), nie osobna maszyna stanów. Stary wiersz `vN` (original) **nigdy nie jest modyfikowany** — fizyczna gwarancja z immutability triggera B01. Gdy `vN+1` (restated) osiąga `APPROVED`, `vN` przechodzi `SUPERSEDED` z jawnym `superseded_by_version_id`. `RESTATEMENT_CARRY` (WP-B06 §4.4) kopiuje krawędzie lineage wchodzące do `vN` na `vN+1` w tej samej transakcji.

**Przetestowane żywo** (TEST 7, sekcja 9): `bv_d01_2` utworzone jako `parent_version_id=bv_d01_1`, `version_kind='RESTATED'`, `restatement_reason`/`restatement_class` wypełnione; `bv_d01_1` pozostaje `APPROVED`/`ORIGINAL` bez żadnej mutacji.

`Management-adjusted` (WP-B06 §4.5) — osobny `artifact_id` tego samego `artifact_type='STATEMENT_PACK'`, połączony `edge_type='VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT'` — również już istnieje w `finance_lineage_edges` CHECK enum i cycle-prevention trigger (`20260809_finance_v3_b03_lineage_freshness.sql:65,123-126`). Ten ADR go tylko **stosuje** do Statement Packów (np. sprawozdanie skorygowane o pozycje jednorazowe do celów analitycznych, nie statutowych), zgodnie z decyzją WP-B06.

Treść (`finance_stmt_lines`, `finance_stmt_entities`, `finance_stmt_fx`, `finance_stmt_reconciliation`, `finance_stmt_source_evidence`) jest **version-scoped przez `business_version_id`** (nie `artifact_id`) dokładnie po to, żeby reopen (zwykły lub restatement) mógł skopiować treść z `vN` do `vN+1` jako nowy zestaw wierszy w tej samej transakcji co reopen — konsystentne z tym, jak `RESTATEMENT_CARRY`/`REOPEN_CARRY` już kopiują krawędzie lineage; ten ADR **nie** implementuje tej kopii (należy do wykonawczego Gate D razem z resztą serwisu `reopen`), tylko projektuje schemat tak, żeby kopia była naturalna (te same kolumny, nowy `business_version_id`), a nie wymuszała przebudowy.

---

## 7. Readiness gate — `DRAFT → READY_FOR_REVIEW`

WP-B02 §T2 definiuje przejście `DRAFT → READY_FOR_REVIEW` jako *"Completeness gate przechodzi LUB jawny override z uzasadnieniem"* — bez konkretnej definicji "completeness" dla Statement Pack. Ten ADR domyka to konkretną funkcją SQL, nie prozą:

```sql
finance_stmt_is_ready_for_review(p_business_version_id TEXT) RETURNS BOOLEAN
```

wołająca `finance_stmt_readiness_check(p_business_version_id)`, która zwraca tabelę siedmiu nazwanych, niezależnie testowalnych warunków:

| # | `check_name` | Warunek |
|---|---|---|
| 1 | `MAPPING_COMPLETE_NO_MISSING` | Zero komórek `finance_stmt_lines.value_status='MISSING'` dla tej wersji |
| 2 | `RECONCILIATION_NO_OPEN_UNMAPPED_DUPLICATE` | Zero wierszy `finance_stmt_reconciliation.bucket IN ('UNMAPPED','DUPLICATE')` |
| 3 | `UNIT_CURRENCY_NORMALIZED` | Zero `NULL` w `unit`/`native_currency`/`presentation_currency` (bezpośrednia odpowiedź na Gate A gap, sekcja 2.2) |
| 4 | `PERIOD_LINEAGE_COMPLETE` | Każdy `finance_stmt_lines.period_id` wskazuje realny wiersz `finance_stmt_periods` |
| 5 | `PERIMETER_DECLARED` | Co najmniej jeden wiersz `finance_stmt_entities` dla tej wersji |
| 6 | `RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE` | Ostatni `finance_reconciliation_runs.status IN ('CLEAN','WITHIN_TOLERANCE')` |
| 7 | `NO_BLOCKING_EXCEPTIONS` | Zero otwartych wyjątków `severity='SECURITY'` w `finance_exceptions_current` |

`finance_stmt_is_ready_for_review()` = `bool_and(passed)` po tych siedmiu wierszach. **Jawny override** z decyzji T2 ("LUB jawny override z uzasadnieniem") jest zakresem serwisu aplikacyjnego (wymaga `finance_exceptions` z `severity='MATERIAL'` i maker-checker impact assessment per master plan §4.3), nie tej funkcji — funkcja odpowiada wyłącznie na pytanie "czy completeness gate przechodzi", zgodnie z jej nazwą.

**Błąd znaleziony i naprawiony przez żywe testowanie** (nie przez code review): pierwsza wersja warunku #6 pisała `v_recon_residual_status IN ('CLEAN','WITHIN_TOLERANCE')` bez `COALESCE`. Gdy dla danej wersji **nie istnieje jeszcze żaden** `finance_reconciliation_runs`, to wyrażenie w SQL daje `NULL` (nie `false`), a `bool_and()` w `finance_stmt_is_ready_for_review()` **po cichu ignoruje** wiersze `NULL` zamiast liczyć je jako niespełnione — TEST 3 (sekcja 9) pokazał `overall_ready = true` mimo że Statement Pack nigdy nie przeszedł reconciliation. Naprawione przez jawny `COALESCE(..., false)`; TEST 3 po naprawie poprawnie zwraca `false`. Ten dokładny wzorzec (SQL `NULL` cicho znika w agregacie zamiast blokować) jest tej samej rodziny co "readiness bypass" z master planu §3 pkt 3 — złapany tu przez testowanie tego ADR-u, nie przez świadomość problemu z góry.

---

## 8. Mapowanie na dzisiejszy `financial_statements`/`financial_statement_values`

| Legacy (Gate A, klasyfikacja) | Canonical (ten ADR) | Uwaga |
|---|---|---|
| `financial_statement_packs` (`AUTO_MIGRATE`) | `finance_artifacts` (`artifact_type='STATEMENT_PACK'`) + `finance_business_versions` | Jeden pack ≈ jeden artifact; każdy `financial_statement_versions.version_no` ≈ jeden `business_version_id` |
| `financial_statements` (`AUTO_MIGRATE`) | `finance_stmt_entities` (per `entity_name`) + kontekst statement_type na `finance_stmt_lines` | `financial_statements.currency`/`.scaling` nullable → `finance_stmt_lines.native_currency`/`.unit` `NOT NULL` (Gate A gap zamknięty strukturalnie) |
| `financial_statement_values` (`MIGRATE_WITH_WARNING` — brak `organization_id`) | `finance_stmt_lines` | `value REAL` w pełni nullable, bez rozróżnienia missing/NA/zero → `value_status`+`value_decimal` z CHECK-iem (sekcja 5.6); `organization_id` teraz bezpośrednio na wierszu, nie tylko przez JOIN |
| `financial_statement_lines` (`AUTO_MIGRATE`, taksonomia) | **reużyta bez zmian** jako `finance_stmt_lines.canonical_line_id` FK | Rozszerzona addytywnie o `RETAINED_EARNINGS`/`DIVIDENDS_DECLARED` (sekcja 5.3) |
| `financial_statement_value_evidence` (`MIGRATE_WITH_WARNING`) | `finance_stmt_source_evidence` | + `bbox`, celuje w nową `finance_stmt_lines` zamiast legacy `financial_statement_values` |
| `financial_statement_versions`/`financial_statement_value_versions` (`AUTO_MIGRATE`/`MIGRATE_WITH_WARNING`, "real prior art" per Gate A) | `finance_business_versions` (lifecycle) + `version_kind`/`restatement_*` | Wzorzec `version_no INTEGER, UNIQUE(statement_id, version_no)` już zainspirował `uq_finance_bv_artifact_version` w WP-B01 (patrz `WP-B01_artifact_schema_ADR.md` §1.2) |
| `financial_statement_validations` (ex-post agregat) | `finance_reconciliation_runs` (istniejący, B05) + `finance_stmt_reconciliation` (ten ADR, per-wiersz) | Ex-post pass/warn/fail zastąpione ciągłym waterfallem z residualem i tolerancją |
| — (brak dziś) | `finance_stmt_calendars`, `finance_stmt_periods`, `finance_stmt_fx` | Zero odpowiednika legacy — dzisiejszy schemat nie ma kalendarza fiskalnego, konsolidacji ani FX w ogóle |

Migracja backfillu (który legacy wiersz → który `finance_stmt_*` wiersz) jest zakresem wykonawczego Gate D (analog WP-C03), nie tego ADR-u — ten ADR tylko ustala docelowy kształt i klasyfikację dziedziczoną z Gate A.

---

## 9. Dowód testowy (ephemeral Postgres, zasady WP-C01)

Zgodnie z twardym zakazem w briefie tego zadania, **żadna baza produkcyjna/demo/dev nie była dotknięta**. Weryfikacja DDL wykonana na dwóch jednorazowych efemerycznych klastrach, dokładnie po procedurze WP-C01/C02/C03:

- `initdb --locale=C`, port z zakresu 55000–59999 (57891, potem 57892 po sprawdzeniu `lsof` wolności), `listen_addresses=127.0.0.1`, osobny katalog danych w `/private/tmp/`.
- Uruchomiony pełen istniejący zestaw migracji (`server/scripts/migrate.postgres.ts`, `NODE_ENV=test`) — 586/586 migracji (w tym 7 istniejących plików Gate C Finance v3), 0 błędów, przed nałożeniem DDL-u z tego ADR-u.
- Na to naniesiony pełny DDL sketch z Załącznika A (7 tabel + 5 kontroli integralności + funkcja readiness gate) — zastosowany bezbłędnie po jednej korekcie (patrz niżej).
- `pg_ctl stop` + `rm -rf` katalogu danych po każdym z dwóch przebiegów; potwierdzone `ps aux`, że współdzielona instancja Homebrew (PID 911, `/opt/homebrew/var/postgresql@15`) pozostała nietknięta przez cały czas.

**Co testowanie znalazło i naprawiło (nie tylko potwierdziło):**

1. `CREATE CONSTRAINT TRIGGER ... REFERENCING NEW TABLE ... FOR EACH STATEMENT` **nie kompiluje się** — Postgres wymaga, żeby constraint triggery były `FOR EACH ROW`. Pierwotny projekt (agregacja całej instrukcji przez transition table) przepisany na `FOR EACH ROW` odczytujący `NEW` bezpośrednio, wciąż `DEFERRABLE INITIALLY DEFERRED` (uruchamia się na `COMMIT`, więc semantyka "sprawdź po całym batchu" jest zachowana mimo wykonania per-wiersz).
2. Readiness gate: `bool_and()` cicho ignorował `NULL` z warunku #6, dając fałszywe `overall_ready=true` gdy nigdy nie uruchomiono reconciliation — naprawione `COALESCE(...,false)` (opisane w sekcji 7).

**Scenariusze przechodzące żywo** (pełne logi w `wp_d01_fixtures_and_tests.sql`/`wp_d01_rollforward_tests.sql`, scratchpad sesji, nie w repo):

| Test | Oczekiwane | Wynik |
|---|---|---|
| Zbalansowany BS (Assets=L+E dokładnie) | commit przechodzi | ✅ |
| Niezbalansowany BS w tolerancji (600 PLN < 1000 PLN) | commit przechodzi | ✅ |
| Niezbalansowany BS poza tolerancją (50 000 PLN > 1000 PLN) | commit odrzucony | ✅ odrzucony z dokładnym komunikatem diff/tolerancja |
| `value_status='PRESENT_NONZERO'` z `value_decimal IS NULL` | insert odrzucony (`check_violation`) | ✅ |
| Mutacja `finance_stmt_lines` po `APPROVED` rodzica | update odrzucony | ✅ (ten sam wzorzec co B01 immutability trigger) |
| Reopen → `vN+1` z `version_kind='RESTATED'` | `vN` niezmieniony, `vN+1` `DRAFT`/`RESTATED` | ✅ |
| Readiness gate z brakującą komórką `MISSING` | `overall_ready=false` | ✅ |
| Cash roll-forward spójny (opening+net_change=closing) | commit przechodzi | ✅ |
| Cash roll-forward z closing przesuniętym o 100 000 PLN | commit odrzucony | ✅ z dokładnym komunikatem |
| RE roll-forward z dywidendami `NA` | commit przechodzi | ✅ |
| RE roll-forward z dywidendami `MISSING` | kontrola pominięta (nie fałszywy pass/fail) | ✅ |
| Elimination para 500 000/500 000 (debit/credit) | commit przechodzi | ✅ |
| Elimination jednostronna zmiana do 700 000 | commit odrzucony | ✅ z dokładnym komunikatem |

Te testy **nie są** Gate C — nie mają resume/checksums/shadow-parity/canary i nie testują backfillu z żywych danych legacy. Są dowodem, że DDL jest **syntaktycznie poprawny i triggery zachowują się zgodnie z projektem**, nie dowodem gotowości produkcyjnej migracji.

---

## 10. Rozważane alternatywy (odrzucone)

### 10.1 Osobna tabela master `finance_stmt_entities_master` (organizacja-poziomowa, nie version-scoped)

Rozważona: jedna encja = jeden wiersz na zawsze, z osobną tabelą `finance_stmt_perimeter` (version-scoped) do ownership/method/perymetru per wersja.

**Odrzucona**: perymetr konsolidacji (kto jest w grupie, jaką metodą, z jakim % własności) **zmienia się co okres** (akwizycje/zbycia/step-up/step-down) — to jest fakt raportowanego okresu, nie stała właściwość encji. Master-poziomowa tabela wymagałaby efektywnie tego samego mechanizmu wersjonowania co `finance_stmt_perimeter`, tylko z dodatkowym poziomem pośredniczącym (join encja↔wersja) bez korzyści — `entity_code` jako stabilny naturalny klucz już daje ciągłość analityczną (grupowanie/trend po tej samej spółce między wersjami) bez potrzeby osobnej tabeli tożsamości. Udokumentowana jako świadoma decyzja upraszczająca, nie przeoczenie.

### 10.2 CTA jako osobna tabela zamiast wiersza `finance_stmt_lines`

Rozważona: `finance_stmt_cta` z per-encja/okres kolumnami `opening_cta`/`translation_adjustment`/`closing_cta`.

**Odrzucona**: CTA jest z definicji linią OCI/kapitału własnego w bilansie — traktowanie jej jako specjalnego przypadku zamiast zwykłego wiersza `finance_stmt_lines` (z `is_adjustment=true`, kanoniczną linią OCI) złamałoby jednolitość "jeden mechanizm wartości dla wszystkiego" z WP-B01 §2.7 i wymagałoby osobnej ścieżki UI/eksportu tylko dla tego jednego pola. Reużycie istniejącego mechanizmu wartości jest prostsze i spójniejsze.

### 10.3 `finance_stmt_reconciliation` jako odtworzenie kształtu `finance_reconciliation_runs` zamiast rollupu do niego

Rozważona: własna, kompletna tabela waterfallu na poziomie Statements, niezależna od `finance_reconciliation_runs`.

**Odrzucona**: `finance_reconciliation_runs` (B05) jest już przetestowanym, generic-artefaktowym agregatem z `materiality_threshold_applied`/`residual`/`status` jako **generated columns** — odtworzenie tego kształtu osobno dla Statements dałoby dwa niezsynchronizowane źródła prawdy o tym samym waterfallu. `finance_stmt_reconciliation` jako **dzieci** jednego `finance_reconciliation_runs.id` (przez `reconciliation_run_id` FK) daje granularność per-wiersz bez duplikowania agregatu.

### 10.4 Generyczna tabela `finance_stmt_rollforward` zamiast osobnych triggerów per równanie

Rozważona: jedna konfigurowalna tabela reguł roll-forward (`opening_line_code`, `movement_line_code`, `closing_line_code`) odczytywana przez jeden generyczny trigger, zamiast trzech odrębnych funkcji (`check_balance`/`check_cash_rollforward`/`check_retained_earnings_rollforward`).

**Odrzucona na tym etapie**: master plan wymaga dokładnie trzech konkretnych, nazwanych kontroli (balance, cash, retained earnings) plus eliminations — nie generycznego silnika schedule'ów (to jest zakres Baseline Model, Gate D-03, nie Statements). Budowanie generycznego silnika reguł tutaj przedwcześnie rozszerzyłoby zakres WP-D01 poza to, co brief prosi, i zdublowałoby to, co Baseline Model i tak musi zbudować dla swoich własnych schedules. Udokumentowane jako świadomie odłożone, nie zapomniane — jeśli w przyszłości pojawi się piąte/szóste podobne równanie specyficzne dla Statements, ponowna ocena tej alternatywy jest zasadna.

---

## 11. Escalacje wymagane przed pełnym GO

Żadna z poniższych nie blokuje przyjęcia tego ADR-u jako projektu — wszystkie są już `PROVISIONAL_PENDING_OWNER_DECISION` gdzie indziej w programie i ten ADR ich nie rozstrzyga jednostronnie, zgodnie z `DEC-FIN-012`:

1. **Konkretna liczba progu materialności** (5% czy inna) — to dosłownie `Decyzja właścicielska #8` z addendum §8, już eskalowana przez orkiestratora Gate B (`GATE_B_INTEGRATION_RECONCILIATION.md` §7). Ten ADR **konsumuje** placeholder przez `finance_reconciliation_runs.materiality_threshold_applied`, nie tworzy nowej eskalacji — tylko przypomina, że dopóki ta liczba nie jest `CONFIGURED`, każdy wynik kontroli balansu w tym schemacie niesie provisional materiality.
2. **`market_data_snapshot_id`** (WP-B06 §10.3) pozostaje bez właściciela — ten ADR świadomie go nie zagarnia (sekcja 2.3); wymaga potwierdzenia, czy Valuation (przyszły Gate D/E WP) go przejmie.
3. **Rzeczywisty backfill legacy → `finance_stmt_*`** (który `financial_statement_packs`/`financial_statements`/`financial_statement_values` wiersz mapuje na który nowy wiersz, z jaką `mapping_confidence`) jest zakresem osobnego wykonawczego WP (analog WP-C03), nie tego ADR-u — Załącznik B (mapowanie kolumna-do-kolumny) jest punktem startowym, nie kompletną specyfikacją migracji danych.
4. **Amendment do `finance_compute_snapshots`** (dodanie realnego FK z `fiscal_calendar_id`/`fx_snapshot_id` do nowych tabel tego ADR-u) wymaga zgody właściciela WP-B06/B01 przed wykonaniem, zgodnie z tym samym wzorcem cross-ADR co inne otwarte pytania Gate B (`WP-B06` §10 pkt 1-2) — nie jest wykonywane jednostronnie przez ten dokument.

---

## 12. Traceability

| Wymaganie z zadania | Sekcja tego ADR |
|---|---|
| `finance_stmt_lines` z rozróżnieniem PRESENT_ZERO/MISSING/NA per §2.4 master planu | §4.5, §5.6 |
| `finance_stmt_periods` — fiscal calendar standard/4-4-5/53-week/stub, FY/Q/month, flow/stock, YTD/LTM/quarter-only | §4.2 (flow/stock = `statement_type` na `finance_stmt_lines`; YTD/LTM/quarter-only = `accumulation_basis` na `finance_stmt_lines`, nie na okresie) |
| `finance_stmt_entities` — legal entity, consolidation perimeter, ownership/NCI | §4.3 |
| `finance_stmt_fx` — transaction/functional/presentation, average/closing/historical, CTA | §4.4 |
| `finance_stmt_reconciliation` z materiality limit referencującym `GATE_B_INTEGRATION_RECONCILIATION.md` §7 | §4.6, §5.0 |
| `finance_stmt_source_evidence` per row/cell | §4.7 |
| CHECK/trigger: Assets=L+E w source-rounding tolerance (nie hardcoded 0.1%) | §5.0, §5.1 |
| CF closing cash=BS cash; opening+movements=closing | §5.2 |
| Retained earnings roll-forward | §5.3 |
| Elimination debits=credits | §5.4 |
| Restatement: original/restated/management-adjusted, spójne z WP-B06, bez nowego mechanizmu | §6 |
| Readiness gate DRAFT→READY_FOR_REVIEW jako konkretna funkcja/query | §7 |
| Mapowanie na dzisiejszy `financial_statements`/`financial_statement_values` z klasyfikacją Gate A | §8, Załącznik B |
| Zakaz łączenia z bazą produkcyjną/demo/dev; własny efemeryczny Postgres jeśli testowane | §9 |

---

## Załącznik A — pełny DDL sketch (syntaktycznie zwalidowany na efemerycznym Postgresie)

Kolejność wykonania: najpierw ten blok (7 tabel, jedna transakcja), potem drugi blok (5 kontroli integralności + rozszerzenie taksonomii, osobna transakcja, bo funkcje/triggery odwołują się do tabel z pierwszego bloku), na końcu funkcje readiness gate (trzeci plik, bez owijającej transakcji — dwie `CREATE FUNCTION`).

```sql
-- WP-D01 Statements Truth Engine — domain schema DDL sketch (Gate D / Fala 3).
--
-- Depends on (already shipped, Gate B/C, untouched by this file):
--   finance_artifacts, finance_business_versions, finance_working_revisions (b01)
--   finance_value_status enum (b01)
--   finance_lineage_edges, finance_artifact_stage_rank() (b03)
--   finance_exceptions, finance_reconciliation_runs (b05)
--   finance_business_versions.version_kind/restatement_reason/restatement_class (b06)
--   financial_statement_lines (Gate A legacy taxonomy, AUTO_MIGRATE, reused as-is)
--   organizations(id)

BEGIN;

-- ============================================================================
-- 1. finance_stmt_calendars — fiscal calendar definitions.
--    Claims ownership of "fiscal_calendar_id" flagged as an unassigned forward
--    reference by WP-B06 section 10.3 ("prawdopodobnie WP-D01... WP-D01
--    potwierdza właścicielstwo przy swoim starcie").
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_calendars (
  fiscal_calendar_id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id             TEXT NOT NULL REFERENCES organizations(id),
  entity_code                   TEXT, -- NULL = organization default calendar; else scoped to one entity_code (soft key, see ADR section 10.1 on why finance_stmt_entities has no separate master row)
  calendar_type                   TEXT NOT NULL CHECK (calendar_type IN ('STANDARD', 'FOUR_FOUR_FIVE', 'FIFTY_THREE_WEEK')),
  fiscal_year_end_month              INTEGER NOT NULL CHECK (fiscal_year_end_month BETWEEN 1 AND 12),
  fiscal_year_end_reference             TEXT NOT NULL DEFAULT 'LAST_DAY_OF_MONTH'
                                           CHECK (fiscal_year_end_reference IN ('LAST_DAY_OF_MONTH', 'NEAREST_WEEKDAY')),
  fiscal_year_end_weekday                 INTEGER CHECK (fiscal_year_end_weekday BETWEEN 0 AND 6),
  four_four_five_pattern                    TEXT CHECK (four_four_five_pattern IN ('445', '454', '544')),
  effective_from                              DATE NOT NULL,
  effective_to                                  DATE,
  created_by                                     TEXT NOT NULL,
  created_at                                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_finance_stmt_cal_weekday_required
    CHECK (fiscal_year_end_reference = 'LAST_DAY_OF_MONTH' OR fiscal_year_end_weekday IS NOT NULL),
  CONSTRAINT chk_finance_stmt_cal_445_required
    CHECK (calendar_type != 'FOUR_FOUR_FIVE' OR four_four_five_pattern IS NOT NULL),
  CONSTRAINT chk_finance_stmt_cal_effective_range
    CHECK (effective_to IS NULL OR effective_to > effective_from),

  CONSTRAINT uq_finance_stmt_cal_scope UNIQUE (organization_id, entity_code, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_cal_org ON finance_stmt_calendars(organization_id, entity_code);

-- ============================================================================
-- 2. finance_stmt_periods — fiscal period windows (FY/Q/month/week; stub-aware).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_periods (
  period_id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id             TEXT NOT NULL REFERENCES organizations(id),
  fiscal_calendar_id            TEXT NOT NULL REFERENCES finance_stmt_calendars(fiscal_calendar_id),
  period_type                     TEXT NOT NULL CHECK (period_type IN ('FY', 'Q', 'MONTH', 'WEEK')),
  fiscal_year                       INTEGER NOT NULL,
  fiscal_quarter                      INTEGER CHECK (fiscal_quarter BETWEEN 1 AND 4),
  fiscal_month                          INTEGER CHECK (fiscal_month BETWEEN 1 AND 12),
  fiscal_week                             INTEGER CHECK (fiscal_week BETWEEN 1 AND 53),
  period_start                              DATE NOT NULL,
  period_end                                  DATE NOT NULL,
  is_stub                                       BOOLEAN NOT NULL DEFAULT false,
  stub_reason                                     TEXT,
  label                                             TEXT NOT NULL,
  previous_period_id                                  TEXT REFERENCES finance_stmt_periods(period_id), -- explicit chain link for roll-forward checks (section 5.2/5.3) instead of a period_end heuristic, robust across 4-4-5/53-week/stub boundaries
  created_by                                          TEXT NOT NULL,
  created_at                                            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_finance_stmt_period_range CHECK (period_end > period_start),
  CONSTRAINT chk_finance_stmt_period_stub_reason CHECK (NOT is_stub OR stub_reason IS NOT NULL),

  -- Exactly one dimension set per period_type; the other two stay NULL (enforced per-type below).
  CONSTRAINT chk_finance_stmt_period_fy_shape
    CHECK (period_type != 'FY' OR (fiscal_quarter IS NULL AND fiscal_month IS NULL AND fiscal_week IS NULL)),
  CONSTRAINT chk_finance_stmt_period_q_shape
    CHECK (period_type != 'Q' OR (fiscal_quarter IS NOT NULL AND fiscal_month IS NULL AND fiscal_week IS NULL)),
  CONSTRAINT chk_finance_stmt_period_month_shape
    CHECK (period_type != 'MONTH' OR (fiscal_month IS NOT NULL AND fiscal_quarter IS NULL AND fiscal_week IS NULL)),
  CONSTRAINT chk_finance_stmt_period_week_shape
    CHECK (period_type != 'WEEK' OR (fiscal_week IS NOT NULL AND fiscal_quarter IS NULL AND fiscal_month IS NULL))
);

-- Postgres UNIQUE treats NULL as distinct, so a single composite UNIQUE across all four
-- period_type shapes would NOT catch two identical FY rows (fiscal_quarter/month/week all
-- NULL on both). Four partial unique indexes, one per period_type, close that gap.
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_stmt_period_fy
  ON finance_stmt_periods (fiscal_calendar_id, fiscal_year) WHERE period_type = 'FY';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_stmt_period_q
  ON finance_stmt_periods (fiscal_calendar_id, fiscal_year, fiscal_quarter) WHERE period_type = 'Q';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_stmt_period_month
  ON finance_stmt_periods (fiscal_calendar_id, fiscal_year, fiscal_month) WHERE period_type = 'MONTH';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_stmt_period_week
  ON finance_stmt_periods (fiscal_calendar_id, fiscal_year, fiscal_week) WHERE period_type = 'WEEK';

CREATE INDEX IF NOT EXISTS idx_finance_stmt_period_range ON finance_stmt_periods(fiscal_calendar_id, period_start, period_end);

-- WEEK period_type only makes sense for 4-4-5/53-week calendars; cross-table, needs a trigger.
CREATE OR REPLACE FUNCTION finance_stmt_period_check_week_calendar() RETURNS TRIGGER AS $$
DECLARE v_calendar_type TEXT;
BEGIN
  IF NEW.period_type = 'WEEK' THEN
    SELECT calendar_type INTO v_calendar_type FROM finance_stmt_calendars WHERE fiscal_calendar_id = NEW.fiscal_calendar_id;
    IF v_calendar_type NOT IN ('FOUR_FOUR_FIVE', 'FIFTY_THREE_WEEK') THEN
      RAISE EXCEPTION 'finance_stmt_periods: WEEK period_type requires a FOUR_FOUR_FIVE/FIFTY_THREE_WEEK calendar, got %', v_calendar_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_period_check_week_calendar ON finance_stmt_periods;
CREATE TRIGGER trg_finance_stmt_period_check_week_calendar
  BEFORE INSERT OR UPDATE ON finance_stmt_periods
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_period_check_week_calendar();

-- ============================================================================
-- 3. finance_stmt_entities — legal entity + consolidation perimeter, scoped to
--    ONE Statement Pack business_version_id (perimeter changes every period:
--    acquisitions/disposals/step-up/step-down are period-scoped facts, not
--    org-level master data — see ADR section 10.1 for the rejected alternative).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_entities (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,

  entity_code                      TEXT NOT NULL, -- stable natural key across versions/periods for the same legal entity
  legal_name                         TEXT NOT NULL,
  jurisdiction                         TEXT,

  role                                   TEXT NOT NULL CHECK (role IN (
                                            'GROUP_PARENT', 'SUBSIDIARY', 'ASSOCIATE', 'JOINT_VENTURE', 'ELIMINATION_BUCKET'
                                          )),
  parent_entity_row_id                     TEXT REFERENCES finance_stmt_entities(id),
  consolidation_method                       TEXT NOT NULL CHECK (consolidation_method IN (
                                                'FULL', 'PROPORTIONAL', 'EQUITY_METHOD', 'NOT_CONSOLIDATED'
                                              )),
  ownership_pct                                NUMERIC(7,4) CHECK (ownership_pct >= 0 AND ownership_pct <= 100),
  nci_pct                                        NUMERIC(7,4) GENERATED ALWAYS AS (
                                                    CASE WHEN consolidation_method = 'FULL'
                                                         THEN GREATEST(0, 100 - COALESCE(ownership_pct, 100))
                                                         ELSE 0 END
                                                  ) STORED,

  functional_currency                              TEXT NOT NULL, -- ISO 4217

  perimeter_event                                    TEXT NOT NULL DEFAULT 'NONE' CHECK (perimeter_event IN (
                                                        'NONE', 'ACQUISITION', 'DISPOSAL', 'STEP_UP', 'STEP_DOWN', 'ORGANIC'
                                                      )),
  perimeter_event_date                                 DATE,
  discontinued_operation                                 BOOLEAN NOT NULL DEFAULT false,

  created_by                                               TEXT NOT NULL,
  created_at                                                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_entities_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_stmt_entities_version_code UNIQUE (business_version_id, entity_code),

  CONSTRAINT chk_finance_stmt_entities_parent_shape
    CHECK (role NOT IN ('GROUP_PARENT', 'ELIMINATION_BUCKET') OR parent_entity_row_id IS NULL),
  CONSTRAINT chk_finance_stmt_entities_ownership_required
    CHECK (consolidation_method = 'NOT_CONSOLIDATED' OR role = 'ELIMINATION_BUCKET' OR ownership_pct IS NOT NULL),
  CONSTRAINT chk_finance_stmt_entities_elimination_shape
    CHECK (role != 'ELIMINATION_BUCKET' OR (consolidation_method = 'NOT_CONSOLIDATED' AND ownership_pct IS NULL)),
  CONSTRAINT chk_finance_stmt_entities_perimeter_event_date
    CHECK (perimeter_event = 'NONE' OR perimeter_event_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_entities_version ON finance_stmt_entities(business_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_entities_code ON finance_stmt_entities(organization_id, entity_code);

-- ============================================================================
-- 4. finance_stmt_fx — transaction/functional/presentation currency rates,
--    frozen per Statement Pack Version (rates must not silently drift once a
--    version is Approved — same "aligned as-of" requirement as market data).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_fx (
  fx_rate_id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,
  period_id                        TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),

  from_currency                      TEXT NOT NULL, -- ISO 4217
  to_currency                          TEXT NOT NULL, -- ISO 4217
  rate_type                              TEXT NOT NULL CHECK (rate_type IN ('AVERAGE', 'CLOSING', 'HISTORICAL')),
  rate                                     NUMERIC NOT NULL CHECK (rate > 0),
  rate_source                                TEXT, -- e.g. 'NBP', 'ECB', 'manual_override:<user>'; forward-ref only, no market-data FK (owner not yet assigned, WP-B06 §10.3)
  as_of                                        TIMESTAMPTZ NOT NULL,

  created_by                                     TEXT NOT NULL,
  created_at                                       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_fx_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_stmt_fx_pair CHECK (from_currency != to_currency),
  CONSTRAINT uq_finance_stmt_fx UNIQUE (business_version_id, period_id, from_currency, to_currency, rate_type)
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_fx_version ON finance_stmt_fx(business_version_id, period_id);

-- ============================================================================
-- 5. finance_stmt_lines — the statement value table (P&L/BS/CF cells).
--    Adopts the mandatory value-cell column bundle from WP-B01 section 2.7
--    verbatim (value_status/value_decimal/native_currency/presentation_currency/
--    unit/multiplier/period_id/entity_id/source_ref/is_adjustment/adjustment_reason),
--    plus Statements-domain-specific columns.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_lines (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,

  statement_type                   TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  canonical_line_id                  TEXT NOT NULL REFERENCES financial_statement_lines(id), -- reuse Gate A taxonomy (AUTO_MIGRATE), not duplicated
  entity_id                            TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  period_id                              TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),
  accumulation_basis                       TEXT NOT NULL DEFAULT 'FULL_YEAR' CHECK (accumulation_basis IN (
                                              'QUARTER_ONLY', 'YTD', 'LTM', 'FULL_YEAR'
                                            )),
  consolidation_scope                        TEXT NOT NULL DEFAULT 'CONSOLIDATED' CHECK (consolidation_scope IN (
                                                'STANDALONE', 'CONSOLIDATED', 'ELIMINATION'
                                              )),

  -- WP-B01 section 2.7 mandatory bundle:
  value_status                                 finance_value_status NOT NULL DEFAULT 'MISSING',
  value_decimal                                  NUMERIC,
  native_currency                                  TEXT NOT NULL, -- ISO 4217, currency the source figure was denominated in
  presentation_currency                              TEXT NOT NULL, -- ISO 4217, currency after translation for group reporting
  unit                                                 TEXT NOT NULL CHECK (unit IN ('UNITS', 'THOUSANDS', 'MILLIONS', 'BILLIONS')),
  multiplier                                             NUMERIC NOT NULL DEFAULT 1, -- scale factor applied on top of `unit`, e.g. FX-translation rounding residual absorption; 1 by default
  source_ref                                               JSONB, -- {source_document_ref, page, row, raw_label}; superset feeds finance_stmt_source_evidence
  is_adjustment                                              BOOLEAN NOT NULL DEFAULT false,
  adjustment_reason                                            TEXT,

  -- Statements-domain-specific:
  sign_convention                                                TEXT NOT NULL DEFAULT 'NATURAL' CHECK (sign_convention IN ('NATURAL', 'CONTRA')),
  accounting_policy                                                TEXT NOT NULL CHECK (accounting_policy IN ('IFRS', 'LOCAL_GAAP', 'US_GAAP')),
  ifrs16_treatment                                                   TEXT CHECK (ifrs16_treatment IN ('APPLIED', 'NOT_APPLICABLE', 'EXEMPT')),
  discontinued_operations                                              BOOLEAN NOT NULL DEFAULT false,
  exceptional_item                                                       BOOLEAN NOT NULL DEFAULT false,
  reclassified_from_line_id                                                TEXT REFERENCES finance_stmt_lines(id),

  created_by                                                                 TEXT NOT NULL,
  created_at                                                                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                                     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_lines_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  -- WP-B01 2.7 value_status <-> value_decimal shape, enforced here per-table as instructed.
  CONSTRAINT chk_finance_stmt_lines_value_shape CHECK (
    (value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL AND value_decimal != 0)
    OR (value_status = 'PRESENT_ZERO' AND value_decimal = 0)
    OR (value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE') AND value_decimal IS NULL)
  ),
  CONSTRAINT chk_finance_stmt_lines_adjustment_reason CHECK (NOT is_adjustment OR adjustment_reason IS NOT NULL),

  -- One authoritative cell per dimensional combination — the "stable canonical key"
  -- the Finance Data Grid (master plan section 10) addresses cells by.
  CONSTRAINT uq_finance_stmt_lines_cell UNIQUE (
    business_version_id, entity_id, canonical_line_id, period_id, accumulation_basis, consolidation_scope
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_lines_version ON finance_stmt_lines(business_version_id, statement_type);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_lines_entity_period ON finance_stmt_lines(entity_id, period_id);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_lines_canonical ON finance_stmt_lines(canonical_line_id);

-- Content freeze once the parent business_version is APPROVED — finance_business_versions'
-- own immutability trigger (B01 §2.4) only protects that one row; every Gate D content table
-- needs the equivalent guard against its own parent lookup (documented, not silent — same
-- "no subquery-in-CHECK, route to a trigger" pattern the B01/B03/B05 trigger authors already used).
CREATE OR REPLACE FUNCTION finance_stmt_lines_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_stmt_lines: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_lines_parent_immutability ON finance_stmt_lines;
CREATE TRIGGER trg_finance_stmt_lines_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_stmt_lines
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_lines_enforce_parent_immutability();

-- ============================================================================
-- 6. finance_stmt_reconciliation — per-row/bucket waterfall detail. Rolls up
--    INTO an existing finance_reconciliation_runs row (Gate B/C, already
--    shipped as the artifact-level aggregate) rather than re-deriving the
--    waterfall shape; this table supplies the row-level detail that aggregate
--    does not carry.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_reconciliation (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,
  reconciliation_run_id            TEXT NOT NULL REFERENCES finance_reconciliation_runs(id),

  source_row_ref                     JSONB NOT NULL, -- {source_document_ref, page, row, raw_label}
  canonical_line_id                    TEXT REFERENCES financial_statement_lines(id), -- NULL until mapped
  entity_id                              TEXT REFERENCES finance_stmt_entities(id),
  period_id                                TEXT REFERENCES finance_stmt_periods(period_id),

  bucket                                     TEXT NOT NULL CHECK (bucket IN (
                                                'MAPPED', 'EXCLUDED', 'UNMAPPED', 'DUPLICATE', 'RECLASS', 'ELIMINATION', 'CANONICAL'
                                              )),
  source_amount                                NUMERIC NOT NULL,
  mapped_amount                                  NUMERIC, -- amount actually contributed to the canonical total; NULL for EXCLUDED/UNMAPPED/DUPLICATE (contribute 0 by definition)

  duplicate_of_row_id                              TEXT REFERENCES finance_stmt_reconciliation(id),
  reclass_target_line_id                             TEXT REFERENCES financial_statement_lines(id),
  elimination_counterparty_entity_id                   TEXT REFERENCES finance_stmt_entities(id),

  reason_code                                            TEXT,
  notes                                                    TEXT,

  created_by                                                 TEXT NOT NULL,
  created_at                                                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_recon_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_stmt_recon_duplicate CHECK (bucket != 'DUPLICATE' OR duplicate_of_row_id IS NOT NULL),
  CONSTRAINT chk_finance_stmt_recon_reclass CHECK (bucket != 'RECLASS' OR reclass_target_line_id IS NOT NULL),
  CONSTRAINT chk_finance_stmt_recon_elimination CHECK (bucket != 'ELIMINATION' OR elimination_counterparty_entity_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_recon_run ON finance_stmt_reconciliation(reconciliation_run_id, bucket);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_recon_version ON finance_stmt_reconciliation(business_version_id);

-- ============================================================================
-- 7. finance_stmt_source_evidence — per row/cell provenance. Extends the Gate A
--    financial_statement_value_evidence shape with the page/bbox capture the
--    extractor today leaves NULL (a known, confirmed-live gap), targeting the
--    new finance_stmt_lines cell instead of legacy financial_statement_values.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_source_evidence (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,
  stmt_line_id                     TEXT NOT NULL REFERENCES finance_stmt_lines(id),

  evidence_type                      TEXT NOT NULL CHECK (evidence_type IN (
                                        'SOURCE_DOCUMENT_CELL', 'AGGREGATED', 'DERIVED_FORMULA', 'MANUAL_OVERRIDE', 'RECONCILIATION_ADJUSTMENT'
                                      )),
  source_document_ref                  TEXT, -- opaque pointer into ingest storage; no FK (source doc tables are Gate A legacy, not yet migrated)
  source_page                            INTEGER,
  source_row                               INTEGER,
  bbox                                       JSONB, -- {x0,y0,x1,y1,page}; NEW column closing the confirmed-live extractor gap
  raw_label                                    TEXT,
  raw_value                                      TEXT,
  confidence                                       NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  contribution_weight                                NUMERIC NOT NULL DEFAULT 1,
  explanation                                          TEXT,

  created_by                                             TEXT NOT NULL,
  created_at                                               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_evidence_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_stmt_evidence_derivation CHECK (
    evidence_type NOT IN ('DERIVED_FORMULA', 'MANUAL_OVERRIDE', 'RECONCILIATION_ADJUSTMENT') OR explanation IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_evidence_line ON finance_stmt_source_evidence(stmt_line_id);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_evidence_version ON finance_stmt_source_evidence(business_version_id);

COMMIT;

-- ============================================================================
-- 8. Integrity controls (separate transaction: functions/triggers reference
--    tables created above).
-- ============================================================================
BEGIN;

-- 8.0 shared tolerance helper — "source rounding" half of the addendum's
-- "source rounding AND materiality, usually the more restrictive" rule.
-- Two independently-rounded presentation-unit subtotals (Total Assets side,
-- Total Liabilities+Equity side) can each carry up to 0.5 unit of rounding
-- error -> worst case combined tolerance is 1 full presentation unit.
CREATE OR REPLACE FUNCTION finance_stmt_unit_value(p_unit TEXT) RETURNS NUMERIC AS $$
BEGIN
  RETURN CASE p_unit
    WHEN 'UNITS' THEN 1
    WHEN 'THOUSANDS' THEN 1000
    WHEN 'MILLIONS' THEN 1000000
    WHEN 'BILLIONS' THEN 1000000000
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION finance_stmt_balance_tolerance(
  p_business_version_id TEXT, p_unit TEXT, p_total_assets NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_rounding_tolerance NUMERIC;
  v_materiality_pct NUMERIC;
  v_materiality_tolerance NUMERIC;
BEGIN
  v_rounding_tolerance := finance_stmt_unit_value(p_unit); -- 1 full presentation unit, worst case of two independently rounded subtotals

  SELECT materiality_threshold_applied INTO v_materiality_pct
    FROM finance_reconciliation_runs
    WHERE business_version_id = p_business_version_id
    ORDER BY created_at DESC LIMIT 1;

  IF v_materiality_pct IS NULL THEN
    -- No reconciliation run recorded yet for this version -> fall back to rounding-only tolerance;
    -- the PROVISIONAL_PENDING_OWNER_DECISION placeholder (GATE_B_INTEGRATION_RECONCILIATION.md §7)
    -- is per-run, not a standing default, so this function does not invent one.
    RETURN v_rounding_tolerance;
  END IF;

  v_materiality_tolerance := v_materiality_pct * ABS(p_total_assets);

  -- Addendum correction: NOT max(1 unit, 0.1%) — derive from BOTH source rounding and
  -- materiality, and take the more restrictive (smaller) of the two.
  RETURN LEAST(v_rounding_tolerance, v_materiality_tolerance);
END;
$$ LANGUAGE plpgsql;

-- 8.1 Assets = Liabilities + Equity. Constraint triggers must be FOR EACH ROW
-- (Postgres restriction — no FOR EACH STATEMENT constraint triggers, no transition
-- tables needed here since the row-level NEW already carries the dimensional key);
-- DEFERRABLE INITIALLY DEFERRED means the check runs once at COMMIT, after a whole
-- batch paste/import has finished writing both the Assets and the Liabilities+Equity
-- side, not mid-write while the row set is transiently unbalanced.
CREATE OR REPLACE FUNCTION finance_stmt_check_balance() RETURNS TRIGGER AS $$
DECLARE
  v_assets NUMERIC;
  v_liab_equity NUMERIC;
  v_tolerance NUMERIC;
  v_unit TEXT;
BEGIN
  IF NEW.statement_type != 'BS' THEN
    RETURN NULL;
  END IF;

  SELECT value_decimal, unit INTO v_assets, v_unit
    FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND period_id = NEW.period_id AND accumulation_basis = NEW.accumulation_basis
      AND canonical_line_id = (SELECT id FROM financial_statement_lines WHERE line_code = 'TOTAL_ASSETS' AND statement_type = 'BS' LIMIT 1)
      AND consolidation_scope = 'CONSOLIDATED';

  SELECT value_decimal INTO v_liab_equity
    FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND period_id = NEW.period_id AND accumulation_basis = NEW.accumulation_basis
      AND canonical_line_id = (SELECT id FROM financial_statement_lines WHERE line_code = 'TOTAL_LIABILITIES_EQUITY' AND statement_type = 'BS' LIMIT 1)
      AND consolidation_scope = 'CONSOLIDATED';

  IF v_assets IS NOT NULL AND v_liab_equity IS NOT NULL THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_assets);
    IF ABS(v_assets - v_liab_equity) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: balance check failed for version=% entity=% period=% basis=%: assets=% liab+equity=% diff=% tolerance=%',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, NEW.accumulation_basis, v_assets, v_liab_equity, ABS(v_assets - v_liab_equity), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_check_balance ON finance_stmt_lines;
CREATE CONSTRAINT TRIGGER trg_finance_stmt_check_balance
  AFTER INSERT OR UPDATE ON finance_stmt_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_check_balance();

-- 8.2 Taxonomy extension — RETAINED_EARNINGS and DIVIDENDS_DECLARED do not exist yet in the
-- canonical financial_statement_lines taxonomy (confirmed absent: only TOTAL_ASSETS, CASH,
-- TOTAL_LIABILITIES, EQUITY, TOTAL_LIABILITIES_EQUITY, NET_CHANGE_CASH, CFO/CFI/CFF exist as of
-- 567_financial_statements_ratios.sql / 20260317_finance_v1_canonical_layer.sql). Additive INSERT
-- into the already-live, AUTO_MIGRATE-classified table — not a new taxonomy table.
INSERT INTO financial_statement_lines (id, statement_type, line_code, line_name, line_name_pl, sort_order, is_system)
VALUES
  ('fsl-bs-retained-earnings', 'BS', 'RETAINED_EARNINGS', 'Retained Earnings', 'Zyski zatrzymane', 85, TRUE),
  ('fsl-bs-dividends-declared', 'BS', 'DIVIDENDS_DECLARED', 'Dividends Declared', 'Zadeklarowane dywidendy', 86, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 8.3 Cash roll-forward: opening BS CASH (previous_period_id) + CF NET_CHANGE_CASH (current
-- period) = closing BS CASH (current period). This single equation covers BOTH master-plan
-- bullets "CF closing cash = BS cash" and "opening + movements = closing" for cash, because for
-- cash they are the same equation. Same deferred-constraint-trigger pattern as section 8.1.
CREATE OR REPLACE FUNCTION finance_stmt_check_cash_rollforward() RETURNS TRIGGER AS $$
DECLARE
  v_prev_period TEXT;
  v_opening_cash NUMERIC;
  v_net_change NUMERIC;
  v_closing_cash NUMERIC;
  v_unit TEXT;
  v_tolerance NUMERIC;
  v_cash_line TEXT;
  v_net_change_line TEXT;
BEGIN
  IF NEW.statement_type NOT IN ('BS', 'CF') THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_cash_line FROM financial_statement_lines WHERE line_code = 'CASH' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_net_change_line FROM financial_statement_lines WHERE line_code = 'NET_CHANGE_CASH' AND statement_type = 'CF' LIMIT 1;

  SELECT previous_period_id INTO v_prev_period FROM finance_stmt_periods WHERE period_id = NEW.period_id;
  IF v_prev_period IS NULL THEN
    RETURN NULL; -- first period on record (e.g. opening balance sheet) -- nothing to roll forward from, not an error
  END IF;

  SELECT value_decimal INTO v_opening_cash FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = v_prev_period
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_cash_line;
  SELECT value_decimal, unit INTO v_net_change, v_unit FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_net_change_line;
  SELECT value_decimal INTO v_closing_cash FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_cash_line;

  IF v_opening_cash IS NOT NULL AND v_net_change IS NOT NULL AND v_closing_cash IS NOT NULL THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_closing_cash);
    IF ABS((v_opening_cash + v_net_change) - v_closing_cash) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: cash roll-forward failed for version=% entity=% period=%: opening=% + net_change=% != closing=% (diff=%, tolerance=%)',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, v_opening_cash, v_net_change, v_closing_cash,
        ABS((v_opening_cash + v_net_change) - v_closing_cash), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_check_cash_rollforward ON finance_stmt_lines;
CREATE CONSTRAINT TRIGGER trg_finance_stmt_check_cash_rollforward
  AFTER INSERT OR UPDATE ON finance_stmt_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_check_cash_rollforward();

-- 8.4 Retained earnings roll-forward: opening BS RETAINED_EARNINGS + P&L NET_INCOME -
-- DIVIDENDS_DECLARED = closing BS RETAINED_EARNINGS. DIVIDENDS_DECLARED contributes 0 only when
-- its value_status is explicitly NA (analyst confirmed no dividends this period) or
-- PRESENT_ZERO -- never when MISSING (silent-zero is exactly the Gate A bug this schema exists
-- to close), in which case the roll-forward check is skipped (cannot verify, not "passes").
CREATE OR REPLACE FUNCTION finance_stmt_check_retained_earnings_rollforward() RETURNS TRIGGER AS $$
DECLARE
  v_prev_period TEXT;
  v_opening_re NUMERIC;
  v_net_income NUMERIC;
  v_dividends NUMERIC;
  v_dividends_status finance_value_status;
  v_closing_re NUMERIC;
  v_unit TEXT;
  v_tolerance NUMERIC;
  v_re_line TEXT;
  v_ni_line TEXT;
  v_div_line TEXT;
BEGIN
  IF NEW.statement_type NOT IN ('BS', 'P&L') THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_re_line FROM financial_statement_lines WHERE line_code = 'RETAINED_EARNINGS' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_ni_line FROM financial_statement_lines WHERE line_code = 'NET_INCOME' AND statement_type = 'P&L' LIMIT 1;
  SELECT id INTO v_div_line FROM financial_statement_lines WHERE line_code = 'DIVIDENDS_DECLARED' AND statement_type = 'BS' LIMIT 1;

  SELECT previous_period_id INTO v_prev_period FROM finance_stmt_periods WHERE period_id = NEW.period_id;
  IF v_prev_period IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT value_decimal INTO v_opening_re FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = v_prev_period
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_re_line;
  SELECT value_decimal, unit INTO v_net_income, v_unit FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_ni_line;
  SELECT value_decimal, value_status INTO v_dividends, v_dividends_status FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_div_line;
  SELECT value_decimal INTO v_closing_re FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_re_line;

  IF v_opening_re IS NOT NULL AND v_net_income IS NOT NULL AND v_closing_re IS NOT NULL
     AND v_dividends_status IN ('NA', 'PRESENT_ZERO', 'PRESENT_NONZERO') THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_closing_re);
    IF ABS((v_opening_re + v_net_income - COALESCE(v_dividends, 0)) - v_closing_re) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: retained earnings roll-forward failed for version=% entity=% period=%: opening=% + NI=% - dividends=% != closing=% (diff=%, tolerance=%)',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, v_opening_re, v_net_income, COALESCE(v_dividends, 0), v_closing_re,
        ABS((v_opening_re + v_net_income - COALESCE(v_dividends, 0)) - v_closing_re), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_check_re_rollforward ON finance_stmt_lines;
CREATE CONSTRAINT TRIGGER trg_finance_stmt_check_re_rollforward
  AFTER INSERT OR UPDATE ON finance_stmt_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_check_retained_earnings_rollforward();

-- 8.5 Elimination debits = credits: consolidation_scope='ELIMINATION' rows for the same
-- canonical_line_id/period/basis must net to (approximately) zero once sign_convention is
-- applied -- a non-zero net means an intercompany elimination was posted one-sided.
CREATE OR REPLACE FUNCTION finance_stmt_check_elimination_balance() RETURNS TRIGGER AS $$
DECLARE
  v_net NUMERIC;
  v_unit TEXT;
  v_tolerance NUMERIC;
BEGIN
  IF NEW.consolidation_scope != 'ELIMINATION' THEN
    RETURN NULL;
  END IF;

  SELECT
    SUM(CASE WHEN sign_convention = 'CONTRA' THEN -value_decimal ELSE value_decimal END),
    MIN(unit)
    INTO v_net, v_unit
  FROM finance_stmt_lines
  WHERE business_version_id = NEW.business_version_id AND canonical_line_id = NEW.canonical_line_id
    AND period_id = NEW.period_id AND accumulation_basis = NEW.accumulation_basis
    AND consolidation_scope = 'ELIMINATION' AND value_decimal IS NOT NULL;

  IF v_net IS NOT NULL THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_net);
    IF ABS(v_net) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: elimination debits != credits for version=% canonical_line=% period=% basis=%: net=% (tolerance=%)',
        NEW.business_version_id, NEW.canonical_line_id, NEW.period_id, NEW.accumulation_basis, v_net, v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_check_elimination_balance ON finance_stmt_lines;
CREATE CONSTRAINT TRIGGER trg_finance_stmt_check_elimination_balance
  AFTER INSERT OR UPDATE ON finance_stmt_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_check_elimination_balance();

COMMIT;
```

```sql
-- WP-D01 readiness gate — Statement Pack DRAFT -> READY_FOR_REVIEW.

CREATE OR REPLACE FUNCTION finance_stmt_readiness_check(p_business_version_id TEXT)
RETURNS TABLE(check_name TEXT, passed BOOLEAN, detail TEXT) AS $$
DECLARE
  v_org TEXT;
  v_missing_count INTEGER;
  v_unmapped_count INTEGER;
  v_null_unit_count INTEGER;
  v_null_currency_count INTEGER;
  v_recon_residual_status TEXT;
  v_period_gap_count INTEGER;
  v_entity_count INTEGER;
BEGIN
  SELECT organization_id INTO v_org FROM finance_business_versions WHERE business_version_id = p_business_version_id;
  IF v_org IS NULL THEN
    RETURN QUERY SELECT 'VERSION_EXISTS'::TEXT, false, 'no such business_version_id'::TEXT;
    RETURN;
  END IF;

  -- 1. Mapping complete: no MISSING-status cells (NA/NOT_APPLICABLE are fine, they are explicit
  --    analyst/taxonomy decisions, not gaps).
  SELECT count(*) INTO v_missing_count
    FROM finance_stmt_lines
    WHERE business_version_id = p_business_version_id AND value_status = 'MISSING';
  RETURN QUERY SELECT 'MAPPING_COMPLETE_NO_MISSING'::TEXT, v_missing_count = 0,
    format('%s cell(s) with value_status=MISSING', v_missing_count);

  -- 2. No unresolved UNMAPPED/DUPLICATE reconciliation rows.
  SELECT count(*) INTO v_unmapped_count
    FROM finance_stmt_reconciliation
    WHERE business_version_id = p_business_version_id AND bucket IN ('UNMAPPED', 'DUPLICATE');
  RETURN QUERY SELECT 'RECONCILIATION_NO_OPEN_UNMAPPED_DUPLICATE'::TEXT, v_unmapped_count = 0,
    format('%s row(s) still UNMAPPED/DUPLICATE', v_unmapped_count);

  -- 3. Unit normalized: no NULL unit/currency on any stored cell (Gate A's structural gap).
  SELECT count(*) INTO v_null_unit_count FROM finance_stmt_lines
    WHERE business_version_id = p_business_version_id AND (unit IS NULL);
  SELECT count(*) INTO v_null_currency_count FROM finance_stmt_lines
    WHERE business_version_id = p_business_version_id AND (native_currency IS NULL OR presentation_currency IS NULL);
  RETURN QUERY SELECT 'UNIT_CURRENCY_NORMALIZED'::TEXT, (v_null_unit_count = 0 AND v_null_currency_count = 0),
    format('%s null-unit cell(s), %s null-currency cell(s)', v_null_unit_count, v_null_currency_count);

  -- 4. Period lineage complete: every period referenced by a stored line has a real
  --    finance_stmt_periods row.
  SELECT count(*) INTO v_period_gap_count
    FROM finance_stmt_lines l
    WHERE l.business_version_id = p_business_version_id
      AND NOT EXISTS (SELECT 1 FROM finance_stmt_periods p WHERE p.period_id = l.period_id);
  RETURN QUERY SELECT 'PERIOD_LINEAGE_COMPLETE'::TEXT, v_period_gap_count = 0,
    format('%s line(s) reference a non-existent period_id', v_period_gap_count);

  -- 5. Entity/perimeter declared: at least one entity row for this version.
  SELECT count(*) INTO v_entity_count FROM finance_stmt_entities WHERE business_version_id = p_business_version_id;
  RETURN QUERY SELECT 'PERIMETER_DECLARED'::TEXT, v_entity_count > 0,
    format('%s entity/perimeter row(s)', v_entity_count);

  -- 6. Reconciliation residual within tolerance for the latest run.
  SELECT status INTO v_recon_residual_status
    FROM finance_reconciliation_runs
    WHERE business_version_id = p_business_version_id
    ORDER BY created_at DESC LIMIT 1;
  -- COALESCE(..., false): a bare `IN (...)` against a NULL status (no reconciliation run at
  -- all yet) evaluates to SQL NULL, not false -- and bool_and() below silently *ignores* NULL
  -- rows instead of treating them as failed, which would let a Statement Pack that was never
  -- reconciled read as "ready" by omission. Caught by live testing (ADR section 7); the explicit
  -- COALESCE closes it.
  RETURN QUERY SELECT 'RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE'::TEXT,
    COALESCE(v_recon_residual_status IN ('CLEAN', 'WITHIN_TOLERANCE'), false),
    format('latest finance_reconciliation_runs.status = %s', COALESCE(v_recon_residual_status, 'NO_RUN_YET'));

  -- 7. No blocking (SECURITY / UNDEFINED_MATH) open exceptions.
  RETURN QUERY SELECT 'NO_BLOCKING_EXCEPTIONS'::TEXT,
    NOT EXISTS (
      SELECT 1 FROM finance_exceptions_current
      WHERE business_version_id = p_business_version_id AND severity = 'SECURITY' AND state = 'OPEN'
    ),
    'no OPEN severity=SECURITY exception'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Aggregate boolean the T2 submit_for_review transition calls.
CREATE OR REPLACE FUNCTION finance_stmt_is_ready_for_review(p_business_version_id TEXT) RETURNS BOOLEAN AS $$
  SELECT bool_and(passed) FROM finance_stmt_readiness_check(p_business_version_id);
$$ LANGUAGE sql;
```

---

## Załącznik B — mapowanie legacy → canoniczny (kolumna do kolumny)

| Legacy kolumna | Canoniczna kolumna | Transformacja |
|---|---|---|
| `financial_statement_packs.id` | `finance_artifacts.artifact_id` | 1:1, nowy `artifact_type='STATEMENT_PACK'` |
| `financial_statement_packs.organization_id` | `finance_artifacts.organization_id` | 1:1 |
| `financial_statement_packs.currency` (nullable) | rozproszone na `finance_stmt_lines.presentation_currency` (`NOT NULL`) per wartość | Backfill musi wypełnić z fallbackiem `'PLN'` (dzisiejszy `DEFAULT`) **oznaczonym** jako `MIGRATE_WITH_WARNING`, nie cichym `NOT NULL` bez dowodu |
| `financial_statements.entity_name` (płaski TEXT) | `finance_stmt_entities.legal_name` + nowy `entity_code`/`role='GROUP_PARENT'` | Backfill generuje `entity_code` deterministycznie (np. slug z `entity_name`), pojedyncza encja per pack (brak dziś konsolidacji do zmapowania) |
| `financial_statements.period_start`/`.period_end` | `finance_stmt_periods.period_start`/`.period_end` | 1:1; `fiscal_calendar_id` przypisany do domyślnego `STANDARD`/grudniowego kalendarza organizacji (backfill tworzy jeden domyślny `finance_stmt_calendars` wiersz per organizacja, jeśli brak) |
| `financial_statement_values.value` (REAL, nullable) | `finance_stmt_lines.value_decimal` + `value_status` | `NULL` → `value_status='MISSING'` (nigdy domyślne 0!); `0` → `value_status='PRESENT_ZERO'`; inne → `PRESENT_NONZERO` |
| `financial_statement_values.canonical_line_id` | `finance_stmt_lines.canonical_line_id` | 1:1 (ta sama tabela `financial_statement_lines`, reużyta) |
| `financial_statement_values.source_page`/`source_row` | `finance_stmt_source_evidence.source_page`/`.source_row` | 1:1, plus nowy `bbox=NULL` (ekstraktor dziś tego nie dostarcza — nie wymyślamy wartości) |
| `financial_statement_versions.version_no` | `finance_business_versions.version_no` | 1:1 |
| `financial_statement_versions.version_kind` (`mapped`/`validated`/`confirmed`/`repair`) | `finance_business_versions.status` (`DRAFT`/`READY_FOR_REVIEW`/`IN_REVIEW`/`APPROVED`) | Mapowanie N:1 przybliżone, wymaga jawnej tabeli decyzyjnej w wykonawczym Gate D (nie jest to bijekcja) |
| `financial_statement_validations` (pass/warn/fail) | `finance_reconciliation_runs.status` (`CLEAN`/`WITHIN_TOLERANCE`/`EXCEEDS_MATERIALITY`) | Przybliżone; realny `residual`/`materiality_threshold_applied` nie istnieje w legacy, musi być przeliczony post-hoc z backfillowanych `finance_stmt_lines`, nie skopiowany |

Ta tabela jest **punktem startowym** dla wykonawczego backfillu (WP analogiczny do WP-C03), nie kompletną specyfikacją — patrz eskalacja §11 pkt 3.
