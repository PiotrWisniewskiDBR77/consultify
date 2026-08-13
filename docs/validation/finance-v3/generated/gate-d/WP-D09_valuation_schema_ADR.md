# ADR WP-D09 — Enterprise Valuation: domenowy schemat (Gate D / Fala 7)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, sekcja 9 (Enterprise Valuation — pełna przebudowa), EPIC-07.
**Work package:** WP-D09 — pierwszy pakiet Fali 7 (Enterprise Valuation), ostatniej domeny głównego łańcucha Finance v3, po zamrożonym Gate B (7 ADR-ów + AP-00), zaimplementowanym Gate C, i po Fali 3 (Statements, WP-D01/D01b/D02), Fali 4 (Analysis, WP-D03/D03b/D04), Fali 5 (Baseline Models, WP-D05/D05b/D06) i Fali 6 (Prediction/Scenario, WP-D07/D07b/D08 — schema, migracje, żywy compute engine).
**Data:** 2026-08-09/10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `ADR — DDL sketch, syntactically validated AND behaviorally exercised on an ephemeral Postgres, NOT executed as a real migration`

To jest ADR (decyzja + kontrakt), wzorem WP-B01…WP-B07, WP-D01, WP-D03, WP-D05, WP-D07. **Nie jest** to migracja Gate D wykonawcza ani produkcyjny kod, i **nie jest** to compute engine (analogiczny pakiet dla Valuation, reużywający wzorzec `baselineScheduleEngine.ts`/`baselineComputeService.ts`, jest kolejnym, osobnym WP — WP-D10 lub podobny). Zakres tego ADR-u to WYŁĄCZNIE schemat: tabele domenowe z prefiksem `finance_valuation_`, FCFF/WACC/terminal/EV→Equity bridge jako jawne kontrakty, methods & weights CHECK (N/A≠zero, suma=100), 5×5 sensitivity jako fizyczna struktura, i mechanizm zamrożenia Valuation Advisora. `OWN-FIN-021` (dosłowna specyfikacja właścicielska) i `DEC-FIN-005`/`DEC-FIN-006`/`DEC-FIN-011` (zdecydowane) są tu wykonywane, nie renegocjowane.

---

## 1. Wejścia przeczytane w całości, w tej kolejności

1. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §9 (Enterprise Valuation — Case i warianty, Metody, Obliczenia FCFF/WACC/Terminal/EV→Equity, Sensitivity, Valuation Advisor, Flow UX) — wymagania funkcjonalne. Także §2 pkt 6 (nieprzekraczalne decyzje: koszyk ważony vs cross-checki nieważone), §4 (wspólny kontrakt danych), §12 (canonical store), §14A EPIC-07 DoD (dosłowne kryteria: nazwany/opisany/wersjonowany/porównywalny wariant, exact source Baseline/Scenario, FCFF/WACC/terminal/bridge przez niezależny workbook, N/A nigdy zerem, 25 monotonicznych komórek, Advisor evidence/TRS refs, approval atomowy, 15/15 compute→review→approve→reopen).
2. `docs/validation/finance-v3/OWNER_REVIEW_REGISTER_2026-08-09.md` OWN-FIN-021 — **dosłowna specyfikacja właściciela**: wspólny `Finance Workspace Bar`, przepływ `Source → Assumptions → Methods & weights → Results → Sensitivity → Valuation Advisor → Export`, `Methods & weights` pozwala włączyć metody/warianty, ustawić wagi sumujące się do 100%, zobaczyć dostępność danych, wynik i wpływ na wynik ważony, metoda bez kompletnych danych jest `N/A` nie PLN 0, wagi są wersjonowanymi założeniami z walidacją, `Valuation Advisor` generuje rekomendacje/ryzyka/pytania/działania na podstawie wybranych metod/wyników/sensitivity/provenance, każda sugestia wskazuje dowód/driver/wpływ/confidence, odróżnia fakt od hipotezy, nie zastępuje zatwierdzenia człowieka, działa dopiero na aktualnie przeliczonym wariancie, wynik jest wersjonowany/eksportowalny.
3. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` — DEC-FIN-005 (**DECIDED**): metody dzielą się na koszyk rekomendacyjny (aktywne+kompletne, wagi sumujące do 100%) i nieważone cross-checki (niezależna perspektywa, disagreement, nie wpływają mechanicznie na wynik); brak danych = N/A/wyłączenie, nigdy zero; system ujawnia korelacje/wkład/ostrzega przed pseudodywersyfikacją. DEC-FIN-006 (**DECIDED**): Advisor działa przed formalnym approval wyłącznie na świeżej computed candidate version, nie zmienia danych, nie zatwierdza; Case zawiera wiele wariantów/wersji, każdy z nazwą/opisem/autorem/timestamp/source versions/assumption snapshot/compute run/historią porównawczą; Advisor analizuje pojedynczy wariant i różnice między wariantami; po approval raport zamrożony z wersją wyceny; ustalenia/warianty/dowody dostępne w kontekście TRS przez trwałe referencje do artifact/version IDs. DEC-FIN-011 (**DECIDED BY PROFESSIONAL STANDARD**): Valuation może wskazywać Baseline Model albo Scenario Version — Scenario **opcjonalne**.
4. `docs/validation/finance-v3/generated/gate-d/WP-D07_prediction_schema_ADR.md` (całość) — wzorzec ADR-u tego samego Gate'u: value bundle WP-B01 §2.7 reużyty dosłownie jako mechanizm "N/A≠zero" (sekcja 4 tego ADR-u stosuje go identycznie do `finance_valuation_methods.result_*`/`finance_valuation_comps.metric_*`), granica DB-cheap-detekcja/service-numeryczna-symulacja (sekcja 6.2/9 tego ADR-u), format testów żywych na efemerycznym Postgresie (sekcja 14 tego ADR-u), wzorzec "trigger nie CHECK dla reguł międzytabelowych" (Postgres nie pozwala subquery w CHECK).
5. `docs/validation/finance-v3/generated/gate-a/WP-A01_inventory_manifest.md` — trzy niezależne, nie-migrowane magazyny wyceny: `valuations`/`valuation_snapshots` (`server/migrations/571_valuation_t055_t056_t057.sql`, `MIGRATE_WITH_WARNING` — `advisory JSONB` bez struktury, `valuation_snapshots` bez `UNIQUE(valuation_id, version)`, strukturalnie możliwy duplikat wersji), oraz `financial_valuation_snapshots`/`financial_valuation_audit` (`server/migrations/20260719_baseline_gap.sql`, serwis `financeEnterpriseService.ts`, route `/api/finance-v4`, oznaczony deprecated w Gateway) — kontekst historyczny, **NIE duplikowany**: sekcja 12 tego ADR-u dokumentuje dokładnie, dlaczego żadna z tych tabel nie jest źródłem prawdy dla `finance_valuation_*`.
6. Dodatkowo (niewymienione w briefie, konieczne do niesprzeczności): `server/migrations/20260809_finance_v3_b01_core_artifacts.sql` (`finance_artifacts.artifact_type` CHECK **już zawiera** `'VALUATION_CASE'` — potwierdzone żywo; task-owy przykład `artifact_type='valuation'` to skrót właściciela, nie literalna wartość — ten ADR używa `'VALUATION_CASE'`, tak jak WP-D07 skorygowało analogiczny skrót dla `PREDICTION_SCENARIO`), `server/migrations/20260809_finance_v3_b03_lineage_freshness.sql` (`finance_lineage_edges.edge_type` CHECK **już zawiera** `MODEL_TO_VALUATION`/`SCENARIO_TO_VALUATION` z wymaganym `assumption_snapshot_hash`, ale **bez** enforcementu "co najwyżej jedno z dwóch" — luka, którą ten ADR domyka, sekcja 4.3), `server/src/services/finance/canonical/artifactVersionService.ts:389` (`approveVersion()`, już naprawione po BUG-GOLDCO-03 — reużyte bez zmian, sekcja 10), `server/migrations/20260809_finance_v3_b04_compute_jobs.sql`/`b06_reproducibility_retention_export.sql` (`compute_jobs`/`finance_compute_snapshots` kształt — Advisor freshness anchor, sekcja 9), oraz bezpośredni odczyt żywego schematu (`\d`) na świeżo zmigrowanej efemerycznej bazie (sekcja 14) — potwierdzenie dokładnych nazw kolumn zamiast polegania na cytatach z wcześniejszych ADR-ów.

---

## 2. Kontekst — co Gate B/C/D01/D03/D05/D07 już daje, NIE duplikujemy

- `finance_artifacts.artifact_type` CHECK enum **już zawiera** `'VALUATION_CASE'` (potwierdzone żywo, `\d finance_artifacts`) — jeden Valuation **wariant** to jeden `finance_business_versions` wiersz z `finance_artifacts.artifact_type='VALUATION_CASE'`. `DRAFT→READY_FOR_REVIEW→IN_REVIEW→APPROVED→SUPERSEDED/ARCHIVED/INVALIDATED`, maker-checker, immutable-Approved trigger (`trg_finance_bv_immutability`), `risk_tier`, reopen/`vN+1` — wszystko odziedziczone, bez zmian.
- `finance_lineage_edges.edge_type` CHECK enum **już zawiera** `MODEL_TO_VALUATION` i `SCENARIO_TO_VALUATION`, oba z wymaganym (`NOT NULL`) `assumption_snapshot_hash` (potwierdzone żywo, `\d finance_lineage_edges` — patrz `chk_finance_lineage_assumption_hash`). Valuation wskazuje **exact Approved Baseline Model albo Scenario Version** wyłącznie przez tę krawędź — `finance_valuation_variants` **świadomie nie ma** kolumny `source_baseline_business_version_id`/`source_scenario_business_version_id` (ta sama decyzja i uzasadnienie co WP-D05 §2.3 i WP-D07 §2 dla ich odpowiedników: dwie denormalizowane kolumny obok istniejącej krawędzi dałyby dwa niezsynchronizowane źródła prawdy). Czego WP-B03 **nie** dało: enforcementu "co najwyżej jedna z dwóch krawędzi per target" — `finance_artifact_stage_rank()` (WP-B03 §4) sam w sobie nie przeszkadza, żeby JEDEN wariant miał WEDNOCZEŚNIE `MODEL_TO_VALUATION` i `SCENARIO_TO_VALUATION` skierowane do niego. Sekcja 4.3 tego ADR-u domyka tę lukę częściowym unikalnym indeksem, dokładnie tym samym idiomem co `uq_finance_bv_one_approved` (WP-B01) już stosuje dla "co najwyżej jeden APPROVED per artifact".
- `finance_value_status` ENUM i obowiązkowy bundle WP-B01 §2.7 — `finance_valuation_methods.result_*` i `finance_valuation_comps.metric_*` przyjmują ten bundle dosłownie, jak `finance_baseline_outputs`/`finance_analysis_kpi_values`/`finance_prediction_outputs`. To jest bezpośrednia, **fizyczna** realizacja "N/A nigdy zerem" — nie nowy mechanizm, tylko trzeci/czwarty zastosowanie tego samego.
- `finance_business_versions.risk_tier` (Gate B Integration Reconciliation §2) — reużyty bez zmian dla "kto może zatwierdzić koszyk metod przy materialnej zmianie wag" (sekcja 6.4) — ta sama maker-checker infrastruktura co reszta programu (DEC-FIN-001), nie nowy mechanizm SoD.
- `compute_jobs`/`compute_job_runs`/`compute_job_outputs` (WP-B04) — Compute Run dla Valuation to `job_type='VALUATION_COMPUTE'` (sekcja 9.2 — dokumentowana rozbieżność od zarezerwowanego `valuation_compute`, ten sam precedens co WP-D06 ustanowiło dla `BASELINE_COMPUTE`/`model_compute` i WP-D07 dla `PREDICTION_COMPUTE`/`prediction_compute`). Nie tworzę nowej kolejki.
- `finance_compute_snapshots` (WP-B06 §3.2, append-only, `trg_finance_compute_snapshots_deny_update`/`_delete`) — reużyty jako **jedyny freshness anchor** dla Valuation Advisor (sekcja 8) — Advisor FK-uje do `compute_snapshot_id`, nie do `business_version_id` wprost, żeby "świeża computed candidate" była faktem strukturalnym, nie konwencją czasową.
- `server/src/services/finance/canonical/artifactVersionService.ts:389` `approveVersion()` (już naprawione po BUG-GOLDCO-03 — kolejność UPDATE-ów parent-supersede przed child-approve w tej samej transakcji, żeby `uq_finance_bv_one_approved` partial unique index nie kolidował sam ze sobą) — reużyty **bez żadnej zmiany kodu**. Sekcja 10 pokazuje dokładnie, że freeze Advisora (wymaganie zadania #6) i idempotent-retry approval (wymaganie zadania #7) są konsekwencją TRIGGERÓW na już-istniejącej tabeli `finance_business_versions`, nie nowej logiki w serwisie.
- `finance_exceptions`/`finance_exceptions_current` (WP-B05) — analogiczna rola co w WP-D05/D07: readiness gate dla `job_type='VALUATION_COMPUTE'` (sekcja 9.2) reużywa `NO_OPEN_UNDEFINED_MATH`, żaden nowy blocking-mechanizm nie jest tu wymyślany.
- `valuations`/`valuation_snapshots`/`financial_valuation_snapshots`/`financial_valuation_audit` (Gate A legacy, sekcja 1 pkt 5) — **kontekst historyczny, nie duplikowany**. Żadna z tych czterech tabel nie ma osobnego wiersza per metoda, nie ma value-status bundle (silent-zero strukturalnie możliwy), nie ma multi-variant Case (jeden `valuation_id` = jeden ciąg wersji, nie kontener wielu nazwanych wariantów), i żadna nie ma FK do `finance_lineage_edges`. Migracja tych danych do `finance_valuation_*` jest zakresem przyszłego Gate C/WP-D09b backfill, nie tego ADR-u — sekcja 12 rozwija.

---

## 3. Decyzja — skrót

Dwanaście nowych tabel z prefiksem `finance_valuation_` — dziesięć dosłownie z zadania (dwie z nich rozbite na header+child dla "jawnej sekwencji"/"many-to-many", bez zmiany liczby koncepcyjnych bytów), plus dwie bridge/child tabele uzasadnione poniżej:

1. `finance_valuation_cases` — kontener, NIE jest wersjonowanym artefaktem (sekcja 4.1).
2. `finance_valuation_variants` — jeden wiersz per `business_version_id`, `artifact_type='VALUATION_CASE'`, wiele wariantów per Case (sekcja 4.2).
3. `finance_valuation_wacc_inputs` — jeden wiersz per wariant, pełny bundle WACC (sekcja 6).
4. `finance_valuation_methods` — per wariant, jeden wiersz per `method_type`, koszyk/cross-check + N/A≠zero + suma wag=100 (sekcja 7 — **flagowy mechanizm tego ADR-u**).
5. `finance_valuation_terminal` — per metoda, Gordon/exit multiple jako alternatywne konwencje, `g < WACC` fizycznie wymuszone (sekcja 8).
6. `finance_valuation_ev_equity_bridge` (header) + `finance_valuation_ev_equity_bridge_components` (child, "jawna sekwencja") — as_of alignment fizycznie wymuszone (sekcja 9).
7. `finance_valuation_sensitivity_grids` (header) + `finance_valuation_sensitivity_cells` (child) — 25 komórek + dokładnie 1 base_cell fizycznie wymuszone przy `grid_status='COMPLETE'` (sekcja 10).
8. `finance_valuation_comps` — peer table, value bundle, readiness gate przeciw "0 comps ale READY" (sekcja 11).
9. `finance_valuation_advisor_outputs` — facts/hypotheses/risks/questions/actions, freeze-on-approval, stale-on-recompute, AI policy (sekcja 12).
10. `finance_valuation_advisor_output_variants` (poza dosłowną listą z zadania, ale nie nowy koncept — realizacja many-to-many compare żądanej wprost) — bridge table łącząca jeden Advisor finding z N porównywanymi wariantami (sekcja 12.4).

**Case ≠ Variant, i to jest inny kształt niż wszystkie poprzednie Gate D domeny.** Statement/Analysis/Baseline/Scenario mają **jeden** ciąg wersji per artefakt. Valuation ma **wiele niezależnych, równoległych ciągów wersji (wariantów)** grupowanych pod jednym Case — stąd potrzeba DODATKOWEGO poziomu kontenera nad `finance_artifacts`/`finance_business_versions`, którego żadna wcześniejsza domena nie potrzebowała (sekcja 4.1/4.2 rozwija to rozróżnienie i dlaczego jest ono wymagane dosłownym brzmieniem DEC-FIN-006: "Jedna Valuation Case może zawierać wiele wariantów i wersji").

**N/A nigdy zerem — fizycznie, nie konwencją** (sekcja 7.2): `finance_valuation_methods.result_value_status`/`result_ev_decimal` reużywa bundle WP-B01 §2.7 (value_decimal NULL wyłącznie gdy status∈{MISSING,NA,NOT_APPLICABLE}), PLUS nowy `chk_finance_methods_result_matches_readiness` — `readiness='NOT_CONFIGURED'`/`'DATA_INCOMPLETE'`/`'COMPUTE_FAILED'` fizycznie WYMAGA braku wyniku (MISSING/NA), `readiness='READY'` fizycznie WYMAGA obecnego wyniku. Nie da się zapisać `NOT_CONFIGURED` z `result_ev_decimal=0` — **przetestowane żywo, TEST 5** (odrzucone).

**Suma wag koszyka = 100, albo 0 gdy pusty koszyk (DRAFT)** (sekcja 7.3): deferred constraint trigger (`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`) sumujący `weight_pct` po `business_version_id` dla `is_in_recommendation_basket=true`, sprawdzany na końcu transakcji, nie po każdym pojedynczym INSERT/UPDATE — pozwala na atomowy "rebalans 3 metod" bez fałszywego czerwonego światła w połowie transakcji. Żaden istniejący WP (B01–D07) nie miał precedensu tego idiomu (sprawdzone przeszukaniem wszystkich ADR-ów) — udokumentowane jako nowe, nie reużyte. **Przetestowane żywo**: 60+40=100 zatwierdzone przy COMMIT (TEST 7), 60+40+10=110 odrzucone przy COMMIT (TEST 8). Cross-check metody (poza koszykiem) mają `weight_pct` fizycznie `NULL`, nigdy `0` — osobny CHECK, **przetestowane żywo** (TEST 9 odrzucone, TEST 10 przyjęte).

**Valuation Advisor freeze — konsekwencja triggerów na już-istniejącej tabeli, zero nowej logiki w `approveVersion()`** (sekcja 12.3): jeden trigger `AFTER UPDATE OF status ON finance_business_versions` (fires dla KAŻDEGO artefaktu w systemie, nieszkodliwy no-op dla nie-Valuation) zamraża wszystkie nie-zamrożone `finance_valuation_advisor_outputs` powiązane z tym `business_version_id` w momencie, gdy status przechodzi na `APPROVED` — dokładnie ta sama, niezmodyfikowana transakcja `approveVersion()`, żadnego nowego call site'u. Drugi trigger (`BEFORE UPDATE OR DELETE`) blokuje KAŻDĄ dalszą mutację zamrożonego wiersza. Trzeci trigger (`AFTER UPDATE OF compute_snapshot_id`) oznacza starsze, niezamrożone findingi jako `is_stale=true` (nigdy nie kasowane) przy recompute. **Przetestowane żywo**: freeze (TEST 25 `is_frozen=true`), immutability po freeze (TEST 26 odrzucone), staleness na recompute (TEST 24 `is_stale=true`), brak nowych insertów po approval (TEST 28 odrzucone), many-to-many compare (TEST 29/30).

**Dowód testowy**: DDL uruchomiony na jednorazowym efemerycznym Postgresie (PostgreSQL 15.15, port 58311, `LC_ALL=C`, `initdb --locale=C`, `/private/tmp/wp_d09_pgdata`, `pg_ctl stop`+`rm -rf` na koniec, PID 911 nietknięty, potwierdzone `ps aux`), zbudowany na pełnym stosie Gate B/C migracji (`b01`…`b07`, bez modyfikacji), 30 scenariuszy przechodzących żywo (sekcja 14) — żadna baza produkcyjna/demo/dev nie była dotknięta, zgodnie z twardym zakazem tego zadania.

---

## 4. Case, warianty i lineage exclusivity

### 4.1 `finance_valuation_cases`

`case_id`, `organization_id`, `name`, `description`, `created_by`, `created_at`, `archived_*`. **Świadomie NIE jest** `finance_artifacts`/`finance_business_versions` — nie ma lifecycle DRAFT→APPROVED, nie ma `risk_tier`, nie jest liniowo wersjonowana. Uzasadnienie: Case jest czystym kontenerem nazewniczym/grupującym ("GoldCo Enterprise Value FY2026-2028"), a to WARIANTY wewnątrz Case'a niosą lifecycle, approval i historię — dokładnie jak katalog nie jest plikiem. Próba nadania Case'owi własnego lifecycle wymagałaby odpowiedzi na pytanie "co znaczy Approved Case, skoro jego warianty mogą być w różnych stanach jednocześnie" — DEC-FIN-006 nie daje na to odpowiedzi (i nie musi: żaden `artifact_type` w WP-B01 nie odpowiada koncepcyjnie "Case", tylko "Variant" jako `VALUATION_CASE`).

### 4.2 `finance_valuation_variants`

`id`, `business_version_id` (`UNIQUE`, FK złożony do `finance_business_versions(business_version_id, organization_id)`), `organization_id`, `case_id` (FK), `name`, `description`, `created_by`, `created_at`. Ten sam wzorzec co `finance_prediction_scenarios` (WP-D07 §4.1): "jeden wiersz per business_version_id", **świadomie brak kolumny źródła**. `name`/`description` są tu domenowe z tego samego powodu co WP-D07 ustaliło dla scenariuszy — `finance_artifacts` nie ma pola nazwy (potwierdzone żywo), a Compare 2-4 wariantów (handoff §9 "Variant compare jest funkcją podstawową") wymaga ludzko czytelnej etykiety per wersja.

**Przetestowane żywo**: TEST 1 (wariant + `MODEL_TO_VALUATION` edge), TEST 3 (DRUGI, niezależny wariant tego samego Case'a, `SCENARIO_TO_VALUATION` edge) — potwierdza multi-variant Case fizycznie działa z dwoma różnymi typami źródła jednocześnie w obrębie jednego kontenera.

### 4.3 Lineage exclusivity — luka WP-B03 domknięta

```sql
CREATE UNIQUE INDEX uq_finance_lineage_edges_one_valuation_source
  ON finance_lineage_edges (target_version_id)
  WHERE edge_type IN ('MODEL_TO_VALUATION', 'SCENARIO_TO_VALUATION');
```

Dokładnie ten sam idiom co `uq_finance_bv_one_approved` (WP-B01, partial unique index realizujący "co najwyżej jeden wiersz spełniający warunek X" na zbiorze kandydatów, gdzie same-row CHECK nie działa, bo oba kandydaci żyją w RÓŻNYCH wierszach tej samej tabeli). To NIE jest zmiana schematu `finance_lineage_edges` (żadna kolumna/CHECK nie jest dotykana) — jest to dodatkowy indeks, bezpiecznie addytywny. **Przetestowane żywo**: TEST 2 — próba dodania `SCENARIO_TO_VALUATION` do celu, który już ma `MODEL_TO_VALUATION`, odrzucona z `duplicate key value violates unique constraint`.

**"Nigdy neither, poza DRAFT" NIE jest tu egzekwowane schematem** — świadomie: wariant musi być tworzalny (INSERT do `finance_valuation_variants`) ZANIM źródło jest wybrane (Source jest pierwszym krokiem UI flow z OWN-FIN-021, ale to nie znaczy "atomowy z utworzeniem wiersza"). Egzekwowanie "musi mieć dokładnie jedno źródło zanim compute/approval" należy do readiness gate (`finance_valuation_can_start_compute()`, analog `finance_prediction_can_start_compute()` z WP-D07 §6.2 — kontrakt, sekcja 13, nie zaimplementowany w tym ADR-ie, ta sama granica co WP-D07 ustaliło dla dwuetapowego compute).

---

## 5. FCFF — jawny kontrakt formuły

```
FCFF = EBIT × (1 − cash_tax_rate) + D&A − ΔWC − CAPEX
```

**Żadna z tych czterech wejść nie jest duplikowana w schemacie Valuation.** Zgodnie z zadaniem ("skąd pochodzą wejścia — z `finance_baseline_outputs` lub `finance_prediction_outputs_effective` przez lineage, nie duplikowane"):

- Jeśli wariant ma `MODEL_TO_VALUATION` edge → EBIT/D&A/ΔWC/CAPEX czytane bezpośrednio z `finance_baseline_outputs` (WP-D05 §4.4) po `canonical_line_id` przez `source_version_id` krawędzi.
- Jeśli wariant ma `SCENARIO_TO_VALUATION` edge → te same linie czytane z `finance_prediction_outputs_effective` VIEW (WP-D07 §8.3) — co automatycznie i przezroczyście obsługuje `STANDARD_BASE` (passthrough do `finance_baseline_outputs`, WP-D07's własna "Base=Baseline" gwarancja) I realnie przeliczone scenariusze, bez żadnej specjalnej logiki po stronie Valuation.

`finance_valuation_methods` **nie ma** kolumn `ebit`/`d_and_a`/`delta_wc`/`capex` — tylko `result_ev_decimal` (wyjście). To jest ta sama decyzja co WP-D07 §2 podjęło dla `finance_prediction_scenarios` względem `finance_baseline_assumptions` — kopiowanie wejść tworzyłoby drugie źródło prawdy, które mogłoby się rozjechać z oryginałem po jego restatement/recompute. Cross-table odczyt EBIT/D&A/ΔWC/CAPEX per okres horyzontu i faktyczne zdyskontowanie do `result_ev_decimal` jest zakresem przyszłego Valuation Compute WP (analog WP-D06/WP-D08), tu jedynie **kontraktowany**, nie implementowany — ta sama granica co WP-D03 §6.3/WP-D07 §7.2 ustaliły wielokrotnie dla "Warstwa 2, service, nie w tym ADR-ie".

---

## 6. WACC — bundle i spójność

`finance_valuation_wacc_inputs` (jedna per wariant): `risk_free_rate_pct`, `equity_risk_premium_pct`, `beta_peer_set_ref` (JSONB **wskaźnik** do `finance_valuation_comps` używanych do beta — nie kopia, ten sam "pointer nie kopia" wzorzec co `beta_peer_set_ref`), `beta_unlevered`/`beta_relevered`, `target_capital_structure_debt_pct`/`_equity_pct`, `current_capital_structure_debt_pct`/`_equity_pct`, `cost_of_debt_pretax_pct`, `credit_spread_pct`, `cash_tax_rate_pct` (steruje tax shield), `currency`, `nominal_or_real` CHECK, `pre_or_post_tax` CHECK, `wacc_computed_pct` (wynik, `NULL` dopóki nie policzony — bez silent zero).

**Kapitał structure sum ≤ tolerancja, nie exact equality** (DEC-FIN-009: source-rounding tolerance): `chk_finance_wacc_target_structure_sum`/`chk_finance_wacc_current_structure_sum` — `abs(debt_pct + equity_pct − 100) <= 0.01`, nie `= 100` dosłownie (wejście z arkuszy/peer źródeł ma zaokrąglenia). **Przetestowane żywo**: TEST 11 (30+70, 25+75 — przyjęte), TEST 12 (30+65=95 — odrzucone).

**Currency/nominal-real/pre-post-tax spójność jest kontraktem cross-table, NIE tabelowym CHECK-iem w tym ADR-ie** — sprawdzenie, że `wacc_inputs.currency` zgadza się z walutą prezentacji cashflows użytych w FCFF (z `finance_baseline_outputs`/`finance_prediction_outputs_effective`), i że `nominal_or_real`/`pre_or_post_tax` konwencja WACC zgadza się z konwencją `g` w `finance_valuation_terminal`, wymaga odczytu przez dwie różne domeny jednocześnie w service layer — ta sama granica co "Warstwa 2, nie w tym ADR-ie" (sekcja 5). Sekcja 15 pkt 2 eskaluje to jako otwarty punkt dla przyszłego Valuation Compute WP.

---

## 7. `finance_valuation_methods` — flagowy mechanizm: koszyk/cross-check, N/A≠zero, suma=100

### 7.1 Kształt

`business_version_id`, `method_type` CHECK (`DCF_FCFF`/`DCF_FCFE`/`DIVIDEND_DISCOUNT`/`TRADING_COMPS`/`PRECEDENT_TRANSACTIONS`/`ASSET_BASED`/`OTHER_WITH_POLICY`) — zadanie wymienia dosłownie `DCF_FCFF`/`TRADING_COMPS`/`PRECEDENT_TRANSACTIONS`/"inne"; `OTHER_WITH_POLICY` realizuje "inne metody tylko z applicability policy" (handoff §9) fizycznie: `chk_finance_methods_other_policy` wymaga `applicability_policy_ref NOT NULL` dokładnie wtedy, gdy `method_type='OTHER_WITH_POLICY'`. `UNIQUE(business_version_id, method_type)` — jeden wiersz per typ metody per wariant (wielokrotne DCF-y różniące się tylko założeniami wymagają osobnych wariantów, nie osobnych wierszy tej samej metody — udokumentowana granica P0, sekcja 15 pkt 3).

### 7.2 N/A nigdy zerem — dwuwarstwowa gwarancja fizyczna

Warstwa 1 (reużyta): `result_value_status finance_value_status` + `result_ev_decimal` — bundle WP-B01 §2.7 verbatim (`chk_finance_methods_result_bundle`).

Warstwa 2 (nowa w tym ADR-ie): `chk_finance_methods_result_matches_readiness` — krzyżowa blokada między `readiness` i `result_value_status`:

```sql
CONSTRAINT chk_finance_methods_result_matches_readiness CHECK (
  (readiness IN ('NOT_CONFIGURED', 'DATA_INCOMPLETE', 'COMPUTE_FAILED')
     AND result_value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE'))
  OR (readiness = 'READY' AND result_value_status IN ('PRESENT_ZERO', 'PRESENT_NONZERO'))
);
```

To domyka lukę, którą sam bundle WP-B01 §2.7 zostawia otwartą: bundle gwarantuje "status i wartość są spójne ze sobą", ale NIE gwarantuje "metoda bez kompletnych danych faktycznie ma taki status" — bez tego drugiego CHECK-a nic nie stałoby na przeszkodzie, żeby `readiness='READY'` współistniało z `result_value_status='MISSING'` (metoda "gotowa" bez wyniku) albo `readiness='NOT_CONFIGURED'` z `result_value_status='PRESENT_ZERO'` (dokładnie ten silent-zero, którego zadanie zakazuje wprost: "NIGDY result=0"). **Przetestowane żywo**: TEST 5 (`NOT_CONFIGURED`+`PRESENT_ZERO`/0 — odrzucone), TEST 6 (`READY`+`MISSING` — odrzucone), TEST 4 (`NOT_CONFIGURED`+domyślny `MISSING` — przyjęte).

### 7.3 Koszyk ważony sumujący do 100%, cross-check zawsze `weight_pct IS NULL`

```sql
CONSTRAINT chk_finance_methods_weight_basket_only CHECK (
  (is_in_recommendation_basket = false AND weight_pct IS NULL)
  OR (is_in_recommendation_basket = true AND weight_pct IS NOT NULL)
);
```

Same-row CHECK powyżej gwarantuje "cross-check nigdy nie ma wagi (NULL, nie 0)" — **przetestowane żywo**, TEST 9 (`is_in_basket=false`+`weight_pct=0` odrzucone), TEST 10 (`is_in_basket=false`+`weight_pct=NULL` przyjęte).

Sumę wag (cross-row, per `business_version_id`) CHECK wyrazić nie może (Postgres CHECK ma zasięg jednego wiersza) — stąd `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`, pierwszy taki idiom w całym programie Finance v3 (sprawdzone: brak precedensu w WP-B01–WP-D07):

```sql
CREATE OR REPLACE FUNCTION finance_valuation_check_basket_weight_sum() RETURNS TRIGGER AS $$
DECLARE v_bv_id TEXT; v_count INTEGER; v_sum NUMERIC;
BEGIN
  v_bv_id := COALESCE(NEW.business_version_id, OLD.business_version_id);
  SELECT count(*), coalesce(sum(weight_pct), 0) INTO v_count, v_sum
    FROM finance_valuation_methods
    WHERE business_version_id = v_bv_id AND is_in_recommendation_basket = true;
  IF v_count > 0 AND abs(v_sum - 100) > 0.01 THEN
    RAISE EXCEPTION 'finance_valuation_methods: basket weights for business_version % sum to % (must be 100, or 0 basket rows for DRAFT)', v_bv_id, v_sum;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_finance_valuation_methods_weight_sum
  AFTER INSERT OR UPDATE OR DELETE ON finance_valuation_methods
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_check_basket_weight_sum();
```

`DEFERRABLE INITIALLY DEFERRED` jest load-bearing, nie kosmetyczny: bez tego, wstawienie trzech wierszy koszyka 34/33/33 w JEDNEJ transakcji failowałoby na PIERWSZYM insercie (34≠100), mimo że transakcja jako całość jest poprawna. Odroczenie do końca transakcji pozwala na atomowy multi-row zapis/edycję, sprawdzany raz, dokładnie zgodnie z "Wagi i koszyk metod są wersjonowanymi założeniami z walidacją" (OWN-FIN-021) — walidacja całości, nie każdego kroku pośredniego. **Przetestowane żywo**: TEST 7 (60+40=100, COMMIT przyjęty), TEST 8 (60+40+10=110, COMMIT odrzucony z dokładnym komunikatem sumy). Zero wierszy koszyka (DRAFT, nikt jeszcze nic nie wybrał) przechodzi trywialnie (`v_count=0`, warunek nie wchodzi) — dosłowna realizacja "albo być 0 jeśli żadna metoda nie jest jeszcze w koszyku".

### 7.4 Korelacja/wkład/disagreement — poza schematem

Handoff §9 wymaga: "System pokazuje correlation, contribution i disagreement." To są zapytania nad już-przechowanymi `result_ev_decimal`/`weight_pct` (korelacja par metod w czasie wymagałaby historii wielu compute runów tej samej metody, dostępnej przez `finance_business_versions` reopen/vN+1 chain) — nie osobna struktura, zakres przyszłego Valuation Compute/UI WP, nie tego ADR-u.

### 7.5 Maker-checker dla materialnej zmiany koszyka

`finance_business_versions.risk_tier` (reużyty, sekcja 2) — zmiana koszyka/wag na wariancie z `risk_tier IN ('MATERIAL','HIGH_RISK')` przechodzi przez tę samą infrastrukturę co reszta programu (submit-for-review zamraża `risk_tier`, `403 SELF_APPROVAL_FORBIDDEN` przy próbie samo-zatwierdzenia). Żaden nowy mechanizm SoD nie jest tu projektowany.

---

## 8. Terminal — Gordon vs exit multiple, `g < WACC` fizycznie

`finance_valuation_terminal`, per `method_id` (nie per wariant — Trading Comps/Precedent Transactions nie mają terminal value w tym sensie), `UNIQUE(method_id, convention)` — pozwala na DWA wiersze per metoda DCF: jeden `GORDON_GROWTH` (główny), jeden `EXIT_MULTIPLE` (cross-check), `is_primary` oznacza który zasila headline wynik metody.

XOR pól per konwencja (ten sam wzorzec co WP-D07's `driver_schedule_type`+`driver_code` XOR `kpi_catalog_id`):

```sql
CONSTRAINT chk_finance_terminal_convention_fields CHECK (
  (convention = 'GORDON_GROWTH' AND g_pct IS NOT NULL AND exit_multiple_value IS NULL)
  OR (convention = 'EXIT_MULTIPLE' AND exit_multiple_value IS NOT NULL AND g_pct IS NULL)
);
```

**`g < WACC` fizycznie wymuszone, trigger nie CHECK** (cross-table read do `finance_valuation_wacc_inputs`, Postgres zakazuje subquery w CHECK — ta sama przyczyna, którą WP-D01/D05/D07 już dokumentowały wielokrotnie dla analogicznych reguł). Enforced WYŁĄCZNIE gdy `wacc_computed_pct` jest już obliczone (`IS NOT NULL`) — DEC-FIN-009: nie blokuje wpisywania założeń roboczych, zanim WACC istnieje. **Przetestowane żywo**: TEST 13 (`g=9.5`, `WACC=9.5` — odrzucone, `g` musi być ŚCIŚLE mniejsze), TEST 14 (`g=2.5 < WACC=9.5` — przyjęte), TEST 15 (drugi wiersz, `EXIT_MULTIPLE` cross-check dla tej samej metody — przyjęty równolegle).

`g = reinvestment_rate × ROIC` (handoff §9, drugi cross-check formula) — kolumny `reinvestment_rate_pct`/`roic_pct` istnieją na tabeli jako **wejścia dokumentujące uzasadnienie `g`**, ale relacja `g = reinvestment_rate × ROIC` NIE jest CHECK-iem (to jest heurystyka sprawdzająca rozsądność `g`, nie twarda matematyczna tożsamość, którą trzeba egzekwować identycznie jak `g < WACC` — analityk może świadomie wybrać `g` niezgodne z tym uproszczonym wzorem i to nie jest błędem, tylko odstępstwem wymagającym `rationale`, tej samej klasy jak `finance_baseline_assumptions.rationale`). Steady-state margins/CAPEX/WC (handoff §9) żyją w `finance_baseline_outputs`/`finance_prediction_outputs_effective` (ostatni okres horyzontu), nie duplikowane tutaj — ten sam "nie kopiuj wejść" argument co sekcja 5.

---

## 9. EV→Equity bridge — jawna sekwencja, as_of alignment fizycznie wymuszone

Header `finance_valuation_ev_equity_bridge` (jeden per wariant, `as_of_date` kanoniczny) + child `finance_valuation_ev_equity_bridge_components` (`sequence_order`, `component_kind` CHECK 10 wartości z handoff §9 dosłownie: debt/leases/pensions-provisions/minorities/associates-investments/cash/restricted-cash/non-operating-assets/options-dilution/other, `sign` CHECK `SUBTRACT_FROM_EV`/`ADD_TO_EV` **jawny, nie wywnioskowany z wartości** — ten sam problem klasy jak WP-D07's `impact_chain.sign`).

**As_of alignment — trigger, nie CHECK**, bo cross-row (component vs sibling header):

```sql
CREATE OR REPLACE FUNCTION finance_bridge_check_as_of_alignment() RETURNS TRIGGER AS $$
DECLARE v_header_as_of DATE;
BEGIN
  SELECT as_of_date INTO v_header_as_of FROM finance_valuation_ev_equity_bridge WHERE id = NEW.bridge_id;
  IF NEW.as_of_date <> v_header_as_of THEN
    RAISE EXCEPTION 'finance_valuation_ev_equity_bridge_components: component as_of_date % does not match bridge header as_of_date % (bridge %)', NEW.as_of_date, v_header_as_of, NEW.bridge_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Świadomie stroższe niż DEC-FIN-009's Info/Warning/Material/Critical tiery** — misaligned as-of dates w bridge'u (np. dług na 30.06, pensje na 31.03) produkują liczbę bez zdefiniowanego znaczenia w danym momencie, co ten ADR czyta jako tę samą klasę problemu co DEC-FIN-009 samo już wyklucza z tolerancji ("matematycznie nieokreślona operacja" — jeden z dwóch jedynych dopuszczalnych hard-blocków obok security/tenant breach). To jest osąd zawodowy tego ADR-u, nie bezpośrednia cytata DEC-FIN-009 — **flagowane do potwierdzenia właściciela w sekcji 15 pkt 1** jako jedyne miejsce, gdzie ten ADR czyta DEC-FIN-009 surowiej niż jego dosłowne brzmienie. **Przetestowane żywo**: TEST 16 (dwa komponenty, ten sam `as_of_date` — przyjęte), TEST 17 (komponent z innym `as_of_date` — odrzucony).

---

## 10. Sensitivity 5×5 — fizyczna struktura, monotoniczność poza zakresem

`finance_valuation_sensitivity_grids` (header, per metoda — `UNIQUE(method_id, grid_label)`, pozwala na wiele grid'ów per metoda, np. WACC×g i WACC×exit-multiple równolegle) + `finance_valuation_sensitivity_cells` (`row_index`/`col_index` `CHECK BETWEEN 1 AND 5`, `UNIQUE(grid_id, row_index, col_index)`, `is_base_cell`).

25-komórek + dokładnie-1-base-cell enforced **wyłącznie gdy `grid_status='COMPLETE'`** — mirror WP-D05's readiness-gate wzorzec (Draft grid może być rzadko wypełniony podczas edycji, ta sama filozofia jak `finance_baseline_readiness_check()`'s "brak wiersza ≠ wiersz MISSING" naprawa z WP-D05 §12 pkt 2, tu zastosowana proaktywnie, nie po fakcie):

```sql
CREATE CONSTRAINT TRIGGER trg_finance_sensitivity_cells_grid_complete
  AFTER INSERT OR UPDATE OR DELETE ON finance_valuation_sensitivity_cells
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_sensitivity_check_grid_complete();
```

(plus lustrzany trigger na `grid_status` UPDATE samego headera, dla przypadku "wszystkie 25 komórek już są, teraz user flaguje grid jako COMPLETE"). **Przetestowane żywo**: TEST 18 (20 komórek + `COMPLETE` przy COMMIT — odrzucone), TEST 19 (25 komórek + 1 base cell + `COMPLETE` — przyjęte), TEST 20 (25 komórek + 2 base cells + `COMPLETE` — odrzucone).

**Monotoniczność jest EXPLICITE poza zakresem tego ADR-u** (zadanie punkt 5, dosłownie: "property do przetestowania... w pakiecie kompute") — nie jest to przeoczenie, jest to granica zgodna z poleceniem. `cell_value_decimal` jest `NUMERIC` bez CHECK-a porównującego sąsiednie komórki (taki CHECK wymagałby subquery, tego samego ograniczenia Postgresa co gdzie indziej, i tak czy inaczej byłby przedwczesny bez znanego kierunku monotoniczności per `row_axis_variable`/`column_axis_variable`, który jest właściwością SILNIKA, nie schematu).

---

## 11. `finance_valuation_comps` — peer table, readiness gate przeciw pustce udającej gotowość

Value bundle (WP-B01 §2.7) na `metric_value_status`/`metric_value_decimal` — peer metryki też bywają MISSING/NA. `is_outlier_excluded`+`exclusion_rationale` (`chk_finance_comps_exclusion_rationale` — wymagany, gdy wykluczony, ta sama "nigdy cichej decyzji" filozofia co reszta programu).

**Readiness gate zamykający WP-D05's "SQL cicho pomija to, czego nie ma" pułapkę** (WP-D05 §12 pkt 2 — brak wiersza ≠ wiersz MISSING, ten sam wzorzec błędu w nowej postaci): metoda `TRADING_COMPS`/`PRECEDENT_TRANSACTIONS` NIE MOŻE przejść na `readiness='READY'`, dopóki nie ma co najmniej jednego nie-wykluczonego, obecnego (`PRESENT_*`) wiersza w `finance_valuation_comps`:

```sql
CREATE OR REPLACE FUNCTION finance_valuation_methods_check_comps_readiness() RETURNS TRIGGER AS $$
DECLARE v_usable_comps INTEGER;
BEGIN
  IF NEW.readiness = 'READY' AND NEW.method_type IN ('TRADING_COMPS', 'PRECEDENT_TRANSACTIONS') THEN
    SELECT count(*) INTO v_usable_comps FROM finance_valuation_comps
      WHERE method_id = NEW.id AND is_outlier_excluded = false
        AND metric_value_status IN ('PRESENT_ZERO', 'PRESENT_NONZERO');
    IF v_usable_comps = 0 THEN
      RAISE EXCEPTION 'finance_valuation_methods: method % (%) cannot be READY with zero usable comps rows', NEW.id, NEW.method_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Bez tego triggera "0 comps skonfigurowanych" i "READY z pustym peer setem" byłyby nieodróżnialne z perspektywy `finance_valuation_methods` samej w sobie — dokładnie handoff §9's "Brak comps = Not configured + CTA" wymaga, żeby to rozróżnienie było fizyczne, nie tylko UI-owe. **Przetestowane żywo**: TEST 21 (0 comps, próba `READY` — odrzucona), TEST 22 (1 usable comp, `READY` — przyjęte).

---

## 12. Valuation Advisor — freeze, staleness, many-to-many compare, TRS refs, polityka AI

### 12.1 Freshness anchor — `compute_snapshot_id`, nie `business_version_id`

`finance_valuation_advisor_outputs.compute_snapshot_id NOT NULL REFERENCES finance_compute_snapshots(compute_snapshot_id)` (append-only, WP-B06). To jest fizyczna realizacja "Advisor działa... wyłącznie na świeżej computed candidate version" — Advisor FK-uje do KONKRETNEGO, niemutowalnego zrzutu compute, nie do wariantu jako takiego (który JEST mutowalny w Draft). Gdy wariant jest przeliczony ponownie, powstaje NOWY `finance_compute_snapshots` wiersz (WP-B06 append-only) — stary FK Advisora pozostaje wskazujący na stary, teraz nieaktualny snapshot, co jest DOKŁADNIE sygnałem staleness (sekcja 12.2), nie usterką.

### 12.2 Staleness na recompute — oznaczenie, nigdy kasowanie

```sql
CREATE OR REPLACE FUNCTION finance_valuation_mark_advisor_stale_on_recompute() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.compute_snapshot_id IS DISTINCT FROM OLD.compute_snapshot_id THEN
    UPDATE finance_valuation_advisor_outputs
      SET is_stale = true, stale_since = now()
      WHERE business_version_id = NEW.business_version_id
        AND is_frozen = false
        AND compute_snapshot_id IS DISTINCT FROM NEW.compute_snapshot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_bv_mark_advisor_stale_on_recompute
  AFTER UPDATE OF compute_snapshot_id ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_mark_advisor_stale_on_recompute();
```

Zaczepione na `finance_business_versions.compute_snapshot_id` (kolumna już denormalizowana na wersji, WP-B01 §3 / WP-B06 §3.2-3.3) — NIE na `finance_compute_snapshots` wprost, bo ta ostatnia nie niesie `business_version_id` (tylko `artifact_id`+`working_revision_id`; joinowanie przez working revisions byłoby niejednoznaczne podczas Draft — patrz odrzucona alternatywa poniżej). To jest dokładnie sygnał "ten wariant został przeliczony" (recompute commituje nowy snapshot i repoint'uje wersję na niego), bez potrzeby przechodzenia przez `finance_working_revisions`. **Przetestowane żywo**: TEST 24 — po zmianie `compute_snapshot_id` z `snap-1` na `snap-2`, finding przypięty do `snap-1` ma `is_stale=true`; wiersz NIE jest usunięty (`SELECT` go nadal znajduje).

**Rozważona i odrzucona alternatywa**: joinowanie przez `finance_compute_snapshots.artifact_id`+`working_revision_id` bezpośrednio, bez pośrednictwa `finance_business_versions.compute_snapshot_id`. Odrzucona: podczas otwartego Draft, jeden artefakt może mieć wiele `working_revision_id` (autosave/undo cykle, DEC-FIN-010), i nie każdy z nich musi odpowiadać "aktualnej" wersji roboczej w danym momencie — `finance_business_versions.compute_snapshot_id` jest już tym jednoznacznym, zaprojektowanym w Gate B wskaźnikiem "który snapshot jest AKTUALNY dla tej wersji", i reużycie go unika ponownego wynajdywania tej samej logiki gorzej.

### 12.3 Freeze na approval — konsekwencja triggera, zero nowego kodu w `approveVersion()`

```sql
CREATE OR REPLACE FUNCTION finance_valuation_freeze_advisor_on_approval() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM 'APPROVED') THEN
    UPDATE finance_valuation_advisor_outputs
      SET is_frozen = true, frozen_at = now()
      WHERE business_version_id = NEW.business_version_id AND is_frozen = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_bv_freeze_advisor_on_approval
  AFTER UPDATE OF status ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_freeze_advisor_on_approval();
```

Ten trigger fires dla KAŻDEGO `finance_business_versions` UPDATE w całym systemie (Statements, Analysis, Baseline, Scenario też), ale jest no-opem dla nich — `UPDATE ... WHERE business_version_id = NEW.business_version_id` na pustej tabeli-córce nie robi nic, zero kosztu poza jednym pustym `UPDATE`. To pozwala `approveVersion()` (`server/src/services/finance/canonical/artifactVersionService.ts:389`) pozostać **całkowicie niezmodyfikowanym** — wymaganie zadania #7 dosłownie: "reużyj wzorca approveVersion() z Gate C, nie wymyślaj nowej logiki lifecycle". Immutability po freeze:

```sql
CREATE OR REPLACE FUNCTION finance_advisor_outputs_enforce_freeze() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_frozen THEN RAISE EXCEPTION '... is frozen (approved), cannot delete', OLD.id; END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_frozen THEN
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION '... is frozen (approved), no mutation permitted', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Allow-list-przez-diff idiom identyczny do `finance_bv_enforce_immutability` (WP-B01) — porównanie całych wierszy jako JSONB zamiast hardkodowanej listy kolumn, żeby przyszłe kolumny dodane przez późniejsze reconciliation automatycznie dziedziczyły ochronę (ten sam argument co WP-B01 migration header notatka #3 uzasadnia dla `finance_business_versions` samego). Blokuje też NOWE inserty na zatwierdzonym wariancie (`trg_advisor_outputs_no_new_after_approval`, reużywa tego samego generycznego `finance_valuation_enforce_parent_immutability()`, którego używają wszystkie pozostałe tabele treści Valuation) — Advisor jest z definicji pre-approval, reopen tworzy nowy `business_version_id`, gdzie Advisor uruchamia się od nowa. **Przetestowane żywo**: TEST 25 (`is_frozen=true` po `UPDATE ... status='APPROVED'`), TEST 26 (mutacja zamrożonego wiersza — odrzucona), TEST 27 (INSERT do `finance_valuation_methods` na zatwierdzonym wariancie — odrzucony, reużyty generyczny guard), TEST 28 (nowy Advisor insert na zatwierdzonym wariancie — odrzucony).

### 12.4 Porównanie wariantów — many-to-many query, nie kolumna

Zadanie, dosłownie: "Advisor porównuje warianty (relacja many-to-many query, nie kolumna)". Realizacja: `finance_valuation_advisor_output_variants(advisor_output_id, compared_business_version_id, role CHECK('PRIMARY','COMPARED_AGAINST'))`, `PRIMARY KEY(advisor_output_id, compared_business_version_id)` — jeden finding porównawczy ma N wierszy w tej tabeli (typowo 2-4, zgodnie z handoff §8/§10's "compare 2-4 scenariusze/wariantów" wzorca), zamiast pojedynczej kolumny `compared_variant_id`, która ograniczałaby porównanie do dokładnie dwóch wariantów i wymagała denormalizacji przy każdym dodaniu trzeciego. Bridge-row może istnieć wyłącznie, gdy rodzic ma `is_comparison=true` (trigger, cross-table). **Przetestowane żywo**: TEST 29 (finding porównawczy + 2 wiersze bridge, `PRIMARY`+`COMPARED_AGAINST` — przyjęte), TEST 30 (bridge-row dla findingu z `is_comparison=false` — odrzucony).

### 12.5 Kontekst TRS — trwałe referencje, żaden nowy mechanizm

`finance_valuation_advisor_outputs.id` + `business_version_id` (razem z `finance_valuation_advisor_output_variants` dla porównań) SĄ trwałymi referencjami wymaganymi przez DEC-FIN-006 ("Ustalenia Advisora, warianty i ich dowody są dostępne w kontekście rozmowy z TRS-em poprzez trwałe referencje do konkretnych artifact/version IDs") — immutable po freeze (sekcja 12.3), nigdy kasowane (append-only w duchu, jak `finance_exceptions`). Rozmowa z TRS przechowuje wskaźniki `{advisor_output_id, business_version_id}`, nie kopie treści — żaden nowy mechanizm trwałości nie jest tu potrzebny ponad to, co już istnieje.

### 12.6 Wymagana polityka AI

`ai_provider`/`ai_model`/`ai_prompt_version` (`NOT NULL`), `ai_residency_region`, `ai_no_training_commitment BOOLEAN NOT NULL`, `ai_estimated_cost_decimal`, `ai_rate_limit_bucket`, `ai_evidence_digest TEXT NOT NULL` (hash zbioru dowodów faktycznie użytych — pozwala later-audit potwierdzić, że sugestia była oparta o TEN konkretny zestaw danych, nie inny), `ai_hallucination_eval_status CHECK('NOT_EVALUATED','PASSED','FLAGGED')`. Żaden precedens tej struktury nie istnieje gdzie indziej w Gate B/D (sprawdzone przeszukaniem) — to jest pierwsze miejsce w programie, które potrzebuje "AI output policy" jako danych, nie tylko procesu; pola żyją bezpośrednio na `finance_valuation_advisor_outputs`, nie w osobnej tabeli, bo są 1:1 z każdym findingiem (różne findingi tego samego Advisor runu mogą teoretycznie mieć różny `ai_hallucination_eval_status`, jeśli ewaluacja jest per-finding, nie per-run — udokumentowana decyzja projektowa, nie przeoczenie, sekcja 15 pkt 4 flaguje alternatywę "per-run" do potwierdzenia).

---

## 13. Dwuetapowy readiness/compute — kontrakt, nie implementacja

Analogicznie do WP-D07 §6 (Prediction), przyszły `finance_valuation_can_start_compute(business_version_id)` (nie tworzony w tym ADR-ie) powinien łączyć: (a) dokładnie jedna krawędź źródła istnieje (sekcja 4.3 — schemat to UMOŻLIWIA, gate to WYMUSZA na granicy compute), (b) `finance_valuation_wacc_inputs` istnieje i `wacc_computed_pct IS NOT NULL` dla metod DCF, (c) co najmniej jedna metoda ma `readiness='READY'`, (d) `NO_OPEN_UNDEFINED_MATH` (reużyty `finance_exceptions_current`, ta sama reguła jak WP-D05/D07). `job_type='VALUATION_COMPUTE'` (uppercase, dokumentowana rozbieżność od zarezerwowanego `valuation_compute` — ten sam precedens co WP-D06/`BASELINE_COMPUTE` i WP-D07/`PREDICTION_COMPUTE`, `compute_jobs.job_type` jest zwykłym `TEXT` bez CHECK enum, potwierdzone żywo).

---

## 14. Dowód testowy — 30 scenariuszy, efemeryczny Postgres

Środowisko: PostgreSQL 15.15 (Homebrew), `initdb --locale=C`, `LC_ALL=C` (bez tego postmaster failuje na macOS z "became multithreaded during startup" — udokumentowany lokalny quirk, nie związany z DDL-em), port 58311 (zakres 55000-59999, sprawdzony wolny przed startem), data dir `/private/tmp/wp_d09_pgdata`, log `/private/tmp/wp_d09_pg.log`. Baza `wp_d09_test` zbudowana przez zastosowanie WSZYSTKICH siedmiu istniejących migracji `20260809_finance_v3_b01`…`b07` bez modyfikacji (0 błędów), plus minimalne fixture'y (organizacja testowa, dwa Approved źródła: `BASELINE_MODEL`+`PREDICTION_SCENARIO`), plus DDL sketch tego ADR-u w trzech blokach. Teardown: `pg_ctl -m fast stop` + `rm -rf` katalogu danych, potwierdzone `ps aux` że proces zniknął i że współdzielony proces (gdyby istniał pod PID 911) nie był tknięty.

| # | Test | Oczekiwane | Wynik |
|---|---|---|---|
| 1 | Case + wariant + `MODEL_TO_VALUATION` edge | przyjęte | ✅ |
| 2 | Druga edge (`SCENARIO_TO_VALUATION`) do TEGO SAMEGO targetu | odrzucone (partial unique index) | ✅ |
| 3 | Drugi, niezależny wariant tego samego Case'a, `SCENARIO_TO_VALUATION` | przyjęte (multi-variant Case) | ✅ |
| 4 | Metoda: domyślny `NOT_CONFIGURED`/`MISSING`/`NULL` | przyjęte | ✅ |
| 5 | Metoda: `NOT_CONFIGURED` + `PRESENT_ZERO`/0 | odrzucone (N/A≠zero) | ✅ |
| 6 | Metoda: `READY` + `MISSING` | odrzucone (READY wymaga wyniku) | ✅ |
| 7 | Koszyk: 60+40=100, COMMIT | przyjęte | ✅ |
| 8 | Koszyk: 60+40+10=110, COMMIT | odrzucone (suma≠100) | ✅ |
| 9 | Cross-check: `weight_pct=0` | odrzucone (musi być NULL) | ✅ |
| 10 | Cross-check: `weight_pct=NULL` | przyjęte | ✅ |
| 11 | WACC: struktura kapitału 30+70, 25+75 | przyjęte | ✅ |
| 12 | WACC: struktura kapitału 30+65=95 | odrzucone | ✅ |
| 13 | Terminal: `g=9.5 >= WACC=9.5` | odrzucone | ✅ |
| 14 | Terminal: `g=2.5 < WACC=9.5` | przyjęte | ✅ |
| 15 | Terminal: exit-multiple cross-check obok Gordon | przyjęte (2 wiersze, 1 metoda) | ✅ |
| 16 | Bridge: 2 komponenty, zgodny `as_of_date` | przyjęte | ✅ |
| 17 | Bridge: komponent z innym `as_of_date` | odrzucone | ✅ |
| 18 | Sensitivity: 20 komórek + `COMPLETE` | odrzucone (≠25) | ✅ |
| 19 | Sensitivity: 25 komórek, 1 base cell, `COMPLETE` | przyjęte | ✅ |
| 20 | Sensitivity: 25 komórek, 2 base cells, `COMPLETE` | odrzucone | ✅ |
| 21 | Comps: `TRADING_COMPS` → `READY` z 0 comps | odrzucone | ✅ |
| 22 | Comps: `TRADING_COMPS` → `READY` z 1 usable comp | przyjęte | ✅ |
| 23 | Advisor: finding przypięty do świeżego snapshotu | przyjęte | ✅ |
| 24 | Advisor: recompute (nowy snapshot) → stary finding `is_stale=true`, nie skasowany | ✅ | ✅ |
| 25 | Advisor: approval wariantu → finding `is_frozen=true` | ✅ | ✅ |
| 26 | Advisor: mutacja zamrożonego wiersza | odrzucone | ✅ |
| 27 | Metody: INSERT na zatwierdzonym wariancie | odrzucone (parent immutability) | ✅ |
| 28 | Advisor: nowy INSERT na zatwierdzonym wariancie | odrzucone | ✅ |
| 29 | Advisor: finding porównawczy + 2-wierszowy bridge (`PRIMARY`/`COMPARED_AGAINST`) | przyjęte | ✅ |
| 30 | Advisor: bridge-row dla findingu `is_comparison=false` | odrzucone | ✅ |

Te testy **nie są** Gate C — nie mają resume/checksums/shadow-parity/canary i nie testują backfillu z żywych danych legacy (`valuations`/`valuation_snapshots`/`financial_valuation_snapshots`). Nie testują faktycznego przeliczenia FCFF/WACC/DCF (to jest przyszły Valuation Compute WP) — są dowodem, że DDL jest syntaktycznie poprawny i że physical guarantees (exactly-one-source, N/A≠zero, suma=100, g<WACC, as_of alignment, 25-komórek+1-base-cell, comps readiness, Advisor freeze/staleness/many-to-many) zachowują się zgodnie z projektem na realnych, wielotabelowych transakcjach.

---

## 15. Eskalacje wymagane przed pełnym GO

Zgodnie z DEC-FIN-012 ("dla zagadnień objętych jednoznacznym profesjonalnym standardem... zespół przyjmuje najwyższy uzasadniony standard bez eskalowania rutynowych pytań") — żadna z poniższych NIE blokuje przyjęcia tego ADR-u jako projektu; są to jawnie nazwane, świadome granice/osądy do potwierdzenia przy przyszłej implementacji compute/UI.

1. **EV→Equity bridge as_of alignment jako hard block, nie exception-ledger warning** (sekcja 9) — ten ADR czyta DEC-FIN-009 surowiej niż jego dosłowne brzmienie (traktuje misaligned as-of jak "matematycznie nieokreśloną operację"). Jeśli właściciel/CFO reviewer uzna to za zbyt restrykcyjne dla wczesnego draftu (np. debt as-of z Q2 raportu, cash as-of z bieżącego wyciągu, różnica dni), alternatywa to Warning-tier exception zamiast trigger-block — zmiana jednolinijkowa (zamiana `RAISE EXCEPTION` na `INSERT INTO finance_exceptions`), ale zmienia semantykę z "nie da się zapisać" na "da się zapisać z ostrzeżeniem".
2. **Currency/nominal-real/pre-post-tax spójność WACC↔cashflows↔terminal g** (sekcja 6) — kontraktowana, nie egzekwowana schematem; wymaga service layer odczytującego DWIE domeny (Valuation + Baseline/Prediction) jednocześnie, zakres przyszłego Valuation Compute WP.
3. **`UNIQUE(business_version_id, method_type)`** (sekcja 7.1) — jeden wiersz per typ metody per wariant; wielokrotne DCF różniące się WYŁĄCZNIE zestawem założeń (nie osobnym wariantem) nie są reprezentowalne bez utworzenia nowego wariantu. Jeśli to okaże się realnym przypadkiem biznesowym (np. "DCF z konserwatywnym WACC" i "DCF z agresywnym WACC" jako dwie perspektywy TEGO SAMEGO wariantu, nie dwóch osobnych wariantów), potrzebny byłby dodatkowy `method_label`/`method_variant_seq` w kluczu unikalnym — świadomie nie dodany w P0 (zbyt wczesne rozszerzenie zakresu, ten sam wzorzec decyzyjny co WP-D05/D07 stosowały dla swoich odpowiedników).
4. **`ai_hallucination_eval_status` per-finding, nie per-run** (sekcja 12.6) — jeśli ewaluacja halucynacji jest tańsza/sensowniejsza per cały Advisor run (jeden LLM call generujący N findingów naraz) niż per pojedynczy finding, te kolumny powinny żyć na osobnej tabeli `finance_valuation_advisor_runs` (nadrzędnej nad `finance_valuation_advisor_outputs`), nie replikowane N razy. Nie zaprojektowane w tym ADR-ie — brak wystarczającego sygnału z zadania, czy granularność runu czy findingu jest właściwa; oba są poprawne strukturalnie, różnią się tylko normalizacją.
5. **Korelacja/wkład/disagreement metod** (sekcja 7.4) i **Reverse stress / breakeven dla Valuation** (analog WP-D07 §9.2, nie zaprojektowane tutaj — zadanie go nie wymienia dla Valuation wprost, w przeciwieństwie do Prediction) — kandydaci do przyszłego Valuation Compute WP, nie tego ADR-u.
6. **Legacy backfill** `valuations`/`valuation_snapshots`/`financial_valuation_snapshots` → `finance_valuation_*` — poza zakresem tego ADR-u (Gate D domain schema), zakres przyszłego WP-D09b (analog WP-D05b/D07b) + Gate C backfill playbook.
7. **`job_type='VALUATION_COMPUTE'` vs zarezerwowany `valuation_compute`** — ten sam, już udokumentowany, nierozwiązany drift co WP-D06/`BASELINE_COMPUTE` i WP-D07/`PREDICTION_COMPUTE` (WP-D07 §6.3) — jednolinijkowy follow-on, może być rozwiązany razem dla wszystkich trzech naraz w jednym przyszłym patchu.

---

## 16. Traceability

| Wymaganie z zadania | Sekcja tego ADR |
|---|---|
| `finance_valuation_cases` — kontener | 4.1 |
| `finance_valuation_variants` — jeden per business_version_id, wiele per Case, exact source przez lineage | 4.2, 4.3 |
| `finance_valuation_wacc_inputs` — pełny bundle | 6 |
| `finance_valuation_methods` — method_type, readiness, result, basket bool, weight, CHECK sum=100 | 7 |
| `finance_valuation_terminal` — g/WACC/convention/terminal_share | 8 |
| `finance_valuation_ev_equity_bridge` — sekwencja komponentów, as_of alignment | 9 |
| `finance_valuation_sensitivity` — 5×5, base_cell marker | 10 |
| `finance_valuation_comps` — peer table | 11 |
| `finance_valuation_advisor_outputs` — facts/hypotheses/risks/questions/actions, evidence/impact/confidence, frozen po approval | 12 |
| FCFF formuła jako jawny kontrakt, wejścia nie duplikowane | 5 |
| Methods & weights CHECK: suma=100 lub 0 (DRAFT) | 7.3 |
| Cross-check weight=NULL, nigdy 0 | 7.3 |
| N/A: result=NULL + readiness='NOT_CONFIGURED', NIGDY result=0 | 7.2 |
| EV→Equity bridge as_of alignment walidacja | 9 |
| Sensitivity 5×5: 25 komórek, 1 base_cell, monotoniczność poza zakresem | 10 |
| Advisor: fresh computed variant, nie zmienia danych, nie zatwierdza | 12.1 |
| Advisor: FK do compute_run_id/snapshot, stale na recompute, nie kasowany | 12.1, 12.2 |
| Advisor: zamrożony po approval, immutability trigger wzorem innych domen | 12.3 |
| Advisor: porównuje warianty, many-to-many query nie kolumna | 12.4 |
| Approval snapshot + status update: jedna transakcja, UNIQUE(version), idempotent retry, reużyty approveVersion() | 2, 12.3 |

---

## Załącznik A — DDL sketch (zweryfikowany żywo)

Dwanaście tabel + 4 CHECK-owe rozszerzenia wymuszające N/A≠zero/suma=100/as_of/g<WACC + 1 partial unique index domykający lukę WP-B03 + 11 funkcji/triggerów (w tym 3 `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` dla agregatów cross-row), w pełni specyfikowane w treści §4-12 powyżej. Pełne, uruchamialne pliki `.sql` żyją w scratchpadzie sesji (`/private/tmp/wp_d09_block{1,2,3}_*.sql`, `/private/tmp/wp_d09_tests*.sql`), nie w repo — poniżej najbardziej load-bearing fragmenty, dosłowne i kopiowalne 1:1.

```sql
-- Lineage exclusivity (domyka lukę WP-B03) — sekcja 4.3
CREATE UNIQUE INDEX uq_finance_lineage_edges_one_valuation_source
  ON finance_lineage_edges (target_version_id)
  WHERE edge_type IN ('MODEL_TO_VALUATION', 'SCENARIO_TO_VALUATION');

-- finance_valuation_methods — kluczowe kolumny/CHECK-i, sekcja 7
CREATE TABLE finance_valuation_methods (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_version_id         TEXT NOT NULL REFERENCES finance_valuation_variants(business_version_id),
  method_type                 TEXT NOT NULL CHECK (method_type IN (
                                 'DCF_FCFF', 'DCF_FCFE', 'DIVIDEND_DISCOUNT', 'TRADING_COMPS',
                                 'PRECEDENT_TRANSACTIONS', 'ASSET_BASED', 'OTHER_WITH_POLICY'
                               )),
  readiness                   TEXT NOT NULL DEFAULT 'NOT_CONFIGURED'
                                 CHECK (readiness IN ('NOT_CONFIGURED','DATA_INCOMPLETE','READY','COMPUTE_FAILED')),
  result_value_status         finance_value_status NOT NULL DEFAULT 'MISSING',
  result_ev_decimal           NUMERIC,
  is_in_recommendation_basket BOOLEAN NOT NULL DEFAULT false,
  weight_pct                  NUMERIC,
  CONSTRAINT uq_finance_valuation_methods_bv_type UNIQUE (business_version_id, method_type),
  CONSTRAINT chk_finance_methods_result_matches_readiness CHECK (
    (readiness IN ('NOT_CONFIGURED','DATA_INCOMPLETE','COMPUTE_FAILED') AND result_value_status IN ('MISSING','NA','NOT_APPLICABLE'))
    OR (readiness = 'READY' AND result_value_status IN ('PRESENT_ZERO','PRESENT_NONZERO'))
  ),
  CONSTRAINT chk_finance_methods_weight_basket_only CHECK (
    (is_in_recommendation_basket = false AND weight_pct IS NULL)
    OR (is_in_recommendation_basket = true AND weight_pct IS NOT NULL)
  )
);

CREATE CONSTRAINT TRIGGER trg_finance_valuation_methods_weight_sum
  AFTER INSERT OR UPDATE OR DELETE ON finance_valuation_methods
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_check_basket_weight_sum();

-- Advisor freeze-on-approval — sekcja 12.3 (jedyny integration point z approveVersion(), 0 kodu tam)
CREATE TRIGGER trg_finance_bv_freeze_advisor_on_approval
  AFTER UPDATE OF status ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_freeze_advisor_on_approval();

CREATE TRIGGER trg_finance_bv_mark_advisor_stale_on_recompute
  AFTER UPDATE OF compute_snapshot_id ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_mark_advisor_stale_on_recompute();
```
