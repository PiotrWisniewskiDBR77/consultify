# Final Implementation Contract — Excele (Position 23/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P23-A** (Excele lane canon + evidence mapping frozen); P23-B / P23-C not started  
Last updated: 2026-03-30 (P23-A scope closure)

## 1. Executive summary
- **Intent**: 100% KIMI: split-screen chat↔excel; generuj/edytuj; zapis do Outputs opcjonalny; zero zgadywania bez referencji KIMI.
- **Primary users**: użytkownicy pracujący na workbook-like artefakcie + chat.
- **Success metric**: realny governed `Sheet` artifact lifecycle + (osobno) KIMI-style split-screen UX/flow udowodniony referencją.

## 2. Scope
### 2.1 In-scope
- `Sheet` jako trwały artefakt: create/materialize → persist → list/open → reopen (honest) → export.
- Split-screen chat↔excel tylko na podstawie referencji KIMI (bez zgadywania).

### 2.2 Out-of-scope / non-goals
- Excel/Google Sheets parity (wprost non-goal w planie `Sheet`).

### 2.3 P23-A canon (scope approval) — “Excele lane”

**Excele to lane deliverable sheet**, nie “BI suite” ani “Tables OS”:

- **Lane definition (what Excele is)**:
  - Excele dostarcza **bounded `Sheet` deliverable** (workbook-like artefakt) powiązany z run/provenance i opcjonalnie lądujący w `Outputs Library`.
  - Excele **nie** jest: OLAP/BI, systemem dashboardów, platformą ETL, ani nową relacyjną prawdą danych.
  - Excele konsumuje fundamenty: `Outputs Library` (pozycja 19) jako home oraz `Provenance/Review/Visibility` (pozycja 18) jako trust-state.

- **Workflow: propose → review → apply (no silent apply)**:
  - **propose**: AI/agent generuje *proposal* (schema/formulas/transforms) jako jawny plan/diff, bez modyfikacji artefaktu.
  - **review (operator)**: user widzi *diff* i wybiera: accept/apply, edit proposal, reject; brak “silent write”.
  - **apply (run)**: materializacja zmian jest **runem** i podlega **approve(run)** wg gramatyki z pozycji 17 (ArtifactRun spine).
  - **Hard invariant**: **approve(run) ≠ review(artifact)** (pozycje 17 + 18). Run approval dotyczy wykonania (apply), a review dotyczy jakości/publish/governance artefaktu.

- **Bounded import posture + validation + error taxonomy**:
  - Import jest **bounded**: wspieramy tylko deklarowane formaty i rozmiary (bez overclaim “all Excel”).
  - Import/transform/formula apply zawsze przechodzi przez **validation** i zwraca **error taxonomy** (czytelne, klasyfikowalne błędy; zob. §7.1).
  - Błąd importu/transform nie może tworzyć “ghost sheet” ani częściowo zastosowanych zmian bez jawnego stanu.

- **Anti-duplicate rule (program-wide)**:
  - Excele nie może tworzyć równoległego “tables OS” (pozycja 15) ani równoległej biblioteki/registry poza pozycją 19.
  - Każdy `Sheet` ma jedną tożsamość i jedną ścieżkę otwierania/reopen zgodną z kanonem artefaktów (pozycje 18/19).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SHEET_2026-03-29.md`
- Related: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- `Sheet` benchmark family: governed workbook-style artifacts z durable identity i honest limits (`WAVE2_FINAL_IMPLEMENTATION_PLAN_SHEET_2026-03-29.md`).
- `KIMI` jako referencja “100% KIMI style” split-screen chat↔sheet.

### 4.2 Local Softs evidence (concrete artifacts)
- **KIMI Sheets (AI Excel agent posture)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/sheets.html` (meta: “AI Excel agent… formulas, charts, data cleaning, financial modeling”).
  - `Softs/KIMI/Docs/www.kimi.com/resources/best-free-ai-tools-for-excel.html` (konkretne deklaracje: formula gen, pivot tables, chart creation, spreadsheet generation, analysis, file conversion Excel ↔ PDF/Word/PPT/CSV/JSON, preview & export flow).
- **KIMI UI evidence (split chat↔sheet posture + task progress)**:
  - `Softs/KIMI/Screens/Screenshot 2026-03-24 at 08.13.51.png` (split view: chat + workbook surface).
  - `Softs/KIMI/Screens/Screenshot 2026-03-24 at 08.14.17.png` (task progress checklist + workbook preview).
  - `Softs/KIMI/Screens/Screenshot 2026-03-24 at 08.15.01.png` (download/allow prompt: export posture).
- **Workbook expectation class (non-goal parity but user mental model)**:
  - `Microsoft Excel`, `Google Sheets` jako “expectation class” — nie parity target (wprost non-goal w planie `Sheet`).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “governed, believable bounded sheet artifact + KIMI split-screen posture”, nie “Excel parity”.**

- **Governed workbook artifact (Sheet plan)**:
  - Create/materialize → persist → list/open → reopen (honest) → export.
  - Jasne non-goals i brak overclaim: “bounded sheet” to kontrakt, nie suite.
- **KIMI-style split-screen (Screens + KIMI Sheets posture)**:
  - Chat i sheet działają side-by-side; user widzi postęp zadań (task list) i rezultat w tym samym flow.
- **Operator-grade outcomes (KIMI resources)**:
  - Formuły/pivot/charts są rezultatem “deliverable-first”; eksport i konwersje są częścią workflow.
- **Export/convert as governed delivery (KIMI resources)**:
  - Preview → export/download; błędy eksportu muszą mieć recovery path (bez ghost artifacts).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_SHEET_2026-03-29.md` + KIMI evidence.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| End-to-end lifecycle closure | create→persist→reopen | “weakest artifact contract” | Domknąć pełny lifecycle i udowodnić reopen/persistence | P0 |
| Honest limits language | no fake parity | “expectation gap intentionally open” | Spisać i eksponować honest limits (co działa, co nie) | P0 |
| Export/convert posture | preview→export | “fake export-only claims risk” | Export/convert muszą być prawdziwe i audytowalne (pozycja 18) | P1 |
| Split-screen action grammar | task progress + preview | “no guessing” | Zmapować actions/states z KIMI Screens (zero interpretacji) | P1

## 6. Evidence mapping (P23-A approval gate)

Poniżej jest **approval-grade mapping** tego, czego *wymagamy* jako dowód przed P23-B (runtime). Wszędzie gdzie dowodu brakuje, oznaczamy **MISSING INPUT**.

| Capability cluster (what we claim) | Required evidence (approval-grade) | Current evidence in repo | Status |
| --- | --- | --- | --- |
| KIMI split-screen anatomy (chat↔sheet) | Konkretne screeny + opis akcji/stanu bez interpretacji | `Softs/KIMI/Screens/Screenshot 2026-03-24 at 08.13.51.png` (split) | **MISSING INPUT**: brak pełnego action/state mapping (skrótów, stanów, affordances) |
| Task progress checklist in flow | Screen pokazujący checklist + jak wpływa na sheet | `Softs/KIMI/Screens/Screenshot 2026-03-24 at 08.14.17.png` | **MISSING INPUT**: brak spisanej semantyki checklist (co jest “task”, kiedy complete) |
| Export/download posture in flow | Screen + dialog/posture + recovery path | `Softs/KIMI/Screens/Screenshot 2026-03-24 at 08.15.01.png`; KIMI resource o preview→export | **MISSING INPUT**: brak mappingu stanów failure/retry w UX |
| AI Excel agent capability claims (formulas/cleaning/modeling) | Strona/Docs z deklaracjami capability | `Softs/KIMI/Docs/www.kimi.com/en/sheets.html`; `.../best-free-ai-tools-for-excel.html` | OK (claims captured) |
| Schema proposal + apply gating | Evidence że zmiany nie są silent + są reviewable | Brak bezpośredniego KIMI dowodu w Screens/Docs dla “diff+apply gating” | **MISSING INPUT**: brak referencji KIMI dla propose/review/apply UI; dopóki brak — nie wolno implementować “jak nam pasuje” |
| Import posture (CSV/XLSX) + bounded limits | Dowód formatu + granic + komunikatów | KIMI resource wspomina conversion/import; brak lokalnego flow evidence | **MISSING INPUT**: brak specyfikacji limitów + brak evidence dla import UX |
| Validation layering + error taxonomy | Lista klas błędów + przykłady komunikatów | Brak w repo konkretnej taxonomy dla sheets | **MISSING INPUT**: brak uzgodnionej taxonomy + przykładów |
| Transforms / data cleaning semantics | Dowód: cleaning jest jawny i audytowalny | KIMI claims (data cleaning) w docs; brak mapped actions | **MISSING INPUT**: brak mappingu transform types + preview/diff |
| Formula semantics + error handling | Dowód: formula generation/edit i jak prezentujemy błędy | KIMI claims (formula gen); brak UI evidence | **MISSING INPUT**: brak mappingu formula edit UX i error surfaces |
| Pivot/charts posture (bounded) | Dowód: pivot/chart creation w deklarowanym zakresie | KIMI resource deklaruje pivot/charts | **MISSING INPUT**: brak evidence o UI i granicach; deklaracje nie wystarczą do “100% KIMI style” |
| Governance: Outputs Library landing | Dowód: sheet jako artifact w bibliotece + reopen | SSOT: pozycja 19 (Outputs Library contract) + Sheet plan reference | OK (program SSOT), ale wymaga implementacji w P23-B |
| Trust-state/provenance/review | Dowód: approve(run) ≠ review(artifact); trust-state payload | SSOT: pozycja 18 + pozycja 17 | OK (SSOT), musi być skonsumowane w P23-B |

## 7. Governance + anti-duplicate posture (P23-A)

- **Canonical home**: `Sheet` jako artefakt ląduje w `Outputs Library` (pozycja 19). Excele nie tworzy drugiej biblioteki ani “sheet registry v2”.
- **Provenance / trust-state**: Excele dziedziczy i wyświetla trust-state z pozycji 18 (source/run/stage/visibility/export_ledger). Nie wymyśla własnych stage enums.
- **Run vs review separation**: apply zmian w sheet to **run** (approve(run) wg pozycji 17); ocena/jakość/publish to **review(artifact)** (pozycja 18).
- **No parallel relational OS**: jeśli potrzeba relacji/records/views — to pozycja 15 (`Tabele`). Excele jest lane’em “deliverable sheet”, nie alternatywą dla tabel.

### 7.1 Degraded / error posture (P23-A) — scenarios (8+)

Każdy scenariusz musi: (a) zatrzymać silent apply, (b) zostawić artefakt w prawdziwym stanie, (c) zwrócić błąd z klasą + recovery.

1. **Import parse error** (np. uszkodzony CSV/XLSX) → `IMPORT_PARSE_ERROR` + wskazanie linii/komórki jeśli możliwe; opcje: retry / upload new / cancel.
2. **Schema mismatch** (kolumny niezgodne z oczekiwaniem/proposal) → `SCHEMA_MISMATCH` + diff; apply zablokowane dopóki user nie zaakceptuje mapowania.
3. **Type coercion failure** (tekst w liczbie, daty) → `TYPE_COERCION_ERROR` + preview zmian; opcja: apply with coercion / fix input / reject.
4. **Validation failure (semantic)** (np. sumy nie domykają się) → `VALIDATION_FAILED` + lista checków; brak apply bez override.
5. **Transform failure** (cleaning step nie może się wykonać) → `TRANSFORM_FAILED` + wskazanie kroku; rollback do pre-transform snapshot; retry.
6. **Formula error** (syntax, odwołania, `#DIV/0!`) → `FORMULA_ERROR` + wskazanie komórek; apply zatrzymane lub częściowe tylko z jawnie zaznaczonymi polami.
7. **Circular reference** → `FORMULA_CYCLE_DETECTED` + ostrzeżenie; rekomendacja naprawy; brak “ukrytego auto-fix” bez dowodu.
8. **Export/conversion failure** (PDF/CSV/JSON) → `EXPORT_FAILED` + retry; brak “ghost output” w bibliotece.
9. **Permission/visibility conflict** (user nie ma prawa modyfikować/eksportować) → `ACCESS_DENIED` + link do zarządzania dostępem (pozycja 18).
10. **Concurrency / stale state** (sheet zmienił się między propose a apply) → `STALE_SNAPSHOT` + rebase proposal / regenerate diff.

### 7.2 Acceptance checklist (P23-A `approved(scope)`) — 10+

1. **Lane definition**: kontrakt mówi wprost: Excele = **deliverable sheet lane**, nie BI/ETL/tables OS.
2. **No silent apply**: propose→review→apply jest jawne; apply jest runem wymagającym approve(run).
3. **Approve(run) ≠ review(artifact)**: rozdział jest zacytowany i powiązany z pozycją 17 i 18 (terminologia nie miesza osi).
4. **Bounded import posture**: kontrakt wymusza jawne ograniczenia importu/rozmiaru/formatów (bez overclaim) i blokuje implementację bez evidence mapping + limitów.
5. **Validation + error taxonomy**: kontrakt posiada klasy błędów (import/schema/type/validation/transform/formula/export/access/stale).
6. **MISSING INPUT flags**: evidence mapping ma jawne **MISSING INPUT** wszędzie gdzie brakuje dowodów KIMI lub repo SSOT.
7. **Governance consumption**: kontrakt mówi: home = Outputs Library (P19), trust-state = P18; Excele nie tworzy równoległych prawd.
8. **Anti-duplicate**: kontrakt explicit blokuje “parallel tables OS” (P15) i “second library/registry”.
9. **Degraded posture**: ≥8 scenariuszy z recovery i zakazem ghost artifacts.
10. **Index readiness**: `EXECUTION_INDEX.md` #23 ustawione na `approved(scope)` dla P23-A.
11. **Evidence ledger row**: §10 ma wypełniony wiersz P23-A (status + commit ref + notes) jako scope-only.

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- `Sheet` ma uczciwy kontrakt i działa end-to-end: create/materialize → persist → list/open → reopen → export.
- UI i komunikaty są spójne z non-goals (brak obietnic Excel parity).
- Split-screen chat↔sheet działa w duchu KIMI evidence (task progress + preview + export).

### 5.2 Tests
- Integracyjne: materialize sheet → library listing → open/reopen → export → audit traceability.
- Regression: duży arkusz (bounded) → brak utraty danych; błędy eksportu → czytelny fallback + retry.
- Contract tests: sheet artifact payload ma type + lifecycle state + export ledger (w deklarowanym zakresie).

### 5.3 Staging proof checklist
- Demo: “z briefu → sheet” + reopen + export (1 happy path).
- Demo: split-screen flow: chat plan/tasklist → preview → download; każdy krok ma evidence pointer do `Softs/KIMI`.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain: see section 3 + missing-input gate (playbook).
- KIMI evidence pointers: see section 4 (no guessing rule).
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P23-A — Sheet canon + honest limits (scope approval)
- **Goal**: zamrozić Excele lane canon: deliverable sheet (bounded) + 100% KIMI evidence mapping + workflow propose→review→apply (bez silent apply).
- **Inputs required**: KIMI mapping (actions/states) dla deklarowanych flows + decyzja o persistence/reopen semantics (plan `Sheet`) + governance consumption (18/19) + approve(run) vs review(artifact) invariants (17/18).
- **Acceptance**: scope zatwierdzony; “zero interpretacji” w KIMI flows; brak równoległych prawd (P15/P19); degraded/error posture gotowa na P23-B.
- **Evidence**: scope approval + evidence mapping (§6) z jawnie oznaczonymi **MISSING INPUT**.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze lane definition + anti-duplicate rule (deliverable sheet lane; no tables OS; no second library).
  - Freeze propose→review→apply gating for schema/formulas/transforms (no silent apply).
  - Freeze bounded import posture + validation + error taxonomy (approval-grade).
  - Freeze persistence/reopen semantics and the bounded KIMI actions/states mapping (or mark MISSING INPUT).
  - Freeze export/convert posture + audit linkage (18/19) (bounded) and error recovery rules.
- **DoD**:
  - Approved(scope): §2.3 canon + §6 evidence mapping + §7 governance/degraded posture; **MISSING INPUT** explicitly blocks P23-B where applicable.

#### P23-B — Lifecycle closure (materialize→persist→reopen→export)
- **Goal**: domknąć najważniejszą ścieżkę E2E i udowodnić persistence.
- **Acceptance**: duży arkusz (bounded) nie gubi danych; export failure ma retry bez ghost artifacts.
- **Evidence**: integracyjne testy + staging demo (happy + failure).
- **Tasks**:
  - Implement the E2E lifecycle and prove persistence/reopen (bounded).
  - Implement export failure recovery + retry without ghost artifacts.
  - Add integration/regression tests and run staging demos (happy + failure).
- **Staging proof script (click-by-click)**:
  1. From brief, materialize a sheet and confirm it persists (appears in library/listing).
  2. Close and reopen the sheet; verify data is intact and state is consistent.
  3. Export/convert (bounded) and confirm audit/export ledger exists (18/19).
  4. Simulate export failure and verify retry/recovery (no ghost artifacts).
  5. If split-screen is in scope: run the KIMI-style chat↔sheet flow and verify mapped actions/states.
- **DoD**:
  - Reopen is real; export is reliable with recovery; tests pass on bounded “large sheet”.

#### P23-C — Verification + rollout
- **Goal**: regresje + staging proof + rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P23-A/B/C.
  - Validate rollback: disable advanced features; preserve read-only + export.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw lifecycle (P0), potem split-screen UX polish (P1).

### 8.3 Rollback plan
- Wyłącz edycję advanced i split-screen extras; zachowaj read-only + export; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: “sheet” bez realnego reopen/persistence (papierowy feature).
- Ryzyko: overclaim Excel parity (złe oczekiwania).
- Decyzje: minimalny zakres formuł/formatów (albo jawny non-goal).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P23-A | approved(scope) |  | N/A — docs/scope only | N/A | Canon §2.3; evidence mapping §6 (with explicit **MISSING INPUT**); governance + anti-duplicate §7; degraded/error posture §7.1; checklist §7.2. |
| P23-B |  |  |  |  |  |
| P23-C |  |  |  |  |  |

