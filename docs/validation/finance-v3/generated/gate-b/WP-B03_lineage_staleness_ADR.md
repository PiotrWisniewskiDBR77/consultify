# ADR WP-B03 — Canonical Lineage DAG i Freshness dla Finance

**Status:** `PROPOSED` (ADR do projektu, NIE implementacja — brak żywego kodu, brak połączenia z bazą)
**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`, sekcja 2.2 „Lineage", Gate B → WP-B03
**Powiązane decyzje:** `DEC-FIN-011` (Lineage DAG), `DEC-FIN-010` (Working Revisions vs Business Versions), `DEC-FIN-007` (usuwanie/Invalidation), `DEC-FIN-009` (tolerancje/wyjątki), `OWN-FIN-022` (Finance Lineage Navigator)
**Data:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`
**Branch:** `codex/finance-v3-gate-a-20260809`
**Wejście Gate A wykorzystane:** `docs/validation/finance-v3/generated/gate-a/WP-A01_inventory_manifest.md`

---

## 0. Zakres i twardy zakaz

Ten dokument jest decyzją architektoniczną (ADR). Nie zawiera migracji SQL, nie łączy się z żadną bazą danych i nie tworzy żywego kodu. Celem jest ustalić **kształt kontraktu danych** (schemat krawędzi, reguły integralności, algorytm propagacji freshness, strategię zapytań) tak, aby WP-B01 (schemat artifact/version), WP-B02 (lifecycle/concurrency) i WP-B04 (jobs) mogły się o niego oprzeć bez kolizji.

**Założenie koordynacyjne (otwarte pytanie #1 poniżej):** ten ADR zakłada, że WP-B01 dostarcza wspólną tabelę tożsamości wersji (`business_versions`) opisaną w sekcji 2.1 master planu — z kolumnami `artifact_id`, `organization_id`, immutable `business_version_id`, `status` w cyklu `DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED → SUPERSEDED / ARCHIVED / INVALIDATED`. WP-B03 **nie projektuje tej tabeli od nowa** — projektuje krawędzie lineage, które się do niej referencyjnie podpinają. W chwili pisania tego ADR pliki WP-B01/WP-B02/WP-B04 nie istnieją jeszcze w tym worktree (sprawdzone: `find docs/validation/finance-v3 -iname "*B01*" -o -iname "*B02*" -o -iname "*B04*"` = puste) — to jest realne ryzyko integracyjne, nie tylko formalność, patrz sekcja 8.

## 1. Stan wyjściowy z Gate A (WP-A01)

Cytat z inwentarza (`WP-A01_inventory_manifest.md`, §3, ocena OWN-FIN-022):

> „Brak jakiejkolwiek tabeli krawędzi wersji/lineage w całym inwentarzu; jedyne powiązania to pojedyncze FK (`financial_analyses.source_statement_pack_id`, `valuations.source_id`) i jednokierunkowy `finance_candidate_handoffs` (promocja DO Initiatives, nie DAG wewnątrz Finance)."

Wnioski, które wprost kształtują ten ADR:

1. **Nie ma nic do migracji.** Lineage DAG to nowa, addytywna struktura (zgodnie z zasadą 5 z sekcji 1 master planu: „migracje są addytywne"). Istniejące pojedyncze kolumny FK (`source_statement_pack_id`, `source_id`) zostają jako dotychczasowe wskaźniki tych tabel — nowa tabela krawędzi jest warstwą ponad nimi, nie zamiennikiem w Gate B (zamiana/backfill to Gate C/D).
2. **Wzorzec referencyjny już istnieje w kodzie:** `finance_post_investment_reviews` (FIN-007) zamraża `baseline_model_id` + `baseline_version` **w momencie utworzenia**, a nie „aktualny approved". To dokładnie zasada, którą krawędzie lineage muszą wymusić strukturalnie: krawędź wskazuje na **konkretną, immutable wersję**, nigdy na „bieżący artefakt".
3. **Ostrzeżenie z audytu:** `financialModelingService.ts` ma trzy miejsca, gdzie reopen zatwierdzonego modelu **nadpisuje wiersz Approved w miejscu** (`UPDATE ... SET status='draft' WHERE status='approved'`) zamiast tworzyć nową wersję. To jest dokładnie scenariusz, przed którym broni się projekt krawędzi lineage w sekcji 3 — krawędzie muszą referencjonować niemutowalne `business_version_id`, a nie `artifact_id` + „aktualny status", inaczej lineage historyczny zostałby po cichu przepisany razem z reopenem. Ten bug jest w zakresie WP-B02 (lifecycle), ale B03 musi zakładać, że taki bug może się powtórzyć gdzie indziej, i projektować krawędzie tak, by nawet błędny reopen w innym miejscu kodu **nie mógł** zmienić znaczenia istniejącej krawędzi (append-only + FK na immutable id, nie na mutable row).
4. **Brakujący constraint z realnym ryzykiem:** `valuation_snapshots` nie ma `UNIQUE(valuation_id, version)`. To potwierdza, że dyscyplina „unikalna wersja" nie jest dziś egzekwowana konsekwentnie w Finance — WP-B03 nie może zakładać, że warstwy pod spodem to zagwarantują same; krawędzie i propagacja freshness muszą być odporne na duplikaty wersji jako *fakt z realnego kodu*, nie tylko teoretyczne ryzyko.

## 2. Typed version edges — sześć relacji z master planu / DEC-FIN-011

Z sekcji 2.2 master planu i `DEC-FIN-011`:

| # | Relacja | Kardynalność źródła | Uwaga |
|---|---|---|---|
| 1 | Statement Pack Version → Analysis Version | 1 statement → N analiz | Analysis wskazuje **konkretną** wersję pakietu, nie „najnowszą" |
| 2 | Statement Pack Version + Historical Analysis Version → Baseline Model Version | 2 rodziców (Statement I Analysis) | Baseline Model ma **dwie** krawędzie przychodzące różnego typu na ten sam target |
| 3 | Baseline Model Version → Scenario Version | opcjonalne (sekcja 6 addendum: „Scenario nie jest obowiązkowe") | Baseline może iść wprost do Valuation z pominięciem Scenario |
| 4 | Baseline Model Version LUB Scenario Version → Valuation Version | XOR jednego z dwóch rodziców tego typu | Valuation ma dokładnie jedną krawędź „bazową" tego typu (Model albo Scenario), plus opcjonalnie inne krawędzie odniesienia |
| 5 | dowolna wersja → Report/Export/TRS context | N:1 agregacja | Report/Export jest **zawsze liściem** (sink) grafu — nigdy source innej krawędzi |

Reprezentacja: **każda krawędź to jeden kierunkowy wskaźnik rodzic→dziecko.** Wielorodzicielstwo (relacja #2, #4 z dwoma opcjami, #5 z agregacją N wersji) nie wymaga specjalnego modelu — to po prostu wiele wierszy krawędzi ze wspólnym `target_version_id`. Nie projektujemy „hyperedge" ani tabeli JSON z listą źródeł — utrudniłoby to zapytania ancestor/descendant z sekcji 7.

### 2.1 Enum `edge_type` — zamknięty, wyliczalny zbiór przejść

```
STATEMENT_TO_ANALYSIS
STATEMENT_TO_MODEL        -- druga krawędź do Baseline Model (obok ANALYSIS_TO_MODEL)
ANALYSIS_TO_MODEL
MODEL_TO_SCENARIO
MODEL_TO_VALUATION
SCENARIO_TO_VALUATION
VERSION_TO_REPORT         -- source: dowolny typ artefaktu; target zawsze Report/Export/TRS context
```

Każdemu typowi artefaktu przypisujemy stałą, całkowitą **rangę etapu** (`stage_rank`), rosnącą wzdłuż przepływu wartości:

| artifact_type | stage_rank |
|---|---|
| STATEMENT_PACK | 0 |
| ANALYSIS | 1 |
| BASELINE_MODEL | 2 |
| SCENARIO | 3 |
| VALUATION | 4 |
| REPORT / EXPORT / TRS_CONTEXT | 5 |

To rozstrzyga bezpośrednio sekcję 3 (cycle prevention) — patrz tam.

## 3. Struktura krawędzi

### 3.1 Tabela `finance_lineage_edges`

```
finance_lineage_edges
  id                     UUID PK, gen_random_uuid()
  organization_id        UUID NOT NULL
  source_version_id      UUID NOT NULL   -- FK złożony → business_versions(id, organization_id)
  source_artifact_type   finance_artifact_type NOT NULL   -- denormalizacja dla trigera rangi i czytelności zapytań
  target_version_id      UUID NOT NULL   -- FK złożony → business_versions(id, organization_id)
  target_artifact_type   finance_artifact_type NOT NULL
  edge_type              finance_lineage_edge_type NOT NULL   -- enum z §2.1
  transformation_kind    TEXT NOT NULL   -- patrz §3.2
  assumption_snapshot_hash TEXT NULL     -- patrz §3.3
  assumption_snapshot_id UUID NULL       -- opcjonalny wskaźnik do pełnej treści snapshotu (poza zakresem B03 — właściciel: engine/model schedules WP)
  compute_run_id          UUID NULL      -- opcjonalny wskaźnik do WP-B04 compute run, który wyprodukował target
  author_id               UUID NOT NULL
  created_at               timestamptz NOT NULL DEFAULT now()

  CONSTRAINT fk_source FOREIGN KEY (source_version_id, organization_id)
      REFERENCES business_versions (id, organization_id)
  CONSTRAINT fk_target FOREIGN KEY (target_version_id, organization_id)
      REFERENCES business_versions (id, organization_id)
  CONSTRAINT no_self_loop CHECK (source_version_id <> target_version_id)
  CONSTRAINT uq_edge UNIQUE (source_version_id, target_version_id, edge_type)
```

Wymaga od WP-B01: `UNIQUE (id, organization_id)` na `business_versions` (dodatkowy złożony unique obok PK `id` — standardowy wzorzec Postgresa dla tenant-safe FK, patrz §4).

**Append-only jako grant DB, nie konwencja aplikacji.** Zgodnie z wzorcem z WP-A04 (bezpiecznik na poziomie roli DB, nie tylko kodu aplikacji): rola aplikacyjna dostaje `GRANT INSERT, SELECT` na `finance_lineage_edges`, **bez** `UPDATE`/`DELETE`. Korekta błędnej krawędzi (np. pomyłkowy manual link) odbywa się przez nowy wiersz o odwrotnym `transformation_kind='RETRACTION'` wskazujący tę samą parę, nie przez `DELETE`/`UPDATE` istniejącego wiersza. To jest bezpośrednia odpowiedź na ryzyko z §1.3 (reopen nadpisujący wiersz w miejscu) — ta klasa błędu jest strukturalnie niemożliwa dla tabeli krawędzi, bo rola DB fizycznie nie ma prawa `UPDATE`.

### 3.2 `transformation_kind`

Odrębna kolumna od `edge_type`. `edge_type` mówi *jaka para etapów*; `transformation_kind` mówi *jak krawędź powstała*:

| transformation_kind | Znaczenie |
|---|---|
| `COMPUTE` | target powstał jako wynik joba compute (WP-B04) korzystającego z source jako input |
| `MANUAL_LINK` | analityk ręcznie powiązał istniejące wersje (np. dopięcie Report do konkretnej Valuation post factum) |
| `PROMOTION` | odpowiednik istniejącego `finance_candidate_handoffs` — promocja/handoff, gdy ma to sens jako krawędź wewnątrz Finance (np. Advisor recommendation → Valuation Version, patrz `DEC-FIN-006`) |
| `RESTATEMENT_CARRY` | source jest restated/corrected wersją i target dziedziczy powiązanie po oryginale (uzupełnienie MUST #2 z addendum — restatements) |
| `REOPEN_CARRY` | target to `vN+1` powstałe z reopenu source `vN` (DEC-FIN-010) — krawędź `SAME_ARTIFACT` sibling, patrz §7.3 |
| `RETRACTION` | koryguje/unieważnia błędnie dodaną wcześniejszą krawędź (append-only fix, patrz §3.1) |

### 3.3 `assumption_snapshot_hash`

Wymagany (`NOT NULL`) dla `edge_type` ∈ `{ANALYSIS_TO_MODEL, MODEL_TO_SCENARIO, MODEL_TO_VALUATION, SCENARIO_TO_VALUATION}` — czyli tam, gdzie target faktycznie *oblicza* coś na podstawie założeń. Nullable dla `STATEMENT_TO_ANALYSIS`, `STATEMENT_TO_MODEL` (czyste dane źródłowe, brak założeń modelowych) i `VERSION_TO_REPORT` (agregacja, nie przeliczenie). Ten warunek jest egzekwowany przez `CHECK` z listą dozwolonych par `(edge_type, assumption_snapshot_hash IS NOT NULL)`, nie przez trigger — to czysta logika stała, nie wymaga zapytania.

Hash to `content_semantic_hash` w duchu sekcji 2.1 master planu — semantic hash + numeric tolerance, **nie** surowy serializacyjny hash (zgodnie z ograniczeniem #7 z sekcji 6 addendum: „Bit-for-bit/hash: używać semantic hash... nie surowego serializacyjnego hash jako dowodu finansowego"). B03 konsumuje ten hash jako dany z warstwy compute (WP-B04/silniki), nie definiuje algorytmu hashowania — to poza zakresem lineage.

## 4. Cycle prevention

**Mechanizm podstawowy — strukturalny, DB-enforced, tani (bez rekurencji):** `stage_rank` z §2.1 jest stały i całkowity. Trigger `BEFORE INSERT` na `finance_lineage_edges` odrzuca wiersz, jeśli `stage_rank(target_artifact_type) <= stage_rank(source_artifact_type)`.

Ponieważ każdy dozwolony `edge_type` z §2.1 z definicji idzie z niższej rangi do wyższej, a `REPORT` ma rangę maksymalną (5) i nigdy nie występuje jako `source_artifact_type` w żadnym zdefiniowanym `edge_type`, graf jest acykliczny **z konstrukcji** — nie potrzeba ogólnego wykrywania cykli (przechodzenie grafu przy każdym insercie). To jest świadomie tańsze niż ogólny algorytm cycle-detection, bo domena nie jest dowolnym grafem — jest ustalonym, małym zbiorem etapów.

**Mechanizm drugorzędny — walidacja aplikacyjna przed insertem (UX, nie bezpieczeństwo):** serwis aplikacyjny wykonuje ten sam check rangi *przed* wysłaniem INSERT, żeby zwrócić czytelny błąd użytkownikowi zamiast surowego naruszenia triggera. To jest duplikat logiki, celowo — trigger DB jest **autorytatywny** (jedyne miejsce, które faktycznie broni integralności, bo aplikacja nie jest jedynym possible writerem — joby WP-B04 piszą też bezpośrednio), warstwa aplikacyjna jest tylko kosmetyczna.

**Dlaczego nie rekurencyjny CTE przy insercie:** przy stałym, małym zbiorze etapów rekurencyjne sprawdzanie „czy target jest już przodkiem source" byłoby poprawne, ale strukturalnie zbędne i droższe (koszt O(głębokość × fan-out) przy każdym insercie krawędzi, na współdzielonej, często zapisywanej tabeli). Ranga daje ten sam efekt w O(1). Rekurencyjny CTE jest natomiast właściwym narzędziem dla zapytań ancestor/descendant (§7) — tam nie da się uniknąć przejścia grafu, bo to jest cel zapytania, nie efekt uboczny walidacji.

**Ryzyko do udokumentowania:** jeśli w przyszłości ktoś doda nowy `edge_type` łączący dwa artefakty na tej samej randze (np. hipotetyczny `SCENARIO_TO_SCENARIO` do porównań wariantów), rangowy trigger **nie** złapie cyklu w obrębie tej samej rangi. Rekomendacja: każda migracja dodająca nowy `edge_type` musi przejść review pod kątem tego, czy `stage_rank(target) > stage_rank(source)` nadal jest prawdziwe dla nowego typu; jeśli nie — wymagany osobny mechanizm (np. `SCENARIO_TO_SCENARIO` powinien być modelowany jako relacja `sibling/variant`, nie `lineage edge`, patrz §7.3, właśnie po to, żeby uniknąć tego problemu od razu).

## 5. Cross-tenant prevention

Mechanizm jest **referencyjny, nie tylko sprawdzany**: `fk_source` i `fk_target` to złożone klucze obce na `(version_id, organization_id)`, wskazujące na złożony `UNIQUE (id, organization_id)` w `business_versions`. Skutek: fizycznie nie da się wstawić wiersza `finance_lineage_edges`, w którym `organization_id` różni się od organizacji faktycznego właściciela `source_version_id` albo `target_version_id` — baza odrzuci insert kodem naruszenia FK, zanim jakikolwiek trigger czy aplikacja zdąży to „sprawdzić". To jest różnica jakościowa względem samego `CHECK`: `CHECK` wymagałby dodatkowego zapytania/subquery (Postgres nie pozwala na subquery w `CHECK` z gwarancją konsystencji przy współbieżności), złożony FK wymusza to atomowo przez sam mechanizm integralności referencyjnej.

Efekt uboczny: skoro `source.organization_id = edges.organization_id = target.organization_id` przechodnio, to `source.organization_id = target.organization_id` jest gwarantowane bez osobnego constraintu między source a target.

Ten wzorzec wymaga jawnej współpracy z WP-B01 (musi dostarczyć `UNIQUE (id, organization_id)` na `business_versions`, nie tylko `PRIMARY KEY (id)`) — zapisane jako zależność w §8.

## 6. Freshness state machine i propagacja

### 6.1 Stany (z sekcji 2.1 master planu, węższy zakres B03 — projektuje przejścia i propagację, nie samą kolumnę)

`NEVER_COMPUTED → CURRENT → {STALE_SOURCE, STALE_ASSUMPTIONS} → COMPUTE_FAILED` (COMPUTE_FAILED jest osiągalny z każdego stanu, gdy uruchomiony compute zawiedzie; z COMPUTE_FAILED powrót do CURRENT wymaga nowego udanego compute, nie automatycznego resetu).

**Kolumna `freshness_state` żyje na `business_versions`** (własność WP-B01 co do miejsca przechowania), ale **B03 definiuje wartości, przejścia i algorytm propagacji**. To jest granica własności, którą trzeba potwierdzić z WP-B01 przy integracji (§8).

Freshness to metadana, nie treść — aktualizacja `freshness_state` na wersji `APPROVED` **nie** narusza zasady „Approved jest immutable" z sekcji 2.1 master planu, bo immutability dotyczy zawartości finansowej (wartości, założeń, snapshotu), nie adnotacji o aktualności. To rozróżnienie musi być jawne w implementacji WP-B01/B02: `UPDATE` na `freshness_state` (i towarzyszących `freshness_reason`, `stale_since`) jest dozwolony nawet dla Approved; `UPDATE` na jakiejkolwiek innej kolumnie Approved nie jest.

### 6.2 Zdarzenia wyzwalające

| Zdarzenie | Właściciel | Efekt na freshness targetu bezpośredniego |
|---|---|---|
| Nowa Business Version artefaktu-przodka zostaje Approved (supersedes poprzednią) | WP-B02 lifecycle | dzieci starej wersji → `STALE_SOURCE`, reason=`NEW_SOURCE_VERSION` |
| Wersja-przodek zostaje `INVALIDATED` | WP-B02 lifecycle | dzieci → `STALE_SOURCE`, reason=`SOURCE_INVALIDATED` (podwyższony priorytet, patrz §6.4) |
| Org-owy rejestr założeń/konwencji (ratio registry, engine_manifest, FX as-of) zmienia się materialnie | poza B03 (governance z addendum §5) | wersja, której `assumption_snapshot_hash` nie zgadza się z bieżącym rejestrem → `STALE_ASSUMPTIONS`, reason=`ASSUMPTION_REGISTRY_CHANGED` |
| Compute job kończy się błędem | WP-B04 | target tego joba → `COMPUTE_FAILED`, reason=`COMPUTE_ERROR` (bez propagacji dalej — dzieci tej wersji nie istnieją jeszcze, bo target nigdy się nie domknął) |
| Nowa Business Version powstaje bez jeszcze uruchomionego compute | WP-B01/B04 | `NEVER_COMPUTED` (stan startowy, nie efekt propagacji) |

Każde przejście **poza** `NEVER_COMPUTED`/`COMPUTE_FAILED` (czyli każde `→ STALE_SOURCE` i `→ STALE_ASSUMPTIONS`) niezależnie od przyczyny jest traktowane jednolicie jako „freshness zmieniło się na nie-CURRENT" i **samo w sobie** jest zdarzeniem wyzwalającym kaskadę do kolejnego poziomu (Model staje się `STALE_ASSUMPTIONS` → jego dzieci Scenario/Valuation stają się `STALE_SOURCE` z reason wskazującym Model jako `triggering_version_id`). To jednolite traktowanie upraszcza algorytm — nie ma osobnej ścieżki kaskady per przyczyna.

### 6.3 Algorytm propagacji — dwie fazy, bez auto-recompute

**Faza 1 — synchroniczna, w tej samej transakcji co zdarzenie wyzwalające:**

1. `UPDATE business_versions SET freshness_state='STALE_SOURCE', freshness_reason=<reason_code>, stale_since=now() WHERE id IN (SELECT target_version_id FROM finance_lineage_edges WHERE source_version_id = :triggering_version_id) AND freshness_state <> 'STALE_SOURCE'::freshness_state OR freshness_reason <> reason_code` (upsert idempotentny — nie nadpisuje `stale_since`, jeśli stan i powód się nie zmieniają, żeby nie „odświeżać" wieku staleness przy powtórnym tym samym zdarzeniu).
2. `INSERT INTO finance_lineage_freshness_events (...)` — po jednym append-only wierszu na każdą faktyczną zmianę stanu, z `triggering_edge_id`, `triggering_version_id`, `previous_state`, `new_state`, `reason_code`. To jest ewidencja dla „source changed / downstream stale" z OWN-FIN-022 i dla Exception inbox z sekcji 3 addendum.
3. Bezpośrednie dzieci (poziom 1) są ograniczone liczbowo (fan-out jednego wydania statement packa w praktyce to niewielka liczba analiz/modeli) — akceptowalne synchronicznie.
4. Enqueue asynchronicznego joba propagacji głębszej (WP-B04 persisted queue) z payloadem `{organization_id, root_version_id, reason_code}` i `idempotency_key = hash(root_version_id, reason_code, dzień)` — job jest bezpieczny do powtórki (at-least-once z WP-B04).

**Faza 2 — asynchroniczna, poziom 2+:**

5. Job wykonuje `WITH RECURSIVE` po `finance_lineage_edges` startując od zbioru wersji zmienionych w fazie 1, idąc `source_version_id → target_version_id`, z twardym limitem głębokości (np. 20 — znacznie ponad realną głębokość domeny ~6, czysto obronne).
6. Dla każdego odwiedzonego węzła: ten sam upsert co w kroku 1, ten sam insert do `finance_lineage_freshness_events`, z `triggering_version_id` wskazującym **najbliższego** przodka na ścieżce, który faktycznie spowodował zmianę (nie zawsze `root_version_id` — zachowuje to czytelność „source changed" bliżej węzła, zamiast zawsze wskazywać najdalszy korzeń).
7. Fixed point: jeśli węzeł już ma dokładnie ten `freshness_state` + `freshness_reason` z tego samego `triggering_edge_id`, przejście dalej po jego dzieciach jest pomijane (zapobiega nieskończonemu/kwadratowemu przetwarzaniu przy powtórnych uruchomieniach joba i przy grafach typu diamond, gdzie ten sam węzeł jest osiągalny wieloma ścieżkami).

**Świadomie brak auto-recompute:** żaden krok algorytmu nie umieszcza joba typu „przelicz Valuation" w kolejce compute. Propagacja wyłącznie **oznacza** stan; decyzję o ponownym Compute podejmuje analityk ręcznie (spójne z wymaganiem z briefu i z zasadą 7 sekcji 1 master planu — system nie blokuje pracy).

**Dlaczego async dla poziomu 2+, a nie cały cascade synchronicznie:** Approve nowej wersji Statement Packa musi zakończyć się szybko nawet jeśli w organizacji istnieją setki starych Raportów/Eksportów zbudowanych na tym pakiecie przez lata (realistyczny scenariusz przy wieloletniej historii — capacity z sekcji 4 addendum). Blokowanie transakcji Approve na przejściu całego grafu narusza zasadę „system nie blokuje pracy z powodu" (sekcja 1 pkt 7) i ryzykuje długie locki na współdzielonej tabeli krawędzi.

### 6.4 Priorytet powodu przy nadpisywaniu (severity ordering)

Ponieważ stan `STALE_SOURCE` może być osiągnięty z różnych powodów w różnym czasie (np. najpierw `NEW_SOURCE_VERSION`, później `SOURCE_INVALIDATED` na tym samym węźle z innej gałęzi grafu), definiujemy porządek ważności `reason_code`, żeby late-arriving mniej pilny powód nie „ukrył" wcześniej ustalonego bardziej krytycznego:

`SOURCE_INVALIDATED` (najwyższy) > `ASSUMPTION_REGISTRY_CHANGED` > `NEW_SOURCE_VERSION` > `COMPUTE_ERROR` (dotyczy innej osi, nie nadpisuje powyższych)

Reguła: nowy zapis nadpisuje `freshness_reason` tylko jeśli jego priorytet ≥ obecnego; w przeciwnym razie zapisuje się dodatkowy wiersz w `finance_lineage_freshness_events` (pełna historia zachowana), ale `business_versions.freshness_reason` pozostaje przy poważniejszym powodzie. To jest jawna decyzja projektowa tego ADR (nie ma jej wprost w briefie) — flagowana jako do potwierdzenia przy review Gate B (§8, pytanie #4).

## 7. Archive-safe history

### 7.1 Krawędzie nigdy nie są usuwane ani edytowane

`finance_lineage_edges` nie ma żadnej kolumny statusu i żadnego triggera reagującego na zmianę `business_versions.status`. Gdy artefakt-przodek przechodzi `SUPERSEDED`/`ARCHIVED`/`INVALIDATED` (WP-B02), krawędzie, w których uczestniczy jako `source_version_id` lub `target_version_id`, **pozostają bez zmian** — to jest bezpośrednia realizacja wymogu z OWN-FIN-022 („Usunięcie/archiwizacja nie może zerwać śladu audytowego") i z DEC-FIN-007 („pozostaje w historii i lineage").

### 7.2 Status źródła liczony na żywo, nie zapisany na krawędzi

Lineage Navigator (§8 przy zapytaniach) nie przechowuje na krawędzi żadnej kopii statusu source/target — status jest doliczany w momencie odczytu przez `JOIN` do `business_versions.status`. Powód: gdyby status był skopiowany na krawędź, każda zmiana statusu wymagałaby `UPDATE` krawędzi (łamie append-only) albo tworzyłaby rozjazd między „stanem w chwili utworzenia krawędzi" a „stanem dziś" — a potrzebujemy obu: krawędź ma pokazywać fakt historyczny (\"ta wersja Valuation powstała z tej konkretnej wersji Modelu"), a Navigator ma pokazywać aktualny status tej wersji Modelu dziś (np. „Superseded przez v4"). Rozdzielenie tych dwóch odpowiedzialności (fakt append-only vs status live) jest świadomym wyborem tego ADR.

### 7.3 Passive (Superseded/Archived) vs active (Invalidated) — różny wpływ na propagację

- **Superseded/Archived jest normalnym, częstym zdarzeniem cyklu życia** (nowa wersja powstaje regularnie). Kaskada z §6.3 uruchamia się dokładnie wtedy — to nie jest wyjątek, to jest główny, oczekiwany tryb działania algorytmu propagacji. Report zbudowany na Statement Pack v1 pozostaje ważny jako **historyczny zapis** (Report jest liściem, sam nie ma dalszych dzieci do propagacji), ale jeśli ktokolwiek zbudował Analysis v2 na Statement Pack v1 już po tym, jak v1 został Superseded przez v2 — to Analysis v2 i tak dostaje `STALE_SOURCE`, bo krawędź wskazuje na konkretną (już nieaktualną) wersję.
- **Invalidated jest rzadkim zdarzeniem korekty błędu** i dostaje podwyższony priorytet powodu (`SOURCE_INVALIDATED`, §6.4) — nadpisuje łagodniejsze powody, i co ważne: **nadpisuje też ewentualny wcześniejszy „manual override / accepted with exception"** na potomkach (jeśli taki mechanizm istnieje w warstwie exception ledger z DEC-FIN-009), ponieważ odkrycie błędu u źródła unieważnia wcześniejszą ludzką akceptację odchylenia — to nie jest to samo ryzyko, które człowiek zaakceptował. Ta reguła jest jawnym rozstrzygnięciem tego ADR, nie ma wprost w briefie, i wymaga potwierdzenia przy review z governance (WP-B05 exception ledger) — patrz §8.

### 7.4 Siblings/warianty tej samej wersji-macierzystej

„Warianty" (np. inne Scenario zbudowane na tym samym Baseline Model, albo `vN+1` powstałe z reopenu `vN`, `transformation_kind='REOPEN_CARRY'`) to nie osobny typ krawędzi w grafie lineage w rozumieniu §2 — to zapytanie po istniejących krawędziach (patrz §8.3), które **nie wymaga** nowej relacji w schemacie. Rozważaliśmy dodanie jawnej relacji `SAME_ARTIFACT_SIBLING`, ale odrzuciliśmy — dublowałaby informację już dostępną w `business_versions.artifact_id` (własność WP-B01) i skomplikowała cycle-check z §4 bez potrzeby (dwie wersje tego samego artefaktu mają tę samą `stage_rank`, więc krawędź między nimi łamałaby regułę `target_rank > source_rank`).

## 8. Zapytania dla Finance Lineage Navigator (OWN-FIN-022)

### 8.1 Ancestors i descendants — rekurencyjny CTE vs materialized closure table

**Rekomendacja: rekurencyjny CTE jako strategia dla Gate B/C/D/E, closure table świadomie odłożona.**

Ancestors:
```sql
WITH RECURSIVE ancestors AS (
  SELECT source_version_id, target_version_id, edge_type, 1 AS depth
  FROM finance_lineage_edges
  WHERE target_version_id = :version_id AND organization_id = :org_id
  UNION ALL
  SELECT e.source_version_id, e.target_version_id, e.edge_type, a.depth + 1
  FROM finance_lineage_edges e
  JOIN ancestors a ON e.target_version_id = a.source_version_id
  WHERE e.organization_id = :org_id AND a.depth < 20
)
SELECT DISTINCT source_version_id, edge_type, depth FROM ancestors;
```
Descendants: symetrycznie, `source_version_id = :version_id` na kotwicy, `e.source_version_id = a.target_version_id` w rekurencji.

Wymagane indeksy: `(organization_id, target_version_id)` dla ancestors, `(organization_id, source_version_id)` dla descendants — oba pokryte przez `uq_edge` częściowo, ale dedykowane indeksy złożone z `organization_id` na początku są potrzebne osobno, bo `uq_edge` ma kolejność `(source_version_id, target_version_id, edge_type)` bez `organization_id`.

**Trade-off (dlaczego nie closure table od razu):**

| Kryterium | Rekurencyjny CTE | Materialized closure table |
|---|---|---|
| Koszt zapisu (insert krawędzi) | O(1) — jeden insert | O(ancestors × descendants) — insert krawędzi wymaga domknięcia iloczynu kartezjańskiego zbiorów przodków/potomków obu końców, wewnątrz tej samej transakcji |
| Koszt odczytu (ancestors/descendants) | O(głębokość × fan-out) na żądanie | O(1) — pojedynczy `SELECT` z gotowej tabeli |
| Spójność | zawsze aktualna, liczona z jedynego źródła prawdy (`finance_lineage_edges`) | wymaga niezawodnej, transakcyjnej konserwacji przy KAŻDYM insercie; ryzyko rozjazdu jeśli inkrementalna aktualizacja zawiedzie |
| Złożoność operacyjna | brak dodatkowej struktury do utrzymania | dodatkowa tabela, dodatkowa logika utrzymania, dodatkowy wektor błędu przy `RETRACTION` (§3.1) |
| Skalowanie przy dużym fan-out | degraduje się przy bardzo szerokich węzłach (setki bezpośrednich dzieci) | skaluje się dobrze przy odczycie, kosztem zapisu |
| Pasowanie do domeny Finance | **dobre** — głębokość grafu jest ustalona i mała (≤6 etapów z §2.1), fan-out per organizację jest ograniczony realną liczbą okresów/wersji/wariantów w rozsądnym horyzoncie (dekady, nie miliony) | nadmiarowe przy tej skali; opłacalne dopiero przy bardzo dużym fan-out lub bardzo częstych odczytach ancestor/descendant o twardym SLO poniżej tego, co CTE realistycznie daje |

**Decyzja:** rekurencyjny CTE, bo (a) głębokość jest strukturalnie mała i stała (§2.1 — 6 etapów, twardy limit 20 w zapytaniu jest czysto obronny), (b) koszt utrzymania closure table pod append-only + `RETRACTION` semantyką (§3.1) jest wyższy niż korzyść przy przewidywanej skali, (c) closure table wprowadzałaby drugie źródło prawdy dokładnie w miejscu, gdzie §7.2 świadomie unika duplikacji stanu. **Warunek rewizji:** jeśli w Gate E (canary tenant, obserwowalność z sekcji 4 pkt 10 addendum) zmierzony p95 dla zapytań Lineage Navigator przekroczy SLO produktywności analityka (sekcja 10 addendum: benchmarki ≤45–90 s dla całych zadań, więc pojedyncze zapytanie nawigatora powinno być rzędu dziesiątek/setek ms) — dopiero wtedy budować closure table jako materializację przyrostową, nie wcześniej. To jest jawna, udokumentowana decyzja odłożenia, nie brak decyzji.

### 8.2 Ostrzeżenia `source changed / downstream stale / orphaned` (OWN-FIN-022, wymaganie właścicielskie)

Nie wymaga nowego zapytania grafowego — to bezpośredni odczyt z `business_versions.freshness_state` (już utrzymywany przez algorytm §6) dla zbioru zwróconego przez ancestors/descendants powyżej. „Orphaned" (wersja bez oczekiwanej krawędzi macierzystej, np. Analysis bez `STATEMENT_TO_ANALYSIS`) to prosty `NOT EXISTS` po wymaganych `edge_type` dla danego `target_artifact_type` — lista wymaganych typów per artefakt jest ustalona w §2.1/§3.3 i może być stałą w kodzie, nie wymaga osobnej tabeli konfiguracyjnej na tym etapie.

### 8.3 Siblings/warianty

Dwie odrębne, tanie, jednoskokowe operacje (nie wymagają rekurencji):

```sql
-- (a) inne wersje tego samego artefaktu (własność WP-B01 — business_versions.artifact_id)
SELECT id FROM business_versions
WHERE artifact_id = (SELECT artifact_id FROM business_versions WHERE id = :version_id)
  AND organization_id = :org_id AND id <> :version_id;

-- (b) warianty zbudowane z tego samego rodzica i tego samego typu krawędzi
SELECT DISTINCT e2.target_version_id
FROM finance_lineage_edges e1
JOIN finance_lineage_edges e2
  ON e1.source_version_id = e2.source_version_id AND e1.edge_type = e2.edge_type
WHERE e1.target_version_id = :version_id AND e2.target_version_id <> :version_id
  AND e1.organization_id = :org_id AND e2.organization_id = :org_id;
```

Indeks wspierający (b): `(source_version_id, edge_type)` — osobny od indeksów ancestors/descendants z §8.1, bo kierunek dostępu jest inny (od source, grupując po parach).

## 9. Podsumowanie decyzji

| Temat | Decyzja |
|---|---|
| Model krawędzi | Jeden kierunkowy wiersz na parę rodzic→dziecko; wielorodzicielstwo = wiele wierszy z tym samym target |
| Typ krawędzi | Zamknięty enum `edge_type` (7 wartości) mapowany na stałą rangę etapu |
| Cycle prevention | Trigger DB oparty na porównaniu `stage_rank(target) > stage_rank(source)` — O(1), strukturalny; walidacja aplikacyjna jako duplikat dla UX, nieautorytatywna |
| Cross-tenant prevention | Złożony FK `(version_id, organization_id)` do `business_versions(id, organization_id)` — referencyjny, nie tylko sprawdzany |
| Append-only | Wymuszone grantami roli DB (brak `UPDATE`/`DELETE` dla roli aplikacyjnej), korekty przez `RETRACTION` |
| Freshness — miejsce | Kolumna na `business_versions` (własność WP-B01), wartości/przejścia/propagacja — własność B03 |
| Freshness — propagacja | Dwufazowa: synchroniczna dla dzieci bezpośrednich, asynchroniczna (WP-B04 queue, rekurencyjny CTE) dla głębszych poziomów; bez auto-recompute |
| Freshness — priorytet powodu | `SOURCE_INVALIDATED` > `ASSUMPTION_REGISTRY_CHANGED` > `NEW_SOURCE_VERSION`; Invalidated nadpisuje wcześniejsze manualne override'y |
| Archive-safe history | Krawędzie nigdy nie są usuwane/edytowane; status source/target liczony na żywo przez JOIN, nie kopiowany na krawędź |
| Query strategy | Rekurencyjny CTE dla ancestors/descendants; materialized closure table świadomie odłożona z jawnym warunkiem rewizji (p95 SLO w Gate E) |

## 10. Otwarte pytania (do rozstrzygnięcia przed/na Gate B review)

1. **Zależność od WP-B01 nie istnieje jeszcze w tym worktree.** Ten ADR zakłada dokładny kształt `business_versions` (kolumny `id`, `artifact_id`, `organization_id`, `status`, potrzebę `UNIQUE (id, organization_id)`). Jeśli WP-B01 wybierze inny kształt (np. oddzielne tabele per typ artefaktu zamiast jednej wspólnej `business_versions`), złożone FK z §5 i zapytania z §8 wymagają przeprojektowania (per-typ FK zamiast jednego uniwersalnego). Rekomendacja: WP-B01 i WP-B03 muszą przejść wspólne review przed Gate C, nie osobno.
2. **Miejsce przechowania `freshness_state`** — czy rzeczywiście na `business_versions` (jedna kolumna dla wszystkich typów artefaktów), czy per-typ? Ten ADR zakłada wspólną kolumnę dla spójności z §2.1 master planu („Freshness jest niezależne" — jedna definicja stanów dla całego systemu), ale to wymaga potwierdzenia z WP-B01.
3. **Rejestr założeń organizacyjnych** (`ASSUMPTION_REGISTRY_CHANGED` w §6.2) nie ma jeszcze zaprojektowanego właściciela w programie — nie jest to WP-B03, prawdopodobnie dotyka governance (sekcja 5 addendum, „reproducibility manifest") i/lub WP-B01 `engine_manifest_id`. B03 zakłada tylko istnienie porównywalnego hasha/wersji, nie projektuje samego rejestru.
4. **Priorytet powodu (§6.4) i nadpisywanie manualnych override'ów przez `SOURCE_INVALIDATED` (§7.3)** to jawne rozstrzygnięcia tego ADR, wykraczające poza literalny tekst briefu — wymagają potwierdzenia przez governance/exception ledger (WP-B05) jako spójne z DEC-FIN-009.
5. **Limit głębokości 20 w zapytaniach rekurencyjnych** (§8.1) jest arbitralny (obronny margines ponad realną głębokość 6) — do skalibrowania empirycznie, gdy pojawią się pierwsze dane produkcyjne w Gate D/E.
6. **`assumption_snapshot_id` jako pełna treść snapshotu** (§3.3) jest zarysowany jako nullable wskaźnik, ale tabela docelowa (gdzie faktycznie żyje treść snapshotu założeń) nie jest projektowana w tym ADR — należy do warstwy silników/model schedules (poza Gate B WP-B03).
