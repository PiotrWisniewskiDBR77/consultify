# ADR WP-D07 — Prediction / Scenario Engine: domenowy schemat (Gate D / Fala 6)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, sekcja 8 (Prediction — pełna przebudowa), EPIC-06.
**Work package:** WP-D07 — pierwszy pakiet Fali 6 (Prediction/Scenario Engine), po zamrożonym Gate B (7 ADR-ów + AP-00), zaimplementowanym Gate C, i po Fali 3 (Statements, WP-D01/D01b/D02), Fali 4 (Analysis, WP-D03/D03b/D04) i Fali 5 (Baseline Models, WP-D05/D05b/D06 — schema, migracje, żywy compute engine).
**Data:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `ADR — DDL sketch, syntactically validated AND behaviorally exercised on an ephemeral Postgres, NOT executed as a real migration`

To jest ADR (decyzja + kontrakt), wzorem WP-B01…WP-B07, WP-D01, WP-D03, WP-D05. **Nie jest** to migracja Gate D wykonawcza ani produkcyjny kod, i **nie jest** to compute engine (WP-D06 był compute engine dla Baseline — analogiczny pakiet dla Prediction, reużywający `baselineScheduleEngine.ts`/`baselineCircularitySolver.ts` per wskazówka #6 briefu, jest kolejnym, osobnym WP). Zakres tego ADR-u to WYŁĄCZNIE schemat: tabele domenowe z prefiksem `finance_prediction_`, dwuetapowy Compute jako kontrakt bramkujący, konkretny algorytm double-counting, i fizyczny mechanizm gwarantujący Base=Baseline. `OWN-FIN-019` (dosłowna specyfikacja właścicielska) i `DEC-FIN-004` (dwuetapowy compute, zdecydowane) są tu wykonywane, nie renegocjowane.

---

## 1. Wejścia przeczytane w całości, w tej kolejności

1. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §8 (Prediction — definicja, impact chain, dwuetapowy Compute, funkcjonalność ekspercka, dwa widoki) — wymagania funkcjonalne. Także §2 pkt 3/5 (nieprzekraczalne decyzje: Baseline bez plug/finansowania, Prediction Compute dwuetapowe), §4 (wspólny kontrakt danych), §7 (Baseline — co dokładnie Prediction dziedziczy jako źródło), §12 (canonical store), §14A DoD.
2. `docs/validation/finance-v3/OWNER_REVIEW_REGISTER_2026-08-09.md` OWN-FIN-019 — **dosłowna specyfikacja właściciela**: trzy tryby A (standard Base/Upside/Downside) / B (wskaźnikowy — zmiana KPI/driverów) / C (fundamentalny — inicjatywy/decyzje mapowane na drivery), pełny łańcuch `initiative → assumption → driver/KPI → statement line → forecast`, jednostka/znak/okres/confidence/właściciel/źródło na każdym impakcie, wykrywanie nakładania/double counting, **UI ma dwa widoki — `Budowa założeń` opisana wprost jako "pełna karta/scenario builder obejmująca A/B/C"** (jeden, wspólny builder, nie trzy rozłączne kreatory) i `Modele/Wyniki`. Sekcja 5 tego ADR-u rozstrzyga literalnie na tej podstawie, czy tryby są rozłączne.
3. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` DEC-FIN-004 (sekcja "Decyzje właścicielskie", **DECIDED**): dwuetapowy Compute — Etap 1 (preflight całego assumption set, wykrycie overlap/double counting/konflikt/braki, lista rozstrzygnięć z numerycznym podglądem) → Etap 2 (właściwy compute, startuje dopiero po domknięciu wymaganych rozstrzygnięć); "System nie blokuje budowania założeń i nie sumuje konfliktów po cichu". Także sekcja 2 pkt 14 (scenariusze: reverse stress/break-even, liquidity/covenant headroom, realized-benefit feedback) i sekcja 8 pkt 3 ("Double-counting taxonomy i kto może rozstrzygać konflikt" — jedna z dziesięciu decyzji wymaganych przed kodowaniem, rozstrzygnięta przez DEC-FIN-004 co do MECHANIZMU; KTO rozstrzyga jest tu wykonane przez reużycie `finance_business_versions.risk_tier`/maker-checker z DEC-FIN-001, nie nowy mechanizm).
4. `docs/validation/finance-v3/generated/gate-d/WP-D05_baseline_models_schema_ADR.md` (całość) — Prediction bierze **exact Approved Baseline Model Version** przez `finance_lineage_edges` (`MODEL_TO_SCENARIO`, już zarezerwowany typ krawędzi, WP-B03 §2.1, wymaga `assumption_snapshot_hash NOT NULL`). Finansowanie/spłata/dywidendy/alokacja nadwyżek, które Baseline **fizycznie wyklucza** (D05 §5, cztery warstwy: zamknięty `schedule_type` enum, forbidden-key trigger na `payload`, taksonomia-driven denylist na outputs, cash-rollforward bez plug) — sekcja 9 tego ADR-u pokazuje, że to jest dokładnie miejsce, gdzie te decyzje TERAZ żyją, z tym samym rygorem fizycznej gwarancji, nie tylko konwencji. `finance_baseline_schedules.schedule_type` (9 wartości) i katalog `driver_code` (D05 Załącznik B) są reużyte dosłownie na `finance_prediction_driver_overrides`/`finance_prediction_impact_chain`, nie zduplikowane.
5. `docs/validation/finance-v3/generated/gate-b/ORCHESTRATOR_DECISIONS_LOG.md` ORCH-DEC-001 — trzy jawnie decyzyjne typy `financial_model_events` (`debt_drawdown`/`equity_injection`/`dividend`) migrują do nowo utworzonej Prediction Scenario Version, `source=migrated_legacy_event`, per organizacja/model; niejednoznaczne (`debt_repayment`/`wc_change`) zostają w `QUARANTINE`. Sekcja 11 tego ADR-u pokazuje dokładne miejsce lądowania (`finance_prediction_financing`) i klasyfikację `scenario_mode` dla takiego migrowanego scenariusza.
6. `docs/validation/finance-v3/generated/gate-d/WP-D06_baseline_compute_engine_report.md` (całość) — `baselineScheduleEngine.ts` (9 czystych funkcji per `schedule_type`) i `baselineCircularitySolver.ts` (`solvePeriod()`, deterministyczny fixed-point) są **gotowym, przetestowanym silnikiem**, który przyszły Prediction Compute (osobny WP, poza zakresem tego ADR-u) będzie reużywał — sekcja 8 tego ADR-u dokumentuje DOKŁADNIE które funkcje i jak, żeby ten przyszły WP nie musiał tego sam ustalać. Także §5 pkt 8: WP-D06 **udokumentowaną rozbieżnością** użyło `job_type='BASELINE_COMPUTE'` zamiast zarezerwowanego `model_compute` (WP-B04 §12 pkt 3) — ten ADR podąża tym samym, jawnie nazwanym precedensem dla `job_type='PREDICTION_COMPUTE'` (sekcja 6.3).
7. Dodatkowo (niewymienione w briefie, konieczne do niespójności/spójności): `docs/validation/finance-v3/generated/gate-b/WP-B03_lineage_staleness_ADR.md` §2.1/§3.3 (enum `edge_type`, `MODEL_TO_SCENARIO` wymaga `assumption_snapshot_hash`), `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md` §3 (kształt `compute_jobs`/`compute_job_outputs`, `job_type` jako zwykły `TEXT` bez CHECK enum — potwierdza, że `PREDICTION_COMPUTE` jest strukturalnie dozwolone), `docs/validation/finance-v3/generated/gate-b/WP-B05_exception_ledger_ADR.md` (kształt `finance_exceptions`/`finance_exceptions_current`, reużyty dosłownie do `NO_OPEN_UNDEFINED_MATH` w readiness gate, sekcja 6.2), `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` (`finance_business_versions.risk_tier` — już istniejąca kolumna, reużyta do maker-checker rozstrzygnięć materialnych, sekcja 7), `docs/validation/finance-v3/generated/gate-d/WP-D03_analysis_schema_ADR.md` §6.3 ("Warstwa 2 unit-checking — kontrakt preflight, nie zaimplementowana w tym ADR-ie" — dokładnie ten sam wzorzec dwuwarstwowej granicy DB-cheap-detekcja / service-numeryczna-symulacja, zastosowany tu do double counting, sekcja 7), oraz bezpośredni odczyt żywego schematu (`\d`) na świeżo zmigrowanej efemerycznej bazie (sekcja 14) — potwierdzenie dokładnych nazw kolumn (`finance_business_versions.uq_finance_bv_id_org`, `finance_artifacts.artifact_type` CHECK zawiera już `PREDICTION_SCENARIO`, `finance_lineage_edges.edge_type` CHECK zawiera już `MODEL_TO_SCENARIO`) zamiast poleganie na cytatach z wcześniejszych ADR-ów, które w praktyce (WP-D05 Gate B Integration Reconciliation) bywały korygowane po fakcie.

---

## 2. Kontekst — co Gate B/C/D01/D03/D05/D06 już daje, NIE duplikujemy

- `finance_artifacts.artifact_type` CHECK enum **już zawiera** `'PREDICTION_SCENARIO'` (potwierdzone żywo, `\d finance_artifacts`, sekcja 14) — Prediction Scenario Version to jeden `finance_business_versions` wiersz z `finance_artifacts.artifact_type='PREDICTION_SCENARIO'`. Ten ADR nie tworzy nowej tabeli wersji/lifecycle. `DRAFT→READY_FOR_REVIEW→IN_REVIEW→APPROVED→SUPERSEDED/ARCHIVED/INVALIDATED`, maker-checker, immutable-Approved trigger, `risk_tier`, reopen/`vN+1` — wszystko odziedziczone, bez zmian.
- `finance_lineage_edges.edge_type` CHECK enum **już zawiera** `'MODEL_TO_SCENARIO'` z wymaganym (`NOT NULL`) `assumption_snapshot_hash` (WP-B03 §3.3 — target faktycznie *oblicza* coś z założeń source'a). Prediction wskazuje **exact Approved Baseline Model Version** wyłącznie przez tę krawędź — `finance_prediction_scenarios` **świadomie nie ma** kolumny `source_baseline_business_version_id` (ta sama decyzja i uzasadnienie co WP-D05 §2.3 dla `finance_baseline_models`/source Statement+Analysis: dwie kolumny denormalizowane obok istniejącej krawędzi dałyby dwa niezsynchronizowane źródła prawdy). `assumption_snapshot_hash` na tej krawędzi = `finance_business_versions.content_semantic_hash` zamrożony Baseline'a w momencie utworzenia krawędzi — reużyty wprost, nie liczony od nowa.
- `finance_baseline_schedules.schedule_type` (9 wartości: `revenue_pvm`/`headcount`/`cogs_opex`/`wc_dso_dio_dpo`/`capex_depreciation`/`leases`/`debt_maturity`/`tax_nol`/`equity_re`) i `driver_code` katalog (D05 Załącznik B, dokumentacja aplikacyjna, nie DB enum) — reużyte dosłownie na `finance_prediction_driver_overrides.schedule_type`/`driver_code` i `finance_prediction_impact_chain.driver_schedule_type`/`driver_code`. Zero nowego katalogu do wymyślenia.
- `finance_value_status` ENUM i obowiązkowy bundle WP-B01 §2.7 — `finance_prediction_driver_overrides` i `finance_prediction_outputs` przyjmują ten bundle dosłownie, jak `finance_baseline_outputs`/`finance_analysis_kpi_values`.
- `financial_statement_lines` (Gate A legacy taxonomy) — reużyta bez zmian jako `canonical_line_id`/`statement_line_id` FK na `finance_prediction_impact_chain`/`finance_prediction_outputs`/`finance_prediction_driver_line_map`, dokładnie jak WP-D01/D05.
- `compute_jobs`/`compute_job_runs`/`compute_job_outputs` (WP-B04) — Compute Run dla Prediction to `job_type='PREDICTION_COMPUTE'` (sekcja 6.3 — dokumentowana rozbieżność od zarezerwowanego `prediction_compute`, ten sam precedens co WP-D06 ustanowił dla `BASELINE_COMPUTE`/`model_compute`). Nie tworzę nowej kolejki.
- `finance_exceptions`/`finance_exceptions_current` (WP-B05) — reużyte wprost do `NO_OPEN_UNDEFINED_MATH` w readiness gate (sekcja 6.2); żaden nowy blocking-mechanizm nie jest tu wymyślany.
- `finance_business_versions.risk_tier` (Gate B Integration Reconciliation §2) — reużyty do "kto może rozstrzygać konflikt" (addendum §8 pkt 3): materialne rozstrzygnięcia (`finance_prediction_conflict_resolutions.requires_review=true`) idą przez tę samą maker-checker infrastrukturę co reszta programu (DEC-FIN-001), nie nowy mechanizm SoD.
- `baselineScheduleEngine.ts`/`baselineCircularitySolver.ts` (WP-D06) — **nie duplikowane**. Sekcja 8 dokumentuje dokładny plan reużycia dla przyszłego Prediction Compute WP.

---

## 3. Decyzja — skrót

Dziesięć nowych tabel z prefiksem `finance_prediction_` — siedem dosłownie z zadania, trzy dodatkowe uzasadnione poniżej:

1. `finance_prediction_scenarios` — jeden wiersz per `business_version_id` artefaktu `PREDICTION_SCENARIO`. `scenario_mode` (5 wartości) jest **hierarchiczny, nie w pełni rozłączny** — sekcja 5 rozstrzyga to literalnie na podstawie OWN-FIN-019.
2. `finance_prediction_driver_overrides` (tryb B) — driver grid override: `schedule_type`+`driver_code`+`entity`+`period`+nowa wartość, bundle WP-B01 §2.7.
3. `finance_prediction_initiatives` (tryb C) — karta inicjatywy: nazwa/opis/source/owner/confidence, domyślny start/ramp/duration/koszt wdrożenia.
4. `finance_prediction_impact_chain` — rdzeń łańcucha `initiative → assumption → driver/KPI → statement_line → forecast`, z amount/%/unit/sign, per-impact override start/ramp/duration/decay, capacity/cannibalization.
5. `finance_prediction_financing` — facility/rate/tenor/covenant/min-cash/dividend/buyback/equity — TU żyje to, co Baseline fizycznie wyklucza (D05 §5), jako jedna discriminated tabela (ten sam wzorzec i to samo uzasadnienie co `finance_baseline_schedules`, D05 §10.1).
6. `finance_prediction_preflight_runs` — Etap 1 kontraktu: snapshot hash analizowanego assumption setu, licznik findings/wymaganych rozstrzygnięć, `superseded_by` łańcuch.
7. `finance_prediction_conflict_resolutions` — decyzja użytkownika per konflikt: `ACCEPTED_PROPOSED`/`CUSTOM`, obowiązkowe `rationale`, materialne → review.

Plus trzy tabele **poza dosłowną listą z zadania**, uzasadnione w sekcji 4:

8. `finance_prediction_preflight_findings` — normalizowany child `preflight_runs`; bez niego `conflict_resolutions` nie ma stabilnego FK "per konflikt" (zadanie mówi "user decision per konflikt" — konflikt musi być adresowalnym wierszem, nie elementem JSON-owej tablicy).
9. `finance_prediction_outputs` — przechowanie wyliczonego scenariuszowego P&L/BS/CF (widok `Modele/Wyniki` z briefu §8 wymaga jakiegoś fizycznego miejsca na wynik; bez tej tabeli "Base = Baseline" (zadanie pkt 3) nie miałoby czego fizycznie NIE mieć — sekcja 8).
10. `finance_prediction_driver_line_map` — udokumentowane, małe (9×N wierszy) zwierciadło tego, które `canonical_line_id` produkuje który `schedule_type` w `baselineScheduleEngine.ts` (WP-D06 §1.2) — bez tej tabeli double-counting detekcja (zadanie pkt 4) nie może być wyrażona jako zapytanie SQL, tylko jako proza (sekcja 7 wyjaśnia dokładnie, dlaczego i jaka jest uczciwa granica tej tabeli).

**`scenario_mode` — hierarchiczny, nie w pełni rozłączny** (sekcja 5): `STANDARD_BASE` jest fizycznie czystym, pustym stanem (zero wierszy w trzech tabelach dzieci — to jest twarda gwarancja Base=Baseline, sekcja 8). `STANDARD_UPSIDE`/`STANDARD_DOWNSIDE` to czyste, oznaczone presetem driver override'y, bez inicjatyw/finansowania. `DRIVER_OVERRIDE` i `FUNDAMENTAL_INITIATIVE` **mogą się łączyć** — `FUNDAMENTAL_INITIATIVE` jest nadzbiorem, dokładnie zgodnym z dosłownym sformułowaniem OWN-FIN-019 "pełna karta... obejmująca A/B/C". Jedno dozwolone, jednokierunkowe przejście `DRIVER_OVERRIDE → FUNDAMENTAL_INITIATIVE` (promocja, nigdy degradacja, nigdy dotykające `STANDARD_*`) — przetestowane żywo (TEST 6/6b, sekcja 14).

**Double counting** (sekcja 7): konkretny, dwuwarstwowy algorytm — Warstwa 1 (SQL, tania, strukturalna) grupuje wszystkie źródła impaktu (driver override'y zmapowane przez `finance_prediction_driver_line_map`, impact-chain rows wprost, financing rows przez zamkniętą mapę `financing_kind`→linie) po `(entity_id, canonical_line_id, period_id)` i flaguje `COUNT(DISTINCT source) > 1`; Warstwa 2 (service, nie w tym ADR-ie, ten sam wzorzec granicy co WP-D03 §6.3) liczy pełny numeryczny podgląd przez faktyczne dwukrotne wywołanie odpowiedniej czystej funkcji `baselineScheduleEngine.ts` (z i bez override'u/impaktu) zamiast szacowania. Przetestowane żywo (TEST 8, sekcja 14): dwie inicjatywy dotykające COGS/Jan26 → 1 wiersz overlap, `source_count=2`, `combined_impact_decimal=-8`.

**Base = Baseline — wymuszone fizycznie, nie testowane po fakcie** (sekcja 8): `finance_prediction_outputs` **fizycznie nie może** mieć wiersza dla scenariusza `scenario_mode='STANDARD_BASE'` (trigger odrzuca INSERT/UPDATE) — Models/Results dla takiego scenariusza czyta `finance_baseline_outputs` **bezpośrednio**, przez `finance_prediction_outputs_effective` VIEW podążający krawędzią `MODEL_TO_SCENARIO`. Nie ma osobnego wiersza, który mógłby się rozjechać — identyczność jest strukturalna, nie wynikiem niezależnego przeliczenia dającego przypadkiem tę samą liczbę. Przetestowane żywo (TEST 1-3, sekcja 14).

**Dwuetapowy Compute jako bramka** (sekcja 6): `finance_prediction_readiness_check()` (trzy nazwane checki: `HAS_CURRENT_PREFLIGHT`, `NO_OPEN_REQUIRED_RESOLUTIONS`, `NO_OPEN_UNDEFINED_MATH`) — `computeJobService` dla `job_type='PREDICTION_COMPUTE'` musi wywołać `finance_prediction_can_start_compute()` przed `enqueue`. Budowanie założeń (INSERT do `driver_overrides`/`initiatives`/`impact_chain`/`financing`) nigdy nie jest blokowane tym mechanizmem — tylko compute. Przetestowane żywo (TEST 9-11, sekcja 14): guard `false` przed preflight, `false` z otwartym wymaganym rozstrzygnięciem, `true` po rozwiązaniu.

**Dowód testowy**: DDL uruchomiony na jednorazowym efemerycznym Postgresie (port 57511, `initdb --locale=C`, `/private/tmp/`, `pg_ctl stop`+`rm -rf` na koniec, PID 911 nietknięty), 13 scenariuszy przechodzących żywo (sekcja 14) — żadna baza produkcyjna/demo/dev nie była dotknięta, zgodnie z twardym zakazem tego zadania.

---

## 4. Nowe tabele domenowe

### 4.1 `finance_prediction_scenarios`

`UNIQUE(business_version_id)`. Kolumny: `name`, `description`, `scenario_mode` (CHECK enum, 5 wartości), `scenario_mode_promoted_at`/`scenario_mode_promoted_by` (obsadzone wyłącznie przy jedynym dozwolonym przejściu, sekcja 5.4). **Świadomie brak kolumny źródła** (`source_baseline_business_version_id`) — sekcja 2. `name`/`description` są tu domenowe (nie na `finance_artifacts`, który nie ma pola nazwy — potwierdzone żywo, `\d finance_artifacts` nie ma `name`/`natural_key` używanego jako display name) — Compare 2-4 scenariuszy (brief §8 "Dwa widoki") wymaga ludzko czytelnej etykiety per wersja, ta sama potrzeba co DEC-FIN-006 nazwała dla wariantów Valuation.

### 4.2 `finance_prediction_driver_overrides` (tryb B)

Driver grid override: `schedule_type` (9 wartości, reużyty enum z D05), `driver_code` (reużyty katalog D05 Załącznik B), `entity_id`, `period_id`, `override_source` (`MANUAL`/`STANDARD_PRESET_UPSIDE`/`STANDARD_PRESET_DOWNSIDE` — sekcja 5.3), bundle WP-B01 §2.7 (`value_status`/`value_decimal`/`unit`), `baseline_value_decimal` (**informacyjny snapshot**, przechwycony w momencie utworzenia, NIE autorytatywny — autorytatywna wartość Baseline jest zawsze odczytywalna przez `finance_baseline_assumptions`/`finance_baseline_outputs` po `MODEL_TO_SCENARIO`; ten snapshot istnieje wyłącznie dla szybkiego podglądu delty bez JOIN-a i jako trwały ślad audytowy "co user widział w momencie decyzji" — Approved Baseline jest immutable, więc snapshot nie może "spleśnieć"), `rationale`.

`UNIQUE(business_version_id, schedule_type, driver_code, entity_id, period_id)` — jeden autorytatywny override per komórka; druga zmiana tego samego drivera to `UPDATE`, nie nowy konflikt.

### 4.3 `finance_prediction_initiatives` (tryb C)

Karta inicjatywy: `initiative_code` (stabilny naturalny klucz w obrębie scenariusza), `name`, `description`, `source` (wolny tekst — `'MANAGEMENT_PLAN'`/`'CONSULTANT_RECOMMENDATION'`/`'BOARD_DECISION'` itp., ta sama decyzja co D05 Załącznik B dla `driver_code`: pełny DB enum byłby przedwczesnym rozszerzeniem zakresu), `owner`, `confidence_pct`, **domyślny** `default_start_period_id`/`default_ramp_months`/`default_duration_months`/`implementation_cost_decimal` (envelope całej inicjatywy — przykład z OWN-FIN-019: "moment startu, ramp-up, okres działania, koszt wdrożenia"), `status` (`DRAFT`/`CONFIRMED`/`REJECTED` — inicjatywa może istnieć jako karta roboczo, zanim jakikolwiek impact chain row ją wykorzysta w compute; **nie** blokuje budowania, tylko oznacza dojrzałość).

Wartości `default_*` są **domyślne**, nie jedyne — `finance_prediction_impact_chain` (4.4) może je nadpisać per-impact (np. efekt kanibalizacji zaczyna się później niż główny efekt tej samej inicjatywy).

### 4.4 `finance_prediction_impact_chain`

Rdzeń łańcucha z OWN-FIN-019, dosłownie: `initiative_id` (FK, `NOT NULL` — ta tabela modeluje wyłącznie tryb C; tryb B działa bezpośrednio przez `driver_overrides`, bez przechodzenia przez impact chain, bo nie ma "inicjatywy" do przypięcia), `assumption_label` (wolny tekst opisujący leżące u podstaw założenie — "5% redukcji COGS z poprawy efektywności produkcji"), `driver_schedule_type`+`driver_code` **XOR** `kpi_catalog_id` (CHECK) — impakt może być wyrażony w terminach drivera Baseline (reużyty katalog D05) LUB KPI (reużyty `finance_analysis_kpi_catalog` z WP-D03, dla impaktów naturalnie opisywanych wskaźnikiem, nie surowym driverem), `statement_line_id` (docelowa linia kanoniczna — ostatnie ogniwo łańcucha), `entity_id`.

`amount_kind` (`ABSOLUTE_AMOUNT`/`PERCENT_OF_BASE`/`PERCENT_DELTA`) + `amount_decimal` + `amount_unit` + `sign` (`POSITIVE`/`NEGATIVE`, **jawny**, nie wywnioskowany z wartości — unika dwuznaczności "redukcja kosztu" jako dodatniego wpływu na wynik vs ujemnej wartości samego kosztu, ten sam problem klasy co D01's "sign convention" dla linii sprawozdań). `start_period_id`/`ramp_months`/`duration_months`/`decay_pct_per_period` — **nullable, dziedziczą z `finance_prediction_initiatives.default_*`, gdy `NULL`** (sekcja 4.3). `implementation_cost_decimal` — per-impact rozbicie kosztu wdrożenia (np. część CAPEX vs część OPEX tej samej inicjatywy), addytywne do `finance_prediction_initiatives.implementation_cost_decimal` na poziomie całej karty. `confidence_pct`/`probability_pct` — osobne pola (confidence = jak pewny jest szacunek wielkości; probability = jak prawdopodobne jest, że inicjatywa w ogóle się wydarzy — dwa różne pytania, oba z OWN-FIN-019). `capacity_constraint_ref JSONB` (np. `{max_units, unit}` — miękkie ograniczenie, niewalidowane triggerem w tym P0, udokumentowana granica sekcja 15 pkt 3). `cannibalizes_impact_id` (self-FK, nullable — jawna, nazwana zależność "ten impakt zmniejsza inny impakt", inny mechanizm niż double-counting DETEKCJA (sekcja 7) — to jest ZNANA, zadeklarowana relacja, nie WYKRYTA).

### 4.5 `finance_prediction_financing`

Jedna discriminated tabela, `financing_kind` CHECK (`FACILITY_DRAWDOWN`/`DISCRETIONARY_REPAYMENT`/`EQUITY_INJECTION`/`DIVIDEND_DECLARATION`/`SHARE_BUYBACK`/`SURPLUS_ALLOCATION_POLICY`/`COVENANT_DEFINITION`/`MIN_CASH_POLICY`) + `payload JSONB` — **dokładnie ten sam wzorzec i to samo uzasadnienie co `finance_baseline_schedules`** (D05 §10.1: jeden wspólny scaffolding zamiast ośmiokrotnego boilerplate'u; Finance Data Grid chce jednego zapytania z `WHERE financing_kind=...`, nie UNION-a ośmiu tabel). `period_id` **nullable** — obsadzony dla zdarzeń punktowych (`FACILITY_DRAWDOWN`, `DISCRETIONARY_REPAYMENT`, `DIVIDEND_DECLARATION`, `SHARE_BUYBACK`, `EQUITY_INJECTION`), `NULL` dla polityk obowiązujących na całym horyzoncie (`COVENANT_DEFINITION`, `MIN_CASH_POLICY`, `SURPLUS_ALLOCATION_POLICY`).

Dokładnie te koncepty, które D05's Warstwa 2 forbidden-key trigger **zakazuje** w `finance_baseline_schedules.payload` (`new_draw`/`debt_drawdown`/`dividend`/`equity_injection`/`share_buyback`/`surplus_allocation`/`cash_plug`) — tu są **jawnie modelowane**, nie ukryte. To jest bezpośrednia, symetryczna realizacja DEC-FIN-002's drugiego zdania: "Decyzje o finansowaniu, spłacie długu, dywidendzie lub wykorzystaniu nadwyżki należą wyłącznie do Prediction."

**Ważne — no-plug zasada NIE kończy się na granicy Baseline/Prediction** (rozwinięte w sekcji 8.3): Prediction dopuszcza DECYZJE finansowania jako WEJŚCIE (to jest cały sens tej tabeli), ale nie dopuszcza niewyjaśnionego residuum jako WYJŚCIE — `finance_prediction_outputs`' cash/balance/RE rollforward triggery (sekcja 8.3, port D05 §5.4 bez warstwy 1/2 zakazu wejścia) nadal wymagają, żeby gotówka była wynikiem policzonym, nawet gdy jednym ze składników tego wyniku jest uznaniowa decyzja.

### 4.6 `finance_prediction_outputs` (poza dosłowną listą z zadania)

Zadanie wymienia siedem tabel; żadna z nich nie jest fizycznym miejscem na wyliczone `P&L`/`BS`/`CF` scenariusza — a widok `Modele/Wyniki` (brief §8 "Dwa widoki") i wymaganie #3 zadania ("Base = semantycznie równe Baseline... zaprojektuj strukturę która to gwarantuje") nie mają sensu bez takiego miejsca. Struktura **dosłownie** ta sama co `finance_baseline_outputs` (D05 §4.4) — ten sam bundle WP-B01 §2.7, ten sam `UNIQUE(business_version_id, entity_id, canonical_line_id, period_id, consolidation_scope)` "jedna autorytatywna komórka" wzorzec. Plus `variance_vs_baseline_decimal` (denormalizowana wygoda dla Compare — brief §8 "Modele/Wyniki: variance vs baseline"; **NIE** jest to drugie źródło prawdy, bo jest to prosta funkcja dwóch już-przechowanych liczb, przeliczana przy każdym compute, nie edytowalna niezależnie — ten sam status co `nci_pct` na `finance_stmt_entities`, generated-in-spirit choć nie literalnie `GENERATED ALWAYS` z powodu MIĘDZYTABELOWEGO odniesienia, którego Postgres nie pozwala w generated column).

**Fizycznie zabronione dla `scenario_mode='STANDARD_BASE'`** (trigger, sekcja 8.2) — to jest DECYZJA #9 zadania rozwinięta w pełni w sekcji 8.

### 4.7 `finance_prediction_driver_line_map` (poza dosłowną listą z zadania)

`(schedule_type, canonical_line_id)` — mały, ręcznie utrzymywany katalog: który `schedule_type` (9 wartości) produkuje który `canonical_line_id`, **udokumentowane zwierciadło** hardkodowanego assembly w `baselineScheduleEngine.ts`/`baselineComputeService.ts` (WP-D06 §1.2 — np. `revenue_pvm`→`REVENUE`, `cogs_opex`→`COGS`+`OPEX`, `capex_depreciation`→`CAPEX`+`DEPRECIATION`+`FIXED_ASSETS`). **Uczciwie nazwana granica** (ten sam wzorzec uczciwości co D05 §5.3 "curated denylist, nie automatyczny dowód"): to jest zapytaniowa optymalizacja nad prawdą, która faktycznie żyje w KODZIE silnika, nie odwrotnie — jeśli `baselineScheduleEngine.ts` kiedyś zmieni, które linie produkuje dany `schedule_type` (np. dodanie `headcount`/`leases` do P0 taksonomii, WP-D06 §5 pkt 3 już to zapowiada jako otwarty punkt), ta tabela wymaga ręcznej aktualizacji — eskalacja sekcja 15 pkt 1 zaleca test parytetu (assert że `finance_prediction_driver_line_map` i `baselineScheduleEngine.ts`'s własne hardkodowane przypisania linii się zgadzają) jako część przyszłego Prediction Compute WP, nie tego ADR-u.

### 4.8 `finance_prediction_preflight_runs`

Etap 1 kontraktu (DEC-FIN-004): `assumption_set_semantic_hash` (hash CAŁEGO assumption setu w momencie analizy — pozwala odróżnić "ten preflight jest wciąż aktualny" od "assumptions zmieniły się od ostatniego preflight", bez czego `NO_OPEN_REQUIRED_RESOLUTIONS`=true na STARYM preflight byłoby fałszywym zielonym światłem), `findings_count`/`required_resolutions_count` (denormalizowane liczniki dla UI bez COUNT-owania na żywo), `superseded_by_preflight_run_id` (self-FK — nowy preflight po zmianie założeń supersede'uje poprzedni; stare `finance_prediction_conflict_resolutions` przypięte do supersede'owanych findings stają się historyczne, nie usuwane — append-only w duchu, jak `finance_exceptions`).

### 4.9 `finance_prediction_preflight_findings` (poza dosłowną listą z zadania)

Bez tej tabeli `finance_prediction_conflict_resolutions` nie ma stabilnego `finding_id` do FK-owania — "user decision per konflikt" (zadanie, punkt 7 listy tabel) wymaga, żeby "konflikt" był adresowalnym wierszem bazy, nie elementem tablicy JSON bez własnej tożsamości/FK/stanu. `finding_kind` (6 wartości: `OVERLAP_DOUBLE_COUNTING`/`CONTRADICTORY_SIGNS`/`MISSING_REQUIRED_INPUT`/`INCONSISTENT_UNIT`/`ORPHAN_IMPACT_NO_INITIATIVE`/`DUPLICATE_SOURCE_ROW` — sekcja 7.3), `requires_resolution` (nie każdy finding blokuje compute — np. `DUPLICATE_SOURCE_ROW` może być czysto informacyjny w P0, blokujące tylko `OVERLAP_DOUBLE_COUNTING`/`CONTRADICTORY_SIGNS`/`MISSING_REQUIRED_INPUT` domyślnie, decyzja aplikacyjna, nie wymuszona schematem — kolumna istnieje właśnie po to, żeby to było jawne per wiersz, nie zakodowane na sztywno per `finding_kind`), `involved_sources JSONB` (lista `{source_type, source_id}` — read-model, źródło prawdy to same tabele `driver_overrides`/`impact_chain`/`financing`), `combined_impact_decimal` + `proposed_resolution_numeric_preview JSONB` — **numeryczny podgląd wpływu** wymagany explicite przez DEC-FIN-004 i zadanie punkt 2.

### 4.10 `finance_prediction_conflict_resolutions`

`finding_id UNIQUE` (jeden rozstrzygnięcie per finding — nowe assumptions → nowy preflight → nowe findings → nowe resolutions, nie edycja starego), `resolution_choice` (`ACCEPTED_PROPOSED`/`CUSTOM`), `custom_resolution_detail` (wymagany gdy `CUSTOM`, CHECK), `rationale` **`NOT NULL`** (zadanie: "zaakceptował propozycję czy własne rozstrzygnięcie + uzasadnienie" — uzasadnienie jest obowiązkowe niezależnie od tego, czy user zaakceptował propozycję, czy nie: nawet zaakceptowanie systemowej propozycji jest decyzją wymagającą śladu "dlaczego to jest OK"), `requires_review`/`state`/`reviewed_by`/`reviewed_at` (maker-checker dla materialnych rozstrzygnięć, DEC-FIN-001 — CHECK wymusza: jeśli `requires_review` i `state='RESOLVED'`, to `reviewed_by` musi być wypełnione, **przetestowane żywo jako odrzucenie**, TEST 12 sekcja 14).

---

## 5. `scenario_mode` — czy jeden scenariusz może łączyć tryby A/B/C, czy są rozłączne

**Decyzja: hierarchiczny, częściowo łączalny, nie w pełni rozłączny.** Dokładny podział:

### 5.1 Dosłowna podstawa w OWN-FIN-019

Cytat: *"UI wykorzystuje pełny ekran i ma dwa główne widoki... `Budowa założeń` (**pełna karta/scenario builder obejmująca A/B/C**)"*. To zdanie mówi wprost: JEDEN builder, obejmujący WSZYSTKIE trzy tryby, nie trzy rozłączne kreatory prowadzące do trzech nie-łączących-się typów scenariusza. Analogicznie, handoff §8 wylicza cztery mechanizmy Prediction ("1. standard... 2. manual KPI/driver overrides; 3. fundamental initiatives/decisions; 4. financing...") jako rzeczy, które Prediction **zawiera** (liczba mnoga, koniunkcja), nie rozłączną alternatywę.

### 5.2 Ale JEDNA hard wymóg wymusza wyjątek: `STANDARD_BASE`

Zadanie punkt 3 ("Base = semantycznie równe Baseline") i DEC-FIN-002 (żadnej modyfikacji w Baseline) wymagają, żeby istniał scenariusz, który jest **strukturalnie, fizycznie pusty** — bez tego "Base" byłby tylko konwencją ("nikt nic tu nie dodał, ufaj mi"), nie gwarancją. Dlatego `STANDARD_BASE` jest **jedynym w pełni rozłącznym, strukturalnie czystym** trybem: trigger na WSZYSTKICH trzech tabelach-dzieciach (`driver_overrides`/`initiatives`/`financing`) odrzuca INSERT, jeśli `scenario_mode='STANDARD_BASE'` (sekcja 8.2, przetestowane żywo TEST 1).

### 5.3 `STANDARD_UPSIDE`/`STANDARD_DOWNSIDE` — czysty, oznaczony wariant standardowy

Modelowane jako `driver_overrides` z `override_source` **wymuszonym** przez trigger na `STANDARD_PRESET_UPSIDE`/`STANDARD_PRESET_DOWNSIDE` (zgodnie z kierunkiem scenariusza) — inicjatywy i financing są zabronione w tym trybie (trigger). Uzasadnienie: OWN-FIN-019 opisuje tryb A jako odrębny od "wariantu fundamentalnego" — Upside/Downside mają pozostać reprodukowalne, proste, porównywalne w Compare bez domieszki inicjatyw/decyzji finansowania, które komplikowałyby czytanie "to jest czysty scenariusz wzrostu/spadku". Mechanizm reprezentacji jest identyczny jak `DRIVER_OVERRIDE` (ten sam driver grid), różni się wyłącznie wymuszonym `override_source` i zakazem financing/initiatives — nie jest to osobny silnik ani osobna tabela.

### 5.4 `DRIVER_OVERRIDE` i `FUNDAMENTAL_INITIATIVE` — hierarchiczne, jednokierunkowo łączalne

- `DRIVER_OVERRIDE`: `driver_overrides` (dowolny `override_source`) i `financing` dozwolone; `initiatives` **zabronione** (trigger). To jest czysty "tryb B" per OWN-FIN-019 — użytkownik zmienia drivery/KPI i/lub dodaje decyzję finansowania, bez formalnej karty inicjatywy.
- `FUNDAMENTAL_INITIATIVE`: **wszystko dozwolone** — `driver_overrides`, `initiatives`, `financing`, `impact_chain`. To jest dosłowna realizacja "pełnej karty obejmującej A/B/C" — najbogatszy, ogólny tryb.
- **Jedno dozwolone przejście**: `DRIVER_OVERRIDE → FUNDAMENTAL_INITIATIVE` (trigger na `UPDATE OF scenario_mode`, sekcja 8.1) — promocja "zacząłem od prostych driverów, teraz chcę dodać formalną inicjatywę", jednokierunkowa, nigdy degradacja, nigdy dotykająca `STANDARD_*`. Przetestowane żywo: promocja przyjęta (TEST 6), próba degradacji z powrotem odrzucona (TEST 6b).

### 5.5 Legacy migracja (ORCH-DEC-001) sprawdza tę regułę bez luki

Scenariusz zrekonstruowany z historycznych `debt_drawdown`/`equity_injection`/`dividend` (sekcja 11) ma WYŁĄCZNIE wiersze `financing`, zero `driver_overrides`, zero `initiatives` — pod regułą §5.4 to poprawnie klasyfikuje się jako `DRIVER_OVERRIDE` (financing dozwolone, initiatives nie wymagane) bez tworzenia szóstej wartości enuma "financing-only" — potwierdza, że hierarchia z sekcji 5.4 (nie płaski, rozłączny podział 1:1 na A/B/C) jest właściwym kształtem, nie tylko wygodnym uproszczeniem.

### 5.6 Rozważona i odrzucona alternatywa: pełna rozłączność (4 osobne typy artefaktu/tabeli)

Rozważona: cztery w pełni niezależne "typy scenariusza" (Standard/Driver/Fundamental/Financing-only), każdy z własnym zestawem tabel, bez możliwości połączenia.

**Odrzucona**: (1) sprzeczna wprost z dosłownym brzmieniem OWN-FIN-019 ("obejmująca A/B/C" jednego buildera); (2) realny przypadek biznesowy z OWN-FIN-019's własnego przykładu ("inicjatywa poprawy efektywności produkcji... wskazuje bazę kosztową") często współistnieje z niezależnymi manualnymi korektami innych driverów (np. inicjatywa efektywnościowa + osobna, niezwiązana korekta kursu FX) — wymuszenie rozłączności zmusiłoby użytkownika do tworzenia dwóch osobnych scenariuszy dla jednej spójnej narracji biznesowej, co łamie Compare (2-4 scenariusze, nie N fragmentów jednej narracji); (3) migracja legacy (sekcja 5.5) nie miałaby gdzie wylądować bez sztucznej piątej kategorii.

---

## 6. Dwuetapowy Compute — kontrakt

### 6.1 Etap 1 — Preflight

Serwis aplikacyjny (poza zakresem tego ADR-u — analogiczna granica co WP-D03 §6.3 dla unit-checking Warstwy 2) analizuje CAŁY assumption set scenariusza (`driver_overrides` + `initiatives`/`impact_chain` + `financing`), wywołuje `finance_prediction_detect_overlaps()` (Warstwa 1 SQL, sekcja 7.1) jako pierwszy przebieg, dla każdej grupy z `source_count > 1` liczy **numeryczny podgląd wpływu** (Warstwa 2, sekcja 7.2), zapisuje jeden `finance_prediction_preflight_runs` wiersz + N `finance_prediction_preflight_findings` wierszy, `assumption_set_semantic_hash` = hash treści wszystkich czterech tabel dzieci w momencie analizy (semantic hash, nie surowy JSON — zgodnie z addendum §6 pkt 7, ten sam wzorzec co `content_semantic_hash` gdzie indziej w programie).

### 6.2 Bramka — `finance_prediction_readiness_check()`

Trzy nazwane checki (przetestowane żywo, sekcja 14):

| Check | Znaczenie |
|---|---|
| `HAS_CURRENT_PREFLIGHT` | istnieje `finance_prediction_preflight_runs` wiersz dla tego scenariusza z `superseded_by_preflight_run_id IS NULL` (najnowszy, aktualny) |
| `NO_OPEN_REQUIRED_RESOLUTIONS` | dla NAJNOWSZEGO preflight, każdy `finding` z `requires_resolution=true` ma odpowiadający `finance_prediction_conflict_resolutions` wiersz w stanie `RESOLVED` |
| `NO_OPEN_UNDEFINED_MATH` | reużyty wprost z D05/WP-B05: brak otwartego `finance_exceptions_current(severity='SECURITY', blocking_category='UNDEFINED_MATH')` dla tego `business_version_id` |

`finance_prediction_can_start_compute(business_version_id)` = `bool_and()` po wszystkich checkach. `computeJobService` MUSI wywołać tę funkcję przed `INSERT` do `compute_jobs(job_type='PREDICTION_COMPUTE')` — dokładnie ten sam punkt integracji, co WP-B05 §3 middleware `SECURITY` gate już ustanowił dla `POST .../compute` ogólnie, tu rozszerzony o Prediction-specyficzny warunek.

**System nie blokuje budowania założeń** — żaden z powyższych checków nie jest triggerem na `driver_overrides`/`initiatives`/`impact_chain`/`financing`; są wyłącznie odczytywane przez bramkę PRZED `compute`, nigdy przed zwykłym `INSERT` treści. Przetestowane pośrednio: TEST 4/7 (insert override/initiative) przechodzą niezależnie od stanu jakiegokolwiek preflight.

### 6.3 `job_type='PREDICTION_COMPUTE'` — dokumentowana rozbieżność, ten sam precedens co WP-D06

`WP-B04_jobs_runs_outputs_ADR.md` §12 pkt 3 zarezerwowało `job_type='prediction_compute'` (lowercase) dla tego pakietu. Zadanie każe dosłownie: *"computeJobService może przyjąć job_type='PREDICTION_COMPUTE'"* (uppercase, dokładnie jak WP-D06 §5 pkt 8 udokumentowało `'BASELINE_COMPUTE'` zamiast zarezerwowanego `'model_compute'`). `compute_jobs.job_type` jest zwykłym `TEXT` bez CHECK enum (potwierdzone żywo, `\d compute_jobs`, sekcja 14) — obie wartości są strukturalnie poprawne. Podążam dosłownym poleceniem zadania i **udokumentowanym precedensem WP-D06**, nie cichym wyborem — pojednanie nazw (`PREDICTION_COMPUTE` vs `prediction_compute`) jest jednolinijkowym follow-onem, tym samym, który WP-D06 już zgłosiło dla `BASELINE_COMPUTE`, oba mogą być rozwiązane razem w jednym przyszłym patchu.

---

## 7. Double-counting — konkretny algorytm

### 7.1 Warstwa 1 — SQL, strukturalna, tania (`finance_prediction_detect_overlaps()`)

```sql
-- 1. Zmaterializuj KAŻDE źródło impaktu jako (entity, canonical_line, period, source_id, estimated_delta)
sourced_impacts =
    -- driver_overrides, zmapowane na dotknięte linie przez finance_prediction_driver_line_map
    SELECT o.entity_id, m.canonical_line_id, o.period_id,
           'DRIVER_OVERRIDE' AS source_type, o.id AS source_id,
           (o.value_decimal - o.baseline_value_decimal) AS estimated_delta
    FROM finance_prediction_driver_overrides o
    JOIN finance_prediction_driver_line_map m ON m.schedule_type = o.schedule_type
    WHERE o.business_version_id = :scenario
  UNION ALL
    -- impact_chain rows, wprost (uproszczenie jednego okresu — pełna ekspansja
    -- ramp/duration/decay to warstwa 2, sekcja 7.2)
    SELECT ic.entity_id, ic.statement_line_id, COALESCE(ic.start_period_id, i.default_start_period_id),
           'INITIATIVE_IMPACT', ic.id,
           (CASE WHEN ic.sign='NEGATIVE' THEN -1 ELSE 1 END) * ic.amount_decimal
    FROM finance_prediction_impact_chain ic
    JOIN finance_prediction_initiatives i ON i.id = ic.initiative_id
    WHERE ic.business_version_id = :scenario
  UNION ALL
    -- financing rows, zmapowane przez zamkniętą CASE-mapę financing_kind -> linie
    -- (FACILITY_DRAWDOWN/DISCRETIONARY_REPAYMENT -> LONG_TERM_DEBT+INTEREST_EXPENSE,
    --  DIVIDEND_DECLARATION -> DIVIDENDS_DECLARED+RETAINED_EARNINGS, ...)
    SELECT ...

-- 2. Grupuj po komórce docelowej, policz DYSTYNKTYWNE źródła
grouped = SELECT entity_id, canonical_line_id, period_id,
                 COUNT(DISTINCT (source_type, source_id)) AS source_count,
                 SUM(estimated_delta) AS combined_impact_decimal,
                 jsonb_agg(...) AS sources
          FROM sourced_impacts GROUP BY entity_id, canonical_line_id, period_id

-- 3. Flaguj konflikt
SELECT * FROM grouped WHERE source_count > 1
```

**Przetestowane żywo** (TEST 8, sekcja 14): dwie inicjatywy (`INIT-1` -5% COGS, `INIT-2` -3% COGS, jednostka `PERCENT`) obie targetujące `COGS`/`ent-d07`/`per-jan26` → dokładnie 1 wiersz overlap, `source_count=2`, `combined_impact_decimal=-8` (naiwna suma; realny podgląd numeryczny w jednostkach walutowych to Warstwa 2).

### 7.2 Warstwa 2 — service, numeryczny podgląd (nie zaimplementowana w tym ADR-ie, kontrakt)

Warstwa 1 mówi "te źródła nachodzą na siebie". Warstwa 2 mówi "o ile dokładnie, w walucie". Dla `driver_override`: wywołaj odpowiednią czystą funkcję `baselineScheduleEngine.ts` (np. `computeCogsOpex`) DWA razy — raz z bazową wartością drivera, raz z override'em — różnica to `estimated_delta` w PLN, nie w jednostce natywnej drivera (procent/dni/itp.). Dla `impact_chain`: rozwiń pełny okres efektywności (`start_period_id`+`ramp_months`+`duration_months`+`decay_pct_per_period`) do listy `(period_id, effective_fraction)` i pomnóż `amount_decimal` przez `effective_fraction` per okres, zanim zsumujesz z innymi źródłami tej samej komórki. Ten sam wzorzec granicy co WP-D03 §6.3 ("kontrakt preflight, nie zaimplementowana w tym ADR-ie") — implementacja to zakres wykonawczego Prediction Compute WP (analogicznego do WP-D06 dla Baseline), które i tak musi mieć dostęp do `baselineScheduleEngine.ts`'s funkcji (wskazówka #6 briefu).

### 7.3 Klasyfikacja konfliktu (`finding_kind`)

- `OVERLAP_DOUBLE_COUNTING` — wszystkie źródła w grupie mają **ten sam znak** (np. dwie inicjatywy redukujące ten sam koszt) — najbardziej prawdopodobny przypadek faktycznego podwójnego liczenia tego samego efektu biznesowego opisanego dwa razy.
- `CONTRADICTORY_SIGNS` — źródła mają **przeciwne znaki** (np. inicjatywa podnosi cenę, driver override obniża wolumen na tej samej linii) — może być celowym hedge'em, może być błędem; zawsze wymaga review, nigdy auto-netowania po cichu (DEC-FIN-004: "nie sumuje po cichu").
- `DUPLICATE_SOURCE_ROW` — ten sam `source_id` pojawia się dwa razy w wynikowej grupie (strukturalnie nie powinno się zdarzyć przy poprawnym `UNIQUE` na `driver_overrides`, ale możliwe dla `impact_chain`, gdzie nic nie zabrania dwóch wierszy tego samego `initiative_id` celujących w tę samą komórkę) — klasa błędu do złapania, nie normalny biznesowy konflikt.
- `MISSING_REQUIRED_INPUT`/`INCONSISTENT_UNIT`/`ORPHAN_IMPACT_NO_INITIATIVE` — pozostałe kategorie z zadania punkt 2 ("wykrywa overlap, konflikt, missing, inconsistency"), poza samym double countingiem, tej samej tabeli `finding_kind` enum.

---

## 8. Base = Baseline — jak jest to wymuszone i weryfikowalne

### 8.1 Warstwa wejścia — trigger na trzech tabelach dzieci

`finance_prediction_gate_driver_overrides()`/`_initiatives()`/`_financing()` (BEFORE INSERT OR UPDATE) czytają `scenario_mode` rodzica i **bezwarunkowo odrzucają** każdy wiersz, jeśli `scenario_mode='STANDARD_BASE'`. Nie ma wyjątku, nie ma trybu awaryjnego na poziomie schematu. Przetestowane żywo: TEST 1 (driver_override odrzucony z dokładnym komunikatem cytującym "DEC-FIN item 3, Base = Baseline").

### 8.2 Warstwa wyjścia — `finance_prediction_outputs` fizycznie pusta dla `STANDARD_BASE`

`finance_prediction_forbid_standard_base_outputs()` (BEFORE INSERT OR UPDATE na `finance_prediction_outputs`) odrzuca **każdy** wiersz, jeśli rodzic ma `scenario_mode='STANDARD_BASE'` — niezależnie od tego, czy wejście (8.1) zostało poprawnie zablokowane, czy nie (defense in depth: gdyby przyszły bug ominął 8.1, 8.2 nadal łapie próbę zapisania wyniku). Przetestowane żywo: TEST 2.

### 8.3 Warstwa odczytu — `finance_prediction_outputs_effective` VIEW

```sql
CREATE VIEW finance_prediction_outputs_effective AS
  -- STANDARD_BASE: czytaj BEZPOŚREDNIO finance_baseline_outputs przez MODEL_TO_SCENARIO
  SELECT s.business_version_id, bo.canonical_line_id, bo.entity_id, bo.period_id, ...,
         'BASELINE_PASSTHROUGH' AS source
  FROM finance_prediction_scenarios s
  JOIN finance_lineage_edges e ON e.target_version_id = s.business_version_id AND e.edge_type = 'MODEL_TO_SCENARIO'
  JOIN finance_baseline_outputs bo ON bo.business_version_id = e.source_version_id
  WHERE s.scenario_mode = 'STANDARD_BASE'
UNION ALL
  -- wszystkie pozostałe tryby: czytaj finance_prediction_outputs (realnie przeliczone)
  SELECT po.business_version_id, po.canonical_line_id, po.entity_id, po.period_id, ...,
         'PREDICTION_COMPUTE' AS source
  FROM finance_prediction_outputs po
  JOIN finance_prediction_scenarios s ON s.business_version_id = po.business_version_id
  WHERE s.scenario_mode != 'STANDARD_BASE';
```

To jest JEDYNE miejsce, które UI (widok `Modele/Wyniki`) czyta — nie musi wiedzieć, czy scenariusz jest Base czy nie. **Gwarancja jest strukturalna**: dla `STANDARD_BASE` nie ma DRUGIEGO wiersza, który mógłby powiedzieć coś innego — sam wiersz Baseline'a JEST wynikiem Prediction dla tego scenariusza, przeczytanym przez wskaźnik (lineage edge), nie skopiowanym. Przetestowane żywo: TEST 3 — `finance_prediction_outputs_effective` dla `STANDARD_BASE` scenariusza zwraca dokładnie wiersz `finance_baseline_outputs` (wartość `1000000`, `source='BASELINE_PASSTHROUGH'`).

### 8.4 Kontrakt testowy dla przyszłego Prediction Compute WP (nie wykonany tutaj)

Ten ADR projektuje STRUKTURĘ, która czyni rozbieżność Base/Baseline niemożliwą (bo nie ma gdzie takiej rozbieżności zamieszkać). Przyszły Prediction Compute WP (analog WP-D06) powinien DODATKOWO udowodnić żywym known-answer testem (wzorem WP-D06 §2, GoldCo PARENT), że: (a) próba przeliczenia `STANDARD_BASE` scenariusza przez `computeJobService` albo w ogóle nie tworzy joba (bo compute dla `STANDARD_BASE` jest no-opem — nie ma czego przeliczać, `finance_prediction_outputs_effective` już ma dane przez passthrough), albo jeśli tworzy, to `finance_prediction_outputs` insert dla niego kończy się dokładnie błędem z sekcji 8.2 (fail-closed, nie cichym pominięciem); (b) `baselineScheduleEngine.ts`'s funkcje wywołane z zerowymi override'ami (czyli dokładnie to, co Prediction Compute robiłby dla dowolnego innego trybu bez faktycznych zmian) dają identyczny wynik co `baselineComputeService.ts` — to jest osobny dowód "silnik jest deterministyczny i reużywalny", komplementarny do (a) "Base nigdy nie próbuje przeliczać siebie od nowa".

---

## 9. Reverse stress/break-even, liquidity/funding/covenant headroom — schemat/wzorzec zapytań, nie implementacja

Zgodnie z zadaniem punkt 5 ("jako tabele/query pattern, nie pełna implementacja logiki — to WP-D07+"), poniżej jest WYŁĄCZNIE miejsce w schemacie i wzorzec zapytania, nie działający silnik (to jest zakres kolejnego WP, analogicznego do relacji WP-D05→WP-D06).

### 9.1 Covenant / min-cash headroom — query pattern nad istniejącymi tabelami

Brak nowej tabeli — `finance_prediction_financing(financing_kind='COVENANT_DEFINITION')`'s `payload` (`{metric_kpi_code, operator, threshold, test_frequency}`) + `finance_prediction_outputs_effective` (sekcja 8.3) + `finance_analysis_kpi_catalog`/`finance_analysis_kpi_values` (WP-D03, dla covenants wyrażonych jako wskaźnik, np. `NET_DEBT_TO_EBITDA`) dają wszystko potrzebne:

```sql
-- wzorzec: headroom = threshold - actual, per okres, dla covenantów tego scenariusza
SELECT f.id AS covenant_id, o.period_id,
       (f.payload->>'threshold')::numeric AS threshold,
       kv.value_decimal AS actual_metric,
       (f.payload->>'threshold')::numeric - kv.value_decimal AS headroom
FROM finance_prediction_financing f
JOIN finance_prediction_outputs_effective o ON o.business_version_id = f.business_version_id
-- JOIN do finance_analysis_kpi_values dla covenanty wyrażone jako wskaźnik, filtr po f.payload->>'metric_kpi_code'
WHERE f.financing_kind = 'COVENANT_DEFINITION' AND f.business_version_id = :scenario;
```

`MIN_CASH_POLICY` analogicznie: `headroom = CASH_line.value_decimal - (payload->>'min_cash_amount')::numeric` per okres, czytane z `finance_prediction_outputs_effective` filtrowanego po `canonical_line_id='CASH'`.

### 9.2 Reverse stress / break-even — miejsce w schemacie, nie silnik

Sketch tabeli (nietworzona w tym ADR-ie, dokumentacja intencji dla przyszłego WP): `finance_prediction_breakeven_runs(id, business_version_id, target_metric_line_id, target_value_decimal, solved_driver_code, solved_value_decimal, converged, iterations_used, compute_job_id)` — jeden wiersz per uruchomienie "dla jakiej wartości drivera X metryka Y osiąga próg Z". Wzorzec algorytmu (nie implementowany): bisection/binary search nad `finance_prediction_driver_overrides` wartością jednego drivera, wywołujący Warstwę 2 preview (sekcja 7.2) lub pełny compute per iterację, aż `target_metric` przetnie `target_value` w tolerancji — koncepcyjnie analogiczne do `baselineCircularitySolver.ts`'s fixed-point (WP-D06 §4.1), ale sterowane celem zewnętrznym (target metric), nie wewnętrzną zbieżnością cash/debt.

---

## 10. Legacy mapping — ORCH-DEC-001

Trzy jawnie decyzyjne typy `financial_model_events` (WP-D05 §9: `debt_drawdown`/`equity_injection`/`dividend`) migrują tutaj:

| `event_type` | `finance_prediction_financing.financing_kind` | Uwagi |
|---|---|---|
| `debt_drawdown` | `FACILITY_DRAWDOWN` | `payload` = `{principal, rate, tenor_months}` z legacy eventu |
| `equity_injection` | `EQUITY_INJECTION` | `payload` = `{amount, instrument}` |
| `dividend` | `DIVIDEND_DECLARATION` | `payload` = `{amount}` — odpowiada `DIVIDENDS_DECLARED.excluded_from_baseline=true` (D05 §4.7), teraz z prawdziwą wartością zamiast wymuszonego `NA` |

Migrowany scenariusz: nowy `finance_prediction_scenarios` wiersz, `scenario_mode='DRIVER_OVERRIDE'` (sekcja 5.5 — financing-only poprawnie klasyfikuje się tu bez nowej wartości enuma), `finance_prediction_financing.source_ref = {migrated_from: 'financial_model_events', legacy_event_id, legacy_model_id, source: 'migrated_legacy_event'}` (dosłowne `source=migrated_legacy_event` z ORCH-DEC-001), `MODEL_TO_SCENARIO` krawędź do odpowiedniego nowego `finance_baseline_models` (per organizację/model, z tego samego `financial_models.id`, zmapowanego przez WP-D05 §9's backfill). Dwa niejednoznaczne typy (`debt_repayment`/`wc_change`) pozostają w `QUARANTINE` per ORCH-DEC-001/D05 §9 — ten ADR nie zmienia tamtej klasyfikacji, tylko potwierdza docelowe miejsce lądowania dla przypadków, które backfill-service jednak rozstrzygnie jako decyzyjne (`DISCRETIONARY_REPAYMENT` financing_kind istnieje właśnie na tę okoliczność).

Rzeczywisty backfill jest zakresem osobnego wykonawczego WP (analog WP-C03/WP-D05b), nie tego ADR-u — ta sekcja tylko ustala docelowy kształt.

---

## 11. Rozważane alternatywy (odrzucone)

### 11.1 `finance_prediction_impact_chain` jako rozszerzenie `finance_prediction_driver_overrides` (jedna wspólna tabela dla trybu B i C)

Rozważona: zamiast dwóch tabel, jedna `finance_prediction_assumptions` z discriminated `assumption_kind IN ('DRIVER_OVERRIDE','INITIATIVE_IMPACT')`.

**Odrzucona**: kształty są fundamentalnie różne — `driver_overrides` to "nowa wartość zamiast starej" (jedna wartość per komórka, `UNIQUE` na współrzędnych), `impact_chain` to "delta dodawana do istniejącej wartości, z własną dynamiką czasową (ramp/decay) i własnym rodzicem (`initiative_id`)" — wymuszenie wspólnego kształtu wymagałoby, żeby WSZYSTKIE kolumny `impact_chain` (ramp/duration/decay/confidence/probability/capacity/cannibalization) były nullable na `driver_overrides` też, rozmywając czytelność i CHECK-i. Osobne tabele, connected wyłącznie przez wspólny `business_version_id` i wspólną konsumpcję w Warstwie 1 double-counting (sekcja 7.1, gdzie i tak są UNION-owane na poziomie zapytania, nie tabeli) — to jest dokładnie ten sam kompromis co D01 zrobiło dla P&L/BS/CF (jedna `finance_stmt_lines` przez `statement_type`, NIE trzy różne strukturalnie tabele) ale w drugą stronę: tu strukturalna różnica jest realna, tam nie była.

### 11.2 `scenario_mode` jako w pełni derived/computed kolumna (nie jawnie ustawiana)

Rozważona: `scenario_mode` liczony automatycznie z obecności wierszy w tabelach dzieci (GENERATED-w-duchu), zamiast jawnie deklarowany przy tworzeniu i chroniony triggerem transition guard.

**Odrzucona**: (1) nie odróżnia `DRIVER_OVERRIDE` od `STANDARD_UPSIDE`/`DOWNSIDE` bez dodatkowego stanu (obie mają tylko `driver_overrides`, różni je WYŁĄCZNIE `override_source`, który sam siebie nie agreguje do jednoznacznej klasyfikacji rodzica bez zapytania w każdym odczycie); (2) auto-relabeling scenariusza w trakcie budowania (np. pierwszy INSERT initiative cichcem zmienia `scenario_mode` z `DRIVER_OVERRIDE` na `FUNDAMENTAL_INITIATIVE`) byłby zaskakujący dla UI polegającego na stabilnej etykiecie w Compare, i utrudniłby jednoznaczne, audytowalne przejście (sekcja 5.4) — jawna kolumna + trigger transition guard daje ten sam efekt (spójność wymuszona) z pełną kontrolą nad KIEDY i JAK etykieta się zmienia.

### 11.3 `finance_prediction_financing` jako 8 osobnych tabel (analogicznie do 11.1's argumentu w drugą stronę)

Rozważona: osobna tabela per `financing_kind`.

**Odrzucona z tego samego powodu co D05 §10.1 odrzuciło to dla `finance_baseline_schedules`** — tu kształty SĄ strukturalnie podobne (wszystkie to "zdarzenie lub polityka finansowa, scoped do encji/opcjonalnego okresu, z payloadem specyficznym dla rodzaju"), więc argument z 11.1 (różne kształty uzasadniają osobne tabele) nie ma tu zastosowania w drugą stronę — jeden wspólny scaffolding jest właściwy, dokładnie jak dla `finance_baseline_schedules`.

---

## 12. Dowód testowy (ephemeral Postgres)

Zgodnie z twardym zakazem tego zadania, **żadna baza produkcyjna/demo/dev nie była dotknięta**. `LC_ALL=C`, `/opt/homebrew/opt/postgresql@15/bin/initdb --locale=C`, port **57511** (sprawdzony wolny przez `lsof` najpierw, w zakresie 55000-59999), `listen_addresses=127.0.0.1`, osobny katalog danych w `/private/tmp/`. Uruchomiony pełen istniejący zestaw migracji (`server/scripts/migrate.postgres.ts`, `NODE_ENV=test`, `DB_TYPE=postgres`) — wszystkie 815 migracji repo (w tym Gate B/C i WP-D01…D06) przeszły 0 błędów, przed nałożeniem DDL-u z tego ADR-u. Po testach: `pg_ctl -m fast stop` + `rm -rf` katalogu danych; potwierdzone `ps aux`, że współdzielona instancja Homebrew (PID 911, `/opt/homebrew/var/postgresql@15`) pozostała nietknięta przez cały czas, oraz że po `stop`+`rm -rf` proces efemeryczny faktycznie zniknął z listy procesów.

**Scenariusze przechodzące żywo** (fixture + testy w scratchpad sesji, `/private/tmp/wp_d07_block1_tables.sql`/`wp_d07_block2_integrity.sql`/`wp_d07_block3_readiness.sql`/`wp_d07_fixtures_and_tests.sql`, nie w repo — ten sam wzorzec co D05/D06's Załącznik A):

| # | Test | Oczekiwane | Wynik |
|---|---|---|---|
| 1 | `STANDARD_BASE` scenariusz + `driver_override` INSERT | Odrzucony ("Base = Baseline") | ✅ |
| 2 | `STANDARD_BASE` scenariusz + własny `finance_prediction_outputs` wiersz | Odrzucony | ✅ |
| 3 | `finance_prediction_outputs_effective` dla `STANDARD_BASE` scenariusza | Zwraca dokładnie wiersz `finance_baseline_outputs` (1 000 000 PLN REVENUE), `source='BASELINE_PASSTHROUGH'` | ✅ |
| 4 | `DRIVER_OVERRIDE` scenariusz + `driver_override` INSERT | Przyjęty | ✅ |
| 5 | `DRIVER_OVERRIDE` scenariusz + `initiative` INSERT | Odrzucony ("promote the scenario first") | ✅ |
| 6 | `UPDATE scenario_mode` `DRIVER_OVERRIDE → FUNDAMENTAL_INITIATIVE` | Przyjęty | ✅ |
| 6b | `UPDATE scenario_mode` `FUNDAMENTAL_INITIATIVE → DRIVER_OVERRIDE` (próba degradacji) | Odrzucony ("one-way only") | ✅ |
| 7 | Po promocji: `initiative` INSERT + `impact_chain` INSERT (×2, różne inicjatywy) | Przyjęte (tryb łączy B+C) | ✅ |
| 8 | `finance_prediction_detect_overlaps()` — 2 inicjatywy, ta sama linia/okres (COGS/Jan26) | 1 wiersz, `source_count=2`, `combined_impact_decimal=-8` | ✅ |
| 9 | `finance_prediction_can_start_compute()` PRZED preflight | `false` (`HAS_CURRENT_PREFLIGHT=false`) | ✅ |
| 10 | Po preflight, finding `requires_resolution=true` bez resolution | `false` (`NO_OPEN_REQUIRED_RESOLUTIONS=false`) | ✅ |
| 11 | Po dodaniu `RESOLVED` resolution dla tego findingu | `true` (wszystkie trzy checki `true`) | ✅ |
| 12 | `conflict_resolution` z `requires_review=true`, `state='RESOLVED'`, `reviewed_by=NULL` | Odrzucony (CHECK) | ✅ |
| 13 | INSERT do `finance_prediction_driver_overrides` na scenariuszu z rodzicem `APPROVED` | Odrzucony (immutability) | ✅ |

Te testy **nie są** Gate C — nie mają resume/checksums/shadow-parity/canary i nie testują backfillu z żywych danych legacy `financial_model_events`. `finance_prediction_driver_line_map` i Warstwa 2 numerycznego podglądu (sekcja 7.2) są **kontraktem, nie kodem** — nie mają żywego testu poza samym `CREATE TABLE`/prostym SQL-owym JOIN-em w TEST 8 (który używa naiwnej sumy procentów jako `estimated_delta`, świadomie uproszczone dla dowodu mechanizmu grupowania, nie dowodu poprawności finansowej — Warstwa 2 to zakres przyszłego Prediction Compute WP). Są dowodem, że DDL jest syntaktycznie poprawny i że mechanizmy `scenario_mode` gating / Base=Baseline / dwuetapowy compute guard / double-counting grupowanie / maker-checker / immutability zachowują się zgodnie z projektem na realnych, wielotabelowych transakcjach.

---

## 13. Eskalacje wymagane przed pełnym GO

Żadna z poniższych nie blokuje przyjęcia tego ADR-u jako projektu — wszystkie zgodne z `DEC-FIN-012`.

1. **`finance_prediction_driver_line_map` parytet z `baselineScheduleEngine.ts`** (sekcja 4.7) — udokumentowane zwierciadło, nie automatyczny dowód zgodności; wymaga testu parytetu w przyszłym Prediction Compute WP (analogicznie do tego, jak WP-D06 dowiodło zgodności silnika z niezależnym oracle).
2. **`finance_prediction_financing` → linie mapowanie dla double-counting Warstwy 1** (sekcja 7.1, trzeci UNION branch) — nie w pełni wypisane w tym ADR-ie (tylko przykładowo: `FACILITY_DRAWDOWN`→`LONG_TERM_DEBT`+`INTEREST_EXPENSE`) — pełna, zamknięta mapa 8 `financing_kind`→linie jest zakresem wykonawczego WP, analogicznie do `finance_prediction_driver_line_map`'s własnej granicy.
3. **`capacity_constraint_ref`/`cannibalizes_impact_id`** (sekcja 4.4) — zadeklarowane w schemacie, niewalidowane triggerem w tym P0 (np. nic nie sprawdza, że suma impaktów nie przekracza `capacity_constraint_ref`'s limitu) — miękkie pola do przyszłej logiki serwisowej.
4. **Warstwa 2 numerycznego podglądu double-counting** (sekcja 7.2) — kontrakt, nie implementacja; wymaga dostępu do `baselineScheduleEngine.ts`'s funkcji z przyszłego Prediction Compute WP.
5. **Reverse stress/break-even engine** (sekcja 9.2) — tylko szkic tabeli/algorytmu, jak zażądano w zadaniu punkt 5; pełna implementacja to WP-D08+ (analogicznie do relacji WP-D05→WP-D06).
6. **`job_type` rozjazd `PREDICTION_COMPUTE` vs zarezerwowany `prediction_compute`** (sekcja 6.3) — ta sama, jeszcze nierozwiązana rozbieżność co WP-D06 zgłosiło dla `BASELINE_COMPUTE`/`model_compute`; oba możliwe do naprawienia jednym follow-onem.
7. **Rzeczywisty backfill 3 typów decyzyjnych eventów → `finance_prediction_financing`** (sekcja 10) jest zakresem osobnego wykonawczego WP (analog WP-C03/WP-D05b) — ta sekcja tylko ustala docelowy kształt.
8. **`finance_prediction_preflight_findings.finding_kind`'s domyślne `requires_resolution`** per rodzaj (sekcja 4.9) nie jest wymuszone schematem (jawna kolumna per wiersz, nie CHECK powiązany z `finding_kind`) — decyzja aplikacyjna, do potwierdzenia przy implementacji preflight service.

---

## 14. Traceability

| Wymaganie z zadania | Sekcja tego ADR |
|---|---|
| `finance_prediction_scenarios` — jeden per `business_version_id`, źródło Baseline przez lineage, `scenario_mode` 5 wartości, decyzja czy tryby łączą się | §4.1, §5 (cała), TEST 1/4/6/6b/7 |
| `finance_prediction_driver_overrides` (tryb B) — KPI/driver + nowa wartość + okres | §4.2, TEST 4 |
| `finance_prediction_initiatives` (tryb C) — nazwa/opis/source/owner/confidence/start/ramp/duration/koszt | §4.3, TEST 7 |
| `finance_prediction_impact_chain` — rdzeń łańcucha initiative→assumption→driver/KPI→statement_line→forecast, amount/%/unit/sign/period | §4.4, TEST 7/8 |
| `finance_prediction_financing` — facility/rate/tenor/covenant/min-cash, TU żyje wykluczone z Baseline | §4.5, §9.1, §10 |
| `finance_prediction_preflight_runs` — Etap 1: overlap/conflict/missing/inconsistency + proponowane resolutions | §4.8, §6.1, TEST 9/10 |
| `finance_prediction_conflict_resolutions` — user decision per konflikt: propozycja czy własne + uzasadnienie | §4.10, TEST 11/12 |
| Dwuetapowy Compute jako jawny kontrakt: preflight → resolution → `PREDICTION_COMPUTE` guard, system nie blokuje budowania | §6 (cała), TEST 9/10/11 |
| Base = semantycznie równe Baseline, zaprojektuj wymuszenie/weryfikowalność | §8 (cała, 4 warstwy), TEST 1/2/3 |
| Double counting — konkretny algorytm, nie proza, numeryczny combined impact | §7 (cała), TEST 8 |
| Reverse stress/break-even, liquidity/funding/covenant headroom — tabele/query pattern, nie pełna implementacja | §9 (cała) |
| Mapowanie 3 typów eventów decyzyjnych ORCH-DEC-001 na ten schemat | §10 |
| Zakaz łączenia z bazą produkcyjną/demo/dev; własny efemeryczny Postgres | §12 |

---

## Załącznik A — DDL sketch (zweryfikowany żywo)

Dziesięć tabel (sekcja 3-4) + 9 funkcji/triggerów integralności (scenario_mode gating ×3, transition guard, Base=Baseline forbid, parent immutability ×5) + 1 VIEW (`finance_prediction_outputs_effective`) + 3 funkcje (`finance_prediction_detect_overlaps`, `finance_prediction_readiness_check`, `finance_prediction_can_start_compute`) są w pełni określone w sekcjach 4-8 tego dokumentu. Pełne, uruchamialne pliki `.sql` (dokładnie te zweryfikowane w sekcji 12) żyją w scratchpad sesji (`/private/tmp/wp_d07_block1_tables.sql`, `wp_d07_block2_integrity.sql`, `wp_d07_block3_readiness.sql`), nie w repo — ten sam wzorzec co D05/D06's własna uwaga o unikaniu duplikowania DDL, które i tak trzeba przepisać z realnymi nazwami plików migracji w wykonawczym Gate D. Kluczowe fragmenty, dosłowne i kopiowalne 1:1:

```sql
CREATE TABLE finance_prediction_scenarios (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id       TEXT NOT NULL,
  business_version_id   TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  scenario_mode         TEXT NOT NULL CHECK (scenario_mode IN (
                           'STANDARD_BASE','STANDARD_UPSIDE','STANDARD_DOWNSIDE',
                           'DRIVER_OVERRIDE','FUNDAMENTAL_INITIATIVE'
                         )),
  scenario_mode_promoted_at TIMESTAMPTZ,
  scenario_mode_promoted_by TEXT,
  created_by            TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_prediction_scenarios_bv UNIQUE (business_version_id),
  CONSTRAINT fk_finance_prediction_scenarios_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

-- Physical layer: Base = Baseline, input side. Same shape repeated for
-- finance_prediction_initiatives (requires scenario_mode='FUNDAMENTAL_INITIATIVE')
-- and finance_prediction_financing (forbids all three STANDARD_* modes).
CREATE FUNCTION finance_prediction_gate_driver_overrides() RETURNS TRIGGER AS $$
DECLARE v_mode TEXT;
BEGIN
  v_mode := (SELECT scenario_mode FROM finance_prediction_scenarios WHERE business_version_id = NEW.business_version_id);
  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: no finance_prediction_scenarios row for business_version_id %', NEW.business_version_id;
  END IF;
  IF v_mode = 'STANDARD_BASE' THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: scenario_mode=STANDARD_BASE forbids any driver override (DEC-FIN item 3, Base = Baseline)';
  END IF;
  IF v_mode = 'STANDARD_UPSIDE' AND NEW.override_source != 'STANDARD_PRESET_UPSIDE' THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: scenario_mode=STANDARD_UPSIDE requires override_source=STANDARD_PRESET_UPSIDE, got %', NEW.override_source;
  END IF;
  IF v_mode = 'STANDARD_DOWNSIDE' AND NEW.override_source != 'STANDARD_PRESET_DOWNSIDE' THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: scenario_mode=STANDARD_DOWNSIDE requires override_source=STANDARD_PRESET_DOWNSIDE, got %', NEW.override_source;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Physical layer: Base = Baseline, output side — no separate row can ever exist to diverge.
CREATE FUNCTION finance_prediction_forbid_standard_base_outputs() RETURNS TRIGGER AS $$
DECLARE v_mode TEXT;
BEGIN
  v_mode := (SELECT scenario_mode FROM finance_prediction_scenarios WHERE business_version_id = NEW.business_version_id);
  IF v_mode = 'STANDARD_BASE' THEN
    RAISE EXCEPTION 'finance_prediction_outputs: scenario_mode=STANDARD_BASE may never own its own output rows — Models/Results must read finance_baseline_outputs through the MODEL_TO_SCENARIO lineage edge instead (finance_prediction_outputs_effective view), so Base cannot physically diverge from Baseline';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- One-way scenario_mode promotion: the only combinability transition allowed.
CREATE FUNCTION finance_prediction_scenario_mode_transition_guard() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scenario_mode = OLD.scenario_mode THEN RETURN NEW; END IF;
  IF OLD.scenario_mode = 'DRIVER_OVERRIDE' AND NEW.scenario_mode = 'FUNDAMENTAL_INITIATIVE' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'finance_prediction_scenarios: scenario_mode transition % -> % is not allowed (only DRIVER_OVERRIDE -> FUNDAMENTAL_INITIATIVE, one-way, never downgrade, never touching STANDARD_*)', OLD.scenario_mode, NEW.scenario_mode;
END;
$$ LANGUAGE plpgsql;
```

Pełny zestaw (10 tabel domenowych + 9 funkcji/triggerów + 1 VIEW + 3 funkcje readiness/detekcji) jest w pełni określony w sekcjach 4-8 tego dokumentu — każda nazwa kolumny, każdy CHECK, każdy trigger name użyty w testach sekcji 12 jest dosłowny, kopiowalny 1:1 do prawdziwego pliku migracji wykonawczego Gate D (analogiczny przyszły pakiet WP-D07b, wzorem WP-D01b/D03b/D05b).
