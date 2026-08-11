# LEDGER_SNAPSHOT — parser rejestrow Case Workspace

> Wygenerowane automatycznie przez `scripts/case-workspace/ledger-report.mjs`.
> NIE edytowac recznie — kazdy przebieg nadpisuje ten plik od zera.
> Wygenerowano: 2026-08-11T06:35:54.016Z

## Jak uruchomic

```bash
node scripts/case-workspace/ledger-report.mjs
# zapis do innej sciezki:
node scripts/case-workspace/ledger-report.mjs --out /tmp/snapshot.md
# plus pelny JSON na stdout:
node scripts/case-workspace/ledger-report.mjs --json
```

Skrypt czyta WSZYSTKIE `docs/product/case-workspace/acceptance/*.csv`, rozwiazuje
lancuchy `supersedes_row_id` (append-only — stary wiersz zastapiony przez nowszy nie
jest liczony podwojnie) i liczy rozklad statusow po wierszach **efektywnych**.

## Zrodla (pliki wejsciowe)

| Plik | Wiersze (surowe) | Kolumna status | row_id/requirement_id | supersedes_row_id |
|---|---:|:---:|:---:|:---:|
| API_EVENT_SCHEMA_COVERAGE.csv | 62 | tak | row_id | tak |
| CARTESIAN_UX_COVERAGE.csv | 0 | tak | brak | brak |
| CODEBASE_CONVERGENCE_MAP.csv | 49 | BRAK | brak | brak |
| CUSTOMER_JOURNEY_LEDGER.csv | 37 | tak | row_id | tak |
| EPIC_DOD_COVERAGE.csv | 357 | tak | row_id | tak |
| FUNCTIONAL_REQUIREMENT_COVERAGE.csv | 901 | tak | row_id | tak |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | 82 | tak | row_id | tak |
| LEGACY_MIGRATION_PARITY.csv | 31 | tak | row_id | tak |
| RESPONSIVE_ACCESSIBILITY_LEDGER.csv | 32 | tak | row_id | tak |
| SECURITY_RESILIENCE_MATRIX.csv | 98 | tak | row_id | tak |
| TRACEABILITY_AUTH_ROUTES.csv | 177 | tak | requirement_id | brak |
| VISUAL_TRIADA_SPEC_A_LEDGER.csv | 235 | tak | row_id | tak |

## LACZNY rozklad statusow — WIERSZE EFEKTYWNE (po rozwiazaniu supersedes_row_id)

Suma wierszy surowych (wszystkie pliki, wliczajac te bez kolumny status): **2061**

Suma wierszy efektywnych (po deduplikacji lancuchow supersedes, tylko pliki z kolumna status): **1682**

NOT_IMPLEMENTED: **1273**, PARTIAL: **201**, IMPLEMENTED_AND_PROVEN: **187**, EVIDENCE_MISSING: **16**, OUT_OF_SCOPE_THIS_WAVE: **5**

**GAP != 0.** Statusy niedomkniete obecne w wierszach efektywnych: PARTIAL=201, EVIDENCE_MISSING=16, NOT_IMPLEMENTED=1273 (razem **1490** wierszy). Nie mozna deklarowac "zero GAP".

### (dla porownania) rozklad surowy — WSZYSTKIE wiersze, bez dedup supersedes

NOT_IMPLEMENTED: **1479**, PARTIAL: **259**, IMPLEMENTED_AND_PROVEN: **191**, BLOCKED_ON_UI: **44**, EVIDENCE_MISSING: **34**, OUT_OF_SCOPE_THIS_WAVE: **5**

## Deduplikacja semantyczna wymagan (grupy, nie wystapienia)

Metoda: dla kazdego pliku z kolumna `requirement_text`, wiersze EFEKTYWNE grupowane
cross-file po identycznym znormalizowanym tekscie (NFKD fold, lowercase, usunieta
interpunkcja, zwiniete biale znaki) — wylacznie dopasowanie DOKLADNE, ZERO dopasowania
parafraz (parafrazy to osobny, nie-mechaniczny problem — patrz `README.md` "near-duplicate
rows across clusters... have not been deduplicated yet"). `TRACEABILITY_AUTH_ROUTES.csv` nie
ma kolumny `requirement_text` (schemat route x authorization_predicate) — pozostaje poza tym
rozdzialem, na wlasnej osi (patrz jego wlasna sekcja per-plik ponizej).

Wiersze efektywne z niepustym `requirement_text` (pliki: 9 z 12): **1505**

Odrebne grupy semantyczne (exact-text) po dedup: **836**

- Grupy z 1 czlonkiem (juz unikalne): **283**
- Grupy z >=2 czlonkami: **553** (skolapsowanych wierszy: **1222**, srednio 2.2/grupe)
- Grupy, w ktorych KAZDY czlonek to nadal `NOT_IMPLEMENTED`: **597**
- Grupy MIESZANE (co najmniej 1 czlonek w lepszym stanie — PARTIAL/IMPLEMENTED_AND_PROVEN/PASS/OUT_OF_SCOPE_THIS_WAVE — a co najmniej 1 inna kopia utkniety w gorszym): **165**

Rozklad statusow **na poziomie grupy** (kazda grupa liczona RAZ, jej "najlepszym" statusem
sposrod czlonkow — ranga: IMPLEMENTED_AND_PROVEN/PASS > PARTIAL > OUT_OF_SCOPE_THIS_WAVE >
EVIDENCE_MISSING > BLOCKED* > NOT_IMPLEMENTED):

NOT_IMPLEMENTED: **597**, PARTIAL: **147**, IMPLEMENTED_AND_PROVEN: **71**, EVIDENCE_MISSING: **16**, OUT_OF_SCOPE_THIS_WAVE: **5**

**To NIE zastepuje ani nie zmniejsza licznika GAP z sekcji powyzej.** Zaden status w zadnym
pliku CSV nie zostal zmieniony przez ten skrypt — to jest DRUGA, jawnie oznaczona miara: ile
WYMAGAN (nie wystapien) istnieje, i jaki jest najlepszy dowod, jaki KTOKOLWIEK z duplikatow
tego wymagania dotychczas zebral. Grupy mieszane oznaczone powyzej sa realnym targetem higieny
rejestru (dwoch agentow ekstrahowalo to samo wymaganie do dwoch rejestrow, jeden zaktualizowal
swoja kopie dowodem, drugi nie) — nie sa rozwiazywane przez ten skrypt, tylko wskazywane.

### Przyklad grup mieszanych (pierwsze 15 z 165)

| Tekst wymagania (skrocony) | Czlonkowie (plik:id=status) |
|---|---|
| Execution layer owns: adapter dispatch, approval validation, result collection, partial failure hand… | API_EVENT_SCHEMA_COVERAGE.csv:AEV8-EXECLAYER-01=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:AEV8-EXECLAYER-01=NOT_IMPLEMENTED |
| Audit layer owns: status trail, actor trail, timestamps, affected artifact refs, final run summary (… | API_EVENT_SCHEMA_COVERAGE.csv:AEV8-AUDITLAYER-01=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:AEV8-AUDITLAYER-01=NOT_IMPLEMENTED |
| Execution Agent must distinguish between planning failure, validation failure, approval missing, ada… | API_EVENT_SCHEMA_COVERAGE.csv:AEV8-FAILURE-MODEL-01=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:AEV8-FAILURE-MODEL-01=NOT_IMPLEMENTED |
| Reusable runtime pattern from actionDecisionService + actionExecutionAdapter: snapshot before execut… | API_EVENT_SCHEMA_COVERAGE.csv:AEV8-ASIS-IDEMPOTENCY-01=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:AEV8-ASIS-IDEMPOTENCY-01=NOT_IMPLEMENTED |
| Platform must add explicit idempotency and replay-safe execution steps, plus checkpoint and resume p… | API_EVENT_SCHEMA_COVERAGE.csv:AEV8-BG-IDEMPOTENCY-01=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:AEV8-BG-IDEMPOTENCY-01=NOT_IMPLEMENTED |
| Users and operators must be able to distinguish queued, running, waiting, failed, cancelled and comp… | API_EVENT_SCHEMA_COVERAGE.csv:AEV8-BG-WAITSTATUS-01=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:AEV8-BG-WAITSTATUS-01=NOT_IMPLEMENTED |
| Cross-mode invariant: Approved human work is protected during retry and rerun. | API_EVENT_SCHEMA_COVERAGE.csv:CW-01-026-INV8=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-01-026-INV8=NOT_IMPLEMENTED |
| 'Running' is forbidden for a step that is actually waiting. The step card must identify who/what is … | API_EVENT_SCHEMA_COVERAGE.csv:CW-02-029=PARTIAL; CUSTOMER_JOURNEY_LEDGER.csv:CW-02-029=NOT_IMPLEMENTED; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-02-029=NOT_IMPLEMENTED |
| Durable command set: Case (CreateCase, ClarifyCaseGoal, ChangeCaseScope, AssignCaseOwner, RaiseGover… | API_EVENT_SCHEMA_COVERAGE.csv:CW-RT-043=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-RT-043=NOT_IMPLEMENTED |
| Case API: POST /api/cases; GET /api/cases/:caseId; PATCH /api/cases/:caseId; POST /api/cases/:caseId… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-023=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-023=NOT_IMPLEMENTED |
| Plan and graph API: POST /api/cases/:caseId/plans; GET/PATCH .../plans/:planVersionId; POST .../plan… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-024=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-024=NOT_IMPLEMENTED |
| Draft mutations require expectedVersion. Published versions reject mutation. Layout-only changes use… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-025=IMPLEMENTED_AND_PROVEN; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-025=NOT_IMPLEMENTED |
| Runtime API: POST /api/cases/:caseId/runs; GET /api/runs/:runId; GET /api/runs/:runId/node-runs; POS… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-026=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-026=NOT_IMPLEMENTED |
| Proposals and approvals API: GET /api/work/proposals/:proposalId; POST /api/work/proposals/:proposal… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-027=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-027=NOT_IMPLEMENTED |
| Decision requests carry proposalVersion, payloadDigest and idempotency key. The server returns autho… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-028=IMPLEMENTED_AND_PROVEN; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-028=NOT_IMPLEMENTED |

## Higiena dowodowa: sentinel `UNCOMMITTED-WORKTREE` i SHA korpusu wymagan w `candidate_sha`

Wiersz EFEKTYWNY nie powinien nosic w `candidate_sha` ani sentinela roboczego
`UNCOMMITTED-WORKTREE...` (dopuszczalny WYLACZNIE jako tymczasowy znacznik podczas pracy na
niezacommitowanym, wspoldzielonym worktree — nie jako trwaly dowod), ani SHA korpusu wymagan
(`80d75f24ce01751639e572226f4e52b30503cd22`, patrz `PACKET_REGISTRY.md` linia 5: "Corpus
commit:" — to commit DOKUMENTOW zrodlowych, nie kodu) uzytego tak, jakby byl dowodem code-review.

Wiersze efektywne z `candidate_sha` zaczynajacym sie od `UNCOMMITTED-WORKTREE`: **71**
  z tego o statusie IMPLEMENTED_AND_PROVEN/PASS (najbardziej niepokojace — dowod "trwaly" na wierszu z sentinelem roboczym): **6**

| Plik | ID | status | candidate_sha |
|---|---|---|---|
| EPIC_DOD_COVERAGE.csv | CW-DOD-F5-U4 | IMPLEMENTED_AND_PROVEN | UNCOMMITTED-WORKTREE-2026-08-10 |
| EPIC_DOD_COVERAGE.csv | CW-DOD-F1-U4 | IMPLEMENTED_AND_PROVEN | UNCOMMITTED-WORKTREE-2026-08-10 |
| EPIC_DOD_COVERAGE.csv | CW-CANON-01-U4 | IMPLEMENTED_AND_PROVEN | UNCOMMITTED-WORKTREE-2026-08-10 |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-F-04-U1 | IMPLEMENTED_AND_PROVEN | UNCOMMITTED-WORKTREE-2026-08-11 |
| SECURITY_RESILIENCE_MATRIX.csv | SEC-009-U1 | IMPLEMENTED_AND_PROVEN | UNCOMMITTED-WORKTREE-2026-08-11 |
| SECURITY_RESILIENCE_MATRIX.csv | CW-DOD-D6-U1 | IMPLEMENTED_AND_PROVEN | UNCOMMITTED-WORKTREE-2026-08-11 |

Wiersze efektywne o statusie IMPLEMENTED_AND_PROVEN/PASS, ktorych `candidate_sha` jest SHA korpusu wymagan (mylnie uzyty jako dowod kodu): **18**

| Plik | ID | status |
|---|---|---|
| API_EVENT_SCHEMA_COVERAGE.csv | CW-00-020-INV10 | IMPLEMENTED_AND_PROVEN |
| API_EVENT_SCHEMA_COVERAGE.csv | CW-GR-025 | IMPLEMENTED_AND_PROVEN |
| API_EVENT_SCHEMA_COVERAGE.csv | CW-GR-028 | IMPLEMENTED_AND_PROVEN |
| API_EVENT_SCHEMA_COVERAGE.csv | SEC-020 | IMPLEMENTED_AND_PROVEN |
| API_EVENT_SCHEMA_COVERAGE.csv | SEC-025 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GR-044 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GR-045 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GR-050 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-B-05 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-B-10 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-C-02 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-D-01 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-D-02 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-D-03 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-D-04 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-E-02 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-E-03 | IMPLEMENTED_AND_PROVEN |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-READ-01 | IMPLEMENTED_AND_PROVEN |

Wiersze efektywne o statusie IMPLEMENTED_AND_PROVEN/PASS w pliku, ktory w ogole NIE MA kolumny `candidate_sha` (strukturalnie niemozliwe do zweryfikowania, wobec jakiego stanu kodu wiersz zostal przyjety): **113**

TRACEABILITY_AUTH_ROUTES.csv: **113**

Zaden `evidence_ref` (odrebna kolumna od `candidate_sha`) nie ma dokladnej wartosci-sentinela
`UNCOMMITTED-WORKTREE` — sentinel wystepuje wylacznie w `candidate_sha`; sprawdzone parserem.

**Ten skrypt nic tu nie zmienia** — zero edycji `status`, zero edycji `candidate_sha`/`evidence_ref`.
Powyzsze liczby sa raportem dla koordynatora, ktory stempluje realny SHA po scaleniu.

## Rozbicie per plik

### API_EVENT_SCHEMA_COVERAGE.csv

- Wiersze surowe: **62**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **4**
- Wiersze efektywne: **58**
- Rozklad statusow (efektywne): PARTIAL: **35**, NOT_IMPLEMENTED: **18**, IMPLEMENTED_AND_PROVEN: **5**
- Rozklad statusow (surowe, przed dedup): PARTIAL: **39**, NOT_IMPLEMENTED: **18**, IMPLEMENTED_AND_PROVEN: **5**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **15**

### CARTESIAN_UX_COVERAGE.csv

- Wiersze surowe: **0**
- Kolumna `supersedes_row_id`: brak w tym pliku — wszystkie wiersze traktowane jako efektywne.
- Wiersze efektywne: **0**
- Rozklad statusow (efektywne): _(brak kolumny status)_
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **0**

### CODEBASE_CONVERGENCE_MAP.csv

- Wiersze surowe: **49**
- Kolumna `supersedes_row_id`: brak w tym pliku — wszystkie wiersze traktowane jako efektywne.
- Wiersze efektywne: **49**
- Kolumna `status`: BRAK w tym pliku — rozklad statusow nieliczony (patrz `docs/FUNCTIONAL_DOCUMENTATION.md` / wlasciciel rejestru co do sensu tego pliku).
- Kolumny `test_ref`/`evidence_ref`: brak w tym pliku.

### CUSTOMER_JOURNEY_LEDGER.csv

- Wiersze surowe: **37**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **0**
- Wiersze efektywne: **37**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **37**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **37**

### EPIC_DOD_COVERAGE.csv

- Wiersze surowe: **357**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **247**
- Wiersze efektywne: **110**
- Rozklad statusow (efektywne): PARTIAL: **72**, EVIDENCE_MISSING: **13**, IMPLEMENTED_AND_PROVEN: **12**, NOT_IMPLEMENTED: **8**, OUT_OF_SCOPE_THIS_WAVE: **5**
- Rozklad statusow (surowe, przed dedup): NOT_IMPLEMENTED: **140**, PARTIAL: **123**, BLOCKED_ON_UI: **44**, EVIDENCE_MISSING: **29**, IMPLEMENTED_AND_PROVEN: **16**, OUT_OF_SCOPE_THIS_WAVE: **5**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **32**

### FUNCTIONAL_REQUIREMENT_COVERAGE.csv

- Wiersze surowe: **901**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **68**
- Wiersze efektywne: **833**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **766**, IMPLEMENTED_AND_PROVEN: **41**, PARTIAL: **26**
- Rozklad statusow (surowe, przed dedup): NOT_IMPLEMENTED: **833**, IMPLEMENTED_AND_PROVEN: **41**, PARTIAL: **27**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **766**

### GOLDEN_CASE_EVIDENCE_LEDGER.csv

- Wiersze surowe: **82**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **4**
- Wiersze efektywne: **78**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **31**, PARTIAL: **30**, IMPLEMENTED_AND_PROVEN: **14**, EVIDENCE_MISSING: **3**
- Rozklad statusow (surowe, przed dedup): PARTIAL: **32**, NOT_IMPLEMENTED: **31**, IMPLEMENTED_AND_PROVEN: **14**, EVIDENCE_MISSING: **5**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **32**

### LEGACY_MIGRATION_PARITY.csv

- Wiersze surowe: **31**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **1**
- Wiersze efektywne: **30**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **29**, PARTIAL: **1**
- Rozklad statusow (surowe, przed dedup): NOT_IMPLEMENTED: **30**, PARTIAL: **1**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **29**

### RESPONSIVE_ACCESSIBILITY_LEDGER.csv

- Wiersze surowe: **32**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **0**
- Wiersze efektywne: **32**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **32**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **32**

### SECURITY_RESILIENCE_MATRIX.csv

- Wiersze surowe: **98**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **6**
- Wiersze efektywne: **92**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **86**, PARTIAL: **4**, IMPLEMENTED_AND_PROVEN: **2**
- Rozklad statusow (surowe, przed dedup): NOT_IMPLEMENTED: **92**, PARTIAL: **4**, IMPLEMENTED_AND_PROVEN: **2**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **86**

### TRACEABILITY_AUTH_ROUTES.csv

- Wiersze surowe: **177**
- Kolumna `supersedes_row_id`: brak w tym pliku — wszystkie wiersze traktowane jako efektywne.
- Wiersze efektywne: **177**
- Rozklad statusow (efektywne): IMPLEMENTED_AND_PROVEN: **113**, PARTIAL: **33**, NOT_IMPLEMENTED: **31**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **15**

### VISUAL_TRIADA_SPEC_A_LEDGER.csv

- Wiersze surowe: **235**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **0**
- Wiersze efektywne: **235**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **235**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **235**

## Wiersze bez dowodu, ktore NIE MOGA byc PASS/IMPLEMENTED_AND_PROVEN

Laczna liczba wierszy efektywnych z pustym `test_ref` LUB pustym `evidence_ref`: **1279**.

Rozklad tej liczby jest zdominowany przez wiersze o statusie `NOT_IMPLEMENTED` (naturalne — nic
nie zostalo zaimplementowane, wiec nie ma dowodu). Kluczowe pytanie kontrolne to: czy ktorys z tych
wierszy jest mimo to oznaczony jako `IMPLEMENTED_AND_PROVEN`/`PASS`?

**Sprawdzone: ZERO.** Zaden wiersz efektywny o statusie IMPLEMENTED_AND_PROVEN/PASS nie ma
calkowicie pustego `test_ref` ani calkowicie pustego `evidence_ref`. To NIE jest to samo co
"dowod jest realny" — patrz nastepna sekcja: czesc `test_ref` niepustych jest sentinelem `PENDING`
albo tekstem opisowym bez wskazanego pliku.

## Niespojnosc: wiersze "udowodnione" (IMPLEMENTED_AND_PROVEN/PASS), ktorych test_ref
## nie wskazuje na realnie istniejacy plik testu

Dla kazdego wiersza efektywnego ze statusem IMPLEMENTED_AND_PROVEN/PASS skrypt rozklada
`test_ref` na kandydatow-sciezki (separator `|`, opcjonalny sufiks `:linia`, opcjonalny dopisek
w nawiasie) i sprawdza kazdy wzgledem systemu plikow (dla golych nazw plikow — dodatkowo
przeszukuje cale repo po nazwie, zeby nie dawac falszywych alarmow na skrocone referencje).

**Znaleziono 39** wpis(y) niespojne — to realne znalezisko, nie szum:

| Plik rejestru | ID wiersza | Powod | Surowy test_ref |
|---|---|---|---|
| EPIC_DOD_COVERAGE.csv | CW-DOD-F5-U4 | test_ref to opis, nie sciezka pliku: "LIVE-U4 browser run" | `LIVE-U4 browser run (u4-report-addendum.json C_crimson_live)\|docs/qa/screens/case-workspace-e2e/_raport.json` |
| EPIC_DOD_COVERAGE.csv | CW-DOD-F1-U4 | test_ref to opis, nie sciezka pliku: "LIVE-U4 browser run" | `LIVE-U4 browser run (u4-report-addendum2.json detail.rawTables=0; u4-report.json S1/S2 real StandardTable rows and rowMenu)` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-012;CW-GR-023 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-01-026-INV1 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-GR-029;CW-GR-030 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-00-020-INV6;CW-RT-018 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-013;CW-02-011;CW-02-024 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-00-020-INV6;CW-RT-017 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-020;CW-DOD-B5 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-021;CW-DOD-I6 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-01-016;CW-01-026-INV12;CW-00-020-INV13 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-00-020-INV13 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-00-020-INV13;CW-03-017;CW-DOD-B2 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-02-032 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-02-032;CW-01-004 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-02-032;CW-01-026-INV9 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-014;CW-GR-029 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-GR-029;CW-GR-030 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-014;CW-GR-029 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-GR-029;CW-GR-030 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-024 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-024;CW-GR-033;CW-02-031;CW-03-017;CW-01-004 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-01-026-INV9;CW-02-031 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-GR-037 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-GR-037 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-GR-037 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-037 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-037;CW-RT-035 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-037 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J3 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J3 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J3 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J1 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J1;CW-DOD-J2 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J3 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J5 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J5;CW-DOD-J6 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-DOD-J5 | test_ref = "PENDING" (sentinel, nie plik) | `PENDING` |
| TRACEABILITY_AUTH_ROUTES.csv | CW-RT-026;CW-RT-044;-U4 | test_ref to opis, nie sciezka pliku: "LIVE-U4 browser+realDB run" | `server/src/services/caseWorkspace/__tests__/caseCoreService.pg.test.ts (realDB outbox assertion; branch(es) NOT yet asserted: case.failed)\|L…` |

## Uwagi metodologiczne

- "Efektywny" wiersz = taki, ktorego `row_id`/`requirement_id` NIE wystepuje jako cel
  `supersedes_row_id` zadnego innego wiersza w tym samym pliku. Dziala to poprawnie dla
  lancuchow dowolnej dlugosci (np. `X` -> `X-U1` -> `X-U3`), bo efektywny jest zawsze i tylko
  wezel koncowy lancucha — nie trzeba go jawnie przechodzic.
- Pliki `CODEBASE_CONVERGENCE_MAP.csv` i `CARTESIAN_UX_COVERAGE.csv` nie maja uzytecznej
  kolumny `status` (pierwszy: brak kolumny w ogole; drugi: 0 wierszy) — wylaczone z rozkladu
  statusow, ale ich liczba wierszy jest wliczona w tabele zrodel powyzej.
- `TRACEABILITY_AUTH_ROUTES.csv` nie ma kolumny `supersedes_row_id` — wszystkie jego wiersze
  sa traktowane jako efektywne wprost.
- Ten plik i skrypt, ktory go generuje, NIE modyfikuja zadnego pliku CSV — rejestry naleza
  do innych agentow rownoleglej pracy.

