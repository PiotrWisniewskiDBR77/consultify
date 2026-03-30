# Final Implementation Contract — Wordy (Position 22/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (KIMI reference present) + missing dedicated plan

## 1. Executive summary
- **Intent**: 100% KIMI: split-screen chat↔word; generuj/edytuj; zapis do Outputs opcjonalny; zero zgadywania bez referencji KIMI.
- **Primary users**: użytkownicy pracujący w trybie chat+document.
- **Success metric**: dokładne zachowanie KIMI split-screen (akcje, stany, skróty, model edycji) odwzorowane na podstawie referencji, nie interpretacji.

## 2. Scope
### 2.1 In-scope
- Split-screen chat↔word jako pierwszoplanowy model pracy.
- Generacja i edycja dokumentu jako artefaktu z traceability (jeśli zapis do Outputs) lub jako sesji (jeśli „opcjonalny zapis”).

### 2.2 Out-of-scope / non-goals
- Zgadywanie zachowania KIMI lub „robimy podobnie”.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Related (shared) plans:
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md`
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md`
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Status correction
- **KIMI reference is present** in repo (`Softs/KIMI/Docs` + `Softs/KIMI/Screens`). Dedicated plan file for `Wordy` remains missing (shared plans only).

### 4.2 Primary benchmark family (SSOT)
- `Softs/KIMI` jako “100% KIMI style” referencja zachowania.
- Shared runtime authority: `Documents` + `ArtifactRun z czatu` + `Outputs Library` + AI OS family:
  - `WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
  - `WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md`
  - `WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md`
  - `WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`

### 4.3 Local Softs evidence (concrete artifacts)
- **KIMI Docs (Word/PDF posture: track changes, comments, print-ready)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/docs.html` (meta: “Create professional Word files & PDFs… Supports track changes, comments…”).
  - `Softs/KIMI/Docs/www.kimi.com/features/docs.html` (Docs feature surface).
- **KIMI UI evidence (split chat↔artifact posture)**:
  - `Softs/KIMI/Screens/Screenshot 2026-03-24 at 08.13.51.png` (split view: left chat, right artifact surface).
  - `Softs/KIMI/Screens/Screenshot 2026-03-24 at 08.15.01.png` (download/allow prompt: export/download posture in workflow).
  - `Softs/KIMI/Screens/` (pozostałe screenshoty: UX/flow/akcje do wyekstrahowania w dedicated plan).

### 4.4 Parity checklist vs Softs (approval-grade)
**Parity oznacza “KIMI split-screen document work model”, nie “pełny Word suite”.**

- **Split-screen anatomy (KIMI)**:
  - Chat i dokument są jednocześnie widoczne; użytkownik pracuje w “conversation + doc” bez przełączania kontekstu.
  - Dokument ma durable identity w sesji; opcjonalny zapis do `Outputs Library` nie może psuć UX.
- **Doc editing semantics (KIMI Docs)**:
  - Track changes + comments jako first-class mechanika pracy i review.
  - Export do Word/PDF ma jawne ograniczenia i jest “print-ready” w deklarowanym zakresie.
- **Governed run vs review separation (Wave2 doctrine)**:
  - Jeśli generacja/edycja uruchamia run: plan → approve(run) → wynik; review dokumentu to oddzielna oś (pozycja 18).
- **No guessing**:
  - Każda krytyczna akcja/skrót/stany split-screen muszą być zmapowane do dowodu w `Softs/KIMI/Screens` (lub oznaczone jako brakujące, jeśli nie ma dowodu).

### 4.5 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy: shared plans z sekcji 4.2 + `Softs/KIMI` evidence.

| Capability cluster (KIMI parity target) | What Softs implies | Current truth (contract) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Dedicated plan extraction | full UX mapped | “missing dedicated plan” | Wyciągnąć dedykowany plan `Wordy` z pełnym mappingiem screen-by-screen | P0 |
| Split-screen action grammar | shortcuts/states | “no guessing rule” | Spisać akcje/stany/skrótowce split-screen na podstawie Screens (zero interpretacji) | P0 |
| Optional Outputs save posture | session vs durable | “optional save” ambiguous | Ustalić i udowodnić flow: session draft ↔ save-to-library ↔ reopen | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Split-screen workflow działa end-to-end zgodnie z KIMI evidence (Screens + Docs posture).
- Track changes + comments (jeśli deklarowane w zakresie) są widoczne i zachowują się przewidywalnie.
- Opcjonalny zapis do `Outputs Library` nie tworzy drugiej prawdy: reopen działa z zachowanym lineage.

### 5.2 Tests
- Integracyjne: create/generate doc → edit → comment/track-change (bounded) → export → save to Outputs (optional) → reopen.
- Regression: export/download failure → czytelny stan + retry; brak “ghost outputs”.
- Contract tests: payload dla dokumentu zawiera provenance/run info gdy dotyczy (pozycja 18).

### 5.3 Staging proof checklist
- Nagranie: split-screen chat↔doc: generate → edit → export → optional save → reopen.
- Checklist: każdy krok ma “evidence pointer” do konkretnego screen lub doc reference w `Softs/KIMI`.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain: see section 3 + missing-input gate (playbook).
- KIMI evidence pointers: see section 4 (no guessing rule).
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P22-A — KIMI-style mapping + scope approval (blocking gate)
- **Goal**: przygotować approval-grade mapping KIMI Wordy (screen-by-screen) i zamrozić scope.
- **Inputs required**: kompletne `Softs/KIMI` evidence dla deklarowanych flows + decyzja o optional save-to-library.
- **Acceptance**: “zero interpretacji”; wszystkie akcje/stany mają evidence pointer; non-goals jawne.
- **Evidence**: linkowane screens + spisane actions/states.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Enumerate KIMI screens/artifacts used and link them (no guessing).
  - Extract actions/states/shortcuts into an approval-grade mapping (screen-by-screen).
  - Freeze optional save-to-library semantics vs Outputs Library (no split-truth).
- **DoD**:
  - Approved(scope): KIMI mapping is complete for declared flows; missing inputs explicitly block work.

#### P22-B — Split-screen doc workflow closure (bounded)
- **Goal**: generate→edit→comment/track-change (bounded)→export→optional save→reopen zgodnie z KIMI evidence.
- **Acceptance**: flow działa end-to-end; brak ghost outputs; provenance spójne z pozycją 18/19.
- **Evidence**: integracyjne testy + nagranie split-screen.
- **Tasks**:
  - Implement the bounded split-screen workflow exactly per mapped evidence.
  - Ensure provenance/trust-state + library convergence (18/19) and no ghost outputs on export.
  - Add integration/regression tests from section 5; record split-screen staging proof.
- **DoD**:
  - Split-screen recording demonstrates evidence-aligned behavior; exports and optional save are audytowalne.

#### P22-C — Verification + rollout
- **Goal**: regresje (export failures) + staging proof + rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Fill ledger rows P22-A/B/C with commits, tests, and split-screen proof.
  - Validate rollback: disable advanced edit/track-change; preserve read-only + export.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw minimalny flow P0 zgodny z evidence; dopiero potem rozszerzenia edycji (P1).

### 8.3 Rollback plan
- Wyłącz edycję/track-change; zachowaj read-only i export; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: brak dedykowanego planu KIMI → nie wolno implementować “na czuja”.
- Ryzyko: optional save tworzy split-truth vs `Outputs Library`.
- Decyzje: minimalny zakres track-changes/comments i jego ograniczenia.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P22-A |  |  |  |  |  |
| P22-B |  |  |  |  |  |
| P22-C |  |  |  |  |  |

