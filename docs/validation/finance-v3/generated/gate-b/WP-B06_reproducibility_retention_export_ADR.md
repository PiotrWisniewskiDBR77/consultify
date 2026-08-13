# ADR WP-B06 — Reproducibility, Restatement, Retention i Export dla Finance

**Status:** `PROPOSED` (Gate B, do akceptu wg DEC-FIN-012; §9 wymaga sign-off orkiestratora/Piotra — decyzje prawne/kosztowe)
**Data:** 2026-08-09
**Work package:** WP-B06, `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` Gate B, Owner: Model Risk/Legal/Data — P0/P1
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Rodzaj dokumentu:** ADR (Architecture Decision Record). **Brak żywego kodu, brak migracji, zero połączeń z bazą** — zgodnie z twardym zakazem briefu. Implementacja wchodzi w Gate C (WP-C01) po zatwierdzeniu Gate B w całości.

**Zakaz respektowany:** ten dokument nie łączy się z żadną bazą, nie tworzy plików w `server/migrations/`, nie uruchamia migracji i **nie decyduje** o konkretnych okresach retencji ani jurysdykcji prawnej — patrz §7/§9 dla mechanizmu konfigurowalnego i jawnej eskalacji.

---

## 0. Wejścia przeczytane w całości przed napisaniem tego ADR

1. `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` — nazewnictwo kanoniczne (`finance_` prefix, PK `business_version_id`), brakujące kolumny na `finance_business_versions` już przyznane B02/B03, placeholder materialności `PROVISIONAL_PENDING_OWNER_DECISION` jako wzorzec eskalacji.
2. `docs/validation/finance-v3/generated/gate-b/WP-B01_artifact_schema_ADR.md` — pełny DDL sketch `finance_artifacts`, `finance_business_versions`, `finance_working_revisions`, `finance_artifact_aliases`, `finance_engine_manifests`; immutability trigger; `finance_value_status`.
3. `docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md` — state machine, atomowy approval (krok (b) `INSERT compute_snapshots` — **tabela referencjonowana, nigdy formalnie zaprojektowana w B01/B02/B04**), reopen bez mutacji w miejscu, race rules.
4. `docs/validation/finance-v3/generated/gate-b/WP-B03_lineage_staleness_ADR.md` — `finance_lineage_edges`, `transformation_kind` (zawiera już `RESTATEMENT_CARRY`, zdefiniowany nazewniczo, **nigdy operacyjnie**), freshness propagation, priorytet `reason_code`.
5. `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md` — `compute_jobs`/`compute_job_runs`/`compute_job_outputs` (uwaga: **bez** prefiksu `finance_` — niespójność nieadresowana przez rekoncyliację, bo ta objęła tylko B01–B03; traktowana tu jako zależność forward-reference, patrz §3.5).
6. `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` — sekcja WP-B06 (linia 144–146), sekcja 8 „Decyzje wymagane przed kodowaniem" pkt 6 („Delete Approved: zakaz czy soft-delete; retention/legal hold").
7. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` — sekcja 5 „Governance i model risk" pkt 6 („Reproducibility manifest przypina engine/code, formula/taxonomy, FX/market data i as-of/timezone"); `DEC-FIN-007` (usuwanie zatwierdzonych — Superseded/Archived/Invalidated, prawne usunięcie tylko przez retention/GDPR/legal hold); `DEC-FIN-009` (exception ledger, Provisional); `DEC-FIN-010` (working revisions vs business versions); `DEC-FIN-011` (lineage DAG); `DEC-FIN-012` (kto decyduje dalej); WP-D01 DoD („original/restated zachowane").

---

## 1. Kontekst i architektoniczne napięcie do rozstrzygnięcia

Brief WP-B06 (i literalne brzmienie master planu) sugeruje dopisanie `fiscal_calendar`, `fx_snapshot_id`, `market_data_snapshot_id`, `locale`, `timezone`, `as_of`, `rounding_convention` bezpośrednio na `finance_engine_manifests`. Sprawdzenie B01 pokazuje, że założenie brief-u „prawdopodobnie tylko referencja, bez pełnej treści" jest **nieaktualne** — B01 §2.5 już zdefiniowało pełną tabelę: `engine_manifest_id, engine_name, engine_version, code_commit_sha, formula_taxonomy_version, market_data_asof (nullable), config_hash, created_at`, z `UNIQUE(engine_name, engine_version, code_commit_sha, config_hash)` i jawnym uzasadnieniem: **„Nie jest org-scoped — opisuje wersję kodu, nie dane tenantów"**.

To uzasadnienie jest fundamentalne i tworzy bezpośredni konflikt z literalną listą kolumn z briefu:

- `fx_snapshot_id`, `market_data_snapshot_id` — który zestaw kursów/danych rynkowych był aktywny — **różni się per compute run**, nawet przy identycznym kodzie silnika (ten sam `engine_version` liczy dziś i za miesiąc, z innym FX snapshotem).
- `fiscal_calendar`, `locale`, `timezone` — **różnią się per organizacja** (dwie organizacje na tym samym `engine_version` mogą mieć różne kalendarze fiskalne i strefy czasowe).
- `as_of` — z definicji **różni się per uruchomienie compute**, nie per wersja kodu.

Gdyby te pola trafiły na `finance_engine_manifests`, złamałoby to `UNIQUE(engine_name, engine_version, code_commit_sha, config_hash)` — każda organizacja, każdy dzień, każdy FX snapshot wymagałby **nowego wiersza manifestu**, mimo identycznego kodu. To dokładnie unieważnia deklarowany cel tabeli (dedup identycznego kodu, reużywanego między organizacjami) i przywraca dokładnie ten sam błąd koncepcyjny, którego B01 świadomie unikało („to świadome odstępstwo od »organization_id wszędzie« i jest tu jawnie uzasadnione, żeby nie wyglądało na przeoczenie" — B01 §2.5).

**Decyzja tego ADR:** rozdzielamy **tożsamość kodu** (`finance_engine_manifests`, bez zmiany filozofii B01) od **kontekstu odtwarzalności per uruchomienie** (nowa tabela `finance_compute_snapshots`, §3.2) — dokładnie ta druga tabela jest tabelą, którą B02 §5.1 krok (b) już referencjonuje jako `INSERT compute_snapshots (immutable copy...)`, ale nigdy formalnie nie zaprojektował. WP-B06 domyka więc **jednocześnie**: (a) literalne wymaganie brief-u „reproducibility manifest" z governance §5.6, (b) lukę projektową pozostawioną otwartą przez B02, (c) integralność deduplikacji `finance_engine_manifests` z B01. To jest decyzja architektoniczna w zakresie `DEC-FIN-012` (techniczna, nie strategiczna) — dokumentowana tu jawnie, nie eskalowana.

---

## 2. Decyzja — skrót

1. **`finance_engine_manifests`** pozostaje tożsamością kodu (B01, bez zmiany filozofii); dopisujemy tylko to, co jest właściwością *kodu/formuły*, nie danych uruchomienia: `rounding_convention` (domyślna konwencja zaokrągleń silnika, wersjonowana razem z formułami). Rekomendujemy WP-B01 amendment: deprecate `market_data_asof` na tej tabeli (błędnie umieszczone — to własność uruchomienia, nie kodu), zastąpione przez `finance_compute_snapshots.as_of`.
2. **Nowa tabela `finance_compute_snapshots`** niesie pełny kontekst odtwarzalności per zamrożone uruchomienie: `fiscal_calendar_id`, `fx_snapshot_id`, `market_data_snapshot_id`, `locale`, `timezone`, `as_of`, `engine_manifest_id` (FK), plus dowiązanie do `working_revision_id`/`compute_run_id`. To jest literalny „reproducibility manifest" z governance §5.6, przypięty do konkretnego `finance_business_versions.compute_snapshot_id`.
3. **`finance_business_versions.version_kind`** (`ORIGINAL | RESTATED | MANAGEMENT_ADJUSTED`) — nowa kolumna, dopisek do zbioru z `GATE_B_INTEGRATION_RECONCILIATION.md` §2 (ten dokument dodaje kolejny wiersz do tej samej tabeli różnic). Restatement używa **istniejącej** mechaniki reopen z B02 §6 (append-only, nowa wersja, stary wiersz nietykalny) plus obowiązkowy `restatement_reason`. Management-adjusted **nie** jest kolejną wersją tego samego artefaktu (złamałoby `UNIQUE(artifact_id) WHERE status='APPROVED'` z B01) — jest **osobnym `artifact_id`** połączonym krawędzią lineage, zgodnie z tym samym wzorcem, który B01 §4 (Ryzyka) już rekomendował dla wariantów Valuation.
4. **`finance_retention_policies`** — konfigurowalna, per organizacja i per typ artefaktu, dane nie hardcode; brak konkretnej liczby dni/lat — jawnie oznaczone `PENDING_OWNER_DECISION` (ten sam wzorzec co placeholder materialności z `GATE_B_INTEGRATION_RECONCILIATION.md` §7).
5. **`finance_legal_holds`** — flaga blokująca nawet dozwolone przejścia stanu (`archive`/`invalidate`/przyszłe retention-driven delete), dodatkowy guard w state machine B02, niezależny od `risk_tier`/SoD.
6. **`finance_export_manifests`** (+ `finance_export_manifest_sources`, `finance_export_evidence_items`) — immutable, version-pinned, evidence appendix, signed URL **przez wskaźnik do storage + on-demand generacja** (nie przechowywanie żywego podpisanego URL — uzasadnienie bezpieczeństwa w §6.4), dwa osobne hashe (semantic vs raw file) do dokładnej rekoncyliacji.

---

## 3. `finance_engine_manifests` i `finance_compute_snapshots` — reprodukowalność

### 3.1 `finance_engine_manifests` — amendment do B01 (dopisek, nie duplikat)

| Kolumna z briefu | Status na B01 dziś | Decyzja WP-B06 |
|---|---|---|
| `code_sha` | `code_commit_sha` już istnieje | Bez zmian — nazwa `code_commit_sha` jest już spójna z resztą schematu (B04 też używa `code_commit_sha`-podobnej konwencji); `code_sha` z briefu to ten sam koncept, nie nowa kolumna. |
| `engine_version` | już istnieje | Bez zmian. |
| `formula_taxonomy_version` | już istnieje | Bez zmian. |
| `rounding_convention` | brak | **Dodać.** `TEXT NOT NULL DEFAULT 'BANKERS_ROUNDING_2DP'` — to jest właściwość *jak silnik zaokrągla przy obliczeniach*, wersjonowana razem z kodem (zmiana konwencji = nowy `engine_version`), więc należy tu, nie na compute_snapshot. Zgodne z B01 §2.7 („Rounding dzieje się wyłącznie na granicy prezentacji") — to pole opisuje **domyślną** konwencję silnika; per-eksport override żyje na `finance_export_manifests` (§6.2), nie tutaj. |
| `fiscal_calendar` | brak | **Nie tutaj** — patrz §3.2, to własność uruchomienia/organizacji, nie kodu. |
| `fx_snapshot_id` | brak | **Nie tutaj** — patrz §3.2. |
| `market_data_snapshot_id` | brak (jest `market_data_asof`, TIMESTAMPTZ) | **Nie tutaj.** Rekomendacja amendmentu do B01: `market_data_asof` na `finance_engine_manifests` jest błędnie umiejscowione z tych samych powodów co pozostałe pola uruchomienia — oznaczyć jako `DEPRECATED, superseded by finance_compute_snapshots.market_data_snapshot_id/as_of` w Załączniku A B01 przy najbliższej wspólnej rewizji Gate B (żaden kod jeszcze nie istnieje, więc to czysta korekta projektu, nie migracja naprawcza). |
| `locale` | brak | **Nie tutaj** — patrz §3.2 i §6.2 (dwa miejsca: co było aktywne przy compute, co jest przypięte do exportu). |
| `timezone` | brak | **Nie tutaj** — jak wyżej. |
| `as_of` | brak (częściowo `market_data_asof`) | **Nie tutaj** — patrz §3.2. |

**Uzasadnienie rozdziału (powtórzone z §1 dla czytelności tabeli):** kod = deduplikowany, reużywalny między organizacjami i uruchomieniami; kontekst uruchomienia = unikalny per compute, nigdy deduplikowany. Mieszanie ich w jednej tabeli niszczy UNIQUE constraint B01 bez żadnej korzyści — rozdzielenie nie jest dodatkową złożonością kosmetyczną, jest wymogiem, żeby `finance_engine_manifests` w ogóle mogło pełnić swoją zadeklarowaną funkcję.

### 3.2 `finance_compute_snapshots` — nowa tabela, domyka lukę B02 §5.1(b)

Jeden wiersz = jeden **zamrożony kontekst odtwarzalności**, tworzony wyłącznie przez krok (b) atomowego approval z B02 §5.1 (`INSERT`, nigdy `UPDATE`) albo przez WP-B04 przy każdym udanym `compute_job_output` (nie tylko przy approval — draft compute też potrzebuje odtwarzalności do debugowania/porównań przed formalnym zatwierdzeniem).

Pola: `compute_snapshot_id` (PK), `artifact_id` + `organization_id` (złożony FK do `finance_artifacts`, ten sam wzorzec „same-org parent enforcement" co reszta B01), `working_revision_id` (FK do `finance_working_revisions` — z którego draftu powstał), `compute_run_id` (forward reference do `compute_job_outputs`/`compute_job_runs` z B04, **bez FK** na razie z tego samego powodu co `finance_business_versions.compute_run_id` w B01 — kolumna istnieje jako TEXT/nullable, FK dorzuca WP-B04 lub wspólna rewizja WP-B01/B04/B06 addytywnym `ALTER TABLE`), `engine_manifest_id` (FK do `finance_engine_manifests`, **obowiązkowy** — nie ma compute bez znanego kodu, nawet dla legacy backfill dostaje `LEGACY_UNKNOWN` sentinel z B01 §2.5), `fiscal_calendar_id` (TEXT, forward reference — rejestr kalendarzy fiskalnych nie jest jeszcze zaprojektowany w żadnym WP; master plan wspomina „fiscal calendars" jako część WP-D01 Statements, więc ta kolumna czeka na FK z Gate D, tymczasowo wolnostojący TEXT snapshot identyfikatora/hasha konfiguracji), `fx_snapshot_id` (TEXT, forward reference — analogicznie, właściciel prawdopodobnie WP-D01/silnik FX), `market_data_snapshot_id` (TEXT, forward reference, jak wyżej), `locale` (TEXT, np. `pl-PL`, `en-US` — co było aktywne dla formatowania/interpretacji przy compute), `timezone` (TEXT, IANA tz np. `Europe/Warsaw` — jak `as_of` i granice okresu są interpretowane), `as_of` (TIMESTAMPTZ NOT NULL — moment, na który dane rynkowe/FX są ważne; odróżnić od `created_at`, które jest momentem *wykonania* compute, nie momentem *danych*), `content_semantic_hash` (hash treści wejścia, spójny z definicją z B01/B03 — semantic, nie raw), `created_by`, `created_at`.

`UNIQUE(working_revision_id, compute_run_id)` — nie więcej niż jeden snapshot per faktyczne uruchomienie compute (odpowiedź na „exactly-once" z B04 §3.3 — snapshot jest 1:1 z `compute_job_outputs`, nie duplikuje się przy retry, bo `compute_job_outputs` już gwarantuje dokładnie jeden committed output per job).

**Immutable z definicji** — brak triggera potrzebnego, bo tabela nigdy nie dostaje `UPDATE` (append-only jak `finance_lineage_edges`, ten sam wzorzec grantów DB `INSERT, SELECT` bez `UPDATE`/`DELETE` dla roli aplikacyjnej, zgodny z B03 §3.1).

`finance_business_versions.compute_snapshot_id` (już istniejący TEXT w B01) dostaje docelowy FK do `finance_compute_snapshots(compute_snapshot_id)` w tym samym oknie, w którym B01/B04 domykają FK do `compute_run_id` — jedna wspólna rewizja Gate C, nie osobna migracja.

### 3.3 Relacja do governance §5.6 (traceability)

> „Reproducibility manifest przypina engine/code, formula/taxonomy, FX/market data i as-of/timezone."

| Element governance §5.6 | Gdzie żyje |
|---|---|
| engine/code | `finance_engine_manifests.engine_name/engine_version/code_commit_sha` |
| formula/taxonomy | `finance_engine_manifests.formula_taxonomy_version` |
| FX/market data | `finance_compute_snapshots.fx_snapshot_id/market_data_snapshot_id` |
| as-of/timezone | `finance_compute_snapshots.as_of/timezone` |

Pełny „manifest" wymagany przez governance to zawsze **złożenie** `finance_business_versions.engine_manifest_id → finance_engine_manifests` **i** `finance_business_versions.compute_snapshot_id → finance_compute_snapshots` — żadna pojedyncza tabela nie jest „całym" manifestem, co jest zgodne z rozdziałem kod/uruchomienie z §1.

### 3.4 Rounding convention na granicy eksportu (uzupełnienie B01 §2.7)

B01 §2.7 ustaliło: `value_decimal` zawsze pełna precyzja, rounding tylko na granicy prezentacji. WP-B06 domyka to dla exportu: `finance_export_manifests.rounding_convention_used` (§6.2) pinuje **efektywną** konwencję zastosowaną przy renderowaniu konkretnego eksportu — domyślnie dziedziczoną z `finance_engine_manifests.rounding_convention` danej wersji business, ale może być jawnie nadpisana przez analityka przy eksporcie (np. eksport dla innego rynku wymaga innej konwencji zaokrągleń prezentacyjnych) — nadpisanie jest logowane, nigdy ciche.

---

## 4. Original / restated / management-adjusted lineage

### 4.1 `version_kind` na `finance_business_versions` — nowa kolumna (dopisek do rekoncyliacji B01↔B02↔B03)

```sql
ALTER TABLE finance_business_versions
  ADD COLUMN version_kind TEXT NOT NULL DEFAULT 'ORIGINAL'
    CHECK (version_kind IN ('ORIGINAL', 'RESTATED', 'MANAGEMENT_ADJUSTED')),
  ADD COLUMN restatement_reason TEXT,
  ADD COLUMN restatement_class TEXT
    CHECK (restatement_class IN (
      'ERROR_CORRECTION', 'ACCOUNTING_POLICY_CHANGE', 'RECLASSIFICATION', 'OTHER'
    ));
```

`CHECK (version_kind = 'RESTATED' → restatement_reason IS NOT NULL AND restatement_class IS NOT NULL)` — obowiązkowy powód i klasa, egzekwowane tym samym mechanizmem co `INVALIDATED → invalidated_reason` w B01 §Załącznik A (trigger immutability już sprawdza analogiczny warunek dla `INVALIDATED`; ten ADR rozszerza go o `RESTATED` na T2/T8, nie tylko T11).

`v1` każdego artefaktu ma domyślnie `version_kind='ORIGINAL'`. `version_kind` **nie jest dziedziczone automatycznie** przy zwykłym reopen (B02 T12) — domyślnie nowy `vN+1` też jest `ORIGINAL` (kontynuacja tego samego zapisu, np. zwykła korekta przed publikacją szerszą), chyba że wywołujący jawnie oznaczy operację jako restatement (nowy parametr żądania `reopen` — `intent: 'CORRECTION' | 'RESTATEMENT'`, dopisek do kontraktu API B02 §4.2 body: `{ "expectedVersion": 7, "reason": "...", "versionKind": "RESTATED", "restatementClass": "ERROR_CORRECTION" }`). To jest jawna decyzja projektowa: **restatement to nie osobna operacja state machine**, to reopen (B02 T12) z dodatkowymi metadanymi — unika duplikowania całej maszyny stanów tylko dla innego etykietowania tego samego mechanizmu.

### 4.2 Dlaczego restatement używa mechaniki reopen, nie nowej krawędzi

Restatement koryguje **tę samą tożsamość** (ten sam okres, ten sam Statement Pack) — to dokładnie definicja `artifact_id` z B01 §2.1 („jeden wiersz na logiczny »obiekt pracy«... niezależnie od tego ile ma wersji"). Stary wiersz (`vN`, oryginał) **nigdy nie jest modyfikowany** (B02 §6.2 krok 6, dosłownie: „Wiersz vN (stary Approved) NIE jest modyfikowany żadnym UPDATE") — to jest fizyczna gwarancja „original nigdy nie jest nadpisywany" wymagana przez brief, już istniejąca w B02, WP-B06 tylko dokłada semantyczną etykietę (`version_kind`) i obowiązkowy powód.

Gdy `vN+1` (restated) osiąga `APPROVED`, `vN` (original) przechodzi `SUPERSEDED` przez T9 (B02 §6.4) — **status** się zmienia, **treść i snapshot nie**. `GET` na `vN` zawsze zwraca dokładnie to, co było pierwotnie zatwierdzone, oznaczone teraz jako `SUPERSEDED` z jawnym `superseded_by_version_id` wskazującym na wersję restated — pełna historia „co było najpierw ogłoszone, co potem skorygowane" jest odczytywalna bez żadnej dodatkowej tabeli.

### 4.3 Downstream staleness przy restatement — rozszerzenie priorytetu B03 §6.4

B03 §6.2 już definiuje: gdy przodek zostaje `SUPERSEDED`, dzieci dostają `STALE_SOURCE`/`NEW_SOURCE_VERSION`. Dla restatement to za mało — `NEW_SOURCE_VERSION` sugeruje rutynową nową wersję, podczas gdy `ERROR_CORRECTION` oznacza, że downstream artefakty zostały zbudowane na **błędnych danych**, nie tylko nieaktualnych.

**Rozszerzenie priorytetu reason_code (amendment do B03 §6.4):**

```
SOURCE_INVALIDATED (najwyższy)
  > RESTATED_ERROR_CORRECTION   -- NOWY, wprowadzony przez WP-B06
  > ASSUMPTION_REGISTRY_CHANGED
  > RESTATED_OTHER              -- NOWY (accounting policy change / reclassification / other)
  > NEW_SOURCE_VERSION
  > COMPUTE_ERROR (inna oś)
```

Reguła propagacji z B03 §6.3 pozostaje bez zmian (dwie fazy, brak auto-recompute) — WP-B06 zmienia tylko **który `reason_code` jest zapisywany** w kroku 1 algorytmu B03, w zależności od `finance_business_versions.restatement_class` wersji wyzwalającej. Gdy `version_kind='RESTATED' AND restatement_class='ERROR_CORRECTION'` → `RESTATED_ERROR_CORRECTION`; gdy `version_kind='RESTATED'` i inna klasa → `RESTATED_OTHER`; w przeciwnym razie (`version_kind='ORIGINAL'`, zwykły reopen) → `NEW_SOURCE_VERSION` jak dotychczas. To wymaga jednej dodatkowej `JOIN`/lookupu w kroku 1 B03 (odczyt `restatement_class` wiersza wyzwalającego) — koszt pomijalny, bez zmiany architektury algorytmu.

### 4.4 `RESTATEMENT_CARRY` — domknięcie operacyjne luki z B03 §3.2

B03 §3.2 już zdefiniowało `transformation_kind='RESTATEMENT_CARRY'` nazewniczo („source jest restated/corrected wersją i target dziedziczy powiązanie po oryginale"), ale nigdy nie określiło **kiedy dokładnie** taka krawędź powstaje. WP-B06 domyka to:

Gdy `vN+1` (restated) powstaje przez reopen `vN`, **working revision** `vN+1` jest kopią-przy-zapisie treści `vN` (B02 §6.2 krok 5) — ale **krawędzie lineage wchodzące do `vN`** (np. `vN` jako Analysis miało `STATEMENT_TO_ANALYSIS` z konkretnego `finance_business_versions` Statement Packa) nie przenoszą się automatycznie, bo `finance_lineage_edges` jest append-only i referencjonuje `vN` po immutable ID, nie po `artifact_id`. Bez nowej krawędzi `vN+1` byłby „sierotą" w grafie lineage (brak wymaganego rodzica danego typu — dokładnie przypadek `orphaned` z B03 §8.2).

**Reguła:** w tej samej transakcji co krok 5 B02 §6.2 (`INSERT working_revision` dla `vN+1`), dla każdej krawędzi `e` gdzie `e.target_version_id = vN.id`, wstawiany jest nowy wiersz `finance_lineage_edges` z `source_version_id = e.source_version_id`, `target_version_id = vN+1.id`, `edge_type = e.edge_type`, `transformation_kind = 'RESTATEMENT_CARRY'`, `assumption_snapshot_hash = e.assumption_snapshot_hash` (kopiowany — założenia źródłowe się nie zmieniły przez sam fakt restatement; jeśli analityk edytuje treść w nowym draftcie, normalny cykl compute nadpisze ten hash przy kolejnym udanym compute, zanim `vN+1` osiągnie `APPROVED`). To **nie** dotyczy zwykłego reopen (`version_kind` pozostaje `ORIGINAL`) — tam `vN+1` dziedziczy te same krawędzie przez `transformation_kind='REOPEN_CARRY'` (już zdefiniowane w B03 §3.2, ta sama mechanika kopiowania, inna etykieta), więc oba przypadki (reopen i restatement) używają jednego wspólnego kroku transakcyjnego, różniącego się tylko wartością `transformation_kind` zapisywaną w pętli — spójne, brak duplikacji logiki.

### 4.5 Management-adjusted — osobny artefakt, nie osobna wersja

Management-adjusted (np. Statement Pack skorygowany o pozycje jednorazowe do celów analitycznych, nie do celów statutowych) **musi współistnieć jednocześnie** z `ORIGINAL`/`RESTATED` jako `APPROVED` — analityk chce widzieć oba obok siebie, nie zastępować jeden drugim. To łamie `UNIQUE(artifact_id) WHERE status='APPROVED'` z B01 §2.2, gdyby modelować jako kolejną wersję tego samego `artifact_id`.

**Decyzja (spójna z B01 §4 „Ryzyka", które już zaproponowało ten sam wzorzec dla wariantów Valuation):** management-adjusted to **osobny `artifact_id`**, tego samego `artifact_type` co źródło (np. drugi `STATEMENT_PACK`, oznaczony `natural_key` konwencją `mgmt-adjusted:<source_artifact_id>:<period>`), połączony krawędzią lineage `edge_type` **rozszerzającą enum B03 §2.1** o nową wartość: `VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT` (source: dowolny stage_rank, target: ten sam stage_rank + oznaczenie wariantu — wymaga wyjątku od reguły `stage_rank(target) > stage_rank(source)` z B03 §4, bo to relacja **siostrzana**, nie przepływ w dół). B03 §4 już przewidziało dokładnie ten przypadek jako ryzyko do udokumentowania: „jeśli w przyszłości ktoś doda nowy edge_type łączący dwa artefakty na tej samej randze... rekomendacja: modelować jako relację sibling/variant, nie lineage edge" — WP-B06 realizuje tę rekomendację: `VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT` **nie** przechodzi przez trigger cycle-prevention B03 §4 (wyłączony jawnie w `CHECK` triggera dla tej jednej wartości enum, udokumentowane jako świadomy wyjątek, nie luka), bo z definicji nie tworzy przepływu wartości w głąb DAG-u — jest czystą adnotacją „ten artefakt jest analitycznym wariantem tamtego", nawigowalną przez to samo zapytanie siblings z B03 §8.3(b).

`finance_business_versions.version_kind='MANAGEMENT_ADJUSTED'` na wersjach tego wariantowego artefaktu — etykieta jest redundantna względem typu krawędzi (celowo — pozwala filtrować po samej kolumnie bez JOIN-a do lineage przy renderowaniu list/tabel, zgodnie z duchem StandardTable/kanonu UI Consultify, który preferuje płaskie kolumny filtrowalne nad ukrytą logiką grafową).

---

## 5. Retention i legal hold

### 5.1 `finance_retention_policies` — konfigurowalne, nie hardcode

```sql
CREATE TABLE finance_retention_policies (
  retention_policy_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id          TEXT,                    -- NULL = domyślna polityka platformy, per-org NADPISUJE
  artifact_type             TEXT NOT NULL,           -- wartości z finance_artifacts.artifact_type CHECK enum (B01 §2.1), lub 'EXPORT' dla finance_export_manifests
  jurisdiction               TEXT,                   -- np. 'PL', 'EU', 'US' — konfigurowalne, nie zamknięty enum (jurysdykcje przybywają bez migracji schematu)
  applies_to_status          TEXT NOT NULL DEFAULT 'ANY'
                               CHECK (applies_to_status IN ('ANY', 'APPROVED', 'SUPERSEDED', 'ARCHIVED', 'INVALIDATED')),

  retention_status          TEXT NOT NULL DEFAULT 'PENDING_OWNER_DECISION'
                               CHECK (retention_status IN ('CONFIGURED', 'PENDING_OWNER_DECISION', 'RETAIN_INDEFINITELY')),
  retention_period          INTERVAL,                -- NULL dopóki retention_status <> 'CONFIGURED'; brak liczby = ESCALATION, nie domyślna wartość zgadywana
  retention_basis            TEXT,                   -- wolny tekst: 'GDPR Art. 17(3)(b)', 'lokalne prawo podatkowe X lat', itp. — dane, nie kod
  post_retention_action      TEXT
                               CHECK (post_retention_action IN ('ANONYMIZE', 'HARD_DELETE', 'MOVE_TO_COLD_ARCHIVE') OR post_retention_action IS NULL),

  legal_hold_overrides_expiry BOOLEAN NOT NULL DEFAULT true,  -- czy legal_hold blokuje nawet upłynięty retention_period (patrz §5.2) — domyślnie tak, zawsze bezpieczniejsza strona

  effective_from             TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by_policy_id     TEXT REFERENCES finance_retention_policies(retention_policy_id),
  created_by                  TEXT NOT NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_retention_scope
    UNIQUE (organization_id, artifact_type, jurisdiction, applies_to_status, effective_from)
);

CREATE INDEX idx_finance_retention_org_type ON finance_retention_policies(organization_id, artifact_type);
```

**Rozwiązanie widoczności/rangi:** przy resolve polityki dla konkretnego artefaktu, silnik wybiera najbardziej specyficzny dopasowany wiersz w kolejności: `(organization_id = konkretna org) > (organization_id IS NULL, platforma domyślna)`, a wewnątrz tego samego poziomu: `jurisdiction` dopasowana dokładnie > `jurisdiction IS NULL`. To jest zwykła reguła „najbardziej specyficzny wygrywa", bez potrzeby dodatkowej tabeli priorytetów.

**Dlaczego `retention_period` jest `INTERVAL` nullable z osobnym `retention_status`, nie po prostu `INTERVAL NOT NULL` z jakąś wartością domyślną:** zakaz z briefu jest wprost „nie decyduj samodzielnie o konkretnych okresach retencji" — każda wartość domyślna (nawet „bezpieczna" typu 7 lat) byłaby cichą decyzją merytoryczną ukrytą w DDL. `retention_status='PENDING_OWNER_DECISION'` jako `NOT NULL DEFAULT` na nowej polityce wymusza **jawny, widoczny w danych** brak decyzji — każde zapytanie po politykach retencji od razu pokazuje, co jest skonfigurowane, a co czeka na prawnika. To jest ten sam wzorzec co `PROVISIONAL_PENDING_OWNER_DECISION` z `GATE_B_INTEGRATION_RECONCILIATION.md` §7 dla progu materialności — spójny idiom w całym Gate B dla „mechanizm gotowy, liczba czeka".

### 5.2 `finance_legal_holds` — guard niezależny od retention

```sql
CREATE TABLE finance_legal_holds (
  legal_hold_id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id         TEXT NOT NULL,
  artifact_id              TEXT,                      -- hold na cały artefakt (wszystkie wersje) — nullable, patrz CHECK niżej
  business_version_id      TEXT,                      -- hold na konkretną wersję — nullable, patrz CHECK niżej
  matter_reference          TEXT NOT NULL,             -- referencja do sprawy prawnej/audytu (numer sprawy, nie treść poufna)
  reason                     TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED')),
  imposed_by                  TEXT NOT NULL,
  imposed_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_by                  TEXT,
  released_at                   TIMESTAMPTZ,
  released_reason               TEXT,

  CONSTRAINT chk_finance_legal_hold_scope
    CHECK (
      (artifact_id IS NOT NULL AND business_version_id IS NULL) OR
      (artifact_id IS NULL AND business_version_id IS NOT NULL)
    ),
  CONSTRAINT chk_finance_legal_hold_release
    CHECK (status = 'ACTIVE' OR (released_by IS NOT NULL AND released_at IS NOT NULL))
);

CREATE INDEX idx_finance_legal_hold_artifact_active
  ON finance_legal_holds(artifact_id) WHERE status = 'ACTIVE' AND artifact_id IS NOT NULL;
CREATE INDEX idx_finance_legal_hold_version_active
  ON finance_legal_holds(business_version_id) WHERE status = 'ACTIVE' AND business_version_id IS NOT NULL;
```

Rola aplikacyjna dostaje `INSERT, SELECT, UPDATE (tylko kolumny release*)` — nigdy `DELETE` (legal hold, nawet zwolniony, jest sam w sobie faktem audytowym, który musi przetrwać).

**Guard w state machine — amendment do B02 §3.2/§8:**

| Operacja B02 | Nowy warunek wstępny (WP-B06) |
|---|---|
| T10 `archive` | Odrzucone `409 LEGAL_HOLD_ACTIVE`, jeśli istnieje `ACTIVE` hold na `artifact_id` LUB na tym `business_version_id`. |
| T11 `invalidate` | Jak wyżej — **legal hold blokuje invalidate silniej niż archive**, bo invalidate jest permanentne/nieodwracalne (B02 §3.1, `INVALIDATED --> [*]: terminal (read-only, permanentne)`) — hold istnieje właśnie po to, żeby nic nieodwracalnego nie stało się z danymi objętymi sporem. |
| T12 `reopen` | Odrzucone `409 LEGAL_HOLD_ACTIVE`, jeśli hold obejmuje konkretnie tę `business_version_id` (reopen tej wersji mógłby wyglądać jak próba „poprawienia" dowodu w trakcie sporu — nawet że stary wiersz i tak zostaje nietykalny, sama percepcja/proces prawny wymaga zablokowania). Hold na poziomie `artifact_id` (nie konkretnej wersji) **nie** blokuje reopenu innych wersji tego samego artefaktu — tylko explicit wskazana wersja lub cały artefakt jeśli hold jest na poziomie artefaktu. |
| Przyszły `DELETE`/anonymizacja z retention job (§5.3) | Zawsze zablokowane, bez wyjątku, dopóki `ACTIVE` hold istnieje na dowolnym poziomie dotykającym rekordu — to jest **twarda blokada, nie SoD-owalna przez żadną rolę** (różni się od pozostałych guardów B02, gdzie `finance_admin` może obejść przez emergency mode; legal hold nie ma trybu emergency, bo obejście oznaczałoby złamanie zewnętrznego zobowiązania prawnego, nie tylko wewnętrznej polityki). |

To odpowiada dosłownie briefowi: „legal_hold flag blokujący nawet dozwolone Archived/Invalidated transitions" — flaga blokuje operacje, które state machine B02 *explicite* dopuszcza (`APPROVED → ARCHIVED`/`APPROVED → INVALIDATED` są legalnymi przejściami samymi w sobie), właśnie dlatego, że legal hold jest **ortogonalny** do lifecycle — nie jest stanem w diagramie B02 §3.1, jest globalnym mutex-em nałożonym z zewnątrz na dowolny stan.

### 5.3 Egzekucja retencji — job, nie automatyczny trigger

Retention **nigdy nie usuwa automatycznie** przy samym upływie `retention_period` — wymaga jawnego, audytowalnego joba (`finance_retention_execution_jobs`, wzorowanego na `compute_jobs` z B04 — persisted queue, leased, retry, WP-B04 pattern reużyty, nie wymyślany od nowa) który: (1) znajduje kandydatów gdzie `now() > (finance_business_versions.created_at_relevant_for_retention + resolved_retention_period)` **i** `retention_status='CONFIGURED'` **i** brak `ACTIVE` legal hold, (2) wykonuje `post_retention_action` (`ANONYMIZE`/`HARD_DELETE`/`MOVE_TO_COLD_ARCHIVE`), (3) zapisuje nieusuwalny wpis w `artifact_lifecycle_events` (B02, własność) z `action='RETENTION_EXECUTED'` **przed** faktycznym usunięciem danych (kolejność: audit log najpierw, żeby nawet przy awarii w trakcie usuwania istniał dowód, że proces się rozpoczął — odwrotna kolejność niż atomowy approval z B02 §5, bo tu nie ma "rollback" w sensie odzyskania usuniętych danych, więc audit-first jest bezpieczniejsze niż audit-last). Wymaga osobnego uprawnienia (`finance_admin` + drugi podpis, maker-checker analogiczny do `invalidate` T11) — usunięcie danych finansowych klienta nigdy nie jest jednoosobową decyzją, nawet gdy polityka retencji jest już `CONFIGURED`.

To pole (`post_retention_action` na `finance_retention_policies`) jest zdefiniowane jako mechanizm, nie jako coś, co WP-B06 uruchamia — implementacja joba egzekucyjnego to Gate C/E, poza zakresem tego ADR.

---

## 6. Export manifest

### 6.1 `finance_export_manifests` — immutable, version-pinned

```sql
CREATE TABLE finance_export_manifests (
  export_manifest_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id            TEXT NOT NULL,
  export_format                TEXT NOT NULL CHECK (export_format IN ('PDF', 'XLSX', 'PPTX', 'CSV', 'JSON')),
  status                        TEXT NOT NULL DEFAULT 'GENERATING'
                                   CHECK (status IN ('GENERATING', 'READY', 'FAILED', 'EXPIRED', 'REVOKED')),

  -- Version-pinned identity (multi-source agregacja przez tabelę dziecko §6.3,
  -- ta kolumna to "primary"/najważniejsze źródło dla szybkiego filtrowania):
  primary_artifact_id           TEXT NOT NULL,
  primary_business_version_id    TEXT NOT NULL,

  -- Reproducibility context pinowany w momencie generacji (kopiowany z finance_compute_snapshots
  -- powiązanej wersji, NIE żywy wskaźnik — export musi przetrwać nawet gdyby snapshot źródłowy
  -- kiedyś zniknął z retencji, patrz §6.5):
  locale                          TEXT NOT NULL,
  timezone                         TEXT NOT NULL,
  unit                              TEXT NOT NULL,          -- np. 'THOUSANDS', 'MILLIONS', 'ACTUAL'
  as_of                              TIMESTAMPTZ NOT NULL,
  rounding_convention_used           TEXT NOT NULL,          -- patrz §3.4 (dziedziczone lub jawnie nadpisane)
  rounding_convention_overridden      BOOLEAN NOT NULL DEFAULT false,

  -- Integrity — dwa różne hashe, dwa różne cele (patrz §6.4)
  content_semantic_hash                TEXT NOT NULL,        -- hash wartości biznesowych, spójny z finance_value_status/B03
  file_hash_sha256                      TEXT,                -- NULL dopóki status<>'READY'; hash bajtowy wyeksportowanego pliku

  -- Storage — NIE żywy podpisany URL, patrz §6.4
  storage_object_key                     TEXT,               -- NULL dopóki status<>'READY'
  storage_bytes                           BIGINT,
  default_signed_url_ttl_seconds           INTEGER NOT NULL DEFAULT 86400,  -- 24h, parametr techniczny (DEC-FIN-012), nie eskalowany

  generated_by                              TEXT NOT NULL,
  generated_at                               TIMESTAMPTZ,
  failure_reason                              TEXT,
  revoked_by                                   TEXT,
  revoked_at                                    TIMESTAMPTZ,
  revoked_reason                                 TEXT,

  created_at                                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_export_primary_artifact_org
    FOREIGN KEY (primary_artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  -- Export smie wskazywać wyłącznie APPROVED (nigdy Draft/IN_REVIEW) — egzekwowane triggerem, patrz §6.2
  CONSTRAINT chk_finance_export_ready_requires_hash
    CHECK (status <> 'READY' OR (file_hash_sha256 IS NOT NULL AND storage_object_key IS NOT NULL AND generated_at IS NOT NULL))
);

CREATE INDEX idx_finance_export_org_status ON finance_export_manifests(organization_id, status);
CREATE INDEX idx_finance_export_primary_version ON finance_export_manifests(primary_business_version_id);
```

**Immutable — ten sam wzorzec triggera co B01 §2.4, reużyty, nie wynajdywany na nowo:** `BEFORE UPDATE` odrzuca zmianę jakiejkolwiek kolumny poza `status`, `file_hash_sha256`, `storage_object_key`, `storage_bytes`, `generated_at`, `failure_reason`, `revoked_by/at/reason` **i** tylko wzdłuż dozwolonych przejść `GENERATING → READY|FAILED`, `READY → EXPIRED|REVOKED`. Raz `READY`, treściowe pola (`locale`, `as_of`, hash-e, `primary_business_version_id`...) są zamrożone na zawsze — to jest dosłowne znaczenie „immutable, version-pinned" z briefu.

### 6.2 Trigger — export tylko z `APPROVED`

```sql
CREATE OR REPLACE FUNCTION finance_export_require_approved_source() RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions WHERE business_version_id = NEW.primary_business_version_id;
  IF v_status IS DISTINCT FROM 'APPROVED' THEN
    RAISE EXCEPTION 'finance_export_manifests: primary_business_version_id % must be APPROVED, is %', NEW.primary_business_version_id, v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_export_require_approved
  BEFORE INSERT ON finance_export_manifests
  FOR EACH ROW EXECUTE FUNCTION finance_export_require_approved_source();
```

Uzasadnienie: eksport (raport klientowi, TRS context, wysyłka do banku/inwestora) na podstawie nie-zatwierdzonych danych podważa cały sens Approved-immutable z master planu zasady wykonania #6 — jeśli analityk chce podglądu przed approval, to jest funkcja UI (preview render), nie formalny `finance_export_manifests` z evidence appendix i signed URL.

### 6.3 `finance_export_manifest_sources` — agregacja N wersji (Report/Export jest zawsze liściem, B03 §2.2)

Eksport może agregować wiele jawnych wersji (`VERSION_TO_REPORT`, B03 §2, relacja N:1). `primary_business_version_id` na tabeli głównej jest wygodnym skrótem dla najczęstszego przypadku (jeden artefakt → jeden eksport), ale pełna lista źródeł żyje osobno:

```sql
CREATE TABLE finance_export_manifest_sources (
  export_manifest_id      TEXT NOT NULL REFERENCES finance_export_manifests(export_manifest_id),
  business_version_id       TEXT NOT NULL,
  role                        TEXT,                  -- np. 'PRIMARY', 'COMPARATIVE_PRIOR_PERIOD', 'BENCHMARK'
  PRIMARY KEY (export_manifest_id, business_version_id)
);
```

Przy `INSERT` do `finance_export_manifests` zawsze towarzyszy co najmniej jeden wiersz tutaj z `role='PRIMARY'` wskazujący `primary_business_version_id` (utrzymanie spójności — egzekwowane w warstwie aplikacyjnej Gate C, nie w tym ADR, bo wymagałoby triggera cross-table po INSERT obu wierszy w jednej transakcji, co jest zwykłym wzorcem transakcyjnym, nie dodatkowym constraintem bazy).

### 6.4 Dwa hashe, dwa różne cele — i dlaczego signed URL nie jest kolumną z gotowym URL-em

**`content_semantic_hash`** — spójny z definicją z B01/B03 (semantic, nie bit-for-bit — addendum §6 explicite zakazuje bit-for-bit jako dowodu finansowego). Służy do odpowiedzi na pytanie „czy dwa eksporty pokazują te same liczby biznesowe", niezależnie od formatowania/renderowania pliku.

**`file_hash_sha256`** — świadomie **inny cel**, nie narusza zakazu z addendum §6: to nie jest dowód finansowy wartości, to jest **integralność dostarczonego pliku** (czy plik, który klient pobrał, jest bajt-w-bajt tym, co system wygenerował i podpisał — klasyczny cel checksumy pliku, jak przy każdym download manager). Rozróżnienie tych dwóch hashy w osobnych kolumnach jest świadome: pomieszanie ich (np. użycie raw file hash jako „dowodu" wartości finansowych) złamałoby dokładnie zasadę, którą B03 §3.3 już ustaliło dla `assumption_snapshot_hash`.

**Signed URL — projektowa zmiana względem literalnego brzmienia brief-u:** brief mówi „signed URL expiry", co sugeruje kolumnę z URL-em. Zamiast przechowywać **żywy, ważny podpisany URL** w bazie (ryzyko: URL w bazie = URL w każdym backupie/logu/replice, ważny przez cały swój TTL niezależnie od tego kto ma dostęp do bazy — praktyczne rozszerzenie powierzchni wycieku danych finansowych klienta), tabela przechowuje **`storage_object_key`** (stabilny, nie-sekretny wskaźnik do obiektu w blob storage) i **`default_signed_url_ttl_seconds`** (parametr generacji). Sam podpisany URL jest generowany **on-demand** przy każdym żądaniu pobrania, poza zakresem tego ADR (warstwa API Gate C), z TTL odczytanym z tej kolumny. To jest różnica jakościowa bezpieczeństwa, nie kosmetyczna: `EXPIRED`/`REVOKED` na tym modelu **natychmiast** unieważnia dostęp (serwis po prostu przestaje generować nowe podpisane URL-e dla tego `export_manifest_id`), podczas gdy przy przechowywaniu żywego URL-a wcześniej wydany, jeszcze nie wygasły URL pozostałby działający nawet po `REVOKED` w bazie, chyba że storage provider wspiera rewokację URL-i z wyprzedzeniem (rzadkie, kosztowne). `default_signed_url_ttl_seconds=86400` (24h) jest parametrem technicznym/bezpieczeństwa, nie prawnym — mieści się w `DEC-FIN-012` (zespół decyduje), nie wymaga eskalacji do właściciela.

### 6.5 `finance_export_evidence_items` — evidence appendix

```sql
CREATE TABLE finance_export_evidence_items (
  evidence_item_id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  export_manifest_id        TEXT NOT NULL REFERENCES finance_export_manifests(export_manifest_id),
  evidence_type               TEXT NOT NULL CHECK (evidence_type IN (
                                 'SOURCE_LINEAGE_VERSION', 'EXCEPTION_LEDGER_ENTRY',
                                 'COMPUTE_SNAPSHOT', 'REVIEW_APPROVAL_RECORD', 'ADVISOR_FINDING'
                               )),
  ref_id                       TEXT NOT NULL,          -- FK-podobny wskaźnik (business_version_id / exception_id / compute_snapshot_id / lifecycle_event_id) — brak jednego FK-typu, bo źródła są różne tabele; integralność egzekwowana w warstwie aplikacyjnej Gate C
  description                   TEXT,
  included_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_export_evidence UNIQUE (export_manifest_id, evidence_type, ref_id)
);
```

Append-only (INSERT/SELECT tylko), immutable po `READY` (egzekwowane wspólnym grantem roli DB, nie osobnym triggerem — ten sam wzorzec co `finance_lineage_edges`). To jest dosłowna realizacja „evidence appendix" z briefu: przy każdym eksporcie zapisujemy **z czego dokładnie** powstał — które wersje źródłowe (lineage), jakie wyjątki były znane w momencie eksportu (exception ledger z WP-B05 — forward reference, tabela jeszcze nie zaprojektowana), jaki dokładnie `compute_snapshot` stał za liczbami, kto i kiedy zatwierdził. Jeśli klient/regulator zapyta „skąd ta liczba w eksporcie sprzed 8 miesięcy", odpowiedź jest w tym jednym miejscu, bez rekonstruowania stanu bazy z tamtego czasu.

### 6.6 Retencja eksportów — te same reguły, inny `artifact_type`

`finance_retention_policies.artifact_type='EXPORT'` (§5.1) obejmuje `finance_export_manifests` tym samym mechanizmem konfigurowalnym co pozostałe artefakty — eksporty do stron trzecich (banki, inwestorzy, regulator) często mają **inne, dłuższe** wymogi retencji niż wewnętrzne drafty, stąd osobna wartość `artifact_type`, nie dziedziczenie polityki źródłowego artefaktu.

---

## 7. Rozważane alternatywy (odrzucone)

1. **Dopisanie `fiscal_calendar`/`fx_snapshot_id`/`market_data_snapshot_id`/`locale`/`timezone`/`as_of` bezpośrednio na `finance_engine_manifests`, dosłownie wg brief-u.** Odrzucone — patrz §1, łamie `UNIQUE(engine_name, engine_version, code_commit_sha, config_hash)` i jawne uzasadnienie B01 „nie org-scoped". Alternatywa rozdzielona (§3) osiąga ten sam cel funkcjonalny (pełny reproducibility manifest dostępny per wersja) bez tego kosztu.
2. **Jedna wspólna tabela `finance_reproducibility_context` łącząca kod i uruchomienie w jednym wierszu (bez FK między dwiema tabelami).** Odrzucone — duplikowałoby `engine_name/engine_version/code_commit_sha` przy każdym compute (denormalizacja bez korzyści, bo kod się nie zmienia między uruchomieniami tak często jak FX/as-of), i uniemożliwiłoby pytanie „ile różnych FX snapshotów użyto z tym samym kodem silnika" bez parsowania duplikatów.
3. **Retention period z rozsądną wartością domyślną (np. 7 lat) zamiast `PENDING_OWNER_DECISION`.** Odrzucone wprost przez zakaz w briefie — każda liczba, nawet "bezpieczna", jest decyzją prawną nie do podjęcia przez ten dokument; jurysdykcje różnią się rzędem wielkości (niektóre wymagają dożywotniej retencji dla pewnych dokumentów finansowych, inne pozwalają na krótsze okresy) i zależą od typu artefaktu.
4. **Management-adjusted jako flaga logiczna na tej samej wersji zamiast osobnego artefaktu.** Odrzucone — łamie partial unique index `UNIQUE(artifact_id) WHERE status='APPROVED'` z B01, chyba że ten index zostałby rozszerzony o `version_kind` w klauzuli `WHERE` (`UNIQUE(artifact_id) WHERE status='APPROVED' AND version_kind != 'MANAGEMENT_ADJUSTED'` + osobny `UNIQUE(artifact_id, version_kind) WHERE status='APPROVED' AND version_kind='MANAGEMENT_ADJUSTED'`) — technicznie możliwe, ale rozważone i odrzucone na rzecz spójności z już przyjętym wzorcem B01 §4 dla wariantów Valuation (osobny `artifact_id` per wariant), żeby nie mieć dwóch różnych rozwiązań tego samego problemu (branch-per-variant) w tym samym schemacie.
5. **Przechowywanie żywego podpisanego URL-a w `finance_export_manifests`.** Odrzucone — patrz §6.4, ryzyko bezpieczeństwa (URL w backupach/replikach pozostaje ważny niezależnie od `REVOKED` w bazie) przewyższa wygodę jednego mniej round-tripu przy pobieraniu.
6. **`file_hash_sha256` jako jedyny hash (bez `content_semantic_hash`).** Odrzucone — rozwiązałoby integralność pliku, ale nie odpowiedziałoby na pytanie „czy dwa eksporty w różnych formatach (PDF vs XLSX tej samej wersji) zgadzają się co do liczb" — to wymaga hasha na poziomie wartości, niezależnego od renderowania.

---

## 8. Konsekwencje

**Pozytywne:**
- Domyka lukę projektową pozostawioną otwartą przez B02 §5.1(b) (`compute_snapshots` referencjonowane, nigdy zaprojektowane) i operacyjnie domyka `RESTATEMENT_CARRY` z B03 §3.2 (nazwany, nigdy użyty).
- `version_kind` + append-only reopen mechanika (już istniejąca w B02) fizycznie gwarantuje „original nigdy nie jest nadpisywany" — nie deklaratywnie, tylko przez ten sam trigger immutability co reszta B01.
- Retention/legal hold jako dane konfigurowalne, nie kod — zmiana jurysdykcji/okresu nie wymaga migracji ani deploy, tylko nowego wiersza `finance_retention_policies`.
- Export manifest reużywa trzy już ustalone wzorce Gate B (immutability trigger z B01, append-only grant z B03, persisted job pattern z B04) zamiast wprowadzać czwarty — mniejsza powierzchnia do audytu i utrzymania.

**Negatywne / koszty:**
- Cztery nowe tabele (`finance_compute_snapshots`, `finance_retention_policies`, `finance_legal_holds`, `finance_export_manifests` + 2 tabele dziecko) dokładają się do już rosnącej listy z B01–B04 — WP-B07 (observability/runbooks) musi objąć je wszystkie, nie tylko oryginalną piątkę z B01.
- `finance_compute_snapshots` będzie rosło z tą samą częstotliwością co `finance_working_revisions` (append-only per compute, nie tylko per approval, jeśli decyzja jest „każdy udany compute dostaje snapshot") — ten sam problem capacity planning, który B01 §4 już flagowało dla `working_revisions`, dziedziczony tutaj; wymaga tej samej strategii partycjonowania/archiwizacji w Gate C/E.
- Rekomendowany amendment do B01 (deprecate `market_data_asof` na `finance_engine_manifests`) wymaga wspólnej rewizji z właścicielem WP-B01 przed Gate C — nie jest to zmiana, którą WP-B06 może jednostronnie scommitować do cudzego ADR.
- `fiscal_calendar_id`/`fx_snapshot_id`/`market_data_snapshot_id` na `finance_compute_snapshots` pozostają forward-references bez FK (właściciel rejestru nie istnieje jeszcze w żadnym WP) — trzecia warstwa odroczonych FK w programie, po `compute_run_id` (B01) i `compute_run_id` (B04); wymaga wspólnego trackera „odroczone FK do domknięcia w Gate C", żeby żadne nie zostało zapomniane.

**Ryzyka:**
- `VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT` jako wyjątek od reguły cycle-prevention B03 §4 (relacja sibling, nie DAG w dół) wymaga jawnej zgody właściciela WP-B03 — to jest zmiana w cudzym triggerze (`stage_rank` check), nie tylko dopisek. Flagowane do wspólnego review Gate B, jak inne cross-ADR zależności w tym programie.
- Rozdział engine_manifest / compute_snapshot (§1, §3) jest słuszny architektonicznie, ale zwiększa liczbę JOIN-ów potrzebnych do zrekonstruowania „pełnego" reproducibility manifestu przy każdym odczycie (governance §5.6 chce jednego widoku) — do zaadresowania widokiem SQL (`CREATE VIEW finance_reproducibility_manifest_v AS SELECT ... FROM finance_business_versions JOIN finance_engine_manifests ... JOIN finance_compute_snapshots ...`) w Gate C, nie jest to problem schematu, jest to problem warstwy odczytu.

---

## 9. Decyzje wymagające sign-off orkiestratora/Piotra — ESKALACJE

Zgodnie z twardym zakazem brief-u i `DEC-FIN-012` (decyzje prawne/kosztowe/apetyt na ryzyko wracają do właściciela), poniższe **nie są rozstrzygane** przez ten ADR:

1. **Konkretne okresy retencji per typ artefaktu i per jurysdykcja.** Mechanizm (`finance_retention_policies`, §5.1) jest gotowy i konfigurowalny; żadna liczba nie jest wpisana. To jest dosłownie `Decyzja właścicielska` z master planu §8 pkt 6 („Delete Approved: zakaz czy soft-delete; retention/legal hold" — część „zakaz/soft-delete" jest już `DECIDED` przez `DEC-FIN-007`, część „retention" pozostaje otwarta). Wymaga wejścia prawnika/compliance per jurysdykcja, w której Consultify ma klientów Finance, zanim `finance_retention_policies.retention_status` może przejść z `PENDING_OWNER_DECISION` na `CONFIGURED` dla jakiejkolwiek kombinacji organizacja×typ×jurysdykcja.
2. **Domyślny `post_retention_action` (`ANONYMIZE` vs `HARD_DELETE` vs `MOVE_TO_COLD_ARCHIVE`) per jurysdykcja.** GDPR "right to erasure" i lokalne prawo podatkowe/rachunkowe wymagające zachowania dokumentów finansowych przez X lat **mogą się wprost sprzeczać** dla tego samego rekordu (np. klient żąda usunięcia danych osobowych, ale faktura musi zostać zachowana do celów podatkowych) — to wymaga jawnej polityki prawnej „co dokładnie anonimizujemy vs co zatrzymujemy w całości", nie technicznej decyzji tego ADR. Mechanizm (`post_retention_action` per policy) jest gotowy, wybór wartości nie.
3. **Kto ma prawo nakładać/zdejmować `finance_legal_holds` na produkcji** (§5.2) — proponowana robocza zasada w tym ADR to „symetryczne z maker-checker `invalidate`" (dwóch `finance_admin`), ale to dotyka realnej odpowiedzialności prawnej organizacji (kto reprezentuje organizację wobec sądu/regulatora w sprawie retencji dowodów) — kwalifikuje się jako decyzja strategiczna/prawna per `DEC-FIN-012`, nie rutynowa technikalia zespołu.
4. **Czy eksporty do stron trzecich (banki, inwestorzy) wymagają osobnej, bardziej rygorystycznej ścieżki zgody/audytu niż eksporty wewnętrzne** — `finance_export_manifests` dziś nie rozróżnia adresata eksportu; jeśli regulacje sektorowe (np. przy Valuation trafiającej do negocjacji M&A) wymagają dodatkowego sign-offu przed wygenerowaniem pliku do wysyłki poza organizację, to jest rozszerzenie zakresu tego ADR wymagające decyzji produktowej/prawnej, nie tylko schematu.

Wszystkie pozostałe decyzje projektowe w tym ADR (rozdział engine_manifest/compute_snapshot, mechanika `version_kind`/`RESTATEMENT_CARRY`, model osobnego artefaktu dla management-adjusted, kształt export manifestu, storage_object_key zamiast żywego URL-a) mieszczą się w `DEC-FIN-012` i są tu rozstrzygnięte bez potrzeby eskalacji.

---

## 10. Otwarte pytania dla wspólnego review Gate B (nie eskalacja właścicielska — koordynacja międzyzespołowa)

1. **Amendment do B01** (deprecate `finance_engine_manifests.market_data_asof`) wymaga zgody właściciela WP-B01 przed Gate C — nie jest jednostronnie wykonalny przez ten dokument.
2. **Amendment do B03** (rozszerzenie priorytetu `reason_code` o `RESTATED_ERROR_CORRECTION`/`RESTATED_OTHER`, §4.3; wyjątek od cycle-prevention dla `VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT`, §4.5) wymaga tej samej zgody od właściciela WP-B03.
3. **`fiscal_calendar_id`/`fx_snapshot_id`/`market_data_snapshot_id` jako forward references** (§3.2) nie mają jeszcze wyznaczonego właściciela WP — prawdopodobnie WP-D01 (Statements, master plan wymienia „fiscal calendars" wprost w tym pakiecie) i/lub silnik FX, ale to nie jest rozstrzygnięte w żadnym dokumencie Gate A/B do tej pory. Rekomendacja: WP-D01 potwierdza właścicielstwo przy swoim starcie, WP-B06 dostarcza kolumny jako gotowe miejsce docelowe.
4. **`finance_export_manifest_sources` spójność `PRIMARY`** (§6.3) — dziś egzekwowana wyłącznie w warstwie aplikacyjnej Gate C, nie przez constraint bazy (wymagałoby triggera cross-table po commit obu INSERT-ów). Do potwierdzenia, czy to wystarczające, czy Gate C potrzebuje dodatkowego deferred constraint trigger.

---

## 11. Traceability

| Wymaganie z briefu | Sekcja tego ADR |
|---|---|
| `finance_engine_manifests` — dokładne kolumny, sprawdzenie stanu B01, dopisanie braków | §1, §3.1 |
| Original/restated/management-adjusted lineage, append-only original, downstream stale (B03) | §4 |
| Retention/legal hold — tabela konfigurowalna, legal_hold guard w state machine (B02) | §5 |
| Export manifest — immutable, version-pinned, locale/timezone/unit/as-of, evidence appendix, signed URL expiry, hash reconciliation | §6 |
| Zakaz decydowania o retencji/jurysdykcji — mechanizm konfigurowalny, ESCALATION jawna | §5.1, §9 |

---

*Ten dokument jest ADR-em projektowym (decyzja + kontrakt), nie implementacją. Kod, migracje i realny schemat wchodzą w Gate C (WP-C01) po zatwierdzeniu Gate B (WP-B01…WP-B07 łącznie, nie tylko WP-B06) i po rozstrzygnięciu eskalacji §9.*
