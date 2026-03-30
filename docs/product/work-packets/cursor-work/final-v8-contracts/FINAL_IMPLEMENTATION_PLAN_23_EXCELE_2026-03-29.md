# Final Implementation Contract — Excele (Position 23/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (shared-sourced contract; KIMI reference present)

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
- **Goal**: arkusz z uczciwym kontraktem (create/persist/reopen/export) bez Excel parity.
- **Inputs required**: KIMI mapping (actions/states) + decyzja o persistence/reopen semantics.
- **Acceptance**: scope zatwierdzony; honest limits jawne w UI; “zero interpretacji” w KIMI flows.
- **Evidence**: scope approval + evidence pointers do KIMI screens.

#### P23-B — Lifecycle closure (materialize→persist→reopen→export)
- **Goal**: domknąć najważniejszą ścieżkę E2E i udowodnić persistence.
- **Acceptance**: duży arkusz (bounded) nie gubi danych; export failure ma retry bez ghost artifacts.
- **Evidence**: integracyjne testy + staging demo (happy + failure).

#### P23-C — Verification + rollout
- **Goal**: regresje + staging proof + rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

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
| P23-A |  |  |  |  |  |
| P23-B |  |  |  |  |  |
| P23-C |  |  |  |  |  |

