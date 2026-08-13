# ADR WP-B01 — Kanoniczny schemat Artifact/Version/Revision (Finance v3)

**Status:** `PROPOSED` (Gate B, do akceptu zespołu wg DEC-FIN-012; sekcja 8 wymaga sign-off orkiestratora/Piotra)
**Data:** 2026-08-09
**Work package:** WP-B01, `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` sekcja "Gate B — Canonical contracts"
**Owner:** Architecture/Data
**Wejście:** `FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` §2.1, §2.4, Gate B/WP-B01; `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` DEC-FIN-007, DEC-FIN-010, DEC-FIN-011; `docs/validation/finance-v3/generated/gate-a/WP-A01_inventory_manifest.md` + `.json`
**Zakaz respektowany:** ten dokument NIE łączy się z żadną bazą, NIE tworzy plików w `server/migrations/`, NIE uruchamia migracji. DDL w Załączniku A jest szkicem projektowym dla WP-C01, nie migracją do wykonania.

---

## 1. Kontekst

### 1.1 Czego wymaga master plan

Sekcja 2.1 master planu definiuje wspólne identyfikatory dla wszystkich artefaktów Finance: `artifact_id`, immutable `business_version_id`, mutable Draft `working_revision_id`, immutable `compute_snapshot_id`, `compute_run_id`, `engine_manifest_id`, `content_semantic_hash`, `organization_id`. Business lifecycle to `DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED → SUPERSEDED / ARCHIVED / INVALIDATED`, z `NEEDS_CHANGES` wracającym do Draft i reopen tworzącym vN+1. Freshness (`NEVER_COMPUTED/CURRENT/STALE_SOURCE/STALE_ASSUMPTIONS/COMPUTE_FAILED`) jest niezależne od statusu.

DEC-FIN-010 (rewizje robocze vs wersje biznesowe): częste zmiany (autosave, Undo/Redo, kolejne Compute, crash recovery, conflict handling) zostają jednym Draftem (`working_revisions`); `business_versions` powstaje świadomie przy submit-to-review, approval, reopen/new version, publish lub nazwanym milestone. Compute wskazuje immutable working snapshot/hash, ale sam nie tworzy nowej wersji biznesowej.

DEC-FIN-007 (usuwanie zatwierdzonych artefaktów): Approved nie ma zwykłego hard-delete; może zostać Superseded, Archived albo Invalidated z obowiązkową przyczyną, zawsze zostaje w historii i lineage. Draft bez potomków może być usuwany zgodnie z uprawnieniami.

DEC-FIN-011 (lineage DAG): kontrolowany, acykliczny DAG oparty na immutable artifact/version ID; relacje cross-tenant i cykle zabronione. WP-B01 nie projektuje jeszcze samych krawędzi (to WP-B03), ale schemat wersji musi dawać stabilne, immutable ID, na których WP-B03 osadzi typed edges.

### 1.2 Czego dowodzi Gate A o obecnym stanie (origin/demo, SHA `9d17cac114`)

Inwentaryzacja WP-A01 (60 tabel, metoda statyczna) daje konkretne, potwierdzone kodem punkty wyjścia, które ten ADR musi adresować wprost, a nie tylko deklaratywnie:

1. **Reopen mutuje Approved w miejscu.** `financialModelingService.ts` ma trzy call site'y (`~L2001, L2047, L2059`) wykonujące `UPDATE financial_models SET status = 'draft' ... WHERE status = 'approved'` na tym samym wierszu, bez utworzenia nowego rekordu `financial_model_versions` i bez podbicia `version` przed mutacją. To jest właśnie problem, który `business_versions` + trigger immutability (§2.4 tego ADR) ma fizycznie uniemożliwić, nie tylko zabronić proceduralnie.
2. **Brak `UNIQUE(model_id, version)` na `financial_model_versions`** (potwierdzone odczytem `server/migrations/20260228_financial_model_versions.sql` — jest `CREATE INDEX idx_fmver_version`, nie `UNIQUE`). Analogicznie brak `UNIQUE(valuation_id, version)` na `valuation_snapshots`, mimo że wzorcowe tabele (`financial_statement_versions`, `financial_statement_value_versions`) mają `UNIQUE(statement_id, version_no)`. Nowy schemat musi mieć te ograniczenia od pierwszego dnia, nie jako poprawkę.
3. **Brak CHECK wiążącego `approved_snapshot` ze statusem `approved`.** `financial_models.approved_snapshot` jest wolnostojącą kolumną TEXT bez wymuszenia "status='approved' ⇒ approved_snapshot IS NOT NULL". Nowy schemat wymusza to na poziomie bazy (§2.4, §Załącznik A p. immutability trigger).
4. **`financial_model_events` jest dzisiejszym jedynym silnikiem Baseline, a jego `event_type` CHECK zawiera `debt_drawdown`, `debt_repayment`, `equity_injection`, `dividend`, `capex_purchase`** — dokładnie decyzje finansowe, które DEC-FIN-002 zabrania w Baseline Model (finansowanie należy wyłącznie do Prediction). To QUARANTINE w Gate A i wymaga jawnej decyzji Gate B (§5, punkt 2 poniżej), nie prostej migracji 1:1.
5. **Trzy niezreconcylowane magazyny NPV/IRR/ROI:** `financial_analyses` (TEXT `organization_id`, ma lifecycle status), `analysis_financials` (068, INTEGER `organization_id` — dryf konwencji), `initiative_financials` (067, INTEGER `organization_id` — dryf konwencji). Nowy schemat nie rozstrzyga merge/deprecate/keep w tym ADR (to decyzja domenowa Finance, poza zakresem WP-B01), ale `aliases` musi umieć zmapować wszystkie trzy bez zgadywania.
6. **`financial_statement_versions` i `finance_post_investment_reviews` są najlepszymi wzorcami w inwentarzu** — numerowana wersja + immutable JSON snapshot + `UNIQUE(statement_id, version_no)` (pierwsza), oraz immutable baseline pointer `baseline_model_id + baseline_version` zamrożony w momencie utworzenia, nie "aktualny approved" (druga). Ten ADR świadomie generalizuje oba wzorce zamiast projektować od zera.
7. **`organization_id` ma dwie konwencje w żywym schemacie:** TEXT (wszystkie tabele Finance-v1+, 2026) i INTEGER (dwie tabele legacy 067/068). Canoniczny schemat przyjmuje TEXT wszędzie; `aliases.organization_id` jest zawsze TEXT, nawet gdy źródło legacy było INTEGER — konwersja happens raz, na granicy aliasu, bez dotykania legacy tabel.

---

## 2. Decyzja

Wprowadzamy pięć nowych, addytywnych tabel: `finance_artifacts`, `finance_business_versions`, `finance_working_revisions`, `finance_artifact_aliases`, `finance_engine_manifests`. Prefiks `finance_` chroni przed kolizją nazw z nie-Finance modułami (Consultify ma współdzieloną bazę) i jest spójny z istniejącą konwencją (`financial_*`, `finance_*` już występują w 60-tabelowym inwentarzu). Żadna istniejąca tabela nie jest modyfikowana, przemianowana ani usuwana przez ten ADR.

### 2.1 `finance_artifacts` — tożsamość, nie treść

Jeden wiersz na logiczny "obiekt pracy" (jeden Statement Pack, jeden Baseline Model, jedna Valuation Case, ...), niezależnie od tego ile ma wersji. Artefakt sam nie niesie danych biznesowych — to kotwica dla `business_versions`/`working_revisions`/lineage (WP-B03).

Kluczowe pola: `artifact_id` (PK), `organization_id` (TEXT NOT NULL), `artifact_type` (CHECK enum zamknięty na typy z DAG-u sekcji 2.1/2.2 master planu: `STATEMENT_PACK`, `HISTORICAL_ANALYSIS`, `BASELINE_MODEL`, `PREDICTION_SCENARIO`, `VALUATION_CASE`, `REPORT_EXPORT`), `natural_key` (opcjonalny, do idempotentnego re-importu), `current_business_version_id` (denormalizowany wskaźnik na "aktualnie obowiązującą" wersję — cache pod odczyt, utrzymywany przez trigger po stronie `business_versions`, nigdy zapisywany bezpośrednio przez aplikację).

`UNIQUE(artifact_id, organization_id)` istnieje wyłącznie po to, by `business_versions`/`working_revisions`/`aliases` mogły użyć **złożonego FK** `(artifact_id, organization_id) REFERENCES finance_artifacts(artifact_id, organization_id)` — to jest mechanizm "same-org parent enforcement" wymagany w zakresie zadania: baza fizycznie odrzuci próbę powiązania wersji z artefaktem należącym do innej organizacji, bez potrzeby triggera.

### 2.2 `finance_business_versions` — immutable milestone

Jeden wiersz = jedna wersja biznesowa (vN). Odpowiada `DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED → SUPERSEDED/ARCHIVED/INVALIDATED` z master planu §2.1.

Kluczowe pola: `business_version_id` (PK), `artifact_id` + `organization_id` (złożony FK do artifacts), `version_no` (INTEGER, sekwencyjny per artifact), `status`, `freshness`, `source_working_revision_id` (która working revision została "podniesiona" do rangi wersji biznesowej — nullable dla wierszy powstałych z backfillu legacy, gdzie nie istnieje odpowiadający draft), `parent_version_id` (self-FK — reopen tworzy vN+1 wskazujący na vN, realizuje literalnie "reopen tworzy vN+1" z master planu), `compute_snapshot_id`, `compute_run_id` (na razie **bez FK** — `compute_jobs/compute_runs/compute_outputs` powstają w WP-B04; kolumny istnieją już teraz jako TEXT/nullable, FK dorzuca WP-B04 addytywnym `ALTER TABLE ... ADD CONSTRAINT`, nie zmieniając kształtu tej tabeli), `engine_manifest_id` (FK do `finance_engine_manifests`, w zakresie tego ADR), `content_semantic_hash`, `approved_by/approved_at/approval_note`, `superseded_by_version_id` (self-FK), `invalidated_reason`, `immutable_since`.

**`UNIQUE(artifact_id, version_no)`** — bezpośrednia odpowiedź na brak `UNIQUE(model_id, version)`/`UNIQUE(valuation_id, version)` znaleziony w Gate A.

**`UNIQUE(artifact_id) WHERE status = 'APPROVED'`** (partial unique index) — w każdej chwili co najwyżej jedna wersja biznesowa danego artefaktu może mieć status `APPROVED`; reopen musi najpierw przestawić starą na `SUPERSEDED` w tej samej transakcji, w której powstaje nowy Draft. To fizycznie zamyka lukę "duplicate valuation version"/"Approved bez snapshotu" z Gate A.

### 2.3 `finance_working_revisions` — mutable Draft, append-only

DEC-FIN-010 mówi wprost: wiele edycji i compute zostaje jednym Draftem. Projektujemy `working_revisions` jako **append-only log niemutowalnych checkpointów** wewnątrz jednego Draftu, nie jako pojedynczy mutowalny wiersz nadpisywany UPDATE-em — to jest architektonicznie ten sam błąd, który znaleźliśmy w `financial_models` (UPDATE w miejscu), tylko na poziomie Draftu zamiast Approved. Każda znacząca zmiana (autosave checkpoint wybrany do retencji, każdy Compute run, jawny "Save") tworzy nowy wiersz z rosnącym `revision_seq`; poprzedni traci `is_current`. Drobnoziarnisty operation-stack (Undo/Redo per-keystroke) to zakres AP-04, osobnej warstwy nad tą tabelą — `working_revisions` daje jej stabilne punkty odniesienia (compute pinned to revision hash), nie zastępuje jej.

Kluczowe pola: `working_revision_id` (PK), `artifact_id` + `organization_id` (złożony FK), `business_version_id` (nullable — który business version jest amendowany; NULL = pierwszy-w-życiu Draft bez zatwierdzonego poprzednika), `revision_seq` (BIGINT, monotoniczny per artifact), `content_semantic_hash`, `compute_run_id` (nullable, bez FK z tego samego powodu co w §2.2), `is_current` (BOOLEAN), `crash_recovery_checkpoint` (BOOLEAN), `edited_by/edited_at`.

`UNIQUE(artifact_id, revision_seq)`; `UNIQUE(artifact_id) WHERE is_current` (partial) — dokładnie jeden "żywy" Draft per artefakt w danej chwili, zgodnie z "wiele zmian i compute pozostaje jednym Draftem".

Rzeczywista treść Draftu (linie sprawozdania, harmonogramy modelu, założenia scenariusza) **nie** jest przechowywana w tej tabeli jako blob — WP-B01 nie przenosi domenowych danych finansowych. `working_revisions` jest warstwą kotwiczącą (hash + status + kto/kiedy), na którą domenowe tabele Gate D (Statements/Analysis/Models/Prediction/Valuation) wskazują przez `working_revision_id`/`business_version_id`. To utrzymuje ten ADR w zakresie "artifact/version/revision schema" bez przedwczesnego projektowania schedules/KPI (Gate D).

### 2.4 Immutable Approved — mechanizm hybrydowy

Zgodnie z zakresem zadania (DB constraint hybrid), immutability Approved ma dwie warstwy:

1. **Warstwa aplikacyjna:** serwisy nigdy nie wydają surowego UPDATE na wierszu `finance_business_versions` w statusie `APPROVED` poza dozwolonym przejściem statusu; reopen zawsze tworzy nowy wiersz (`parent_version_id` = stary `business_version_id`, `version_no` = stary + 1).
2. **Warstwa bazy (twarda granica, niezależna od dyscypliny aplikacji):** trigger `BEFORE UPDATE ON finance_business_versions` odrzuca każdy UPDATE wiersza, którego `OLD.status = 'APPROVED'`, chyba że `NEW.status` przechodzi wyłącznie do `SUPERSEDED`/`ARCHIVED`/`INVALIDATED` **i** żadna inna kolumna poza `status`, `superseded_by_version_id`, `invalidated_reason`, `updated_at` się nie zmienia. Pełen kod triggera — Załącznik A.

To jest dokładnie mechanizm, którego brak w `financial_models` pozwolił na trzy call site'y `UPDATE ... SET status='draft' ... WHERE status='approved'` w `financialModelingService.ts`. Po WP-C02 (compatibility services) taki UPDATE na nowym schemacie zwróci błąd bazy, nie tylko naruszy konwencję.

Dodatkowo trigger wymusza **"Approved bez snapshotu" nigdy więcej**: przejście `NEW.status = 'APPROVED'` jest odrzucane, jeśli `NEW.compute_snapshot_id IS NULL` (chyba że `artifact_type` danego artefaktu jest jawnie oznaczony jako nie-obliczeniowy — obecnie żaden typ z §2.1 nie jest tak oznaczony; `STATEMENT_PACK` też przechodzi przez reconciliation, więc też wymaga snapshotu).

### 2.5 `finance_engine_manifests` — reprodukowalność

Manifest kodu/konfiguracji silnika, który wyprodukował dany `compute_snapshot`. Nie jest org-scoped — opisuje wersję *kodu*, nie dane tenantów; to świadome odstępstwo od "organization_id wszędzie" i jest tu jawnie uzasadnione, żeby nie wyglądało na przeoczenie.

Pola: `engine_manifest_id` (PK), `engine_name`, `engine_version`, `code_commit_sha`, `formula_taxonomy_version`, `market_data_asof` (nullable), `config_hash`, `created_at`. `UNIQUE(engine_name, engine_version, code_commit_sha, config_hash)` — ten sam manifest nie jest tworzony dwa razy.

Legacy dane (backfill z Gate C) nie mają znanego manifestu — dostają sentinel wiersz `engine_name='LEGACY_UNKNOWN'`, żeby `engine_manifest_id` mogło zostać `NOT NULL` bez wyjątków specjalnych w kodzie odczytu (patrz Załącznik B).

### 2.6 `finance_artifact_aliases` — pomost legacy → canonical

Każdy wiersz legacy (z 60-tabelowego inwentarza Gate A) dostaje dokładnie jeden wiersz aliasu na (tabela, id, wersja-legacy), niezależnie od klasyfikacji WP-A01/WP-A03 — łącznie z wierszami `QUARANTINE`. Nic nie ginie po cichu: jeśli wiersz legacy nie da się jednoznacznie zmapować na `business_version_id`, alias i tak istnieje i wskazuje `artifact_id` z `business_version_id = NULL` i `mapping_confidence = 'QUARANTINE'` — to jest miejsce, gdzie "input = candidate + quarantine + excluded" z DoD WP-A01 zostaje fizycznie odzwierciedlone w nowym schemacie, zamiast być tylko właściwością raportu JSON.

Pola: `alias_id` (PK), `legacy_table`, `legacy_id` (TEXT — celowo TEXT nawet dla legacy INTEGER PK, konwersja raz na granicy), `legacy_version` (TEXT, nullable), `artifact_id` + `organization_id` (złożony FK do artifacts — wymusza, że alias nie może wskazywać artefaktu innej organizacji niż ta, którą legacy wiersz deklarował), `business_version_id` (nullable FK), `mapping_confidence` (CHECK enum: `AUTO_MIGRATE/MIGRATE_WITH_WARNING/QUARANTINE/EXCLUDE_WITH_REASON` — dosłownie ta sama nomenklatura co WP-A01/A03, celowo, żeby manifest Gate A i alias table mówiły tym samym językiem bez tłumaczenia), `mapping_reason`, `created_by` (id joba backfillu, nie użytkownika), `created_at`.

`UNIQUE(legacy_table, legacy_id, legacy_version)` — jeden alias per wiersz legacy+wersja; ponowne uruchomienie backfillu (WP-C03 jest z założenia resumable/idempotent) robi UPSERT, nie duplikat.

### 2.7 Wartość finansowa (§2.4 master planu) — konwencja, nie nowa tabela

Zakres zadania (punkt 4) prosi o zaprojektowanie, jak `PRESENT_ZERO/PRESENT_NONZERO/MISSING/NA/NOT_APPLICABLE` mapuje się na kolumny wartości. To **nie** jest szósta tabela WP-B01 — żadna z pięciu tabel powyżej nie przechowuje pojedynczych wartości finansowych (linii P&L, komórek modelu). Ten ADR definiuje natomiast jeden reużywalny typ Postgres i wymagany zestaw kolumn, który każda przyszła domenowa tabela wartości (Gate D: statement lines, model outputs, scenario cells, valuation inputs) musi przyjąć:

```
CREATE TYPE finance_value_status AS ENUM (
  'PRESENT_ZERO', 'PRESENT_NONZERO', 'MISSING', 'NA', 'NOT_APPLICABLE'
);
```

Wymagany bundle kolumn na każdej domenowej tabeli "komórki wartości": `value_status finance_value_status NOT NULL`, `value_decimal NUMERIC` (NULL dopuszczalny tylko gdy `value_status IN ('MISSING','NA','NOT_APPLICABLE')`; `value_status='PRESENT_ZERO'` wymaga `value_decimal = 0`; `value_status='PRESENT_NONZERO'` wymaga `value_decimal <> 0` — CHECK per tabela w Gate D), `native_currency`, `presentation_currency`, `unit`, `multiplier`, `period_id`, `entity_id`, `source_ref`, `is_adjustment BOOLEAN`, `adjustment_reason`. Rounding dzieje się wyłącznie na granicy prezentacji (master plan §2.4) — `value_decimal` zawsze przechowuje pełną precyzję źródłową.

Rozróżnienie `MISSING` vs `NA` vs `NOT_APPLICABLE` jest świadome i bezpośrednio adresuje problem #2 z Gate A ("Silent-zero / `firstNonZero`", **STILL_OPEN**, ~15+ wywołań w `financialModelingService.ts`): `MISSING` = dana powinna istnieć, ale jej nie mamy (błąd/luka źródła); `NA` = analityk jawnie oznaczył "nie dotyczy dla tego okresu/scenariusza"; `NOT_APPLICABLE` = z definicji linii/branży to pole nie istnieje (np. Inventory Days dla firmy usługowej). Żadna z tych trzech nie wolno silent-collapse'ować do `0`/`PRESENT_ZERO` — to jest dokładnie mechanizm, który w kodzie legacy `firstNonZero` łamie.

---

## 3. Rozważane alternatywy (odrzucone)

1. **Jedna tabela `finance_versions` z kolumną `kind` (business/working)** zamiast dwóch osobnych tabel. Odrzucone: `working_revisions` jest append-only i wysokoczęstotliwościowe (autosave, co Compute), `business_versions` jest rzadkie i ma zupełnie inny reżim immutability (trigger blokujący UPDATE). Współdzielenie tabeli zmusiłoby trigger immutability do rozróżniania wierszy po `kind`, co jest kruche i utrudnia partial unique index na `is_current`/`APPROVED`.
2. **Bezpośrednia migracja `financial_model_events` 1:1 do nowego schematu jako `working_revisions.content`.** Odrzucone: schemat `event_type` zawiera decyzje finansowe zakazane w Baseline przez DEC-FIN-002; przeniesienie 1:1 przenosi błąd koncepcyjny do nowego, "czystego" schematu. Wymaga jawnej decyzji domenowej (§5).
3. **Trigger immutability zaimplementowany wyłącznie jako CHECK constraint.** Odrzucone: Postgres CHECK nie widzi `OLD` wiersza (nie ma dostępu do stanu przed UPDATE), więc nie da się nim wyrazić "zablokuj zmianę innej kolumny niż status, gdy OLD.status='APPROVED'". Wymaga triggera.
4. **FK `organization_id` wprost z `business_versions`/`working_revisions` do `organizations(id)` zamiast złożonego FK do `finance_artifacts`.** Odrzucone jako jedyny mechanizm: samo FK do `organizations` nie gwarantuje, że `business_versions.organization_id` zgadza się z `organization_id` artefaktu-rodzica — dwie osobne poprawne wartości mogłyby się rozjechać. Złożony FK `(artifact_id, organization_id) REFERENCES finance_artifacts(artifact_id, organization_id)` wymusza spójność rodzic↔dziecko, co jest literalnie "same-org parent enforcement" z zakresu zadania. FK do `organizations(id)` zostaje zachowane na poziomie `finance_artifacts.organization_id` jako dodatkowa granica.

---

## 4. Konsekwencje

**Pozytywne:**
- Fizycznie zamyka trzy konkretne, potwierdzone kodem luki z Gate A (reopen-in-place, brak UNIQUE wersji, Approved bez snapshotu) — nie deklaratywnie, tylko przez constraint/trigger.
- `aliases` daje jawną, kompletną (0% orphan) ścieżkę migracji z 60-tabelowego inwentarza, zgodną z równaniem WP-A01 "input = candidate + quarantine + excluded".
- Schemat jest addytywny — nic w istniejących 60 tabelach się nie zmienia w tym ADR; WP-C01/C02 mogą budować adaptery bez ryzyka regresji na legacy endpointach w oknie kompatybilności.
- `finance_value_status` domyka problem #2 (silent-zero) na poziomie typu, zanim jakikolwiek Gate D silnik zacznie pisać dane.

**Negatywne / koszty:**
- Pięć nowych tabel + trigger immutability + partial unique indexes to dodatkowa złożoność operacyjna (WP-B07 musi objąć je observability/runbookami).
- `working_revisions` jako append-only log rośnie szybko (każdy autosave/Compute = nowy wiersz) — Gate C/backfill i długoterminowa retencja (WP-B06) muszą zaplanować partycjonowanie/archiwizację, inaczej tabela stanie się wąskim gardłem przy dużej liczbie tenantów (capacity planning z sekcji 4.9 addendum).
- `compute_snapshot_id`/`compute_run_id` bez FK aż do WP-B04 to tymczasowe osłabienie integralności referencyjnej — świadomie zaakceptowane, żeby nie blokować WP-B01 na jeszcze nie zaprojektowanym WP-B04, ale wymaga pilnowania w code review do czasu domknięcia FK.
- Backfill `financial_model_events` (decyzje finansowe w Baseline) nie ma jeszcze docelowego miejsca — wymaga decyzji przed WP-C03 (§5).

**Ryzyka:**
- Jeśli WP-B04 zaprojektuje `compute_runs`/`compute_snapshots` z PK innego typu niż TEXT (np. natywny UUID), dodanie FK będzie wymagało konwersji typu kolumny w `business_versions`/`working_revisions` — rekomendacja: WP-B04 powinien przyjąć ten sam wzorzec `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`, który już obowiązuje w całym żywym schemacie (zob. Gate A, wszystkie 60 tabel).
- Partial unique index `UNIQUE(artifact_id) WHERE status='APPROVED'` zakłada, że w danym momencie istnieje **co najwyżej jedna** obowiązująca Approved wersja per artefakt. To jest zgodne z master planem, ale gdyby Gate D (np. Valuation z wieloma równoległymi Case'ami) chciał wielu jednocześnie "aktywnych" Approved wariantów pod jednym artefaktem, trzeba by zmienić model na wiele `artifacts` (jeden per wariant) zamiast jednego z wieloma Approved — do potwierdzenia przy WP-D05 (DEC-FIN-006 mówi "jedna Valuation Case może zawierać wiele wariantów/wersji", co sugeruje: wariant = osobny `artifact_id`, wersja wariantu = `business_version_id`; ten ADR jest z tym spójny, ale warto to jawnie zweryfikować przy projektowaniu WP-D05).

---

## 5. Decyzje wymagające sign-off orkiestratora/Piotra

DEC-FIN-012 rozstrzyga rutynowe pytania techniczne na poziomie zespołu. Poniższe punkty **nie są** rutynowe — dotyczą albo widoczności historycznych danych klienta, albo zakresu produktu — i powinny wrócić do orkiestratora/Piotra przed WP-C03 (backfill):

1. **Los `financial_model_events` (decyzje finansowe dziś żyjące w Baseline).** Dwie opcje: (a) retroaktywnie przepakować `debt_drawdown/debt_repayment/equity_injection/dividend/capex_purchase` jako materiał startowy dla nowo tworzonych artefaktów `PREDICTION_SCENARIO` — to **tworzy nowe dane scenariuszowe**, których organizacja nigdy jawnie nie przejrzała jako scenariusz; (b) zostawić je w `QUARANTINE` przez alias (`business_version_id = NULL`) i wymagać ręcznego, świadomego odtworzenia w Prediction przez analityka. Opcja (a) jest wygodniejsza operacyjnie, ale zmienia to, co klient zobaczy jako "swoje dane" bez jego udziału — to jest właśnie rodzaj decyzji, którą DEC-FIN-012 każe eskalować (dotyczy widoczności/integralności danych klienta), nie rutynowa technikalia.
2. **Merge/deprecate/keep dla trzech magazynów NPV/IRR/ROI** (`financial_analyses`, `analysis_financials`, `initiative_financials`) — Gate A już to oznaczył jako wymagającą jawnej decyzji przed Gate B (koniec sekcji 6 manifestu). Ten ADR nie rozstrzyga tego merge'u; `aliases` obsłuży dowolny wynik, ale wybór (jedna kanoniczna liczba per initiative vs trzy równoległe z jawnym rozróżnieniem "dlaczego różne") wpływa na to, jaką liczbę NPV/IRR klient widzi jako "prawdziwą" — potencjalnie reputacyjne, jeśli dziś różne części produktu pokazują różne liczby dla tego samego przypadku.
3. **Zakres klastra "Value Tracking" (M16, `finance-value.routes.ts`, żywy i zamontowany, 802 linie).** Gate A stwierdza wprost: nie pojawia się nigdzie w rejestrze OWN-FIN ani w 12 problemach z handoffu, ale jest produkcyjnie żywy. Zanim WP-B01 doda dla niego `artifact_type`, potrzebna jest decyzja: czy ten klaster wchodzi w zakres przebudowy Finance v3, czy zostaje osobnym torem — to zmiana zakresu produktu, nie technikalia.

Wszystkie pozostałe decyzje projektowe w tym ADR (kształt tabel, mechanizm immutability, partial unique indexes, konwencja `finance_value_status`) mieszczą się w DEC-FIN-012 i zostały rozstrzygnięte przez ten dokument bez potrzeby eskalacji.

---

## Załącznik A — DDL sketch (NIE do wykonania; materiał wejściowy dla WP-C01)

```sql
-- ============================================================
-- WP-B01 DDL SKETCH — Finance v3 canonical artifact/version schema
-- STATUS: PROJEKT / ADR, nie migracja. Nie umieszczać w server/migrations/
-- bez przejścia przez WP-C01 (Gate C, additive migrations, real Postgres
-- fresh+upgrade replay). Zero wykonania w ramach WP-B01.
-- ============================================================

-- --------------------------------------------------------------
-- 0. Wspólny typ wartości finansowej (master plan §2.4)
-- Konwencja dla przyszłych tabel wartości Gate D, nie osobna tabela B01.
-- --------------------------------------------------------------
CREATE TYPE finance_value_status AS ENUM (
  'PRESENT_ZERO',
  'PRESENT_NONZERO',
  'MISSING',
  'NA',
  'NOT_APPLICABLE'
);
-- Przykładowy bundle kolumn, do powielenia w Gate D domain tables:
--   value_status   finance_value_status NOT NULL,
--   value_decimal  NUMERIC,              -- NULL tylko gdy status IN (MISSING,NA,NOT_APPLICABLE)
--   native_currency TEXT,
--   presentation_currency TEXT,
--   unit           TEXT,
--   multiplier     NUMERIC DEFAULT 1,
--   period_id      TEXT,
--   entity_id      TEXT,
--   source_ref     TEXT,
--   is_adjustment  BOOLEAN DEFAULT false,
--   adjustment_reason TEXT,
--   CHECK (
--     (value_status = 'PRESENT_ZERO'    AND value_decimal = 0) OR
--     (value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL AND value_decimal <> 0) OR
--     (value_status IN ('MISSING','NA','NOT_APPLICABLE') AND value_decimal IS NULL)
--   )

-- --------------------------------------------------------------
-- 1. finance_artifacts — tożsamość, nie treść
-- --------------------------------------------------------------
CREATE TABLE finance_artifacts (
  artifact_id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id         TEXT NOT NULL REFERENCES organizations(id),
  artifact_type           TEXT NOT NULL CHECK (artifact_type IN (
                             'STATEMENT_PACK', 'HISTORICAL_ANALYSIS', 'BASELINE_MODEL',
                             'PREDICTION_SCENARIO', 'VALUATION_CASE', 'REPORT_EXPORT'
                           )),
  natural_key             TEXT,               -- opcjonalny idempotency key dla re-importu
  current_business_version_id TEXT,           -- denormalizowany cache; FK dodany po CREATE finance_business_versions
  created_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at             TIMESTAMPTZ,
  archived_reason         TEXT,

  -- Same-org parent enforcement: pozwala dzieciom robić złożony FK (artifact_id, organization_id)
  CONSTRAINT uq_finance_artifacts_org UNIQUE (artifact_id, organization_id)
);

CREATE INDEX idx_finance_artifacts_org_type ON finance_artifacts(organization_id, artifact_type);

-- --------------------------------------------------------------
-- 2. finance_engine_manifests — reprodukowalność (nie org-scoped: opisuje kod, nie dane tenanta)
-- --------------------------------------------------------------
CREATE TABLE finance_engine_manifests (
  engine_manifest_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  engine_name               TEXT NOT NULL,
  engine_version             TEXT NOT NULL,
  code_commit_sha            TEXT NOT NULL,
  formula_taxonomy_version   TEXT,
  market_data_asof           TIMESTAMPTZ,
  config_hash                TEXT NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_engine_manifest UNIQUE (engine_name, engine_version, code_commit_sha, config_hash)
);

-- Sentinel wiersz dla backfillu legacy, gdzie manifest nie jest znany:
-- INSERT INTO finance_engine_manifests (engine_name, engine_version, code_commit_sha, config_hash)
--   VALUES ('LEGACY_UNKNOWN', '0', 'unknown', 'unknown');

-- --------------------------------------------------------------
-- 3. finance_business_versions — immutable milestone (vN)
-- --------------------------------------------------------------
CREATE TABLE finance_business_versions (
  business_version_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id              TEXT NOT NULL,
  organization_id           TEXT NOT NULL,
  version_no                INTEGER NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                               'DRAFT', 'READY_FOR_REVIEW', 'IN_REVIEW', 'APPROVED',
                               'NEEDS_CHANGES', 'SUPERSEDED', 'ARCHIVED', 'INVALIDATED'
                             )),
  freshness                  TEXT NOT NULL DEFAULT 'NEVER_COMPUTED' CHECK (freshness IN (
                               'NEVER_COMPUTED', 'CURRENT', 'STALE_SOURCE', 'STALE_ASSUMPTIONS', 'COMPUTE_FAILED'
                             )),
  source_working_revision_id TEXT,             -- FK dodany niżej po CREATE finance_working_revisions
  parent_version_id          TEXT REFERENCES finance_business_versions(business_version_id),
  superseded_by_version_id   TEXT REFERENCES finance_business_versions(business_version_id),

  -- Forward references do WP-B04 (compute_jobs/compute_runs/compute_outputs) — bez FK aż do WP-B04.
  compute_snapshot_id        TEXT,
  compute_run_id             TEXT,
  engine_manifest_id         TEXT NOT NULL REFERENCES finance_engine_manifests(engine_manifest_id),
  content_semantic_hash      TEXT,

  approved_by                TEXT,
  approved_at                TIMESTAMPTZ,
  approval_note               TEXT,
  invalidated_reason          TEXT,
  immutable_since              TIMESTAMPTZ,

  created_by                  TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_bv_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  -- Odpowiedź na brak UNIQUE(model_id, version) / UNIQUE(valuation_id, version) z Gate A:
  CONSTRAINT uq_finance_bv_artifact_version UNIQUE (artifact_id, version_no)
);

-- Co najwyżej jedna APPROVED wersja biznesowa per artefakt w danym momencie:
CREATE UNIQUE INDEX uq_finance_bv_one_approved
  ON finance_business_versions (artifact_id)
  WHERE status = 'APPROVED';

CREATE INDEX idx_finance_bv_artifact ON finance_business_versions(artifact_id, version_no);
CREATE INDEX idx_finance_bv_org_status ON finance_business_versions(organization_id, status);

-- --------------------------------------------------------------
-- 4. finance_working_revisions — mutable Draft, append-only checkpoints
-- --------------------------------------------------------------
CREATE TABLE finance_working_revisions (
  working_revision_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id                 TEXT NOT NULL,
  organization_id              TEXT NOT NULL,
  business_version_id          TEXT REFERENCES finance_business_versions(business_version_id),
  revision_seq                  BIGINT NOT NULL,
  content_semantic_hash          TEXT,
  compute_run_id                  TEXT,        -- forward reference do WP-B04, bez FK na razie
  is_current                       BOOLEAN NOT NULL DEFAULT true,
  crash_recovery_checkpoint         BOOLEAN NOT NULL DEFAULT false,
  edited_by                          TEXT,
  edited_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_wr_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT uq_finance_wr_artifact_seq UNIQUE (artifact_id, revision_seq)
);

-- Dokładnie jeden "żywy" Draft per artefakt:
CREATE UNIQUE INDEX uq_finance_wr_one_current
  ON finance_working_revisions (artifact_id)
  WHERE is_current;

CREATE INDEX idx_finance_wr_artifact ON finance_working_revisions(artifact_id, revision_seq DESC);

-- Teraz, gdy finance_business_versions i finance_working_revisions istnieją, domykamy
-- odroczone FK (deferred, addytywne ALTER — kolejność wymuszona przez wzajemną zależność):
ALTER TABLE finance_business_versions
  ADD CONSTRAINT fk_finance_bv_source_wr
  FOREIGN KEY (source_working_revision_id)
  REFERENCES finance_working_revisions (working_revision_id);

ALTER TABLE finance_artifacts
  ADD CONSTRAINT fk_finance_artifacts_current_bv
  FOREIGN KEY (current_business_version_id)
  REFERENCES finance_business_versions (business_version_id);

-- --------------------------------------------------------------
-- 5. finance_artifact_aliases — pomost legacy → canonical
-- --------------------------------------------------------------
CREATE TABLE finance_artifact_aliases (
  alias_id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  legacy_table          TEXT NOT NULL,          -- np. 'financial_models', 'financial_model_versions'
  legacy_id              TEXT NOT NULL,         -- legacy PK jako TEXT, także dla legacy INTEGER PK
  legacy_version           TEXT,                -- legacy 'version'/'version_no' jako TEXT, NULL jeśli n/d
  artifact_id                TEXT NOT NULL,
  organization_id              TEXT NOT NULL,   -- zawsze TEXT na granicy aliasu, nawet gdy legacy było INTEGER
  business_version_id            TEXT REFERENCES finance_business_versions(business_version_id),
  mapping_confidence               TEXT NOT NULL CHECK (mapping_confidence IN (
                                     'AUTO_MIGRATE', 'MIGRATE_WITH_WARNING', 'QUARANTINE', 'EXCLUDE_WITH_REASON'
                                   )),
  mapping_reason                     TEXT,
  created_by                          TEXT,      -- id joba backfillu (WP-C03), nie użytkownika
  created_at                            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_alias_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT uq_finance_alias_legacy UNIQUE (legacy_table, legacy_id, legacy_version)
);

CREATE INDEX idx_finance_alias_artifact ON finance_artifact_aliases(artifact_id);
CREATE INDEX idx_finance_alias_org ON finance_artifact_aliases(organization_id);
CREATE INDEX idx_finance_alias_legacy_table ON finance_artifact_aliases(legacy_table);

-- --------------------------------------------------------------
-- 6. Immutability enforcement — DB constraint hybrid (trigger)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION finance_bv_enforce_immutability() RETURNS TRIGGER AS $$
BEGIN
  -- Approved wymaga compute_snapshot_id (odpowiedź na "Approved bez snapshotu" z Gate A):
  IF NEW.status = 'APPROVED' AND NEW.compute_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'finance_business_versions: cannot APPROVE % without compute_snapshot_id', NEW.business_version_id;
  END IF;

  -- Approved -> tylko przejście do SUPERSEDED/ARCHIVED/INVALIDATED, i tylko meta-kolumny się zmieniają:
  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' THEN
    IF NEW.status NOT IN ('SUPERSEDED', 'ARCHIVED', 'INVALIDATED') THEN
      RAISE EXCEPTION 'finance_business_versions: % is APPROVED and immutable; only SUPERSEDED/ARCHIVED/INVALIDATED transitions allowed', OLD.business_version_id;
    END IF;
    IF NEW.version_no IS DISTINCT FROM OLD.version_no
       OR NEW.artifact_id IS DISTINCT FROM OLD.artifact_id
       OR NEW.compute_snapshot_id IS DISTINCT FROM OLD.compute_snapshot_id
       OR NEW.content_semantic_hash IS DISTINCT FROM OLD.content_semantic_hash
       OR NEW.engine_manifest_id IS DISTINCT FROM OLD.engine_manifest_id
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'finance_business_versions: % is APPROVED; only status/superseded_by_version_id/invalidated_reason/updated_at may change', OLD.business_version_id;
    END IF;
    IF NEW.status = 'INVALIDATED' AND (NEW.invalidated_reason IS NULL OR NEW.invalidated_reason = '') THEN
      RAISE EXCEPTION 'finance_business_versions: INVALIDATED requires invalidated_reason (DEC-FIN-007)';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_bv_immutability
  BEFORE UPDATE ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_bv_enforce_immutability();

-- --------------------------------------------------------------
-- 7. Denormalizowany cache finance_artifacts.current_business_version_id
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION finance_artifacts_sync_current_bv() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'APPROVED' THEN
    UPDATE finance_artifacts
      SET current_business_version_id = NEW.business_version_id
      WHERE artifact_id = NEW.artifact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_artifacts_sync_current_bv
  AFTER INSERT OR UPDATE ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_artifacts_sync_current_bv();

-- ============================================================
-- KONIEC SZKICU. WP-C01 dostarcza to jako sekwencyjne migracje
-- (expand-only, NOT VALID gdzie potrzebne, real Postgres fresh+upgrade
-- replay, lock-time zmierzony) — nie jako jeden plik 1:1 z powyższego.
-- ============================================================
```

---

## Załącznik B — Przykład mapowania legacy → canoniczny schemat: Baseline Model

Scenariusz: `financial_models` wiersz `fm_123` (organization_id `'org_9'`, status `'approved'`, `version = 2`, `approved_snapshot` wypełniony), z dwoma wierszami w `financial_model_versions` (`v1`, `v2`) i trzema wierszami w `financial_model_events` (dwa harmonogramowe, jeden `debt_drawdown`).

**Krok 1 — `finance_artifacts`:**

| artifact_id | organization_id | artifact_type | natural_key |
|---|---|---|---|
| `art_bm_fm123` | `org_9` | `BASELINE_MODEL` | `legacy:financial_models:fm_123` |

**Krok 2 — `finance_business_versions`** (jeden wiersz per historyczna wersja `financial_model_versions`, plus bieżąca `financial_models` sama w sobie reprezentuje najnowszą):

| business_version_id | artifact_id | version_no | status | compute_snapshot_id | engine_manifest_id | approved_by |
|---|---|---|---|---|---|---|
| `bv_fm123_v1` | `art_bm_fm123` | 1 | `SUPERSEDED` | `snap_fm123_v1` (minted z `financial_model_versions.snapshot_data` dla v1) | `LEGACY_UNKNOWN` | (z `financial_model_versions.approved_by` dla v1, jeśli wypełnione) |
| `bv_fm123_v2` | `art_bm_fm123` | 2 | `APPROVED` | `snap_fm123_v2` (minted z `financial_models.approved_snapshot`) | `LEGACY_UNKNOWN` | `financial_models.approved_by` |

`bv_fm123_v1.superseded_by_version_id = bv_fm123_v2`. Backfill (WP-C03) ustawia `v1` na `SUPERSEDED` niezależnie od tego, czy legacy wiersz kiedykolwiek formalnie miał status `approved` — sam fakt, że istnieje `v2` nowszy, wystarcza do klasyfikacji `v1` jako superseded w nowym modelu (assumption jawnie udokumentowana w `mapping_reason` aliasu, do weryfikacji przy WP-A03 row-level classification).

**Krok 3 — `financial_model_events` (decyzje finansowe w Baseline, Gate A QUARANTINE):** dwa harmonogramowe eventy (jeśli faktycznie reprezentują baseline schedule, nie decyzję) idą do treści `working_revisions` powiązanej z `bv_fm123_v2` po ręcznej klasyfikacji Gate-B (§5 pkt 1); wiersz `debt_drawdown` **nie** jest migrowany do żadnego `business_version_id` — dostaje alias z `business_version_id = NULL`, `mapping_confidence = 'QUARANTINE'`, do czasu decyzji orkiestratora/Piotra o docelowym miejscu (opcja (a)/(b) w §5).

**Krok 4 — `finance_artifact_aliases`:**

| legacy_table | legacy_id | legacy_version | artifact_id | business_version_id | mapping_confidence | mapping_reason |
|---|---|---|---|---|---|---|
| `financial_models` | `fm_123` | `NULL` | `art_bm_fm123` | `bv_fm123_v2` | `MIGRATE_WITH_WARNING` | "reopen-in-place mutation bug (Gate A, financialModelingService.ts ~L2001/2047/2059); potwierdzić brak przerwanego reopen przed cutover" |
| `financial_model_versions` | `v1` | `1` | `art_bm_fm123` | `bv_fm123_v1` | `AUTO_MIGRATE` | "czysty numbered snapshot, brak niejednoznaczności" |
| `financial_model_versions` | `v2` | `2` | `art_bm_fm123` | `bv_fm123_v2` | `AUTO_MIGRATE` | "zgodne z financial_models.version=2 i approved_snapshot" |
| `financial_model_events` | `evt_schedule_1` | `NULL` | `art_bm_fm123` | `bv_fm123_v2` (po klasyfikacji) | `MIGRATE_WITH_WARNING` | "harmonogramowy event, nie decyzja finansowa — do weryfikacji Gate-B" |
| `financial_model_events` | `evt_debt_drawdown_1` | `NULL` | `art_bm_fm123` | `NULL` | `QUARANTINE` | "decyzja finansowa (debt_drawdown) w Baseline narusza DEC-FIN-002; wymaga decyzji orkiestratora/Piotra §5.1 przed backfillem" |

Ten przykład pokazuje mechanikę end-to-end: żaden legacy wiersz nie ginie (każdy ma alias), niejednoznaczne/sprzeczne-z-polityką dane trafiają do jawnej kwarantanny zamiast cichej migracji, a `UNIQUE(artifact_id, version_no)` + partial-unique `APPROVED` gwarantują, że po backfillu `art_bm_fm123` ma dokładnie jedną obowiązującą wersję.
