# LEDGER_SNAPSHOT — parser rejestrow Case Workspace

> Wygenerowane automatycznie przez `scripts/case-workspace/ledger-report.mjs`.
> NIE edytowac recznie — kazdy przebieg nadpisuje ten plik od zera.
> Odcisk tresci wejsciowej (sha256 nazw+bajtow wszystkich *.csv, sortowane): `77dba34395bc981f30ba5a4fecb523b48bf2b0bde7edb36c7979ec22757c3544`
> Ten odcisk (nie znacznik czasu) dowodzi determinizmu: dwa przebiegi na tych samych
> plikach wejsciowych daja identyczny odcisk i bajtowo identyczny plik wyjsciowy.

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
| API_EVENT_SCHEMA_COVERAGE.csv | 71 | tak | row_id | tak |
| CARTESIAN_UX_COVERAGE.csv | 0 | tak | brak | brak |
| CODEBASE_CONVERGENCE_MAP.csv | 49 | BRAK | brak | brak |
| CUSTOMER_JOURNEY_LEDGER.csv | 37 | tak | row_id | tak |
| EPIC_DOD_COVERAGE.csv | 415 | tak | row_id | tak |
| FUNCTIONAL_REQUIREMENT_COVERAGE.csv | 901 | tak | row_id | tak |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | 99 | tak | row_id | tak |
| LEGACY_MIGRATION_PARITY.csv | 32 | tak | row_id | tak |
| RESPONSIVE_ACCESSIBILITY_LEDGER.csv | 32 | tak | row_id | tak |
| SECURITY_RESILIENCE_MATRIX.csv | 104 | tak | row_id | tak |
| TRACEABILITY_AUTH_ROUTES.csv | 214 | tak | row_id | tak |
| VISUAL_TRIADA_SPEC_A_LEDGER.csv | 235 | tak | row_id | tak |

## LACZNY rozklad statusow — WIERSZE EFEKTYWNE (po rozwiazaniu supersedes_row_id)

Suma wierszy surowych (wszystkie pliki, wliczajac te bez kolumny status): **2189**

Suma wierszy efektywnych (po deduplikacji lancuchow supersedes, tylko pliki z kolumna status): **1682**

NOT_IMPLEMENTED: **1273**, PARTIAL: **227**, IMPLEMENTED_AND_PROVEN: **161**, EVIDENCE_MISSING: **16**, OUT_OF_SCOPE_THIS_WAVE: **5**

**GAP != 0.** Statusy niedomkniete obecne w wierszach efektywnych: PARTIAL=227, EVIDENCE_MISSING=16, NOT_IMPLEMENTED=1273 (razem **1516** wierszy). Nie mozna deklarowac "zero GAP".

### (dla porownania) rozklad surowy — WSZYSTKIE wiersze, bez dedup supersedes

NOT_IMPLEMENTED: **1487**, PARTIAL: **328**, IMPLEMENTED_AND_PROVEN: **228**, EVIDENCE_MISSING: **48**, BLOCKED_ON_UI: **44**, OUT_OF_SCOPE_THIS_WAVE: **5**

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

NOT_IMPLEMENTED: **597**, PARTIAL: **149**, IMPLEMENTED_AND_PROVEN: **69**, EVIDENCE_MISSING: **16**, OUT_OF_SCOPE_THIS_WAVE: **5**

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
| Runtime API: POST /api/cases/:caseId/runs; GET /api/runs/:runId; GET /api/runs/:runId/node-runs; POS… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-026=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-026=NOT_IMPLEMENTED |
| Proposals and approvals API: GET /api/work/proposals/:proposalId; POST /api/work/proposals/:proposal… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-027=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-027=NOT_IMPLEMENTED |
| Capability Registry and Plays API: GET /api/capabilities?availability=&ownerModule=&cursor=; GET /ap… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-029=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-029=NOT_IMPLEMENTED |
| Artifacts and evidence API: POST /api/cases/:caseId/artifacts; DELETE /api/cases/:caseId/artifacts/:… | API_EVENT_SCHEMA_COVERAGE.csv:CW-GR-033=PARTIAL; FUNCTIONAL_REQUIREMENT_COVERAGE.csv:CW-GR-033=NOT_IMPLEMENTED |

## Higiena dowodowa: sentinel `UNCOMMITTED-WORKTREE` i SHA korpusu wymagan w `candidate_sha`

Wiersz EFEKTYWNY nie powinien nosic w `candidate_sha` ani sentinela roboczego
`UNCOMMITTED-WORKTREE...` (dopuszczalny WYLACZNIE jako tymczasowy znacznik podczas pracy na
niezacommitowanym, wspoldzielonym worktree — nie jako trwaly dowod), ani SHA korpusu wymagan
(`80d75f24ce01751639e572226f4e52b30503cd22`, patrz `PACKET_REGISTRY.md` linia 5: "Corpus
commit:" — to commit DOKUMENTOW zrodlowych, nie kodu) uzytego tak, jakby byl dowodem code-review.

Wiersze efektywne z `candidate_sha` zaczynajacym sie od `UNCOMMITTED-WORKTREE`: **0**
  z tego o statusie IMPLEMENTED_AND_PROVEN/PASS (najbardziej niepokojace — dowod "trwaly" na wierszu z sentinelem roboczym): **0**

Wiersze efektywne o statusie IMPLEMENTED_AND_PROVEN/PASS, ktorych `candidate_sha` jest SHA korpusu wymagan (mylnie uzyty jako dowod kodu): **0**

Wiersze efektywne o statusie IMPLEMENTED_AND_PROVEN/PASS w pliku, ktory w ogole NIE MA kolumny `candidate_sha` (strukturalnie niemozliwe do zweryfikowania, wobec jakiego stanu kodu wiersz zostal przyjety): **0**

Zaden `evidence_ref` (odrebna kolumna od `candidate_sha`) nie ma dokladnej wartosci-sentinela
`UNCOMMITTED-WORKTREE` — sentinel wystepuje wylacznie w `candidate_sha`; sprawdzone parserem.

**Ten skrypt nic tu nie zmienia** — zero edycji `status`, zero edycji `candidate_sha`/`evidence_ref`.
Powyzsze liczby sa raportem dla koordynatora, ktory stempluje realny SHA po scaleniu.

## Rozbicie per plik

### API_EVENT_SCHEMA_COVERAGE.csv

- Wiersze surowe: **71**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **13**
- Wiersze efektywne: **58**
- Rozklad statusow (efektywne): PARTIAL: **35**, NOT_IMPLEMENTED: **18**, IMPLEMENTED_AND_PROVEN: **5**
- Rozklad statusow (surowe, przed dedup): PARTIAL: **43**, NOT_IMPLEMENTED: **18**, IMPLEMENTED_AND_PROVEN: **10**
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

- Wiersze surowe: **415**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **305**
- Wiersze efektywne: **110**
- Rozklad statusow (efektywne): PARTIAL: **74**, EVIDENCE_MISSING: **13**, IMPLEMENTED_AND_PROVEN: **10**, NOT_IMPLEMENTED: **8**, OUT_OF_SCOPE_THIS_WAVE: **5**
- Rozklad statusow (surowe, przed dedup): PARTIAL: **157**, NOT_IMPLEMENTED: **148**, BLOCKED_ON_UI: **44**, EVIDENCE_MISSING: **42**, IMPLEMENTED_AND_PROVEN: **19**, OUT_OF_SCOPE_THIS_WAVE: **5**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **32**

### FUNCTIONAL_REQUIREMENT_COVERAGE.csv

- Wiersze surowe: **901**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **68**
- Wiersze efektywne: **833**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **766**, IMPLEMENTED_AND_PROVEN: **41**, PARTIAL: **26**
- Rozklad statusow (surowe, przed dedup): NOT_IMPLEMENTED: **833**, IMPLEMENTED_AND_PROVEN: **41**, PARTIAL: **27**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **766**

### GOLDEN_CASE_EVIDENCE_LEDGER.csv

- Wiersze surowe: **99**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **21**
- Wiersze efektywne: **78**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **31**, PARTIAL: **30**, IMPLEMENTED_AND_PROVEN: **14**, EVIDENCE_MISSING: **3**
- Rozklad statusow (surowe, przed dedup): PARTIAL: **34**, NOT_IMPLEMENTED: **31**, IMPLEMENTED_AND_PROVEN: **28**, EVIDENCE_MISSING: **6**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **32**

### LEGACY_MIGRATION_PARITY.csv

- Wiersze surowe: **32**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **2**
- Wiersze efektywne: **30**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **29**, PARTIAL: **1**
- Rozklad statusow (surowe, przed dedup): NOT_IMPLEMENTED: **30**, PARTIAL: **2**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **29**

### RESPONSIVE_ACCESSIBILITY_LEDGER.csv

- Wiersze surowe: **32**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **0**
- Wiersze efektywne: **32**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **32**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **32**

### SECURITY_RESILIENCE_MATRIX.csv

- Wiersze surowe: **104**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **12**
- Wiersze efektywne: **92**
- Rozklad statusow (efektywne): NOT_IMPLEMENTED: **86**, PARTIAL: **4**, IMPLEMENTED_AND_PROVEN: **2**
- Rozklad statusow (surowe, przed dedup): NOT_IMPLEMENTED: **92**, PARTIAL: **8**, IMPLEMENTED_AND_PROVEN: **4**
- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **86**

### TRACEABILITY_AUTH_ROUTES.csv

- Wiersze surowe: **214**
- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **37**
- Wiersze efektywne: **177**
- Rozklad statusow (efektywne): IMPLEMENTED_AND_PROVEN: **89**, PARTIAL: **57**, NOT_IMPLEMENTED: **31**
- Rozklad statusow (surowe, przed dedup): IMPLEMENTED_AND_PROVEN: **126**, PARTIAL: **57**, NOT_IMPLEMENTED: **31**
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

**Sprawdzone: ZERO niespojnosci.** Kazdy `test_ref` na wierszu IMPLEMENTED_AND_PROVEN/PASS
wskazuje na plik, ktory realnie istnieje w repo.

## Uwagi metodologiczne

- "Efektywny" wiersz = taki, ktorego `row_id`/`requirement_id` NIE wystepuje jako cel
  `supersedes_row_id` zadnego innego wiersza w tym samym pliku. Dziala to poprawnie dla
  lancuchow dowolnej dlugosci (np. `X` -> `X-U1` -> `X-U3`), bo efektywny jest zawsze i tylko
  wezel koncowy lancucha — nie trzeba go jawnie przechodzic.
- Pliki `CODEBASE_CONVERGENCE_MAP.csv` i `CARTESIAN_UX_COVERAGE.csv` nie maja uzytecznej
  kolumny `status` (pierwszy: brak kolumny w ogole; drugi: 0 wierszy) — wylaczone z rozkladu
  statusow, ale ich liczba wierszy jest wliczona w tabele zrodel powyzej.
- Pliki bez kolumny `supersedes_row_id` (CARTESIAN_UX_COVERAGE.csv): wszystkie ich
  wiersze sa traktowane jako efektywne wprost — dla tych plikow ten skrypt nie moze wykryc
  duplikatow append-only (stara wersja wiersza zastapiona nowszym nadal liczy sie osobno).
- Ten plik i skrypt, ktory go generuje, NIE modyfikuja zadnego pliku CSV — rejestry naleza
  do innych agentow rownoleglej pracy.
