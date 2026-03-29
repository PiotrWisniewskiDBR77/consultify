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

