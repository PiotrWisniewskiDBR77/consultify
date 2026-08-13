# W2 P0 Tenant-Isolation Fix — adversarial verification

**Rola:** Odbiorca-weryfikator, niezależny od autora naprawy (`docs/validation/finance-v3/generated/gate-d/P0_TENANT_ISOLATION_FIX_report.md`).
**Worktree:** `/Users/piotrwisniewski/consultify-wt/w2-p0verify`
**Gałąź:** `codex/finance-v3-w2-p0verify`, HEAD `cecc7975c1` (fan-in: `codex/finance-v3-p0tenant` + `codex/finance-v3-d01hash` + `codex/finance-v3-tdverify` + bazowa historia).
**Zakres naprawy pod odbiorem:** `32a9087755..4edfa9239a` (6 commitów, gałąź `codex/finance-v3-p0tenant`, baza `cc874cc5e7`).
**Data:** 2026-08-10.
**Baza pomiarowa:** własny efemeryczny Postgres 15.15, `PGDATA=/private/tmp/fv3-p0v-pgdata`, port **57691**, usunięty po pracy. Zero połączeń ze staging/demo/produkcją. Zero pushy.

---

## 0. Metoda

Dla każdego z 6 defektów napisałem **własny, niezależny prob** (`w2_probe.ts`), z własnymi organizacjami/wartościami seed, bez importowania czegokolwiek z `tenantMatrix.pg.test.ts` autora. Werdykt biorę zawsze z **niezależnego `SELECT` wprost z tabeli**, nigdy z wartości zwróconej przez serwis. Dodatkowo przejrzałem **linia po linii** wszystkie 8 odwróconych asercji w pliku testowym autora, policzyłem migracje/testy sam, i wykonałem kontrolę negatywną dla obu P0 przez `git show <parent> -- <plik> > plik` (NIE `git stash`), z osobnym probem używającym STAREGO kształtu API tam, gdzie sygnatura się zmieniła (dokładnie ostrzeżenie autora o „pułapce przesunięcia pozycyjnych argumentów").

---

## 1. Per defekt — twierdzenie autora vs mój prob

### W9-C-5 (P0) — `computeJobService.getJob/cancelJob/failJob`

**Twierdzenie:** wymagają teraz `organizationId`, predykat SQL, odmowa=`null`, `claim()` nietknięty.

**Mój prob** (orgi `verify2-X`/`verify2-Y`, własne UUID):
```
[PASS] W9-C-5 getJob(X, Y.jobId) returns null
[PASS] W9-C-5 cancelJob(X, Y.jobId) returns null
[PASS] W9-C-5 independent read: Y job still queued/untouched
      :: {"status":"queued","cancel_reason":null,"cancel_requested_at":null,"organization_id":"...Y..."}
[PASS] W9-C-5 sanity: Y reads own job
```
**Werdykt: POTWIERDZONE.**

### W9-C-4 (P0) — `writeSensitivityGrid()`

**Twierdzenie:** weryfikuje właściciela `methodId` PRZED dotknięciem czegokolwiek, typowany `SensitivityGridAccessError`, plus backstop FK.

**Mój prob:**
```
[PASS] W9-C-4 precondition: Y has 25 cells
[PASS] W9-C-4 X write against Y.methodId THROWS :: "SensitivityGridAccessError"
[PASS] W9-C-4 thrown error is typed SensitivityGridAccessError
[PASS] W9-C-4 independent read: still 25 rows, same ids as before, all owned by Y
[PASS] W9-C-4 no X-owned cell exists for this grid
```
**Werdykt: POTWIERDZONE.**

### W9-C-1 (P1) — `baselineComputeService.loadContext()`

**Twierdzenie:** wszystkie 6 odczytów org-scoped, refuse na PIERWSZYM (`finance_baseline_models`), typowany `NO_BASELINE_MODEL_ROW`.

**Mój prob:**
```
[PASS] W9-C-1 loadContext(X, Y.baselineBvId) refuses :: {"ok":false,"code":"NO_BASELINE_MODEL_ROW",...}
[PASS] W9-C-1 typed code NO_BASELINE_MODEL_ROW
[PASS] W9-C-1 independent read: Y baseline model untouched, still Y-owned
```
**Werdykt na poziomie WYNIKU zwracanego do wywołującego: POTWIERDZONE** — cross-tenant call refuses, nigdy nie zwraca danych B.

**ALE — twierdzenie „refuse na PIERWSZYM odczycie" jest NIEŚCISŁE.** Patrz §3, nowe ustalenie NEW-2: `resolveSourceStatementPackVersion()` (linia 145-153) jest FAKTYCZNIE pierwszym odczytem, wykonywanym PRZED sprawdzeniem org na `finance_baseline_models`, i NIE MA predykatu `organization_id`. Nie zmienia to werdyktu POTWIERDZONE dla samego W9-C-1 (bo wartość jest odrzucana zanim wróci do wywołującego), ale unieważnia dosłowne brzmienie uzasadnienia w kodzie/commit message.

### W9-C-2 (P1) — `predictionPreflightService.runPreflight()`

**Twierdzenie:** predykat na pierwszym odczycie, typowany `NO_SCENARIO_ROW`, refuse przed raw FK.

**Mój prob:**
```
[PASS] W9-C-2 runPreflight(X, Y.predictionBvId) refuses :: {"ok":false,"code":"NO_SCENARIO_ROW",...}
[PASS] W9-C-2 typed code NO_SCENARIO_ROW
[PASS] W9-C-2 independent read: zero preflight_runs rows persisted for Y
[PASS] W9-C-2 independent read: Y scenario still Y-owned
```
**Werdykt: POTWIERDZONE.** (`runPreflight` nie ma odpowiednika `resolveSourceStatementPackVersion` przed swoim głównym odczytem — sprawdzone grepem, ten plik nie ma tej funkcji).

### W9-C-3 (P1) — `valuationComputeService.findOrCreateMethod()`

**Twierdzenie:** weryfikuje `businessVersionId` należy do `organizationId` PIERWSZE, zwraca `{ok:false, code:'BUSINESS_VERSION_NOT_FOUND'}` zamiast gołego `MethodRow`.

**Mój prob:**
```
[PASS] W9-C-3 findOrCreateMethod(X, Y.valuationBvId) refuses :: {"ok":false,"code":"BUSINESS_VERSION_NOT_FOUND",...}
[PASS] W9-C-3 typed code BUSINESS_VERSION_NOT_FOUND
[PASS] W9-C-3 independent read: exactly 1 method row for Y.valuationBvId, still Y-owned, no new row
```
**Werdykt na poziomie granicy tenanta: POTWIERDZONE.** Ale ta zmiana sygnatury (throw→union) ma udokumentowany koszt uboczny — patrz §4 (regresja `coldReopen.pg.test.ts`) i §7 (ocena wyboru projektowego).

### W9-C-6 (P2) — `computeAnalysisKpis()` typowana odmowa

**Twierdzenie:** izolacja i tak trzymała; teraz `{ok:false, code:'BUSINESS_VERSION_NOT_FOUND'}` zamiast gołego throw.

**Mój prob:**
```
[PASS] W9-C-6 computeAnalysisKpis(X, Y.anaBvId) resolves (no throw)
[PASS] W9-C-6 typed refusal ok:false :: {"ok":false,"code":"BUSINESS_VERSION_NOT_FOUND",...}
[PASS] W9-C-6 typed code BUSINESS_VERSION_NOT_FOUND
```
**Werdykt: POTWIERDZONE.**

**Podsumowanie §1: wszystkie 6 twierdzeń autora POTWIERDZONE moim własnym, niezależnym probem z niezależnym odczytem fizycznym.**

---

## 2. Kontrola negatywna — OBOWIĄZKOWA

### 2.1 W9-C-5 (`computeJobService`)

Plik podmieniony `git show cc874cc5e7:...computeJobService.ts` (NIE stash). Napisałem DEDYKOWANY prob używający STAREGO 1-argumentowego `getJob(jobId)` / 2-argumentowego `cancelJob(jobId, reason)` — dokładnie unikając pułapki „przesunięcia pozycyjnego", którą sam autor odnotował.

```
[negctrl] OLD getJob(B.jobId) called from A's context (no org param exists) ->
  {"id":"...","organization_id":"org-negctrl-B-...","status":"queued",...}   <- PEŁEN wiersz B
[negctrl] OLD cancelJob(B.jobId, reason) -> {..."status":"cancelled",...}    <- zmutowany
[negctrl] independent physical read of B.jobId after ->
  {"status":"cancelled","cancel_reason":"cross-tenant cancel via OLD unscoped API",...}
[RESULT] leaked=true mutated=true -> VULNERABLE (defect reproduces, RED as expected)
```
**Defekt odtworzony 1:1.** Plik przywrócony (`git status` czysty), prob ponownie zielony (patrz §1).

### 2.2 W9-C-4 (`writeSensitivityGrid` + migracja W9-C-7)

**Krok 1 — tylko serwis cofnięty (`git show cc874cc5e7:...`), złożony FK z migracji ZOSTAJE:**
```
[negctrl-c4] A write against B.methodId (service reverted, structural FK still present) threw= true
  msg= insert or update on table "finance_valuation_sensitivity_cells" violates
       foreign key constraint "fk_finance_valuation_sensitivity_cells_grid_org"
[negctrl-c4] independent physical read of ownership after A's attempt ->
  [{"organization_id":"...B...","n":"25"}]
[negctrl-c4] same 25 rows survived (FK-backstop working) = true count after= 25
```
**Potwierdzam DOSŁOWNIE ustalenie autora**: sam złożony FK strukturalny — BEZ jakiejkolwiek sprawdzki w warstwie serwisu — już zatrzymuje destrukcyjny zapis. B's 25 komórek przetrwały, nietknięte, mimo cofniętego serwisu. Błąd jest surowym 23503 (nie typowanym), ale dane są chronione.

**Krok 2 — oba FK zdjęte (`ALTER TABLE ... DROP CONSTRAINT`), serwis nadal cofnięty:**
```
[negctrl-c4] A write against B.methodId (service reverted, structural FK still present) threw= false
[negctrl-c4] independent physical read of ownership after A's attempt -> [{"organization_id":"...A...","n":"25"}]
[negctrl-c4] same 25 rows survived (FK-backstop working) = false count after= 25
```
**Defekt oryginalny odtworzony 1:1** — wszystkie 25 komórek B fizycznie należą teraz do A (`organization_id=A`), zero błędu. Dokładnie zgodne z oryginalnym raportem W9 i z twierdzeniem autora.

**Sprzątanie i przywrócenie:** usunięte skorumpowane wiersze testowe (`grid_label='NEGC4_GRID'`), FK odtworzone ręcznie tymi samymi definicjami co migracja (walidacja przeszła bez błędu na POZOSTAŁYCH danych w bazie — potwierdza brak innej korupcji), serwis przywrócony `cp` z backupu (`git status` czysty), migracja STRICT ponownie `exit 0` (0 zastosowanych — idempotentna), pełny prob ponownie zielony.

**Werdykt kontroli negatywnej: OBIE warstwy P0 dyskryminują poprawnie; ustalenie autora o „obronie w głąb" (FK sam wystarcza, serwis daje tylko TYPOWANY komunikat zamiast surowego 23503) — POTWIERDZONE, nie obalone.**

### 2.3 Bramka DB

```
$ unset DATABASE_URL RUN_DB_TESTS MOCK_DB DB_TYPE
$ NODE_ENV=test npx vitest run ... tenantMatrix.pg.test.ts
Test Files  1 skipped (1)
     Tests  24 skipped (24)
```
`skipped`, nigdy `passed` — potwierdzone niezależnie.

---

## 3. Tabele tej samej klasy, których autor NIE zamknął

Zapytanie do `pg_constraint`/`information_schema` po wszystkich `finance*`/`compute*` tabelach z kolumną `organization_id`, sklasyfikowane: `composite_fk` (chronione złożonym FK) / `single_org_fk_only` / `NO_ORG_FK_AT_ALL`.

| Tabela | Status FK | Ma parenta (child-of)? | Realny wektor przez serwis? | Ocena |
| --- | --- | --- | --- | --- |
| `finance_valuation_cases` | single (root) | NIE (root, udokumentowane przez autora) | 0 callerów — potwierdzone grepem niezależnie | Poprawne, jak twierdzi autor |
| `finance_legal_holds` | single | ma `artifact_id`/`business_version_id`, ale BEZ ŻADNEGO FK (nawet pojedynczego) | **0 callerów w `server/src`** (grep czysty — dwa różne, niepowiązane systemy `legal_hold`/`retention_polic*` istnieją w kodzie, ŻADEN nie dotyka `finance_legal_holds`) | Martwa tabela, EVIDENCE_MISSING dla „realnie wycieka" — nie wycieka, bo nic jej nie używa |
| `finance_retention_policies` | brak FK w ogóle | root (config, `organization_id` nullable = platform default) | **0 callerów w `server/src`** | Martwa tabela, jak wyżej |
| `finance_candidate_handoffs` | brak FK do `organizations` w ogóle | NIE (root, `source_id`/`candidate_id` to opaque identyfikatory domeny wywołania, nie FK do innej tabeli finance) | Wszystkie 3 zapytania w `financeCandidateHandoffCore.ts` już mają `organization_id = ?` w `WHERE`/`UNIQUE(org,type,id)` — read/write zawsze org-scoped z kontekstu wywołującego | **Brak realnego wektora** — luka to tylko referential-integrity (brak FK do `organizations`), nie tenant leak |
| `finance_comment_assignments` | single (do `organizations`), BRAK złożonego FK do `finance_comments(id, organization_id)` | TAK — dziecko `finance_comments` przez `comment_id` (pojedyncza kolumna, bez org) | `commentService.assignComment()` **weryfikuje** `SELECT id FROM finance_comments WHERE id=? AND organization_id=?` PRZED insertem (ten sam wzorzec obrony co `writeSensitivityGrid`) | **Nie wycieka DZIŚ** (serwis chroni), ale to DOKŁADNIE ta sama klasa strukturalna, którą W9-C-7 zamknął gdzie indziej — brak backstopu FK. **P2, strukturalna niekompletność, nie żywy lek.** |
| `finance_lineage_freshness_events` | single, BRAK złożonego FK do `finance_lineage_edges(id, organization_id)` na `triggering_edge_id` | TAK — dziecko `finance_lineage_edges` | `triggering_edge_id` pochodzi WYŁĄCZNIE z org-scoped odczytu edges wewnątrz `propagateStalenessInTransaction()` (nigdy nie jest przyjmowany bezpośrednio od wywołującego) | **Nie wycieka** — źródło id jest już org-zweryfikowane przed użyciem. P3, kosmetyczne. |
| `finance_post_investment_reviews` | single, BRAK złożonego FK na `initiative_id`→`initiatives` ani `baseline_model_id`→`financial_models` | TAK — dziecko `initiatives`/`financial_models` | `baseline_model_id` JEST zweryfikowany org-scoped (`resolveApprovedBaselineLine`), ale **`initiative_id` NIE JEST zweryfikowany przed INSERT-em** wiersza `in_progress`. Zbadałem `computeAndFinalizeReview()`: `actualIds` są odczytywane `WHERE ... organization_id=? AND initiative_id=?` z `roi_realized_values`, więc w normalnym użyciu org A nie MA własnych `actualIds` powiązanych z `initiative_id` org B → ścieżka kończy się `ActualNotFoundError`, review oznaczony `failed`. **Nie znalazłem sposobu na realny odczyt/zapis danych B przez ten wektor** — ale wiersz `finance_post_investment_reviews` z `organization_id=A, initiative_id=B` fizycznie POWSTAJE (status `in_progress`→`failed`), co jest integralnościowym zanieczyszczeniem, nie leakiem. **P2/P3, EVIDENCE_MISSING na realny exploit, ale strukturalna luka realna.** |

**Wniosek §3:** żadna z sześciu tabel wskazanych w briefie (`finance_artifacts`, `finance_candidate_handoffs`, `finance_legal_holds`, `finance_post_investment_reviews`, `finance_retention_policies`, `finance_comment_assignments`, `finance_lineage_freshness_events`) nie ma **żywego, potwierdzonego** wektora cross-tenant READ/WRITE dzisiaj. `finance_comment_assignments` i `finance_post_investment_reviews` mają **strukturalną tę samą klasę luki** (child bez złożonego FK) co W9-C-4/C-7 zamykało — obecnie chronioną WYŁĄCZNIE w warstwie serwisu, bez FK backstopu — warte osobnego, mniejszego ticketu (P2), nie blokera FC-01.

---

## 4. NOWE ustalenia (nie były w zakresie oryginalnej naprawy)

### NEW-1 (P1, integracyjna regresja, NIE defekt tenant-izolacji) — `coldReopen.pg.test.ts` czerwony na HEAD

Zgłoszone też przez orkiestratora w trakcie mojej pracy — potwierdzam niezależnie i rozszerzam.

**Fakt:** na `cecc7975c1` (mój HEAD), `server/src/services/finance/canonical/__tests__/coldReopen.pg.test.ts` jest CZERWONY:
```
SensitivityGridAccessError: writeSensitivityGrid: method undefined not found for organization org-w10-coldreopen-...
```

**Przyczyna:** commit `2e2274f52f` (W9-C-3) zmienił `findOrCreateMethod()` z gołego `MethodRow` na unię `{ok:true,method}|{ok:false,code}`. `coldReopen.pg.test.ts` (commit `5f09b0f690`, gałąź inna niż `p0tenant` — **nie istniała na `4edfa9239a`**, potwierdzone `git show 4edfa9239a:...coldReopen... `→ brak pliku) dalej robi `const dcfMethod = await valuationComputeService.findOrCreateMethod(...); ...dcfMethod.id` — `.id` na obiekcie `{ok,method}` daje `undefined`, wpycha `methodId: undefined` do `writeSensitivityGrid`, który TERAZ (poprawnie, zgodnie z W9-C-4) odrzuca `undefined` jako "nie znaleziono metody".

**Systematyczne sprawdzenie pozostałych 5 napraw pod tym kątem** (na żądanie orkiestratora) — grep całego `server/src` + `tests/` za KAŻDĄ zmienioną funkcją:

| Funkcja | Zmiana kontraktu | Inni wywołujący poza `p0tenant`/`canonical/__tests__`? | Złamani? |
| --- | --- | --- | --- |
| `computeJobService.getJob/cancelJob/failJob` | sygnatura (dodany wymagany `organizationId`) | `AsyncJobService.getJob/cancelJob` (osobny, niepowiązany system w `server/src/ai/`) — **inna funkcja, inna nazwa modułu, false positive** | NIE |
| `baselineComputeService.loadContext` | kształt zwrotu BEZ zmian (już był `{ok,...}` z `NO_BASELINE_MODEL_ROW` przed naprawą) | `predictionComputeService.ts:308` (już poprawnie `if(!loaded.ok)`) | NIE |
| `predictionPreflightService.runPreflight` | kształt zwrotu BEZ zmian | `coldReopen.pg.test.ts:654` woła bez destrukturyzacji `.id` | NIE |
| `valuationComputeService.findOrCreateMethod` | **kształt zwrotu ZMIENIONY** (`MethodRow`→union) | `coldReopen.pg.test.ts:718` (`.id` na unii = `undefined`, **ZŁAMANE**); dodatkowo `docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts:1014,1039` (skrypt demo, POZA testami — też `.id` na unii, złamany przy ręcznym uruchomieniu, nie wpływa na CI) | **TAK — 1 plik testowy + 1 skrypt demo** |
| `kpiComputeService.computeAnalysisKpis` | kształt zwrotu BEZ zmian (już był `{ok,...}`, tylko JEDNA gałąź throw→return) | `coldReopen.pg.test.ts:477` już poprawnie `if(!kpis.ok) throw` | NIE |

**Jedyna złamana zmiana kontraktu to `findOrCreateMethod`.** Punkt odniesienia dla `src/services/finance/canonical` na moim HEAD: **30 zielonych / 1 czerwony plik, 417 passed + 4 skipped (421 total)** — po odjęciu tego jednego integracyjnego pliku (nie istniał na branchy autora, więc jego „416/416" nie było nigdy nieprawdziwe DLA JEGO drzewa) odpowiada dokładnie deklarowanemu 30/416.

**Dlaczego `tsc -p server` tego nie złapał, mimo że to dokładnie klasa błędu, którą TypeScript wykrywa (`.id` nie istnieje na typie unii bez zawężenia):** `server/tsconfig.json` wyklucza `**/*.test.ts` z projektu. `vitest` transpiluje przez `esbuild`, które usuwa typy bez ich sprawdzania. Rezultat: **żadna zmiana sygnatury/kształtu zwrotu publicznej funkcji serwisu w tym repo nie ma DZIŚ żadnej automatycznej ochrony typów po stronie plików testowych** — jedyna siatka bezpieczeństwa to faktyczne URUCHOMIENIE testu na żywej bazie, i to tylko jeśli ten konkretny plik jest w zasięgu danego uruchomienia. To jest ustalenie **niezależne od tej konkretnej naprawy** i ogólniejsze — rekomendacja: rozważyć osobny `tsconfig.test.json` bez wykluczenia `**/*.test.ts`, uruchamiany w CI jako osobny, tani krok (`tsc --noEmit`), żeby złapać dokładnie tę klasę regresji PRZED integracją, nie po.

**Ocena wyboru projektowego (na żądanie orkiestratora):** zmiana `findOrCreateMethod` z throw na discriminated-union return jest STYLISTYCZNIE spójna z siostrzanymi funkcjami tego samego pliku (`loadContext`/`runPreflight`/`computeAnalysisKpis` już zwracały `{ok,...}`), ale w PRAKTYCE droższa niż alternatywa: gdyby autor poszedł śladem `writeSensitivityGrid` (ten sam commit-pakiet, jeden commit wcześniej) i rzucił **typowany błąd** (`BusinessVersionAccessError extends Error`) zamiast zmieniać kształt zwrotu sukcesu, ścieżka sukcesu (`.id` na gołym `MethodRow`) zostałaby BEZ ZMIAN dla każdego istniejącego wywołującego — `coldReopen.pg.test.ts` i `goldco_full_dag.ts` NIGDY by się nie złamały, bo obie legalnie trafiają wyłącznie w ścieżkę sukcesu (nie w cross-tenant odmowę). Refuzja graniczna tenanta jest wyjątkowym, rzadkim przypadkiem dla większości wywołujących (w przeciwieństwie do `loadContext`/`runPreflight`, gdzie "nie znaleziono" jest normalnym, oczekiwanym wynikiem w środku pipeline'u) — throw jest tu bardziej naturalnym, mniej inwazyjnym wyborem, i to WŁAŚNIE ten wzorzec autor sam zastosował w `writeSensitivityGrid` jeden commit wcześniej. **Wniosek: wybór unii był defensywny w duchu, ale niepotrzebnie kosztowny w praktyce — throw byłby bezpieczniejszy przy braku ochrony typów nad plikami testowymi w tym repo.** P2, jakość projektu, nie P0/P1 (bo zepsuł tylko test, głośno, nie produkcję po cichu).

### NEW-2 (P2, defense-in-depth gap, NIE aktualnie eksploatowalny) — `resolveSourceStatementPackVersion()` bez predykatu org

Opisane w §1 (W9-C-1). **Dwa miejsca, identyczny wzorzec:**
- `baselineComputeService.ts:145-153`
- `kpiComputeService.ts:419-427`

Obie funkcje robią `SELECT source_version_id FROM finance_lineage_edges WHERE edge_type=? AND target_version_id=?` **bez `organization_id`**, jako pierwszy odczyt w `loadContext()`/`computeAnalysisKpis()`, PRZED sprawdzeniem org na kolejnym kroku. Mój prob potwierdził empirycznie:
```
[PASS] NEW FINDING: resolveSourceStatementPackVersion-shaped query (no org predicate)
       resolves Y's source_version_id from X's context :: {"source_version_id":"...Y's real id..."}
```
**Konsekwencja DZIŚ:** żadna — wynik jest odrzucany, zanim wróci do wywołującego (kolejny krok, org-scoped, refuduje pierwszy). Nie jest to żywy leak. **Ale unieważnia dosłowne zdanie w komentarzu naprawy** ("refuses HERE, at the first row fetched (finance_baseline_models)") — to NIE jest pierwszy odczyt. Kruche na przyszłość: jeden refaktor (np. dodanie loggera z `sourceVersionId` do diagnostyki, albo zmiana kolejności checków) zamieniłby to w żywy leak identyfikatora cross-tenant. **Rekomendacja: dodać `AND organization_id = ?` do obu tych zapytań przy najbliższej okazji — tania, jednoliniowa poprawka, nie blokuje FC-01.**

### NEW-3 (P1, cross-tenant MUTATION, integralność/dostępność — NIE konfidencjonalność) — `computeJobService.claim()` w rzeczywistym wzorcu wywołania

**To jest odkrycie z klauzuli wyjątku brief'u** ("jeśli znajdziesz kolejny czynny wyciek międzytenantowy z mutacją, opisz go szczegółowo").

Autor pozostawił `claim()` celowo bez zmian, cytując ADR B04 ("`claim()` jest międzyorganizacyjny z założenia — pula workerów bierze po `job_type`"). **Sprawdziłem ADR B04 i FAKTYCZNY wzorzec wywołania w kodzie:** ADR B04 §5.1 opisuje `claim()` jako prymityw dla GENUINE worker pool (`FOR UPDATE SKIP LOCKED`, wiele workerów pollujących niezależnie). **Ale taki worker pool NIE ISTNIEJE w tym kodzie** — potwierdzone własnym komentarzem `lineageFreshnessService.ts:46-48`: *"NOTHING in this codebase runs a worker loop that claims and executes jobs — `claim()` has no production caller [w sensie genuine workera]"* oraz przez sam oryginalny raport W9 (§3.1: *"Nie istnieje żaden proces, który podejmuje zadanie, którego sam nie zakolejkował"*).

Zamiast tego **wszystkie 4 produkcyjne wywołania `claim()`** (`baselineComputeService.ts:420`, `valuationComputeService.ts:373`, `predictionComputeService.ts:262,452`, `kpiComputeService.ts:486`) są **self-claim, synchroniczne, w tej samej funkcji, która przed chwilą sama zrobiła `enqueue()`** — dokładnie ten wzorzec, który sam oryginalny W9 raport już opisał (EM-1/EM-5), ale WYŁĄCZNIE w kontekście "porzucone zadanie nigdy nie zostanie podjęte", NIE w kontekście cross-tenant.

**Mój prob wykazuje konkretną, empirycznie odtworzoną konsekwencję cross-tenant:**
```
Y enqueue job (starszy next_attempt_at) -> queued
X enqueue job (własny, nowszy next_attempt_at) -> queued
X's flow (jak każdy z 4 prawdziwych wywołujących) robi:
  claim({ jobTypes: [sharedType], limit: 1 })   <- BEZ organizationId, ANY org, oldest-first

[CLAIM-RACE] X enqueued job ...838cd (own), Y's older job is ...78e229. claim() returned ...78e229.
             claimedIsOwnJob=false claimedIsOtherOrgsJob=true
[CLAIM-RACE][FINDING] Y's job PHYSICALLY MUTATED by a claim() call triggered from X's request path:
  {"status":"running","lease_owner":"verify2-worker-...","attempt_count":1,"organization_id":"...Y..."}
```
**To NIE wymaga złośliwości ani exploita — to jest normalne, oczekiwane zachowanie pod zwykłym równoległym użyciem przez DWIE różne organizacje wywołujące ten sam typ compute joba w tym samym oknie czasowym** (np. dwóch klientów klika "Przelicz Baseline" prawie jednocześnie).

**Realne konsekwencje** (wyprowadzone z odczytu `completeJobSuccess()` — `WHERE id=? FOR UPDATE`, wymaga `status='running'`):
1. **X's WŁASNY job nigdy nie zostaje realnie "running" w bazie** (bo `claim()` zabrał starszy wiersz Y, nie własny X). X i tak liczy lokalnie (bo kod ma fallback `runningJob = job`), ale gdy na końcu wywoła `completeJobSuccess({jobId: X.job.id,...})`, zapytanie `WHERE id=? ... status='running'` **nie znajdzie** X's joba w stanie `running` (bo nigdy nim nie był) → `{ok:false, code:'NOT_RUNNING'}`. **X's poprawnie policzony wynik może zostać po cichu odrzucony przy commicie** — zależnie od tego, jak każdy z 4 wywołujących serwisów obsługuje ten konkretny kod błędu (poza zakresem tego zadania — te 4 serwisy są WŁASNOŚCIĄ innych równoległych agentów per brief, nie badałem ich `completeJobSuccess`-handling szczegółowo).
2. **Y's job zostaje trwale skorumpowany**: oznaczony `running`, `attempt_count` podbity za "próbę", której NIKT faktycznie nie wykonuje (worker, który go "claimnął", jest zajęty liczeniem X's joba). Ponieważ **reaper wygasłych lease nie istnieje** (potwierdzone przez oryginalny raport W9, EM-1 — nie badałem ponownie, poza zakresem tego zadania), ten wiersz Y **zostaje w `running` na zawsze**, tak jak oryginalny raport już opisał dla scenariusza porzucenia — tylko że tu PRZYCZYNĄ porzucenia jest inna organizacja, nie awaria własnego workera.

**Klasyfikacja: P1** (nie P0 — nie ma tu odczytu/ujawnienia DANYCH cudzej organizacji, "tylko" korupcja stanu kolejki i możliwa cicha utrata WŁASNEGO wyniku firmy inicjującej). **Nie jest to regresja wprowadzona przez naprawę P0 pod odbiorem** — `claim()`'s SQL nie było i nie jest zmieniane przez żaden z 6 commitów; defekt istniał identycznie PRZED i PO tej naprawie. Decyzja "`claim()` celowo bez zmian" jest **poprawna w sensie wąskim** (zmiana SQL `claim()` na org-scoped złamałaby ADR B04's zamierzony model dla przyszłego worker poola), ale uzasadnienie w commit message ("jest międzyorganizacyjny z założenia") **nie odnosi się do tego, jak `claim()` jest FAKTYCZNIE wywoływany dzisiaj** — a to jest dokładnie ta różnica, którą mam sprawdzić. **Ta luka NIE jest w zakresie naprawy pod odbiorem** (autor jej nie dotykał, słusznie ograniczył zakres do 6 zdefiniowanych defektów), ale jest realna, empirycznie potwierdzona, i dotyczy plików (`computeJobService.ts`, 4 serwisy compute), które brief wprost mówi są własnością innych, równolegle pracujących agentów — **zgłaszam, nie naprawiam**, decyzję zostawiam orkiestratorowi zgodnie z instrukcją.

### Inne obserwacje (bez wpływu na werdykt)

- `server/src/services/finance/collaboration/__tests__/collaboration.pg.test.ts` jest RÓWNIEŻ czerwony na moim HEAD (`computePinning.enqueueComputeForCurrentRevision` — asercja `NO_CONTENT_HASH` timing), deterministycznie (potwierdzone uruchomieniem w izolacji). **Nie ma związku z granicą tenanta** — żaden z 6 commitów P0 nie dotyka `computePinning.ts`/`autosaveService.checkpointOperatio*`/`content_semantic_hash`. Prawdopodobnie inny artefakt fan-in z równoległego strumienia (`d01hash`/`tdverify`). Odnotowuję, nie badam głębiej — poza zakresem tego zadania.

---

## 5. Własne pomiary (mierzone samodzielnie, nie przepisane z raportu autora)

| Pomiar | Wynik |
| --- | --- |
| Migracje STRICT, świeża baza, `server/scripts/migrate.postgres.ts` (bez `--safe`) | **exit 0**, **633 migracje** (`SELECT count(*) FROM schema_migrations`) |
| Migracje STRICT, drugi przebieg (idempotencja) | **exit 0**, 0 nowo zastosowanych |
| `src/services/finance/canonical` (`--no-file-parallelism`) | **30 passed / 1 failed** plików (`coldReopen.pg.test.ts`, patrz NEW-1) — **417 passed, 4 skipped (421 total)** |
| `src/services/finance` (cały katalog) | **39 passed / 2 failed** plików (`coldReopen.pg.test.ts` + `collaboration.pg.test.ts`, patrz NEW-1 i „Inne obserwacje") — **684 passed, 1 failed, 4 skipped (689 total)** |
| `npx tsc -p server --noEmit` | **exit 0** (potwierdzone 2×; nie łapie `**/*.test.ts` — patrz NEW-1) |
| Bramka DB bez zmiennych | `tenantMatrix.pg.test.ts`: **1 skipped / 24 skipped**, nigdy `passed` |
| Mój własny prob (`w2_probe.ts`), 6 defektów + 1 nowe ustalenie | **21/22 asercji PASS**; jedyny "FAIL" to celowo odwrócona etykieta na potwierdzeniu NEW-3 (patrz kod probu) |
| Kontrola negatywna W9-C-5 | defekt odtworzony 1:1 na cofniętym pliku, naprawiony po przywróceniu |
| Kontrola negatywna W9-C-4, krok 1 (tylko serwis cofnięty) | rzuca surowy 23503, B's 25 komórek PRZETRWAŁY — **potwierdza obronę w głąb autora** |
| Kontrola negatywna W9-C-4, krok 2 (serwis + FK cofnięte) | defekt oryginalny odtworzony 1:1 (25/25 komórek B fizycznie należą do A) |

**Rozbieżność z raportem autora (wyjaśniona, nie defekt):** autor podał 30/416 dla `canonical` i 684/684 dla `finance` — na SWOIM izolowanym drzewie (`codex/finance-v3-p0tenant`, `4edfa9239a`) te liczby są prawdziwe (potwierdzone: `coldReopen.pg.test.ts` **nie istniał** na tym SHA). Na MOIM drzewie (fan-in HEAD `cecc7975c1`, ten sam SHA co orkiestrator/finalny target odbioru) doszły 2 pliki z innych strumieni, z których jeden (`coldReopen.pg.test.ts`) faktycznie koliduje z jedną ze zmian tej naprawy (patrz NEW-1). Po odjęciu tego jednego pliku integracyjnego liczby zgadzają się dokładnie.

---

## 6. Przegląd 8 odwróconych asercji — linia po linii

Zweryfikowałem `server/src/services/finance/canonical/__tests__/tenantMatrix.pg.test.ts` w całości (952 linie), nie tylko diff.

| # | Test | Twierdzi teraz (nie tylko "przestał twierdzić wyciek") | Niezależny odczyt fizyczny obecny? |
| --- | --- | --- | --- |
| 1 | `FIXED W9-C-1` (rodz. 2, L451) | `loaded.ok===false`, `code==='NO_BASELINE_MODEL_ROW'` | TAK — L477-482, `SELECT organization_id FROM finance_baseline_models` = B |
| 2 | `FIXED W9-C-2` (rodz. 5, L602) | `result.ok===false`, `code==='NO_SCENARIO_ROW'` | TAK — L622-627 (0 preflight_runs) + L630-635 (scenario nadal B) |
| 3 | `FIXED W9-C-3` (rodz. 6, L655) | `result.ok===false`, `code==='BUSINESS_VERSION_NOT_FOUND'` | TAK — L675-683, dokładnie 1 metoda, wciąż `B.methodId`, `organization_id=B` |
| 4 | `FIXED W9-C-4` (rodz. 6, L686) | `.rejects.toThrow(/method .* not found for organization/i)` | TAK — L740-763, `GROUP BY organization_id` = wyłącznie B, 25/25, TE SAME `id` co przed próbą (porównanie `Set`) |
| 5 | `FIXED W9-C-5 getJob` (rodz. 8, L869) | `getJob(A,B.jobId)===null`; sanity `getJob(B,B.jobId)!==null` | Pośrednio (sanity-read to fizyczny odczyt via własną org) |
| 6 | `FIXED W9-C-5 cancelJob` (rodz. 8, L885) | `cancelJob(A,B.jobId,...)===null` | TAK — L899-907, `status='queued'`, `cancel_reason=null` |
| 7 | `STRUCTURAL W9-C-7 FIXED` (rodz. 6, L766) | pinowana lista = dokładnie `['finance_valuation_cases']` | Zapytanie DO `pg_constraint`/`information_schema` SAMO W SOBIE jest fizycznym odczytem schematu — **odtworzyłem to zapytanie niezależnie w §3, wynik zgodny** |
| 8 | `FIXED W9-C-6` (rodz. 3, L515) | `result.ok===false`, `code==='BUSINESS_VERSION_NOT_FOUND'` (P2) | TAK — L533-539, `finance_analysis_kpi_values` dla B nadal = `B.marker` |

**Wniosek §6: wszystkie 8 asercji stwierdzają POZYTYWNIE, że granica JEST egzekwowana (typowany kod + w 6/8 przypadków dodatkowy niezależny odczyt fizyczny), nie tylko że "przestały wykazywać wyciek".** Żadna nie została osłabiona do samego `expect(...).not.toThrow()` bez treści. Nagłówek pliku (L27-33) poprawnie opisuje inwersję. Sam odtworzyłem punkty 1-4 i 6-8 własnym, niezależnym probem (§1, §3) z identycznym wynikiem.

---

## 7. Weryfikacja `claim()` i decyzji ADR B04

Odpowiedź na pytanie z brief'u: **czy pozostawienie `claim()` bez zmian jest poprawną decyzją?**

**Częściowo tak, częściowo nie — i to jest ważne rozróżnienie:**
- **TAK** w sensie: zmiana SQL `claim()` na `AND organization_id = ?` byłaby SPRZECZNA z ADR B04 §5.1 (worker pool ma świadomie brać zadania międzyorganizacyjnie po `job_type`, bo to JEDEN worker pool obsługujący WSZYSTKICH tenantów) — więc autor NIE POPEŁNIŁ błędu nie dotykając tej funkcji, i cytowanie ADR B04 jest trafne.
- **NIE** w sensie: uzasadnienie w commit message ("jest międzyorganizacyjny z założenia") milczy o tym, że **ten "worker pool" fizycznie nie istnieje** — wszystkie 4 produkcyjne wywołania to self-claim w request-scoped funkcjach compute, nie niezależny proces. To NIE jest defekt WPROWADZONY przez tę naprawę (istniał identycznie przed i po), i słusznie POZA zakresem 6 zdefiniowanych defektów tej naprawy — ale ocena "czy to poprawna decyzja" wymaga stwierdzenia: **decyzja o niezmienianiu SQL jest poprawna; MILCZENIE o realnej cross-tenant konsekwencji tego wzorca wywołania (NEW-3, §4) nie jest.** Zalecam, żeby FC-01 (lub osobna bramka wydajności/kolejki, FC-11) odnotowała NEW-3 jako świadomy, nie ukryty dług.

---

## 8. Werdykt końcowy

### Per defekt
| Defekt | Werdykt |
| --- | --- |
| W9-C-5 (P0) | **POTWIERDZONE** — naprawione, kontrola negatywna zgodna |
| W9-C-4 (P0) | **POTWIERDZONE** — naprawione (dwuwarstwowo), kontrola negatywna zgodna, „obrona w głąb" potwierdzona |
| W9-C-7 (strukturalne) | **POTWIERDZONE** — migracja addytywna, idempotentna, 6/7 tabel zamknięte, pominięcie `finance_valuation_cases` uzasadnione i zweryfikowane (0 callerów) |
| W9-C-1 (P1) | **POTWIERDZONE** na poziomie wyniku zwracanego wywołującemu; **NEW-2** (nieścisłość w uzasadnieniu "pierwszy odczyt") odnotowana, P2 |
| W9-C-2 (P1) | **POTWIERDZONE** bez zastrzeżeń |
| W9-C-3 (P1) | **POTWIERDZONE** na granicy tenanta; **spowodowało realną regresję** (NEW-1, `coldReopen.pg.test.ts`) poza zakresem widoczności autora |
| W9-C-6 (P2) | **POTWIERDZONE** bez zastrzeżeń |
| 8 odwróconych asercji | **POTWIERDZONE** — wszystkie stwierdzają egzekwowanie granicy, nie tylko brak wykazanego wycieku |

### Nowe ustalenia
- **NEW-1 (P1, integracyjne, NIE tenant-security)**: `coldReopen.pg.test.ts` czerwony na fan-in HEAD `cecc7975c1` — spowodowane zmianą kształtu zwrotu `findOrCreateMethod`, plik nie istniał na drzewie autora. Poza tym plikiem żaden inny wywołujący żadnej z 6 napraw nie jest złamany (sprawdzone systematycznie).
- **NEW-2 (P2, defense-in-depth, nie żywy leak)**: `resolveSourceStatementPackVersion()` w `baselineComputeService.ts` i `kpiComputeService.ts` czyta `finance_lineage_edges` bez predykatu org, PRZED właściwym sprawdzeniem granicy. Nie eksploatowalne dziś (wynik odrzucany przed powrotem do wywołującego), ale kruche.
- **NEW-3 (P1, cross-tenant MUTATION, integralność/dostępność, NIE poufność)**: `computeJobService.claim()`, wywoływany w rzeczywistym self-claim wzorcu przez wszystkie 4 serwisy compute, może (i w moim probie REALNIE) zaklaimować i zmutować (`status→running`, `attempt_count++`, `lease_owner` obcy) najstarszy KOLEJKUJĄCY się job INNEJ organizacji tego samego `job_type`, pod zwykłym równoległym użyciem — nie exploit, zwykłe użycie produktu przez dwóch klientów naraz. Może powodować cichą utratę WŁASNEGO wyniku obliczeniowego wywołującej organizacji (`completeJobSuccess` wymaga `status='running'`) oraz trwałe uwięzienie cudzego joba w stanie `running` (brak reapera). **Pre-existing, nie wprowadzone przez tę naprawę, poprawnie poza jej zadeklarowanym zakresem — ale realne i warte osobnego ticketu P1 w gestii właścicieli `computeJobService.ts`/serwisów compute.**
- **Tabele tej samej klasy strukturalnej bez FK backstopu, obecnie chronione tylko w warstwie serwisu**: `finance_comment_assignments`, `finance_post_investment_reviews` (częściowo — `initiative_id` niezweryfikowany). P2/P3, nie żywe leaki, warte mniejszego follow-upu.
- Test `collaboration.pg.test.ts` czerwony na HEAD z przyczyn niezwiązanych z tenant-izolacją (deterministyczne, nie flaky) — odnotowane, nie badane głębiej (poza zakresem).

### `EVIDENCE_MISSING` — wprost
- Nie zbadałem, jak KAŻDY z 4 serwisów compute obsługuje `{ok:false, code:'NOT_RUNNING'}` z `completeJobSuccess()` w kontekście NEW-3 (czy cichy zanik wyniku faktycznie następuje, czy jest gdzieś złapany i zretry'owany) — te pliki są własnością innych, równolegle pracujących agentów per brief, celowo nie wchodziłem głębiej.
- Nie zbadałem `finance_post_investment_reviews`/`initiative_id` pod kątem INNYCH tras wejścia niż `createPostInvestmentReview` (np. czy istnieje endpoint HTTP z innym kodem walidacji) — ograniczyłem się do jedynego pliku serwisowego.
- Nie zmierzyłem realnej regresji wydajności (plan wykonania SQL) dla dodanych predykatów/FK — `[W9-D MEASURED]` timingi z pełnego przebiegu `canonical` (widoczne w logu testów) nie odstają rażąco od typowych wartości dla tych operacji, ale nie mam punktu odniesienia SPRZED tej konkretnej naprawy do bezpośredniego porównania na tej samej bazie/danych. Brak dowodu na regresję, ale też brak formalnego pomiaru "przed/po" — traktuję jako niewykazaną, nie jako "brak problemu".

### Werdykt: **ACCEPT_WITH_BACKLOG**

Uzasadnienie: wszystkie 6 zadeklarowanych defektów (2×P0, 3×P1, 1×P2) są **POTWIERDZONE naprawione** przez mój całkowicie niezależny prob z niezależnym odczytem fizycznym, w tym kontrolę negatywną z realną reprodukcją oryginalnego wycieku dla obu P0. 8 odwróconych asercji poprawnie stwierdza egzekwowanie granicy. Migracja strukturalna jest addytywna, idempotentna, poprawnie uzasadnia jedyne pominięcie. Żadna z 6 tabel wskazanych w briefie jako "do sprawdzenia" nie ma dziś żywego wektora wycieku.

Nie jest to czyste `ACCEPT` z trzech powodów, żaden z nich nie unieważnia samej naprawy P0, ale wszystkie muszą trafić na backlog PRZED uznaniem FC-01 za w pełni zamknięte: (1) `coldReopen.pg.test.ts` jest DZIŚ czerwony na tym dokładnym SHA — to fakt o stanie drzewa, niezależnie od przyczyny; (2) `computeJobService.claim()` ma realny, empirycznie potwierdzony cross-tenant efekt uboczny pod zwykłym użyciem, dziś MILCZĄCO zaakceptowany przez odniesienie do ADR bez zbadania rzeczywistego wzorca wywołania; (3) dwie tabele (`finance_comment_assignments`, `finance_post_investment_reviews`) mają tę samą strukturalną lukę klasy W9-C-7, obecnie chronioną wyłącznie w kodzie aplikacji bez backstopu bazy.

### Rekomendacja dla bramki FC-01

**GO, z zastrzeżeniem.** Zmiana z `NO-GO` (W9) na `GO` (P0_TENANT_ISOLATION_FIX) jest **potwierdzona** dla wszystkich 6 zdefiniowanych defektów granicy tenanta — nie znalazłem ŻADNEGO sposobu na obejście którejkolwiek z 6 napraw, mimo dedykowanej próby dla każdej. Warunek dla PEŁNEGO zamknięcia (nie blokujący samego FC-01, ale wymagany przed uznaniem programu Finance v3 za gotowy do szerszej integracji): napraw `coldReopen.pg.test.ts` (jednoliniowa zmiana — rozpakować unię), otwórz osobny ticket P1 dla NEW-3 (`claim()` cross-tenant), P2 dla NEW-2 i dla brakującego FK-backstopu na 2 wskazanych tabelach.
