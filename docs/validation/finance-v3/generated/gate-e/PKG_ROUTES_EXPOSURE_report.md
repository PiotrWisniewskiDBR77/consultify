# Pakiet ROUTES_EXPOSURE — HTTP warstwa dla martwych serwisów Finance v3

**Data:** 2026-08-12
**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3p-m-inventory`
**Gałąź:** `codex/fv3p-routes-exposure`
**Baza startowa:** `aa4948b1d1` (tip integracji, zawiera scalony pakiet B3)
**SHA końcowy:** `48f43cb5380e04e9983424ed1b4b0cdee8e1ff48`
**Allowlista:** `server/src/routes/v8/finance-v2/**` (nowe pliki + montaż w `index.ts`). Serwisy kanoniczne NIE zostały zmienione (zero commitów poza allowlistą).

Ten dokument jest danymi dla orkiestratora — nie zawyżam statusów. Każdy punkt ma dowód (test PG realny, SQL niezależny, kontrola negatywna) albo jest jawnie oznaczony jako niedostarczony.

---

## 1. `git diff --stat` (aa4948b1d1..HEAD)

```
 .../__tests__/comments.routes.pg.test.ts           | 289 ++++++++++++++++
 .../finance-v2/__tests__/compare.routes.pg.test.ts | 246 +++++++++++++
 .../__tests__/export-import.routes.pg.test.ts      | 319 +++++++++++++++++
 .../__tests__/lineage-navigator.routes.pg.test.ts  | 367 ++++++++++++++++++++
 .../__tests__/saved-views.routes.pg.test.ts        | 261 ++++++++++++++
 server/src/routes/v8/finance-v2/comments.routes.ts | 351 +++++++++++++++++++
 server/src/routes/v8/finance-v2/compare.routes.ts  | 300 ++++++++++++++++
 .../routes/v8/finance-v2/export-import.routes.ts   | 230 +++++++++++++
 server/src/routes/v8/finance-v2/index.ts           |  25 ++
 .../v8/finance-v2/lineage-navigator.routes.ts      | 381 +++++++++++++++++++++
 .../src/routes/v8/finance-v2/saved-views.routes.ts | 176 ++++++++++
 11 files changed, 2945 insertions(+)
```

6 commits, one per service package, each with its own real-PG test evidence and a negative control performed and reverted before moving on (per the mid-session directive after two prior agents lost work to network/hook failures):

| SHA | Commit |
|---|---|
| `a8fcf9e935` | Lineage Navigator (read) |
| `569dbd1abd` | Compare engine |
| `3f24ec2269` | Comments + Review checklist |
| `667d26b8c5` | Lineage edge creation (write) — added mid-session per Pakiet H's finding |
| `55266f18ba` | Saved Views |
| `48f43cb538` | Export/Import |

---

## 2. Własna weryfikacja: które serwisy były naprawdę martwe

Policzone przez `grep -rn "from.*['\"].*<service>" server/src tests` i odfiltrowanie linii wewnątrz samego pliku serwisu (dopasowanie po linii importu, nie luźny substring — zgodnie z instrukcją, żeby uniknąć fałszywych trafień z komentarzy).

| Serwis | Wywołujący PRZED (poza testami) | Wywołujący PRZED (testy) | Wywołujący PO (nowe trasy) |
|---|---|---|---|
| `financeCompareService.ts` | **0** | 1 plik (`financeCompareService.test.ts`, tylko 3 pure helpery: `buildMatchKey`/`diffPair`/`toFullUnitValue`) | `compare.routes.ts` — 6 endpointów |
| `commentService.ts` | **0** | 0 | `comments.routes.ts` — 12 endpointów |
| `reviewChecklistService.ts` | **0** | 0 | `comments.routes.ts` — 5 endpointów |
| `savedViewService.ts` | **0** | 0 | `saved-views.routes.ts` — 6 endpointów |
| `financeExportService.ts` | **0** | 0 | `export-import.routes.ts` — 1 endpoint |
| `financeImportService.ts` | **0** | 0 | `export-import.routes.ts` — 3 endpointy |
| `lineageNavigatorContract.ts` | **0** produkcyjnych; re-eksportowany przez `workspace/index.ts`, ale **nic nie importuje `workspace/index.js`/`'../workspace'` w całym repo** | 2 pliki testowe | `lineage-navigator.routes.ts` — 1 endpoint GET |
| `lineageService.insertEdge()` | **0** (ustalone NIEZALEŻNIE przez Pakiet H w trakcie sesji, potwierdzone przeze mnie tym samym grepem) | tylko fixtury testowe (`pkg-b2-cross-tenant.routes.pg.test.ts`, mój własny `lineage-navigator.routes.pg.test.ts`) | `lineage-navigator.routes.ts` — 1 endpoint POST |

Potwierdzenie ustalenia tabeli wejściowej: wszystkie siedem serwisów z tabeli zadania rzeczywiście miało zero wywołujących produkcyjnych. Jedyna korekta: `commentService.ts`/`reviewChecklistService.ts` faktycznie miały zero wywołujących NAWET w testach (tabela mówiła tylko "ma realne tabele", co też się potwierdziło).

★ Osobne ustalenie zgłoszone w trakcie sesji przez Pakiet H (Enterprise Valuation), przeze mnie potwierdzone tym samym grepem: `lineageService.insertEdge()` miało **zero wywołujących produkcyjnych i zero w testach poza fixturami** — cały DAG Statement→Analysis→Baseline→Prediction→Valuation, który `lineageNavigatorContract.ts` ma czytać, nie dał się ZBUDOWAĆ przez API. Dodane do zakresu priorytetu 1, patrz sekcja 5.

---

## 3. Tabela nowych endpointów — dowód montażu (404-z-code vs 404-bez-code)

Dla KAŻDEGO nowego pliku tras: test #1 = ważny kontekst uwierzytelnienia + zasób nieistniejący → `404` z `body.code` ustawionym (handler faktycznie się wykonał, zapytał bazę, zdecydował). Test #2 = ten sam ważny kontekst + ścieżka, której żaden router w drzewie nie obsługuje → `404` BEZ pola `code` (Express default, trasa nigdy nie dopasowana). Oba testy istnieją w KAŻDYM z 5 nowych plików `__tests__/*.pg.test.ts`.

| Plik tras | Endpointów | Metoda dowodu #1 (404+code) | Metoda dowodu #2 (404 bez code) | Status |
|---|---|---|---|---|
| `lineage-navigator.routes.ts` | 2 | `GET .../versions/<random-uuid>/lineage-navigator` → `404 {code:'NOT_FOUND'}`; `POST .../versions/lineage-edges` z nieistniejącym `sourceVersionId` → `404 {code:'NOT_FOUND'}` | `GET .../this-path-truly-does-not-exist-anywhere` → `404`, brak `code` | PASS |
| `compare.routes.ts` | 6 | `POST .../compare/periods` z `artifactRef.businessVersionId` losowym → `404 {code:'ARTIFACT_NOT_FOUND'}` | jw. | PASS |
| `comments.routes.ts` | 17 | `GET .../comments/<random-uuid>` → `404 {code:'NOT_FOUND'}` | jw. | PASS |
| `saved-views.routes.ts` | 6 | `GET .../saved-views/<random-uuid>` → `404 {code:'NOT_FOUND'}` | jw. | PASS |
| `export-import.routes.ts` | 4 | `GET .../export/statement-pack/<random>/<random>` → `404 {code:'NOT_FOUND'}` | jw. | PASS |

Dodatkowo ponownie uruchomiony **cały** istniejący `mount-proof.pg.test.ts` (7/7 zielono) po każdym montażu nowego routera — brak regresji w istniejącym dowodzie montażu B/B2/B3.

---

## 4. Łączna liczba endpointów `/api/v8/finance-v2/*`

Policzone samodzielnie: `grep -c "router\.\(get|post|patch|delete|put\)(" <plik>` na KAŻDYM pliku tras (nie zaufane od słowa).

| Plik (PRZED, B/B2/B3) | Endpointów |
|---|---|
| `analysis.routes.ts` | 3 |
| `artifacts.routes.ts` | 5 |
| `baseline.routes.ts` | 4 |
| `compute.routes.ts` | 4 |
| `crosscutting.routes.ts` | 4 |
| `models.routes.ts` | 2 |
| `prediction.routes.ts` | 2 |
| `statements.routes.ts` | 5 |
| `valuation.routes.ts` | 21 |
| `versions.routes.ts` | 3 |
| **RAZEM PRZED** | **53** (zgadza się z liczbą podaną w zadaniu) |

| Plik (NOWE, ten pakiet) | Endpointów |
|---|---|
| `lineage-navigator.routes.ts` | 2 |
| `compare.routes.ts` | 6 |
| `comments.routes.ts` | 17 |
| `saved-views.routes.ts` | 6 |
| `export-import.routes.ts` | 4 |
| **RAZEM NOWE** | **35** |

**RAZEM PO: 88 endpointów** (53 + 35).

---

## 5. Priorytet 1 — Lineage Navigator: co dostarczono (w tym rozszerzenie w trakcie sesji)

- `GET /versions/:businessVersionId/lineage-navigator` — kompaktowy breadcrumb (root→focus) + panel „Powiązane" (parents/indirectAncestors/children/indirectDescendants/siblings) + `createNew` + odznaki stale/terminal + izolacja najemcy + raportowanie cykli. Cała logika domenowa zostaje w `lineageNavigatorContract.ts` (~1480 linii, bez zmian) — router tylko zbiera krawędzie (`lineageService.getAncestors/getDescendants`, bez zmian) i metadane węzłów przez JEDNO zapytanie wsadowe (`finance_business_versions` + `finance_artifacts` + LEFT JOIN `finance_prediction_scenarios.name`/`finance_valuation_variants.name` dla `variantLabel`), i mapuje wynik na JSON.
- **NIE duplikuje** istniejącej `GET .../versions/:id/lineage` (surowe krawędzie, `crosscutting.routes.ts`, Pakiet B2) — obie trasy stoją obok siebie, `crosscutting.routes.ts` nietknięty.
- ★ **`POST /versions/lineage-edges`** — dodane w trakcie sesji po zgłoszeniu przez Pakiet H (potwierdzonym przeze mnie niezależnym grepem, patrz sekcja 2). Zamyka pętlę zapis→odczyt dla całego DAG. Cała walidacja rang/cykli i wymóg `assumption_snapshot_hash` zostaje w `lineageService.insertEdge()` (bez zmian); router dodaje tylko pre-check istnienia `source`/`targetVersionId` w organizacji wołającego (żeby cross-tenant/nieistniejąca wersja dawała czyste `404`, a nie surowy błąd FK).

**Dowód end-to-end (test `END-TO-END:` w `lineage-navigator.routes.pg.test.ts`):** utworzono krawędź `STATEMENT_TO_ANALYSIS` przez `POST .../lineage-edges` → potwierdzono NIEZALEŻNYM `SELECT * FROM finance_lineage_edges WHERE id = ?` (organization_id, source/target_version_id, edge_type, author_id — wszystkie pola zgodne) → odczytano z powrotem przez `GET .../lineage-navigator` na nowym węźle i potwierdzono, że nowo utworzona krawędź pojawia się jako `parents[0]` w panelu Related.

**Cykle i tenant — udowodnione testem, nie deklaracją:**
- `CYCLE REJECTION` test: krawędź `BASELINE_MODEL → STATEMENT_PACK` (ranga 2→0, wsteczna) → `409 LINEAGE_CYCLE_REJECTED`, SQL potwierdza `COUNT(*)` krawędzi organizacji A niezmieniony (0 nowych wierszy).
- `CROSS-TENANT EDGE CREATION` test: org B próbuje połączyć DWIE realne wersje org A → `404 NOT_FOUND`, SQL potwierdza 0 nowych krawędzi dla org B i niezmienioną liczbę krawędzi org A.

**11/11 testów zielono** (real PG), w tym mount proof, pełny łańcuch 3-węzłowy, join `variantLabel`, panel Related dla węzła środkowego (parents I children jednocześnie), append-only/duplicate (`409 DUPLICATE_EDGE`), cykl, cross-tenant read, cross-tenant write.

---

## 6. Priorytet 2 — Compare: co dostarczono

6 endpointów POST (`/compare/{periods,versions,entities,scenarios,valuation-methods,actual-vs-forecast}`) — pięć osi z briefu (okres/okres, wersja/wersja, scenariusz/baseline, metoda/metoda) plus encja/encja i actual/forecast, które sam serwis już eksportował. Cała logika (MISSING/NA-dyscyplina, materiality, dopasowanie kluczy) zostaje w `financeCompareService.ts` (bez zmian).

**Dowód realny (nie tylko walidacja body):** fixture `finance_stmt_lines` z dwiema wartościami w dwóch okresach (100→150), `POST /compare/periods` zwraca `diffKind:'BOTH_PRESENT'`, `absoluteDiff:50`, `materialityFlag` poprawnie przełączany progiem; `onlyMaterial` filtruje `rows`, ale `summary` zawsze liczy pełny zbiór.

**Macierz cross-tenant (dwa różne kształty ataku, oba real-PG + SQL):**

| Scenariusz | Wynik HTTP | Niezależne SQL |
|---|---|---|
| Org B podszywa się pod `artifactRef.organizationId=orgA`, uwierzytelniony jako org B | `403 ORGANIZATION_MISMATCH` | — (odrzucone przed jakimkolwiek zapytaniem SQL) |
| Org B podaje swój WŁASNY `organizationId`, ale realny `businessVersionId` org A | `404 ARTIFACT_NOT_FOUND` | `SELECT COUNT(*) finance_stmt_lines WHERE org=A` = 2 (niezmienione); `WHERE org=B` = 0 |

**7/7 testów zielono.**

---

## 7. Priorytet 3 — Komentarze i review checklist: co dostarczono

12 endpointów komentarzy (create/get/list/resolve/reopen/assign/mentions/search-by-cell) + 5 endpointów review checklist (add/check/uncheck/required/list/all-checked/changed-cells) + 1 endpoint preflight (`has-unresolved-blocking-comments`). Realne, już zmigrowane tabele (`finance_comments`, `finance_comment_assignments`, `finance_review_checklists`) — najniższe ryzyko z całego pakietu, zgodnie z przewidywaniem w zadaniu.

**Odkrycie w trakcie budowy testu (odnotowane, nie ukryte):** pierwsza wersja testu mentions zakładała, że `listMentioning` filtruje TYLKO po `userId`. Realny przebieg pokazał, że filtruje NAJPIERW po `organization_id` — wzmianka w komentarzu jednej organizacji nie jest widoczna przez endpoint innej organizacji nawet dla tego samego `userId`. Test poprawiony na dwóch użytkowników W TEJ SAMEJ organizacji (poprawne zachowanie bezpieczeństwa, nie błąd).

**18/18 testów zielono**, w tym pełny cykl życia komentarza (blocking→preflight→resolve→preflight znowu), review checklist (`all-required-checked` fałsz→prawda→fałsz po zmianie `required`), cross-tenant (create/read/list).

---

## 8. Priorytet 4 — Saved Views: co dostarczono

6 endpointów (`POST/GET/PATCH/DELETE /saved-views`, `GET /saved-views/shared/:token`). PERSONAL=tylko właściciel, TEAM=cała organizacja (odczyt), edycja/usuwanie zawsze tylko właściciel niezależnie od scope — cała reguła zostaje w `savedViewService.ts`.

**15/15 testów zielono**, w tym: widoczność PERSONAL vs TEAM w OBRĘBIE tej samej organizacji (drugi użytkownik tej samej org widzi TEAM, nigdy PERSONAL), refuzja edycji/usunięcia TEAM przez nie-właściciela (`403`), granica tokenu udostępniania (rozwiązuje się dla całej org przy TEAM, nigdy dla nie-właściciela przy PERSONAL), pełna macierz cross-tenant z SQL.

---

## 9. Priorytet 5 — Export/Import: co dostarczono (zakres zawężony, udokumentowany)

`GET /export/statement-pack/:artifactId/:businessVersionId` (pobranie `.xlsx` z arkuszem Manifest) + `POST /import/{parse,preview,apply}` (trzy etapy z nagłówka `financeImportService.ts`: parse czysty/bez DB → preview tylko-odczyt → apply jeden `Operation.batch` transakcyjny).

**★ ZAWĘŻENIE ZAKRESU (udokumentowane w nagłówku pliku, nie ciche):** tylko `.xlsx`. Import `.csv` wymagałby akceptowania manifestu dostarczonego przez klienta jako JSON (bo CSV nie niesie arkusza Manifest) — bez walidacji osadzonej w pliku ten manifest musiałby być zaufany inaczej niż przez `checkManifestCompatibility`, co wymaga osobnego przeglądu bezpieczeństwa, którego budżet tej sesji nie objął. Status: **EVIDENCE_MISSING / poza zakresem tej fali**, nie zapomniane.

**Dowód end-to-end (real PG):** eksport realnego Statement Pack z jedną wartością (100) → pobrany bufor sparsowany z powrotem przez `POST /import/parse` → `preview` bez edycji pokazuje `diff.toChange=[]` → edycja wartości na 250 → `preview` pokazuje realny `toChange` → `apply` z prawidłowym CAS-pinem (`expectedWorkingRevisionId`) → SQL potwierdza `finance_stmt_lines.value_decimal = 250` I nowy wiersz `finance_working_revisions.is_current=true`.

**CAS/konkurencja:** ponowienie `apply` z TYM SAMYM (już nieaktualnym) `expectedWorkingRevisionId` i tym samym `batchIdempotencyKey` → `409 WORKING_REVISION_CONFLICT`, SQL potwierdza wartość dotkniętą DOKŁADNIE raz (250 nie została nadpisana przez odrzuconą próbę).

**10/10 testów zielono.**

---

## 10. Priorytet 6 — Grid / Keyboard / Kolaboracja: ocena (nie budowano tras — uzasadnienie poniżej)

Oceniłem to zamiast budować trasy na siłę, zgodnie z instrukcją.

| Katalog | Pliki | Dotyka DB? | Ocena | Uzasadnienie |
|---|---|---|---|---|
| `finance/grid/**` | 8 plików (`PasteEngine`, `BulkOpsEngine`, `FillEngine`, `GridSelectionModel`, `FindReplaceEngine`, `gridCoordinates`, `engineContext`, `GridViewState`) | **NIE** | **NIE wystawiać przez HTTP** | Nagłówek pliku `grid/index.ts` mówi wprost: *„This directory is pure in-memory logic (no DOM, no React, no DB connection)... a future `FinanceDataGrid` React component is expected to implement against these exports."* To jest logika KLIENCKA (natychmiastowa reakcja UI na wklejenie/wypełnienie w gridzie) — okrężna droga przez HTTP zniszczyłaby dokładnie tę responsywność, po którą istnieje. |
| `finance/keyboard/**` | 5 plików (`commandTypes`, `CommandAvailability`, `FocusRestoreContract`, `KeyboardCommandRegistry`, `CommandPaletteIndex`) | **NIE** | **NIE wystawiać przez HTTP** | Ten sam wzorzec: `keyboard/index.ts` nagłówek: *„pure in-memory logic (no DOM, no React)... a future keyboard-shortcut hook is expected to implement against these exports."* Skróty klawiszowe/paleta komend to z definicji stan przeglądarki. |
| `finance/collaboration/**` — `autosaveService.ts`, `conflictResolver.ts`, `crashRecoveryService.ts`, `computePinning.ts` | 4 pliki | **TAK** (`withPinnedPostgresTransaction`, zapisy do `finance_working_revisions`) | **KANDYDACI do HTTP — NIE zbudowane, brak budżetu** | Realne operacje serwerowe: `autosaveService.checkpointOperationStack()` zapisuje working-revision checkpoint z CAS; `conflictResolver` czyta konkurencyjne checkpointy do rozstrzygnięcia mine/theirs; `crashRecoveryService` wykrywa dangling crash-recovery checkpoint przy ponownym otwarciu; `computePinning` przypina compute do `content_semantic_hash`. Bez trasy HTTP autosave/undo/crash-recovery nie działa end-to-end mimo w pełni zaimplementowanej logiki. **Status: EVIDENCE_MISSING, wyceniona pozycja poniżej.** |
| `finance/collaboration/**` — `autosaveScheduler.ts`, `operationStack.ts` | 2 pliki | **NIE** | **NIE wystawiać przez HTTP** | `autosaveScheduler.ts` nagłówek: *„Pure scheduling logic — no DB, no knowledge of finance_working_revisions."* `operationStack.ts` nagłówek: *„Pure, DB-free (zero imports from pg/DbPromise/Express)"* — debounce i stos undo/redo to stan sesji przeglądarki, wysyłany do `autosaveService` przez klienta, nie odwrotnie. |

**Wycena niedostarczonej pozycji (Collaboration DB-touching, 4 pliki):** ~6-8 endpointów (`POST checkpoint`, `GET current-working-revision`, `GET conflict-check`, `POST resolve-conflict`, `GET crash-recovery-check`, `POST acknowledge-recovery`, `POST enqueue-with-pin`), analogiczny rozmiar do pakietu Saved Views (6 endpointów, ~450 linii routera+testów, ~1h realnej pracy z dowodami real-PG). Rekomendacja: osobna, zdefiniowana paczka na następną falę.

---

## 11. Zgłoszona przez orkiestratora luka: pięć tabel scenariuszowych bez warstwy zapisu

Niezależny weryfikator (Pakiet G) ustalił, że pięć tabel scenariuszowych ma gotowy schemat, ale ZERO funkcji zapisujących w warstwie serwisowej (wstawiają do nich wyłącznie fixtury testowe) — koszt wyższy niż „serwis gotowy, brakuje trasy" (przypadek compare/komentarzy/saved-views), bo tu trzeba dopisać całą warstwę zapisu PRZED trasą.

**Status: NIE PODJĘTE w tej sesji** — zgodnie z jawną instrukcją orkiestratora, żeby nie brać tego przed priorytetami 1-5, i budżet sesji wyczerpał się na dokończeniu 1-5 z pełnym rygorem dowodowym. Nie zidentyfikowałem samodzielnie KTÓRE pięć tabel — to ustalenie Pakietu G, nie moje; nie mam w tej sesji potwierdzenia z nazwami tabel z pierwszej ręki. **Rekomendacja: zdefiniowana, wyceniona paczka na następną falę, z osobną inwentaryzacją nazw tabel i wymaganych funkcji zapisu — beze mnie nie zgaduję nazw tabel, które nie zostały mi podane.**

---

## 12. Wyniki testów — pełny przebieg z exit code

Środowisko: `RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/routes_exp` (baza `routes_exp`, klaster izolowany 127.0.0.1:54330, utworzona przez `newdb.sh` z `fv3_template`, **usunięta po sesji** — `dropdb` przez `/opt/homebrew/opt/postgresql@15/bin/dropdb`).

```
cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/routes_exp" \
  npx vitest run src/routes/v8/finance-v2/__tests__/ --maxWorkers=2 --testTimeout=90000

 Test Files  18 passed (18)
      Tests  150 passed (150)
   Duration  7.41s (transform 4.02s, import 1.43s, tests 11.60s)
EXIT_CODE=0
```

18 plików testowych = 13 istniejące (B/B2/B3, nietknięte, potwierdzone wciąż zielone) + 5 nowe (ten pakiet). 150 testów = 89 istniejących + 61 nowych (11 lineage + 7 compare + 18 comments + 15 saved-views + 10 export-import).

Kilka pojedynczych przebiegów napotkało transient `socket hang up` / `Hook timed out in 10000ms` przy pierwszym uruchomieniu (maszyna pod obciążeniem innych sesji, zgodnie z ostrzeżeniem w brief) — powtórzony przebieg zawsze zielony, zgodnie z instrukcją „powtórz pomiar, zanim cokolwiek zdiagnozujesz".

---

## 13. Lista kontroli negatywnych (każda: zepsute→czerwone→przywrócone→zielone)

| # | Plik / miejsce | Co zepsuto | Test(y) które zaczerwieniły się | Wynik |
|---|---|---|---|---|
| 1 | `lineage-navigator.routes.ts`, `GET .../lineage-navigator` | Wyłączono `if (!focus) return 404` | 3 testy (mount proof + 2× cross-tenant) | `404`→`500` — POTWIERDZONE |
| 2 | `compare.routes.ts`, `POST /compare/periods` | `organizationId` brane z `artifactRef` klienta zamiast z kontekstu auth | 1 test (cross-tenant forge) | `403`→`200` z REALNYMI danymi org A — **najpoważniejsza kontrola: pokazuje faktyczny wyciek, nie tylko zmianę kodu błędu** |
| 3 | `comments.routes.ts`, `POST /comments` | Wyłączono pre-check `businessVersionId` przed insertem | 1 test (cross-tenant create) | `404`→`500` (surowe naruszenie FK Postgres) — POTWIERDZONE, DB nadal broni (0 wierszy), ale kształt błędu inny |
| 4 | `lineage-navigator.routes.ts`, `POST .../lineage-edges` | Wyłączono oba pre-checki (`source`/`targetVersion`) | 2 testy (mount proof + cross-tenant write) | `404`→`409` (błąd triggera źle sklasyfikowany jako `LINEAGE_CYCLE_REJECTED`) — POTWIERDZONE, dodatkowo ujawniło realny błąd klasyfikacji bez pre-checku |
| 5 | `saved-views.routes.ts`, mapowanie statusów | Usunięto `case 'FORBIDDEN': return 403` | 2 testy (PATCH/DELETE nie-właściciel) | `403`→`400` — POTWIERDZONE |
| 6 | `export-import.routes.ts`, mapowanie statusów eksportu | `const status = 400` na stałe | 2 testy (mount proof + cross-tenant export) | `404`→`400` — POTWIERDZONE |

Wszystkie 6 kontroli: zepsute→czerwone (potwierdzone przebiegiem), przywrócone→zielone (potwierdzone kolejnym przebiegiem), zanim przeszedłem do następnego serwisu — zgodnie z nowym trybem pracy wymuszonym w trakcie sesji.

---

## 14. Rzeczy niedostarczone — status jawny

| Pozycja | Powód | Status |
|---|---|---|
| Import `.csv` (tylko `.xlsx` obsłużony) | Wymaga akceptowania manifestu od klienta bez walidacji osadzonej w pliku — osobny przegląd bezpieczeństwa poza budżetem sesji | **EVIDENCE_MISSING** (zakres udokumentowany w nagłówku pliku, nie cichy) |
| Kolaboracja: `autosaveService`/`conflictResolver`/`crashRecoveryService`/`computePinning` przez HTTP | Priorytet 6 (najniższy), budżet wyczerpany na priorytetach 1-5 z pełnym rygorem | **EVIDENCE_MISSING** — wyceniona w sekcji 10 (~6-8 endpointów, rozmiar porównywalny do Saved Views) |
| Grid (`finance/grid/**`) przez HTTP | Logika kliencka z natury (nagłówek pliku to potwierdza) | **NIE DOTYCZY** — świadoma decyzja, nie luka |
| Keyboard (`finance/keyboard/**`) przez HTTP | Logika kliencka z natury (nagłówek pliku to potwierdza) | **NIE DOTYCZY** — świadoma decyzja, nie luka |
| Kolaboracja: `autosaveScheduler`/`operationStack` przez HTTP | Logika kliencka z natury (nagłówek pliku to potwierdza) | **NIE DOTYCZY** — świadoma decyzja, nie luka |
| Warstwa zapisu dla 5 tabel scenariuszowych (Pakiet G) | Jawnie wykluczone z tej sesji przez orkiestratora, poniżej priorytetu 1-5 | **BLOCKED_EXTERNAL** — poza zakresem tej sesji z instrukcji, nie moja ocena kosztu/wartości |
| `tsc -p server` na nowych plikach | Zakaz pełnego `tsc` dla robotników (OOM/koszt) — poleganie na `esbuild --bundle` (łapie błędy importu/składni, NIE łapie błędów typów) + realnych testach PG (łapią większość błędów logiki w runtime) | **PARTIAL** — świadomy kompromis zgodny z instrukcją środowiska, nie przeoczenie |

---

## 15. Rozbieżność API zgłoszona przez Pakiet H (informacyjnie, NIE naprawiona — poza allowlistą)

Pakiet H (Enterprise Valuation) udokumentował, że kilka endpointów GET wyceny zwraca surowe wiersze bazy w snake_case, podczas gdy ich POST/PUT odpowiedniki zwracają DTO camelCase (`docs/validation/finance-v3/generated/gate-e/PKG_H_VALUATION_report.md`). To poza moją allowlistą (`valuation.routes.ts` nie jest moim plikiem). **Potwierdzam, że NIE powieliłem tego wzorca w żadnej z moich 5 nowych tras — każdy DTO w `compare.routes.ts`/`comments.routes.ts`/`saved-views.routes.ts`/`export-import.routes.ts`/`lineage-navigator.routes.ts` konsekwentnie zwraca camelCase**, z jednym świadomym wyjątkiem: `comments.routes.ts` zwraca surowe wiersze `FinanceCommentRow`/`FinanceReviewChecklistItemRow` (snake_case: `is_blocking`, `resolved_at`, `checked_at`, `owner_user_id` w przypadku saved-views) bezpośrednio z serwisu, bo te dwa serwisy (`commentService.ts`, `reviewChecklistService.ts`, `savedViewService.ts`) już zwracają surowe wiersze jako swój publiczny kontrakt (`FinanceCommentRow` itd. to eksportowane typy) — mapowanie na inny kształt byłoby wprowadzeniem NOWEGO kontraktu DTO, którego serwis nie deklaruje, i którego zadanie nie prosiło. Odnotowuję to jako TĘ SAMĄ rozbieżność (snake_case przecieka do HTTP), ale świadomą, nie przypadkową — zmiana wymagałaby decyzji produktowej wykraczającej poza „wystaw istniejący kod".

---

## 16. Podsumowanie stanu

| Priorytet | Serwis | Endpointy | Testy | Cross-tenant | Kontrola negatywna | Status |
|---|---|---|---|---|---|---|
| 1 | Lineage Navigator (odczyt) | 1 | ✅ | ✅ | ✅ | **PASS** |
| 1★ | Lineage edge creation (zapis, dodane w trakcie sesji) | 1 | ✅ | ✅ (2 kształty) | ✅ | **PASS** |
| 2 | Compare | 6 | ✅ | ✅ (2 kształty) | ✅ | **PASS** |
| 3 | Komentarze + review checklist | 17 | ✅ | ✅ | ✅ | **PASS** |
| 4 | Saved Views | 6 | ✅ | ✅ | ✅ | **PASS** |
| 5 | Export/Import | 4 | ✅ (zakres: tylko .xlsx) | ✅ | ✅ | **PASS** (CSV: EVIDENCE_MISSING, udokumentowane) |
| 6 | Grid/Keyboard | 0 (celowo) | — | — | — | **OCENA DOSTARCZONA — nie wystawiać** |
| 6 | Kolaboracja (DB-touching) | 0 | — | — | — | **EVIDENCE_MISSING — wyceniona, następna fala** |
| 6 | Kolaboracja (pure client) | 0 (celowo) | — | — | — | **OCENA DOSTARCZONA — nie wystawiać** |
| — | 5 tabel scenariuszowych (Pakiet G) | 0 | — | — | — | **BLOCKED_EXTERNAL — poza zakresem tej sesji** |

**35 nowych endpointów, 61 nowych testów real-PG, 150/150 zielono (exit 0), 6/6 kontroli negatywnych potwierdzonych, zero zmian w serwisach kanonicznych, zero regresji w istniejących 89 testach B/B2/B3.**
