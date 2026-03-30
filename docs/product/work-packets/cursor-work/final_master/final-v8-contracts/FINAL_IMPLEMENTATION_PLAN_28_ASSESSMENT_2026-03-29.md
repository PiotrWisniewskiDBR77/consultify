# Final Implementation Contract — Assessment (Position 28/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Assessment AI‑driven, wykonywalne przez czat.
- **Primary users**: konsultanci prowadzący diagnostykę; odbiorcy wyników.
- **Success metric**: jedna spójna rodzina assessment: choose → run workbench → evidence/scoring → interpret → promote into action/outputs.

## 2. Scope
### 2.1 In-scope
- Shared assessment workbench + state model.
- Evidence/scoring/interpretation governance.
- Promotion wyników do pracy/artefaktów.

### 2.2 Out-of-scope / non-goals
- Parity z każdą metodologią/diagnostic platform w 1 kroku.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md`

### 4.2 Local Softs evidence (concrete artifacts)
- **Typeform (reporting + branching logic + export + AI insights posture)**:
  - `Softs/0 Ankiety/typerform 1/www.typeform.com/reporting.html` (reporting surface posture).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029116392-What-is-branching-logic.html` (branching logic).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360057591531-Logic-Map.html` (logic map as an explainable structure).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029251552-Create-and-share-your-responses-report.html` (responses report).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses.html` + `.../41990885069716-Export-Results-Summary-to-a-CSV.html` (export posture).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/23542072977172-Get-AI-analysis-of-your-results-with-Smart-Insights.html` (AI insights posture).
- **SurveyMonkey (survey templates as a packaged starting point)**:
  - `Softs/0 Ankiety/typerform 1/www.typeform.com/templates-sub-category/evaluation-surveys.html` (template categories: evaluation posture as “choose starting frame”).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “one assessment family + shared workbench + action loop”, nie “kolejny survey builder”.**

- **Choose → run → interpret in one workbench (Wave2 doctrine)**:
  - Wybór metodologii prowadzi do jednej spójnej sesji (shared workbench), nie do rozproszonych flow.
- **Explainable logic and scoring (Typeform logic map posture)**:
  - Logika (branching/scoring) jest zrozumiała, debugowalna i nie jest “black box”.
- **Evidence-first and honest scoring (plan)**:
  - Scoring/interpretacja wymagają evidence pointers albo jawnych assumptions (bounded honesty).
- **Export/reporting posture (Typeform reporting/export)**:
  - Wynik ma report view + export; brak “export-only claims”.
- **AI insights under governance (Typeform smart insights posture + Wave2)**:
  - AI proponuje interpretację i next steps jako propozycje; user zatwierdza; brak overclaim.
- **Promotion into action (Wave2)**:
  - Wyniki kończą się akcją: inicjatywy/tasks/reports/decks, z traceability.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Shared family packaging | one coherent product | “family packaging weak” | Zbudować jeden shell i język rodziny Assessment | P0 |
| Shared workbench | unified runtime | “workbench not explicit enough” | Ujednolicić state model + evidence/scoring grammar | P0 |
| Governance visibility | AI + scoring honest | “needs stronger final contract” | Ujawnić governance scoring/AI/interpretation w UI i payloadach | P0 |
| Action loop continuity | results → action | “downstream continuity needs closure” | Dopiąć promotion do work/outputs z traceability | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Workbench jest spójny; scoring/interpretation ma governance; wyniki stają się akcją.
- Logika (branching/scoring) jest explainable i nie degraduje się do “black box”.
- AI interpretacja ma tryb propose→review→accept oraz evidence pointers tam gdzie dotyczy.

### 5.2 Tests
- Integracyjne: choose methodology → run workbench → evidence capture → scoring → interpretation → promote to initiatives/report.
- Regression: brak danych/evidence → czytelny degraded state + “what to do next”.
- Contract tests: assessment payload zawiera state + scoring rationale + evidence pointers + promotion trace.

### 5.3 Staging proof checklist
- Demo: 1 metodologia end-to-end (z branching/scoring) + promotion do inicjatyw.
- Demo: AI insights proposal → review → accept/reject + widoczna różnica w final report.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Assessment SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P28-A — Assessment family canon + workbench grammar (scope approval)
- **Goal**: jeden shell i język Assessment (workbench + scoring/evidence) z jawnej governance.
- **Inputs required**: scoring rationale + evidence pointers contract; promotion target (initiatives/reports).
- **Acceptance**: scope zatwierdzony; non-goals jawne; AI interpretacja = propose→review→accept.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze assessment shell/workbench grammar (state model + evidence capture + scoring).
  - Freeze scoring rationale and explainability rules (no black box).
  - Freeze promotion contract to initiatives/reports with traceability (bounded).
- **DoD**:
  - Approved(scope): workbench and scoring governance are explicit and testable.

#### P28-B — Methodology run→evidence→score→interpret→promote closure
- **Goal**: domknąć E2E metodologię na jednym workbench.
- **Acceptance**: branching/scoring jest explainable; degraded (missing evidence) daje “what next”.
- **Evidence**: integracyjne testy + staging demo 1 metodologii.
- **Tasks**:
  - Implement 1 methodology end-to-end on the unified workbench (bounded).
  - Implement degraded states for missing evidence with explicit “what next”.
  - Add integration/regression + contract tests and run staging demo (5.3).
- **Staging proof script (click-by-click)**:
  1. Choose one methodology and start an assessment run in the workbench.
  2. Capture evidence inputs (bounded) and observe scoring with explainable rationale.
  3. Trigger a missing-evidence case and verify degraded state + “what next” guidance.
  4. Generate AI interpretation as proposal → review → accept/reject; verify differences are visible.
  5. Promote results to an initiative/report and verify traceability (run→artifact→promotion).
- **DoD**:
  - Methodology run is explainable; results can be promoted with traceability; demos recorded.

#### P28-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P28-A/B/C.
  - Validate rollback: disable AI interpretations/promotions; preserve workbench read-only.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw 1 metodologia P0, potem rozszerzenia family packaging (P1).

### 8.3 Rollback plan
- Wyłącz AI interpretacje/promotions; zachowaj workbench read-only; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: scoring jako black box (brak zaufania).
- Ryzyko: brak jednego workbench → rodzina niespójna.
- Decyzje: minimalny scoring grammar i format evidence pointers.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P28-A |  |  |  |  |  |
| P28-B |  |  |  |  |  |
| P28-C |  |  |  |  |  |

