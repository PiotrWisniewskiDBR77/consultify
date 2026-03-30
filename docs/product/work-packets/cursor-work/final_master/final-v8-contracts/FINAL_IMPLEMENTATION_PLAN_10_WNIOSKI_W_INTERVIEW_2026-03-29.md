# Final Implementation Contract — Wnioski z interview (insights) (Position 10/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Wnioskowanie z odpowiedzi + kontekstu organizacji w sposób **audytowalny**: insight ma strukturę, wskazuje evidence, i ma jawne granice pewności.
- **Primary users**: operatorzy badań / consulting; decydenci konsumujący insights.
- **Success metric**: insight artifact ma strukturę + confidence/limits + daje się użyć do następnej decyzji i ma bridge do inicjatyw.

## 2. Scope
### 2.1 In-scope
- Insight readback jako artefakt: struktura findingów, evidence framing, confidence semantics.
- Downstream handoff do `Inicjatywy` / pracy operacyjnej na deklarowanych ścieżkach.

### 2.2 Out-of-scope / non-goals
- Pełna parity „research analytics platform”.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WNIOSKI_W_INTERVIEW_2026-03-29.md`
- Readiness: `docs/product/INTERVIEW_V8_READINESS_AUDIT.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje jako najbliższe benchmark family: `Softs/0 Ankiety` + `Softs/0 Projekty` (limitation opisana w planie).

### 4.2 Local Softs evidence (concrete artifacts — adjacent expectations)
- **Collection truth & governance (Typeform/SurveyMonkey via Ankiety)**:
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360057591531-Logic-Map.html` (Logic Map + troubleshooting: złożone ścieżki muszą być kontrolowalne).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/12978390412692-Webhooks-Troubleshooting-and-FAQ.html` (delivery posture: duplicate webhooks / at-least-once, retry gdy brak HTTP 200).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses.html` (export CSV/XLSX; eksport tylko filtrowanych/wybranych; export file uploads jako zip).
  - `Softs/0 Ankiety/Surveymonkey 2/help.surveymonkey.com/en/surveymonkey/create/skip-logic/index.html` (skip logic: różne ścieżki; consent/disqualification/multilingual).
- **Downstream action surfaces (Linear / Projekty family)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/triage.html` (triage jako “special inbox”: review/update/prioritize przed wejściem do workflow).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/developers/agent-signals.html` (signals jako metadane intencji — downstream powinien rozumieć jak interpretować wynik).

### 4.3 Missing input (must remain explicit)
- **Dovetail / Condens-class insight products**: zgodnie z planem (`WAVE1_FINAL_IMPLEMENTATION_PLAN_WNIOSKI_W_INTERVIEW_2026-03-29.md`) **Softs corpus nie zawiera bezpośredniego benchmarku** → insight-depth parity jest tu prowadzone głównie przez readiness/SSOT, a Softs służy tylko do oczekiwań “adjacent”.

### 4.4 Parity checklist vs Softs (approval-grade, within limitation)
**Parity oznacza “actionable insight artifact z evidence + confidence”, nie “pełna platforma research analytics”.**

- **Evidence traceability to collection (Ankiety Softs adjacency)**:
  - Każdy finding musi dać się cofnąć do: źródła (survey/interview), subsetu odpowiedzi, i/lub artefaktu wejściowego (export/link).
  - System musi być odporny na “at-least-once” delivery i duplikaty wejścia (bez psucia evidence framing).
- **Operator review flow (Linear triage analogy)**:
  - Insight powstaje przez review/triage: operator widzi “co jest kandydatem na finding”, dopina evidence, i publikuje artifact.
- **Intent metadata for downstream (agent signals analogy)**:
  - Finding/insight powinien mieć metadane intencji: “co z tym zrobić dalej” + proponowany handoff do `Inicjatywy`.

### 4.5 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_WNIOSKI_W_INTERVIEW_2026-03-29.md` + readiness `INTERVIEW_V8_READINESS_AUDIT.md`.

| Capability cluster (parity target) | What “good” implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Artifact structure | findings grouped, evidence framed | “structure too light” | Ustalić strukturę insight artefaktu (finding/evidence/limit/next action) | P0 |
| Confidence & limits | explicit uncertainty boundaries | “confidence semantics not deep enough” | Zdefiniować confidence/limits jako kontrakt UI+data (bez overclaim) | P0 |
| Actionability → Inicjatywy | clear handoff | “downstream actionability partial” | Domknąć handoff z findingu do inicjatywy z zachowaniem sensu | P0 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Insight ma jawny confidence/limits; user może przejść z findingu do inicjatywy bez utraty sensu.
- Finding ma evidence pointers (responses/subset/attachments/exports) i nie jest “gołym podsumowaniem bez źródeł”.
- System nie myli “collection completed” z “insight ready” — istnieje jawny review/publish state.

### 5.2 Tests
- Integracyjne: ankieta/interview input → insight draft → review/publish → handoff do `Inicjatywy`.
- Contract tests: confidence/limits + evidence pointers renderują się spójnie i nie znikają przy edycjach.
- Regression: duplikaty wejścia / partial submissions (jeśli w zakresie) nie psują evidence ledger.

### 5.3 Staging proof checklist
- Demo: „survey/interview → insight → initiative handoff” z co najmniej 2 findingami o różnych confidence levels.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (readiness/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P10-A — Insight artifact canon + scope approval
- **Goal**: insight jako audytowalny artefakt (finding/evidence/limits/next action).
- **Inputs required**: confidence/limits contract + evidence pointers; handoff do `Inicjatywy`.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no overclaim” zasada spisana.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze artifact structure (finding/evidence/limits/next action) and confidence levels semantics.
  - Freeze evidence pointers rules (what is linkable; how we prevent “source loss” on edits).
  - Freeze handoff payload to `Inicjatywy` (what context travels, bounded).
- **DoD**:
  - Approved(scope): “no overclaim” is enforceable; artifact is audytowalny and testable.

#### P10-B — Review/publish + handoff closure
- **Goal**: draft→review→publish state + stable handoff do inicjatywy.
- **Acceptance**: user przechodzi finding→initiative bez utraty sensu; evidence pointers nie znikają po edycji.
- **Evidence**: integracyjne testy + staging demo.
- **Tasks**:
  - Implement review/publish state machine (bounded) and stable handoff to initiatives.
  - Ensure evidence pointers persist across edits; add contract tests for payload stability.
  - Run staging demo (5.3) with 2 findings of different confidence.
- **DoD**:
  - Handoff is stable; evidence pointers persist; confidence/limits visible and consistent.

#### P10-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P10-A/B/C.
  - Validate rollback: disable publish/handoff automations; preserve read-only insights.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw read-only artifact + review, potem automatyzacje/AI assist (jeśli P1).

### 8.3 Rollback plan
- Wyłącz publish/handoff automations; zachowaj read access do insightów; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: insight bez evidence pointers (nieaudytowalny).
- Ryzyko: mylenie “collection done” z “insight ready”.
- Decyzje: minimalna skala confidence levels + ich semantyka.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P10-A |  |  |  |  |  |
| P10-B |  |  |  |  |  |
| P10-C |  |  |  |  |  |

